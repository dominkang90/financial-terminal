from fastapi import APIRouter, Query
from typing import Optional, List
from app.services.market_service import (
    get_quote, get_batch_quotes, get_indices,
    get_forex, get_commodities, get_rates,
    get_chart_data, search_symbols, get_options_chain, get_etf_holdings,
    get_stock_fundamentals,
)

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}")
async def quote(symbol: str):
    return await get_quote(symbol.upper())


@router.post("/quotes")
async def batch_quotes(body: dict):
    symbols = body.get("symbols", [])
    if not symbols or len(symbols) > 50:
        return {"error": "symbols는 1~50개 사이여야 합니다"}
    return await get_batch_quotes([s.upper() for s in symbols])


@router.get("/indices")
async def indices():
    return await get_indices()


@router.get("/forex")
async def forex():
    return await get_forex()


@router.get("/commodities")
async def commodities():
    return await get_commodities()


@router.get("/rates")
async def rates():
    return await get_rates()


@router.get("/chart/{symbol}")
async def chart(
    symbol: str,
    period: str = Query("6mo", description="1mo 3mo 6mo 1y 2y 5y 10y"),
    interval: str = Query("1d", description="1d 1wk 1mo"),
):
    return await get_chart_data(symbol.upper(), period, interval)


@router.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(20, le=50)):
    return await search_symbols(q, limit)


@router.get("/options/{symbol}")
async def options(symbol: str):
    return await get_options_chain(symbol.upper())


@router.get("/etf/{symbol}/holdings")
async def etf_holdings(symbol: str):
    return await get_etf_holdings(symbol.upper())


@router.get("/fundamentals/{symbol}")
async def fundamentals(symbol: str):
    return await get_stock_fundamentals(symbol.upper())
