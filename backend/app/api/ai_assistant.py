from fastapi import APIRouter, Depends
from typing import Optional
from pydantic import BaseModel

from app.core.security import get_current_user_id
from app.services.ai_service import analyze_stock, chat_with_ai
from app.services.market_service import get_quote
from app.services.news_service import get_news

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    symbol: Optional[str] = None
    api_key: Optional[str] = None


class AnalyzeRequest(BaseModel):
    symbol: str
    api_key: Optional[str] = None


@router.post("/analyze")
async def analyze(req: AnalyzeRequest, user_id: Optional[int] = Depends(get_current_user_id)):
    quote = await get_quote(req.symbol.upper())
    news = await get_news(req.symbol.upper(), limit=10)
    return await analyze_stock(
        symbol=req.symbol.upper(),
        quote=quote,
        news=news,
        user_api_key=req.api_key,
    )


@router.post("/chat")
async def chat(req: ChatRequest, user_id: Optional[int] = Depends(get_current_user_id)):
    context = {}
    if req.symbol:
        context["symbol"] = req.symbol
        context["quote"] = await get_quote(req.symbol.upper())
    return await chat_with_ai(req.message, context, req.api_key)
