"""
뉴스 서비스: Yahoo Finance RSS (무료) + Finnhub (API 키 선택).
AI 번역은 Gemini API 키가 있을 때만 동작.
"""
import asyncio
import time
import re
from typing import List, Dict, Any, Optional
from cachetools import TTLCache
import feedparser
import httpx

from app.core.config import settings

_news_cache: TTLCache = TTLCache(maxsize=200, ttl=settings.NEWS_CACHE_TTL)

# Yahoo Finance RSS 피드 (무료, API 키 불필요)
YAHOO_RSS_FEEDS = {
    "market": "https://finance.yahoo.com/news/rssindex",
    "us_market": "https://finance.yahoo.com/rss/topstories",
}


def _clean_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def _extract_tickers(text: str) -> List[str]:
    tickers = re.findall(r'\b([A-Z]{1,5})\b', text)
    # 일반 영어 단어 필터링
    stopwords = {"THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
                 "WAS", "ONE", "OUR", "OUT", "WHO", "HIS", "HAS", "ITS", "NEW", "NOW",
                 "CEO", "CFO", "SEC", "ETF", "IPO", "FED", "GDP", "CPI", "PCE", "US",
                 "WILL", "FROM", "WITH", "THIS", "THAT", "THEY", "BEEN", "HAVE"}
    return list(set(t for t in tickers if t not in stopwords and len(t) >= 2))[:5]


def _sentiment_score(text: str) -> str:
    positive = ["surge", "rally", "gain", "rise", "beat", "record", "growth", "profit", "strong", "upgrade", "bullish"]
    negative = ["fall", "drop", "plunge", "decline", "miss", "loss", "weak", "downgrade", "bearish", "cut", "layoff"]
    text_lower = text.lower()
    pos = sum(1 for w in positive if w in text_lower)
    neg = sum(1 for w in negative if w in text_lower)
    if pos > neg + 1:
        return "positive"
    elif neg > pos + 1:
        return "negative"
    return "neutral"


async def get_yahoo_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    cache_key = f"news:yahoo:{symbol or 'market'}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    articles = []
    try:
        if symbol:
            url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
        else:
            url = YAHOO_RSS_FEEDS["us_market"]

        feed = await asyncio.to_thread(feedparser.parse, url)
        for entry in feed.entries[:limit]:
            summary = _clean_html(entry.get("summary", ""))
            title = entry.get("title", "")
            articles.append({
                "id": entry.get("id", entry.get("link", "")),
                "title": title,
                "summary": summary[:300] if summary else "",
                "url": entry.get("link", ""),
                "published_at": entry.get("published", ""),
                "source": entry.get("source", {}).get("title", "Yahoo Finance") if isinstance(entry.get("source"), dict) else "Yahoo Finance",
                "tickers": _extract_tickers(title + " " + summary),
                "sentiment": _sentiment_score(title + " " + summary),
                "importance": "high" if any(w in title.lower() for w in ["fed", "earnings", "crash", "rally", "recession"]) else "normal",
                "data_source": "yahoo_rss",
                "translation": None,  # AI 번역 필요 시 별도 API 호출
            })
    except Exception as e:
        articles = [{"data_status": "error", "error": str(e)}]

    _news_cache[cache_key] = articles
    return articles


async def get_finnhub_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    if not settings.FINNHUB_API_KEY:
        return []

    cache_key = f"news:finnhub:{symbol or 'market'}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    try:
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

        async with httpx.AsyncClient() as client:
            if symbol:
                url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={week_ago}&to={today}&token={settings.FINNHUB_API_KEY}"
            else:
                url = f"https://finnhub.io/api/v1/news?category=general&token={settings.FINNHUB_API_KEY}"

            resp = await client.get(url, timeout=10)
            data = resp.json()

        articles = []
        for item in data[:limit]:
            title = item.get("headline", "")
            summary = item.get("summary", "")
            articles.append({
                "id": str(item.get("id", "")),
                "title": title,
                "summary": summary[:300],
                "url": item.get("url", ""),
                "published_at": str(item.get("datetime", "")),
                "source": item.get("source", "Finnhub"),
                "tickers": [item["related"]] if item.get("related") else _extract_tickers(title),
                "sentiment": _sentiment_score(title + summary),
                "importance": "normal",
                "data_source": "finnhub",
                "image": item.get("image"),
                "translation": None,
            })

        _news_cache[cache_key] = articles
        return articles
    except Exception:
        return []


async def translate_with_gemini(text: str, api_key: Optional[str] = None) -> Optional[str]:
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(
            model.generate_content,
            f"다음 영문 금융 뉴스를 한국어로 간결하게 번역해줘. 투자자 관점에서 핵심만 요약해줘:\n\n{text[:800]}"
        )
        return response.text
    except Exception:
        return None


async def get_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    finnhub = await get_finnhub_news(symbol, limit)
    if finnhub:
        return finnhub
    return await get_yahoo_news(symbol, limit)
