@echo off
setlocal

echo ▶ FinTerminal 로컬 시작 (Windows)

set ROOT=%~dp0..

:: .env 확인
if not exist "%ROOT%\.env" (
    echo .env 파일이 없습니다. .env.example을 복사합니다...
    copy "%ROOT%\.env.example" "%ROOT%\.env"
    echo .env 생성됨.
)

:: 백엔드
cd /d "%ROOT%\backend"
if not exist ".venv" (
    echo Python 가상환경 생성 중...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt
copy "%ROOT%\.env" . >nul 2>&1

echo 백엔드 시작 중...
start "FinTerminal Backend" cmd /k "cd /d %ROOT%\backend && .venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: 프론트엔드
cd /d "%ROOT%\frontend"
if not exist "node_modules" (
    echo npm install 중...
    npm install
)

echo 프론트엔드 시작 중...
start "FinTerminal Frontend" cmd /k "cd /d %ROOT%\frontend && npm run dev"

echo.
echo ═══════════════════════════════════════════
echo  FinTerminal 실행 중
echo  프론트엔드: http://localhost:5173
echo  백엔드 API: http://localhost:8000/api/docs
echo ═══════════════════════════════════════════
echo.
pause
