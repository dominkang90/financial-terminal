from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Financial Terminal"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production-min-32-chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./financial_terminal.db"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Redis (optional - falls back to in-memory cache if not set)
    REDIS_URL: Optional[str] = None

    # External APIs (all optional)
    FINNHUB_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    NEWS_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    OPENAI_API_KEY: Optional[str] = None

    # Broker APIs (optional)
    ALPACA_API_KEY: Optional[str] = None
    ALPACA_SECRET_KEY: Optional[str] = None
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"  # paper trading default

    # Korean APIs
    DART_API_KEY: Optional[str] = None
    KIS_APP_KEY: Optional[str] = None  # 한국투자증권
    KIS_APP_SECRET: Optional[str] = None

    # Cache TTL (seconds)
    QUOTE_CACHE_TTL: int = 15
    NEWS_CACHE_TTL: int = 300
    CHART_CACHE_TTL: int = 60
    INDEX_CACHE_TTL: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
