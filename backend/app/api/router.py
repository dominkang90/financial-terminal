from fastapi import APIRouter
from app.api import auth, market, news, portfolio, ai_assistant

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(market.router)
api_router.include_router(news.router)
api_router.include_router(portfolio.router)
api_router.include_router(ai_assistant.router)
