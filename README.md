# FinTerminal — 한국어 금융 터미널

> 미국 주식 투자자를 위한 한국어 기반 고밀도 금융 터미널.  
> Bloomberg Terminal 스타일의 UI, 실제 시장 데이터, AI 분석, 포트폴리오 관리를 제공합니다.

---

## 📸 주요 기능

| 기능 | 설명 |
|------|------|
| **실시간 시세** | 미국/한국 주식, ETF, 지수, 환율, 원자재, 금리 |
| **캔들 차트** | 이동평균(MA20/60), 거래량, 기간/인터벌 선택 |
| **뉴스 + 번역** | Yahoo Finance RSS + Finnhub, Gemini 한국어 번역 |
| **AI 어시스턴트** | Gemini 기반 종목 분석 / 채팅 (없으면 규칙 기반) |
| **포트폴리오** | 포지션 관리, 손익 계산, 실시간 평가 |
| **옵션 체인** | 콜/풋 옵션 표시, 행사가·IV·OI |
| **Paper Trading** | 모의 매매 기본, 실거래 별도 설정 |
| **JWT 인증** | 회원가입/로그인, 설정 저장, API 키 관리 |

---

## 🚀 빠른 시작

### 방법 1: 로컬 직접 실행

**필수 조건:** Python 3.11+, Node.js 18+

```bash
# 프로젝트 폴더로 이동
cd financial-terminal

# Linux/Mac
chmod +x scripts/start-local.sh
./scripts/start-local.sh

# Windows
scripts\start-windows.bat
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:8000
- API 문서: http://localhost:8000/api/docs

### 방법 2: Docker Compose

```bash
cd financial-terminal

# .env 파일 생성
cp .env.example .env
# .env에서 SECRET_KEY 반드시 변경!

# 실행
docker compose up -d

# 로그 확인
docker compose logs -f

# 중단
docker compose down
```

---

## 🔑 API 키 설정

데이터가 없으면 `"데이터 없음"` / `"API 키 필요"` 로 명확히 표시합니다.  
**가짜 숫자는 절대 표시하지 않습니다.**

### 필수 (없어도 기본 동작)

| API | 용도 | 발급처 | 비용 |
|-----|------|--------|------|
| **없음** | yfinance (주가, 차트) | 자동 사용 | 무료 |
| **없음** | Yahoo Finance RSS (뉴스) | 자동 사용 | 무료 |

### 선택 (기능 확장)

| API | 용도 | 발급처 | 비용 |
|-----|------|--------|------|
| **Gemini API** | AI 분석, 뉴스 번역 | [aistudio.google.com](https://aistudio.google.com/apikey) | 무료 티어 |
| **Finnhub** | 더 많은 뉴스, 빠른 데이터 | [finnhub.io](https://finnhub.io) | 무료 (60req/분) |
| **Alpha Vantage** | 경제 지표, 추가 데이터 | [alphavantage.co](https://www.alphavantage.co) | 무료 (25req/일) |

### 브로커 연동 (거래)

| API | 용도 | 발급처 |
|-----|------|--------|
| **Alpaca** | 미국 주식 Paper/실거래 | [alpaca.markets](https://alpaca.markets) |
| **한국투자증권** | 국내 주식 | [apiportal.koreainvestment.com](https://apiportal.koreainvestment.com) |
| **DART** | 한국 공시 | [opendart.fss.or.kr](https://opendart.fss.or.kr) |

### 설정 방법

1. `.env` 파일에서 서버 전체 설정
2. UI 우상단 ⚙️ 설정 → API 키 탭에서 개인별 설정 (브라우저 저장)

---

## 📊 데이터 출처 및 신뢰도

```
[실시간]     → 거래 중 실시간 (Finnhub Pro 등)
[지연 15분]  → yfinance, Yahoo Finance (기본)
[지연]       → 30분~수 시간
[데이터 없음] → 해당 종목 데이터 없음
[API 키 필요] → API 키가 있어야 조회 가능
[오류]       → 네트워크 오류 등
```

---

## 🏗️ 아키텍처

```
프론트엔드 (React + Vite)    포트 5173 (개발) / 80 (운영)
    ↕ HTTP + JWT
백엔드 (FastAPI)              포트 8000
    ↕
yfinance / Finnhub / RSS     (외부 API)
    ↕
