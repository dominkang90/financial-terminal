"""
시장 데이터 서비스.
우선순위: yfinance → Alpha Vantage → Finnhub
모든 소스 실패 시 "데이터 없음"으로 명확히 표시 (가짜 데이터 없음).
"""
import asyncio
import time
from typing import Optional, Dict, Any, List
from cachetools import TTLCache
import httpx

from app.core.config import settings

_quote_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.QUOTE_CACHE_TTL)
_chart_cache: TTLCache = TTLCache(maxsize=100, ttl=settings.CHART_CACHE_TTL)
_index_cache: TTLCache = TTLCache(maxsize=50, ttl=settings.INDEX_CACHE_TTL)

INDEX_TICKERS = {
    "SPX": "^GSPC",
    "NDX": "^NDX",
    "DJIA": "^DJI",
    "VIX": "^VIX",
    "RUT": "^RUT",
    "KOSPI": "^KS11",
    "KOSDAQ": "^KQ11",
}

FX_TICKERS = {
    "USD/KRW": "KRW=X",
    "EUR/USD": "EURUSD=X",
    "USD/JPY": "JPY=X",
    "GBP/USD": "GBPUSD=X",
    "USD/CNY": "CNY=X",
}

COMMODITY_TICKERS = {
    "GOLD": "GC=F",
    "SILVER": "SI=F",
    "OIL_WTI": "CL=F",
    "OIL_BRENT": "BZ=F",
    "NATGAS": "NG=F",
    "COPPER": "HG=F",
}

RATE_TICKERS = {
    "US10Y": "^TNX",
    "US02Y": "^IRX",
    "US30Y": "^TYX",
}

YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
    "Origin": "https://finance.yahoo.com",
}


def _data_status(last_updated: float) -> str:
    age = time.time() - last_updated
    if age < 60:
        return "live"
    elif age < 900:
        return "delayed"
    return "stale"


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        f = float(v)
        return f if f == f else default  # NaN check
    except (TypeError, ValueError):
        return default


async def _fetch_yahoo_quote_http(symbol: str) -> Optional[Dict]:
    """Yahoo Finance v8 HTTP API 직접 호출"""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": "2d", "interval": "1d", "includePrePost": "false"}
    try:
        async with httpx.AsyncClient(
            headers=YAHOO_HEADERS, timeout=10.0, follow_redirects=True
        ) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 429:
                return None
            if resp.status_code != 200:
                return None
            data = resp.json()

        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
        r = result[0]
        meta = r.get("meta", {})
        quotes_data = r.get("indicators", {}).get("quote", [{}])[0]
        timestamps = r.get("timestamp", [])

        price = _safe_float(meta.get("regularMarketPrice") or meta.get("chartPreviousClose"))
        prev_close = _safe_float(meta.get("chartPreviousClose") or meta.get("previousClose"))
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0

        # fundamental 데이터 보완 (yfinance.info)
        try:
            import yfinance as yf
            info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info) or {}
        except Exception:
            info = {}

        open_price = _safe_float(meta.get("regularMarketOpen")) or _safe_float(info.get("open"))

        return {
            "symbol": symbol.upper(),
            "name": meta.get("longName") or meta.get("shortName", symbol),
            "price": round(price, 4),
            "change": round(change, 4),
            "change_pct": round(change_pct, 4),
            "prev_close": round(prev_close, 4),
            "open": open_price,
            "high": _safe_float(meta.get("regularMarketDayHigh")),
            "low": _safe_float(meta.get("regularMarketDayLow")),
            "volume": int(_safe_float(meta.get("regularMarketVolume"))),
            "avg_volume": int(_safe_float(info.get("averageVolume"))),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "eps": info.get("trailingEps"),
            "dividend_yield": (info["dividendYield"] / 100) if info.get("dividendYield") else None,
            "52w_high": _safe_float(meta.get("fiftyTwoWeekHigh")),
            "52w_low": _safe_float(meta.get("fiftyTwoWeekLow")),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "currency": meta.get("currency", "USD"),
            "exchange": meta.get("exchangeName", ""),
            "data_source": "yahoo_http",
            "note": "Yahoo Finance 지연 데이터",
            "_fetched_at": time.time(),
        }
    except Exception:
        return None


async def _fetch_yahoo_chart_http(symbol: str, period: str, interval: str) -> Optional[List[Dict]]:
    """Yahoo Finance v8 차트 데이터 직접 호출"""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    params = {"range": period, "interval": interval, "includePrePost": "false"}
    try:
        async with httpx.AsyncClient(
            headers=YAHOO_HEADERS, timeout=15.0, follow_redirects=True
        ) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return None
            data = resp.json()

        result = data.get("chart", {}).get("result", [])
        if not result:
            return None

        r = result[0]
        timestamps = r.get("timestamp", [])
        quotes_data = r.get("indicators", {}).get("quote", [{}])[0]

        candles = []
        for i, ts in enumerate(timestamps):
            try:
                o = _safe_float(quotes_data.get("open", [None])[i])
                h = _safe_float(quotes_data.get("high", [None])[i])
                l = _safe_float(quotes_data.get("low", [None])[i])
                c = _safe_float(quotes_data.get("close", [None])[i])
                v = int(_safe_float(quotes_data.get("volume", [0])[i]))
                if c > 0:
                    candles.append({"time": ts, "open": round(o, 4), "high": round(h, 4),
                                    "low": round(l, 4), "close": round(c, 4), "volume": v})
            except (IndexError, TypeError):
                continue
        return candles
    except Exception:
        return None


