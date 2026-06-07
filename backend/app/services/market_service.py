"""
시장 데이터 서비스.
우선순위: yfinance → Alpha Vantage → Finnhub
모든 소스 실패 시 "데이터 없음"으로 명확히 표시 (가짜 데이터 없음).
"""
import asyncio
import re
import time
from typing import Optional, Dict, Any, List
from cachetools import TTLCache
import httpx

from app.core.config import settings

_quote_cache: TTLCache = TTLCache(maxsize=500, ttl=settings.QUOTE_CACHE_TTL)
_chart_cache: TTLCache = TTLCache(maxsize=100, ttl=settings.CHART_CACHE_TTL)
_index_cache: TTLCache = TTLCache(maxsize=50, ttl=settings.INDEX_CACHE_TTL)
_fx_cache: TTLCache = TTLCache(maxsize=32, ttl=300)
_krx_info_cache: TTLCache = TTLCache(maxsize=128, ttl=1800)

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

NAVER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://finance.naver.com/",
}

KRW_FX_CROSS = {
    "USD": ("KRW=X", "direct"),
    "EUR": ("EURUSD=X", "multiply_usdkrw"),
    "GBP": ("GBPUSD=X", "multiply_usdkrw"),
    "JPY": ("JPY=X", "divide_usdkrw"),
    "CNY": ("CNY=X", "divide_usdkrw"),
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


def _normalize_symbol_candidates(symbol: str) -> List[str]:
    sym = (symbol or "").strip().upper()
    if not sym:
        return []
    if re.fullmatch(r"\d{6}", sym):
        return [f"{sym}.KS", f"{sym}.KQ"]
    return [sym]


def _is_krx_symbol(symbol: str) -> bool:
    return bool(re.fullmatch(r"\d{6}\.(KS|KQ)", (symbol or "").upper()))


def _extract_krx_code(symbol: str) -> Optional[str]:
    match = re.fullmatch(r"(\d{6})\.(KS|KQ)", (symbol or "").upper())
    return match.group(1) if match else None


def _strip_tags(value: str) -> str:
    return re.sub(r"<[^>]+>", "", value or "").replace("&nbsp;", " ").strip()


def _first_number(value: str) -> Optional[float]:
    if not value:
        return None
    match = re.search(r"-?\d[\d,]*(?:\.\d+)?", value)
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", ""))
    except ValueError:
        return None


def _extract_table_value(html: str, label_pattern: str) -> Optional[str]:
    pattern = rf"{label_pattern}.*?</th>\s*<td[^>]*>(.*?)</td>"
    match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
    if not match:
        return None
    return _strip_tags(match.group(1))


async def _fetch_simple_yahoo_price(symbol: str) -> Optional[float]:
    quote = await _fetch_yahoo_quote_http(symbol)
    price = _safe_float((quote or {}).get("price"), 0.0)
    return price if price > 0 else None


async def _get_krw_fx_rate(currency: Optional[str]) -> Optional[float]:
    curr = (currency or "").upper()
    if not curr:
        return None
    if curr == "KRW":
        return 1.0
    if curr in _fx_cache:
        return _fx_cache[curr]

    cross = KRW_FX_CROSS.get(curr)
    if not cross:
        return None

    base_symbol, mode = cross
    base_price = await _fetch_simple_yahoo_price(base_symbol)
    if not base_price:
        return None

    if mode == "direct":
        rate = base_price
    else:
        usd_krw = await _fetch_simple_yahoo_price("KRW=X")
        if not usd_krw:
            return None
        if mode == "multiply_usdkrw":
            rate = base_price * usd_krw
        else:
            rate = usd_krw / base_price if base_price else None

    if rate and rate > 0:
        _fx_cache[curr] = rate
        return rate
    return None


async def _fetch_krx_company_info(symbol: str) -> Dict[str, Any]:
    code = _extract_krx_code(symbol)
    if not code:
        return {}
    if code in _krx_info_cache:
        return _krx_info_cache[code]

    url = f"https://finance.naver.com/item/main.naver?code={code}"
    try:
        async with httpx.AsyncClient(headers=NAVER_HEADERS, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return {}
            html = resp.text

        market_cap_eok = _first_number(_extract_table_value(html, r"시가총액\(억\)") or "")
        foreign_ownership = _first_number(_extract_table_value(html, r"외국인소진율\(B/A\)") or "")
        shares_outstanding = _first_number(_extract_table_value(html, r"상장주식수") or "")
        per_value = _first_number(_extract_table_value(html, r"PER(?:<span[^>]*>.*?</span>)?\(배\)") or "")
        eps_value = _first_number(_extract_table_value(html, r"EPS(?:<span[^>]*>.*?</span>)?\(원\)") or "")
        pbr_value = _first_number(_extract_table_value(html, r"PBR(?:<span[^>]*>.*?</span>)?\(배\)") or "")
        bps_value = _first_number(_extract_table_value(html, r"BPS(?:<span[^>]*>.*?</span>)?\(원\)") or "")

        dividend_match = re.search(r"배당수익률.*?<td[^>]*>\s*<em>([\d.,]+)</em>", html, re.IGNORECASE | re.DOTALL)
        high_low_match = re.search(r"52주최고.*?<td[^>]*>\s*<em>([\d,]+)</em>\s*<span[^>]*>.*?</span>\s*<em>([\d,]+)</em>", html, re.IGNORECASE | re.DOTALL)
        industry_match = re.search(r"업종명\s*:\s*<a[^>]*>([^<]+)</a>", html, re.IGNORECASE)

        dividend_rate = _first_number(dividend_match.group(1)) if dividend_match else None

        result = {
            "market_cap": int(market_cap_eok * 100_000_000) if market_cap_eok else None,
            "foreign_ownership": foreign_ownership,
            "shares_outstanding": int(shares_outstanding) if shares_outstanding else None,
            "pe_ratio": per_value,
            "eps": eps_value,
            "pbr": pbr_value,
            "bps": bps_value,
            "dividend_yield": (dividend_rate / 100) if dividend_rate is not None else None,
            "52w_high": _first_number(high_low_match.group(1)) if high_low_match else None,
            "52w_low": _first_number(high_low_match.group(2)) if high_low_match else None,
            "industry": _strip_tags(industry_match.group(1)) if industry_match else None,
        }
        _krx_info_cache[code] = result
        return result
    except Exception:
        return {}


async def _decorate_quote(symbol: str, quote: Dict[str, Any]) -> Dict[str, Any]:
    enriched = dict(quote)
    if _is_krx_symbol(symbol):
        krx_info = await _fetch_krx_company_info(symbol)
        for key, value in krx_info.items():
            if value is None:
                continue
            if enriched.get(key) in (None, "", 0, 0.0):
                enriched[key] = value
        enriched["currency"] = "KRW"
        enriched["exchange"] = enriched.get("exchange") or ("KOSDAQ" if symbol.endswith(".KQ") else "KOSPI")

    fx_rate = await _get_krw_fx_rate(enriched.get("currency"))
    if fx_rate and fx_rate > 0:
        enriched["fx_rate_to_krw"] = round(fx_rate, 4)
        for src, dst in [
            ("price", "price_krw"),
            ("change", "change_krw"),
            ("prev_close", "prev_close_krw"),
            ("open", "open_krw"),
            ("high", "high_krw"),
            ("low", "low_krw"),
            ("market_cap", "market_cap_krw"),
            ("eps", "eps_krw"),
            ("52w_high", "52w_high_krw"),
            ("52w_low", "52w_low_krw"),
        ]:
            value = enriched.get(src)
            if value not in (None, ""):
                try:
                    enriched[dst] = round(float(value) * fx_rate, 4)
                except (TypeError, ValueError):
                    continue

    return enriched


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
    candidates = _normalize_symbol_candidates(symbol)
    if not candidates:
        return {
            "symbol": (symbol or "").upper(),
            "data_status": "error",
            "error": "심볼이 비어 있습니다.",
        }

    for sym in candidates:
        cache_key = f"quote:{sym}"
        if cache_key in _quote_cache:
            cached = _quote_cache[cache_key]
            return {**cached, "data_status": _data_status(cached["_fetched_at"])}

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
            decorated = await _decorate_quote(sym, result)
            _quote_cache[cache_key] = decorated
            return {**decorated, "data_status": "delayed"}

    return {
        "symbol": candidates[0],
        "data_status": "error",
        "error": "데이터를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
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

    candidates = _normalize_symbol_candidates(symbol)
    if not candidates:
        candidates = [(symbol or "").upper()]

    for candidate in candidates:
        cache_key = f"chart:{candidate}:{period}:{interval}"
        if cache_key in _chart_cache:
            return _chart_cache[cache_key]

        candles = await _fetch_yahoo_chart_http(candidate, period, interval)

        if candles is None:
            try:
                import yfinance as yf
                import asyncio as _asyncio
                ticker = yf.Ticker(candidate)
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

        if candles:
            result = {
                "symbol": candidate.upper(),
                "period": period,
                "interval": interval,
                "candles": sorted(candles, key=lambda x: x["time"]),
                "data_source": "yahoo_finance",
                "data_status": "delayed",
                "note": "지연 데이터 (Yahoo Finance)",
            }
            _chart_cache[cache_key] = result
            return result

    return {
        "symbol": candidates[0].upper(),
        "period": period,
        "interval": interval,
        "data_status": "no_data",
        "candles": [],
        "error": "차트 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.",
    }


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


_fundamentals_cache: TTLCache = TTLCache(maxsize=100, ttl=1800)


async def get_stock_fundamentals(symbol: str) -> Dict[str, Any]:
    sym = symbol.upper()
    cache_key = f"fund:{sym}"
    if cache_key in _fundamentals_cache:
        return _fundamentals_cache[cache_key]

    def _fetch() -> Dict[str, Any]:
        import yfinance as yf

        t = yf.Ticker(sym)
        info = t.info or {}

        def _s(val: Any) -> Any:
            if val is None:
                return None
            if isinstance(val, float) and val != val:  # NaN
                return None
            return val

        rec_summary: Dict[str, Any] = {}
        try:
            recs = t.recommendations
            if recs is not None and not recs.empty:
                recent = recs.tail(20)
                cols = recent.columns.tolist()
                rec_summary = {
                    "strong_buy": int(recent["strongBuy"].sum()) if "strongBuy" in cols else 0,
                    "buy": int(recent["buy"].sum()) if "buy" in cols else 0,
                    "hold": int(recent["hold"].sum()) if "hold" in cols else 0,
                    "sell": int(recent["sell"].sum()) if "sell" in cols else 0,
                    "strong_sell": int(recent["strongSell"].sum()) if "strongSell" in cols else 0,
                }
        except Exception:
            pass

        earnings_dates: List[str] = []
        try:
            cal = t.calendar
            if isinstance(cal, dict):
                dates = cal.get("Earnings Date") or []
                for d in dates:
                    earnings_dates.append(d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d))
        except Exception:
            pass

        return {
            "symbol": sym,
            "name": info.get("longName") or info.get("shortName", sym),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "description": (info.get("longBusinessSummary") or "")[:600],
            "country": info.get("country"),
            "website": info.get("website"),
            "employees": _s(info.get("fullTimeEmployees")),
            "market_cap": _s(info.get("marketCap")),
            "pe_trailing": _s(info.get("trailingPE")),
            "pe_forward": _s(info.get("forwardPE")),
            "pb_ratio": _s(info.get("priceToBook")),
            "ps_ratio": _s(info.get("priceToSalesTrailingTwelveMonths")),
            "ev_ebitda": _s(info.get("enterpriseToEbitda")),
            "week52_high": _s(info.get("fiftyTwoWeekHigh")),
            "week52_low": _s(info.get("fiftyTwoWeekLow")),
            "day_high": _s(info.get("dayHigh")),
            "day_low": _s(info.get("dayLow")),
            "beta": _s(info.get("beta")),
            "avg_volume": _s(info.get("averageVolume")),
            "eps_trailing": _s(info.get("trailingEps")),
            "eps_forward": _s(info.get("forwardEps")),
            "earnings_growth": _s(info.get("earningsGrowth")),
            "revenue_growth": _s(info.get("revenueGrowth")),
            "earnings_dates": earnings_dates,
            "dividend_yield": _s(info.get("dividendYield")),
            "payout_ratio": _s(info.get("payoutRatio")),
            "short_ratio": _s(info.get("shortRatio")),
            "short_pct_float": _s(info.get("shortPercentOfFloat")),
            "profit_margin": _s(info.get("profitMargins")),
            "operating_margin": _s(info.get("operatingMargins")),
            "gross_margin": _s(info.get("grossMargins")),
            "roe": _s(info.get("returnOnEquity")),
            "roa": _s(info.get("returnOnAssets")),
            "total_revenue": _s(info.get("totalRevenue")),
            "debt_to_equity": _s(info.get("debtToEquity")),
            "current_ratio": _s(info.get("currentRatio")),
            "free_cashflow": _s(info.get("freeCashflow")),
            "analyst_count": info.get("numberOfAnalystOpinions"),
            "recommendation_key": info.get("recommendationKey"),
            "recommendation_mean": _s(info.get("recommendationMean")),
            "target_high": _s(info.get("targetHighPrice")),
            "target_low": _s(info.get("targetLowPrice")),
            "target_mean": _s(info.get("targetMeanPrice")),
            "target_median": _s(info.get("targetMedianPrice")),
            "rec_summary": rec_summary,
            "data_status": "delayed",
        }

    try:
        result = await asyncio.wait_for(asyncio.to_thread(_fetch), timeout=15.0)
        _fundamentals_cache[cache_key] = result
        return result
    except Exception as e:
        return {"symbol": sym, "data_status": "error", "error": str(e)}
