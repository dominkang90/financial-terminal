import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import create_tables

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _warmup_youtube_news() -> None:
    try:
        from app.services.news_service import get_youtube_market_videos
        await get_youtube_market_videos(limit=30, topic="all")
        logger.info("YouTube 뉴스 워밍업 완료")
    except Exception as exc:
        logger.warning("YouTube 뉴스 워밍업 실패: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Financial Terminal API 시작")
    await create_tables()
    asyncio.create_task(_warmup_youtube_news())
    yield
    logger.info("Financial Terminal API 종료")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "frontend_url": settings.FRONTEND_URL,
    }