async def _fetch_finnhub_quote(symbol: str) -> Optional[Dict]:
    """Finnhub API - API 키 필요"""
    if not settings.FINNHUB_API_KEY:
        return None
    url = f"https://finnhub.io/api/v1/quote"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params={"symbol": symbol, "token": settings.FINNHUB_API_KEY})
            if resp.status_code != 200:
                return None
            d = resp.json()
        if not d.get("c"):
            return None
        price = _safe_float(d.get("c"))
        prev_close = _safe_float(d.get("pc"))
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0.0
        return {
            "symbol": symbol.upper(),
            "name": symbol,
            "price": round(price, 4),
            "change": round(change, 4),
            "change_pct": round(change_pct, 4),
            "prev_close": round(prev_close, 4),
            "open": _safe_float(d.get("o")),
            "high": _safe_float(d.get("h")),
            "low": _safe_float(d.get("l")),
            "volume": 0,
            "avg_volume": 0,
            "currency": "USD",
            "exchange": "",
            "data_source": "finnhub",
            "note": "Finnhub 실시간 데이터",
            "_fetched_at": time.time(),
        }
    except Exception:
        return None


async def get_quote(symbol: str) -> Dict[str, Any]:
    sym = symbol.upper()
    cache_key = f"quote:{sym}"
    if cache_key in _quote_cache:
        cached = _quote_cache[cache_key]
        return {**cached, "data_status": _data_status(cached["_fetched_at"])}

    # 소스 순서: Finnhub → Yahoo HTTP
    result = None
    for fetch_fn in [
        lambda: _fetch_finnhub_quote(sym),
        lambda: _fetch_yahoo_quote_http(sym),
    ]:
        try:
            result = await fetch_fn()
            if result:
                break
        except Exception:
            continue

    if result:
        _quote_cache[cache_key] = result
        return {**result, "data_status": "delayed"}

    # 모든 소스 실패
    return {
        "symbol": sym,
        "data_status": "error",
        "error": "데이터를 불러올 수 없습니다. Finnhub API 키를 설정하거나 잠시 후 다시 시도해주세요.",
    }


async def get_batch_quotes(symbols: List[str]) -> Dict[str, Any]:
    results = {}
    for sym in symbols:
        results[sym] = await get_quote(sym)
        await asyncio.sleep(0.15)
    return results


async def get_indices() -> Dict[str, Any]:
    if "indices" in _index_cache:
        return _index_cache["indices"]
    results = {}
    for name, ticker in INDEX_TICKERS.items():
        results[name] = await get_quote(ticker)
    _index_cache["indices"] = results
    return results


async def get_forex() -> Dict[str, Any]:
    results = {}
    for name, ticker in FX_TICKERS.items():
        results[name] = await get_quote(ticker)
    return results


async def get_commodities() -> Dict[str, Any]:
    results = {}
    for name, ticker in COMMODITY_TICKERS.items():
        results[name] = await get_quote(ticker)
    return results


async def get_rates() -> Dict[str, Any]:
    results = {}
    for name, ticker in RATE_TICKERS.items():
        results[name] = await get_quote(ticker)
    return results


async def get_chart_data(
    symbol: str,
    period: str = "6mo",
    interval: str = "1d",
) -> Dict[str, Any]:
    valid_periods = {
        "1mo": "1mo", "3mo": "3mo", "6mo": "6mo",
        "1y": "1y", "2y": "2y", "5y": "5y", "10y": "10y",
    }
    valid_intervals = {"1d": "1d", "1wk": "1wk", "1mo": "1mo"}
    period = valid_periods.get(period, "6mo")
    interval = valid_intervals.get(interval, "1d")

    cache_key = f"chart:{symbol}:{period}:{interval}"
    if cache_key in _chart_cache:
        return _chart_cache[cache_key]

    candles = await _fetch_yahoo_chart_http(symbol, period, interval)

    if candles is None:
        # yfinance 폴백 시도
        try:
            import yfinance as yf
            import asyncio as _asyncio
            ticker = yf.Ticker(symbol)
            hist = await _asyncio.to_thread(lambda: ticker.history(period=period, interval=interval))
            if not hist.empty:
                candles = []
                for idx, row in hist.iterrows():
                    c = float(row["Close"])
                    if c > 0:
                        candles.append({
                            "time": int(idx.timestamp()),
                            "open": round(float(row["Open"]), 4),
                            "high": round(float(row["High"]), 4),
                            "low": round(float(row["Low"]), 4),
                            "close": round(c, 4),
                            "volume": int(row["Volume"]),
                        })
        except Exception:
            pass

    if not candles:
        return {
            "symbol": symbol.upper(),
            "period": period,
            "interval": interval,
            "data_status": "no_data",
            "candles": [],
            "error": "차트 데이터를 가져올 수 없습니다. Finnhub API 키를 설정하세요.",
        }

    result = {
        "symbol": symbol.upper(),
        "period": period,
        "interval": interval,
        "candles": sorted(candles, key=lambda x: x["time"]),
        "data_source": "yahoo_finance",
        "data_status": "delayed",
        "note": "지연 데이터 (Yahoo Finance)",
    }
    _chart_cache[cache_key] = result
    return result


