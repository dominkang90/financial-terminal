from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional, List
import asyncio

from app.core.database import get_db
from app.core.security import require_user
from app.models.portfolio import Portfolio, Position, Trade
from app.services.market_service import get_batch_quotes

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PositionCreate(BaseModel):
    symbol: str
    market: str = "US"
    quantity: float
    avg_cost: float
    currency: str = "USD"
    notes: Optional[str] = None


class TradeCreate(BaseModel):
    portfolio_id: int
    symbol: str
    side: str  # buy / sell
    quantity: float
    price: float
    currency: str = "USD"
    is_paper: bool = True


@router.get("/")
async def list_portfolios(user_id: int = Depends(require_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    return result.scalars().all()


@router.post("/")
async def create_portfolio(
    body: dict,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = Portfolio(
        user_id=user_id,
        name=body.get("name", "내 포트폴리오"),
        is_paper=body.get("is_paper", True),
        cash_balance=body.get("cash_balance", 0.0),
    )
    db.add(portfolio)
    await db.flush()
    return portfolio


@router.get("/{portfolio_id}/positions")
async def get_positions(
    portfolio_id: int,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Position).where(
            Position.portfolio_id == portfolio_id,
            Position.user_id == user_id,
        )
    )
    positions = result.scalars().all()

    symbols = [p.symbol for p in positions]
    quotes = {}
    if symbols:
        quotes = await get_batch_quotes(symbols)

    enriched = []
    total_value = 0.0
    total_cost = 0.0

    for pos in positions:
        q = quotes.get(pos.symbol, {})
        current_price = q.get("price", pos.avg_cost)
        market_value = current_price * pos.quantity
        cost_basis = pos.avg_cost * pos.quantity
        pnl = market_value - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis else 0

        total_value += market_value
        total_cost += cost_basis

        enriched.append({
            "id": pos.id,
            "symbol": pos.symbol,
            "market": pos.market,
            "quantity": pos.quantity,
            "avg_cost": pos.avg_cost,
            "current_price": round(current_price, 4),
            "market_value": round(market_value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "currency": pos.currency,
            "notes": pos.notes,
            "quote_status": q.get("data_status", "no_data"),
            "sector": q.get("sector"),
            "name": q.get("name", pos.symbol),
        })

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost else 0

    return {
        "positions": enriched,
        "summary": {
            "total_market_value": round(total_value, 2),
            "total_cost_basis": round(total_cost, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 2),
        },
    }


@router.post("/{portfolio_id}/positions")
async def add_position(
    portfolio_id: int,
    req: PositionCreate,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio or portfolio.user_id != user_id:
        raise HTTPException(status_code=404, detail="포트폴리오를 찾을 수 없습니다")

    # 기존 포지션 확인
    existing = await db.execute(
        select(Position).where(
            Position.portfolio_id == portfolio_id,
            Position.symbol == req.symbol.upper(),
        )
    )
    pos = existing.scalar_one_or_none()

    if pos:
        # 평균 단가 업데이트
        total_qty = pos.quantity + req.quantity
        pos.avg_cost = (pos.avg_cost * pos.quantity + req.avg_cost * req.quantity) / total_qty
        pos.quantity = total_qty
    else:
        pos = Position(
            portfolio_id=portfolio_id,
            user_id=user_id,
            symbol=req.symbol.upper(),
            market=req.market,
            quantity=req.quantity,
            avg_cost=req.avg_cost,
            currency=req.currency,
            notes=req.notes,
        )
        db.add(pos)

    await db.flush()
    return {"ok": True, "position_id": pos.id}


@router.delete("/{portfolio_id}/positions/{position_id}")
async def delete_position(
    portfolio_id: int,
    position_id: int,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Position).where(
            Position.id == position_id,
            Position.user_id == user_id,
        )
    )
    return {"ok": True}


@router.post("/trade")
async def record_trade(
    req: TradeCreate,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    # Paper trading 기록
    trade = Trade(
        portfolio_id=req.portfolio_id,
        user_id=user_id,
        symbol=req.symbol.upper(),
        side=req.side,
        quantity=req.quantity,
        price=req.price,
        currency=req.currency,
        is_paper=req.is_paper,
        status="filled",
    )
    db.add(trade)

    # 포지션 업데이트
    if req.side == "buy":
        existing = await db.execute(
            select(Position).where(
                Position.portfolio_id == req.portfolio_id,
                Position.symbol == req.symbol.upper(),
            )
        )
        pos = existing.scalar_one_or_none()
        if pos:
            total_qty = pos.quantity + req.quantity
            pos.avg_cost = (pos.avg_cost * pos.quantity + req.price * req.quantity) / total_qty
            pos.quantity = total_qty
        else:
            db.add(Position(
                portfolio_id=req.portfolio_id,
                user_id=user_id,
                symbol=req.symbol.upper(),
                quantity=req.quantity,
                avg_cost=req.price,
                currency=req.currency,
            ))
    elif req.side == "sell":
        existing = await db.execute(
            select(Position).where(
                Position.portfolio_id == req.portfolio_id,
                Position.symbol == req.symbol.upper(),
            )
        )
        pos = existing.scalar_one_or_none()
        if pos:
            pos.quantity -= req.quantity
            if pos.quantity <= 0:
                await db.delete(pos)

    await db.flush()
    return {"ok": True, "trade_id": trade.id, "is_paper": req.is_paper}
