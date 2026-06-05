from fastapi import APIRouter, Query, Depends
from typing import Optional
from app.services.news_service import get_news, get_youtube_market_videos, translate_with_gemini
from app.core.security import get_current_user_id

router = APIRouter(prefix="/news", tags=["news"])


@router.get("/")
async def news(
    symbol: Optional[str] = Query(None),
    limit: int = Query(30, le=100),
):
    return await get_news(symbol, limit)


@router.get("/videos")
async def news_videos(
    topic: str = Query("all"),
    limit: int = Query(24, le=60),
):
    return await get_youtube_market_videos(limit=limit, topic=topic)


@router.post("/translate")
async def translate(body: dict, user_id: Optional[int] = Depends(get_current_user_id)):
    text = body.get("text", "")
    user_api_key = body.get("api_key")
    if not text:
        return {"translation": None, "error": "text가 필요합니다"}
    result = await translate_with_gemini(text, user_api_key)
    if result is None:
        return {"translation": None, "note": "Gemini API 키가 필요합니다"}
    return {"translation": result}
