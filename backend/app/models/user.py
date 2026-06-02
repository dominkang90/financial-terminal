from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 개인 설정 (JSON으로 저장)
    settings = Column(JSON, default=dict)
    # 레이아웃 설정
    layout_config = Column(JSON, default=dict)
    # 관심종목
    watchlist = Column(JSON, default=list)
    # API 키 (암호화 저장 권장 - 현재는 base64 힌트만)
    api_keys_encrypted = Column(Text, nullable=True)


class UserAPIKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    provider = Column(String, nullable=False)  # gemini, alpaca, finnhub 등
    # 실제 운영에서는 암호화 필수
    encrypted_key = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
