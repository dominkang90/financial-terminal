from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user_id, require_user,
)
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")

    existing_user = await db.execute(select(User).where(User.username == req.username))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="이미 사용 중인 사용자명입니다")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 최소 8자 이상이어야 합니다")

    user = User(
        email=req.email,
        username=req.username,
        hashed_password=hash_password(req.password),
        settings={
            "theme": "dark",
            "default_symbol": "AAPL",
            "language": "ko",
            "notifications": True,
        },
        watchlist=["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"],
        layout_config={},
    )
    db.add(user)
    await db.flush()

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user={"id": user.id, "email": user.email, "username": user.username},
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="비활성화된 계정입니다")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user={"id": user.id, "email": user.email, "username": user.username},
    )


@router.get("/me")
async def me(
    user_id: Optional[int] = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if not user_id:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "settings": user.settings,
        "watchlist": user.watchlist,
        "layout_config": user.layout_config,
    }


@router.put("/settings")
async def update_settings(
    body: dict,
    user_id: int = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)

    if "settings" in body:
        user.settings = {**(user.settings or {}), **body["settings"]}
    if "watchlist" in body:
        user.watchlist = body["watchlist"]
    if "layout_config" in body:
        user.layout_config = body["layout_config"]

    return {"ok": True}
