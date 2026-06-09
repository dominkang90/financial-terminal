from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx
import secrets
import urllib.parse

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    get_current_user_id, require_user,
)
from app.core.config import settings
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


# ─── OAuth 공통 헬퍼 ────────────────────────────────────────────────────────

def _oauth_popup_response(token: str, error: str | None = None) -> HTMLResponse:
    """팝업 창에서 부모 창으로 결과를 전달하는 HTML 응답"""
    if error:
        script = f"""
        <script>
          window.opener && window.opener.postMessage({{type:'oauth_error',error:{error!r}}}, '*');
          window.close();
        </script>
        """
    else:
        script = f"""
        <script>
          window.opener && window.opener.postMessage({{type:'oauth_success',token:{token!r}}}, '*');
          window.close();
        </script>
        """
    return HTMLResponse(f"<html><body>{script}</body></html>")


async def _find_or_create_oauth_user(
    db: AsyncSession,
    email: str,
    username: str,
    provider: str,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        base = username.replace(" ", "_")[:20] or provider
        candidate = base
        idx = 1
        while True:
            exists = await db.execute(select(User).where(User.username == candidate))
            if not exists.scalar_one_or_none():
                break
            candidate = f"{base}_{idx}"
            idx += 1
        user = User(
            email=email,
            username=candidate,
            hashed_password=hash_password(secrets.token_hex(16)),
            settings={"theme": "dark", "language": "ko", "oauth_provider": provider},
            watchlist=["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"],
            layout_config={},
        )
        db.add(user)
        await db.flush()
    return user


# ─── Google OAuth ───────────────────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/oauth/google/start")
async def google_oauth_start():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth가 설정되지 않았습니다 (GOOGLE_CLIENT_ID 미설정)")
    redirect_uri = f"{settings.oauth_base}/api/auth/oauth/google/callback"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    url = f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/oauth/google/callback")
async def google_oauth_callback(code: str | None = None, error: str | None = None, db: AsyncSession = Depends(get_db)):
    if error or not code:
        return _oauth_popup_response("", error or "access_denied")
    redirect_uri = f"{settings.oauth_base}/api/auth/oauth/google/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            return _oauth_popup_response("", "token_exchange_failed")
        access_token = token_res.json().get("access_token")
        info_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if info_res.status_code != 200:
            return _oauth_popup_response("", "userinfo_failed")
        info = info_res.json()

    email = info.get("email", "")
    name = info.get("name", "") or email.split("@")[0]
    user = await _find_or_create_oauth_user(db, email, name, "google")
    jwt = create_access_token(user.id)
    return _oauth_popup_response(jwt)


# ─── Kakao OAuth ────────────────────────────────────────────────────────────

KAKAO_AUTH_URL = "https://kauth.kakao.com/oauth/authorize"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USERINFO_URL = "https://kapi.kakao.com/v2/user/me"


@router.get("/oauth/kakao/start")
async def kakao_oauth_start():
    if not settings.KAKAO_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Kakao OAuth가 설정되지 않았습니다 (KAKAO_CLIENT_ID 미설정)")
    redirect_uri = f"{settings.oauth_base}/api/auth/oauth/kakao/callback"
    params = {
        "client_id": settings.KAKAO_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
    }
    url = f"{KAKAO_AUTH_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url)


@router.get("/oauth/kakao/callback")
async def kakao_oauth_callback(code: str | None = None, error: str | None = None, db: AsyncSession = Depends(get_db)):
    if error or not code:
        return _oauth_popup_response("", error or "access_denied")
    redirect_uri = f"{settings.oauth_base}/api/auth/oauth/kakao/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(KAKAO_TOKEN_URL, data={
            "grant_type": "authorization_code",
            "client_id": settings.KAKAO_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "code": code,
            **({"client_secret": settings.KAKAO_CLIENT_SECRET} if settings.KAKAO_CLIENT_SECRET else {}),
        })
        if token_res.status_code != 200:
            return _oauth_popup_response("", "token_exchange_failed")
        access_token = token_res.json().get("access_token")
        info_res = await client.get(KAKAO_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        if info_res.status_code != 200:
            return _oauth_popup_response("", "userinfo_failed")
        info = info_res.json()

    kakao_account = info.get("kakao_account", {})
    email = kakao_account.get("email", f"kakao_{info['id']}@kakao.local")
    nickname = info.get("properties", {}).get("nickname", "") or str(info["id"])
    user = await _find_or_create_oauth_user(db, email, nickname, "kakao")
    jwt = create_access_token(user.id)
    return _oauth_popup_response(jwt)