async def search_symbols(query: str, limit: int = 20) -> List[Dict]:
    query = query.strip()
    if not query:
        return []

    # 1) 6자리 숫자 → 한국 종목 코드 (.KS 우선, .KQ 폴백)
    if query.isdigit() and len(query) == 6:
        for sym in [f"{query}.KS", f"{query}.KQ"]:
            q = await get_quote(sym)
            if q.get("data_status") != "error" and (q.get("price") or 0) > 0:
                return [{
                    "symbol": sym,
                    "name": q.get("name", sym),
                    "exchange": q.get("exchange", ""),
                    "type": "EQUITY",
                }]

    # 2) 한글 포함 시 영문 번역해서 검색
    if any("가" <= ch <= "힣" for ch in query):
        try:
            from deep_translator import GoogleTranslator
            translated = GoogleTranslator(source="ko", target="en").translate(query)
            if translated:
                query = translated
        except Exception:
            pass

    # Finnhub 심볼 검색 시도
    if settings.FINNHUB_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://finnhub.io/api/v1/search",
                    params={"q": query, "token": settings.FINNHUB_API_KEY}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {
                            "symbol": r.get("symbol", ""),
                            "name": r.get("description", ""),
                            "exchange": r.get("primaryExchange", ""),
                            "type": r.get("type", ""),
                        }
                        for r in data.get("result", [])[:limit]
                        if r.get("symbol")
                    ]
        except Exception:
            pass

    # Yahoo Finance 검색 API
    try:
        async with httpx.AsyncClient(headers=YAHOO_HEADERS, timeout=8.0) as client:
            resp = await client.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": limit, "newsCount": 0}
            )
            if resp.status_code == 200:
                data = resp.json()
                quotes = data.get("quotes", [])
                return [
                    {
                        "symbol": q.get("symbol", ""),
                        "name": q.get("longname") or q.get("shortname", ""),
                        "exchange": q.get("exchange", ""),
                        "type": q.get("quoteType", ""),
                    }
                    for q in quotes[:limit]
                    if q.get("symbol")
                ]
    except Exception:
        pass

    return []


async def get_options_chain(symbol: str) -> Dict[str, Any]:
    try:
        import yfinance as yf
        import asyncio as _asyncio
        import pandas as pd

        ticker = yf.Ticker(symbol)
        expirations = await _asyncio.to_thread(lambda: ticker.options)

        if not expirations:
            return {
                "symbol": symbol,
                "data_status": "no_data",
                "error": "옵션 데이터 없음 — 옵션이 없는 종목이거나 데이터 제공자 제한",
                "expirations": [], "calls": [], "puts": [],
            }

        nearest_exp = expirations[0]
        chain = await _asyncio.to_thread(lambda: ticker.option_chain(nearest_exp))

        def df_to_list(df: pd.DataFrame) -> List[Dict]:
            if df is None or df.empty:
                return []
            return df.fillna(0).to_dict(orient="records")

        return {
            "symbol": symbol.upper(),
            "expirations": list(expirations),
            "selected_expiration": nearest_exp,
            "calls": df_to_list(chain.calls),
            "puts": df_to_list(chain.puts),
            "data_source": "yfinance",
            "data_status": "delayed",
        }
    except Exception as e:
        return {
            "symbol": symbol,
            "data_status": "error",
            "error": str(e),
            "expirations": [], "calls": [], "puts": [],
        }


async def get_etf_holdings(symbol: str) -> Dict[str, Any]:
    try:
        import yfinance as yf
        import asyncio as _asyncio
        ticker = yf.Ticker(symbol)
        info = await _asyncio.to_thread(lambda: ticker.info)
        return {
            "symbol": symbol.upper(),
            "name": info.get("longName", symbol),
            "holdings": info.get("holdings", [])[:30],
            "data_source": "yfinance",
            "data_status": "delayed",
        }
    except Exception as e:
        return {"symbol": symbol, "data_status": "error", "error": str(e)}
