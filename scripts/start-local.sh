#!/bin/bash
# FinTerminal 로컬 개발 서버 시작 스크립트

set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
echo "▶ FinTerminal 로컬 시작 (디렉토리: $ROOT)"

# .env 확인
if [ ! -f "$ROOT/.env" ]; then
  echo "⚠️  .env 파일이 없습니다. .env.example을 복사합니다..."
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "✅ .env 생성됨. 필요한 경우 API 키를 입력해주세요."
fi

# 백엔드 가상환경 설정
if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "▶ Python 가상환경 생성..."
  python3 -m venv "$ROOT/backend/.venv"
fi

source "$ROOT/backend/.venv/bin/activate"
echo "▶ Python 패키지 설치..."
pip install -q -r "$ROOT/backend/requirements.txt"

# 백엔드 백그라운드 시작
echo "▶ 백엔드 시작 (http://localhost:8000)..."
cd "$ROOT/backend"
cp "$ROOT/.env" . 2>/dev/null || true
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 프론트엔드 의존성 설치
echo "▶ 프론트엔드 패키지 설치..."
cd "$ROOT/frontend"
npm install --silent

# 프론트엔드 시작
echo "▶ 프론트엔드 시작 (http://localhost:5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "═══════════════════════════════════════"
echo " FinTerminal 실행 중"
echo " 프론트엔드: http://localhost:5173"
echo " 백엔드 API: http://localhost:8000"
echo " API 문서:   http://localhost:8000/api/docs"
echo " 종료: Ctrl+C"
echo "═══════════════════════════════════════"

# Ctrl+C 시 모두 종료
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