SQLite (개발) / PostgreSQL (운영)
```

### 프로젝트 구조

```
financial-terminal/
├── backend/
│   ├── main.py               FastAPI 진입점
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── core/             설정, 보안, DB
│       ├── api/              라우터 (market, news, portfolio, ai, auth)
│       ├── models/           SQLAlchemy 모델
│       └── services/         비즈니스 로직 (market, news, ai)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar/       상단 메뉴, 검색, 지수 스트립
│   │   │   ├── pages/        Markets, Chart, News, Portfolio, Options, AI, Orders
│   │   │   ├── widgets/      StockChart, WatchList, NewsFeed, Portfolio ...
│   │   │   ├── common/       DataStatus, 공통 컴포넌트
│   │   │   └── auth/         로그인, 설정 모달
│   │   ├── store/            Zustand 상태 관리
│   │   ├── api/              Axios API 클라이언트
│   │   └── types/            TypeScript 타입 정의
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── scripts/
    ├── start-local.sh
    └── start-windows.bat
```

---

## 🔐 보안 주의사항

1. **`SECRET_KEY`**: 반드시 32자 이상 랜덤 문자열로 변경
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```

2. **API 키 저장**: 브라우저 localStorage에 저장됨. 공용 PC 사용 후 로그아웃 필수.

3. **실거래 모드**: 설정에서 명시적으로 활성화해야 함. Paper Trading이 기본.

4. **HTTPS**: 운영 서버에서는 반드시 HTTPS 사용 (Nginx + Let's Encrypt 권장).

5. **CORS**: `.env`의 `CORS_ORIGINS`를 실제 도메인으로 제한.

---

## 🛠️ 개발

### 백엔드만 실행

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn main:app --reload
```

### 프론트엔드만 실행

```bash
cd frontend
npm install
npm run dev
```

### API 문서

http://localhost:8000/api/docs (Swagger UI)

---

## 📦 운영 서버 배포

### Nginx + HTTPS (권장)

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5173;  # 또는 프론트엔드 정적 파일
    }
    location /api/ {
        proxy_pass http://localhost:8000;
    }
}
```

### PostgreSQL로 전환

```bash
# .env 수정
DATABASE_URL=postgresql+asyncpg://finterminal:password@localhost/finterminal

# docker-compose.yml에서 postgres 서비스 주석 해제
```

---

## 🤖 AI 기능 설정

### Gemini API 연결

1. [aistudio.google.com](https://aistudio.google.com/apikey)에서 API 키 발급 (무료)
2. FinTerminal 설정 → API 키 → Gemini API 키 입력
3. AI 어시스턴트 탭에서 바로 사용 가능

### API 키 없을 때

- 뉴스 번역: "Gemini API 키가 필요합니다" 메시지 표시
- AI 분석: 규칙 기반 간단 분석 제공 (P/E, 등락률 기반)
- AI 채팅: "API 키를 입력해주세요" 안내

---

## 📋 지원 데이터

| 구분 | 항목 | 데이터 소스 |
|------|------|-------------|
| 미국 주식 | NYSE, NASDAQ 전체 | yfinance (지연) |
| ETF | SPY, QQQ 등 전체 | yfinance (지연) |
| 지수 | S&P500, NASDAQ, DOW, VIX, RUT | yfinance (지연) |
| 한국 주식 | KOSPI, KOSDAQ | yfinance (지연) |
| 환율 | USD/KRW, EUR/USD, USD/JPY 등 | yfinance (지연) |
| 원자재 | 금, 은, WTI, 천연가스, 구리 | yfinance (지연) |
| 금리 | 미국 2년/10년/30년물 | yfinance (지연) |
| 옵션 | 옵션 체인 (콜/풋) | yfinance (지연) |
| 뉴스 | 미국 금융 뉴스 | Yahoo RSS / Finnhub |
| 공시 | SEC EDGAR | (추후 구현 예정) |
| DART | 한국 공시 | (API 키 필요, 추후) |

---

## ⚠️ 면책조항

이 소프트웨어는 교육 및 참고용입니다.  
실제 투자 결정에 단독 사용하지 마세요.  
지연 데이터를 기반으로 하므로 실거래 시 반드시 공식 브로커 플랫폼을 사용하세요.
