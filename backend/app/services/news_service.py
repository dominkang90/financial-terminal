"""
뉴스 서비스: Yahoo Finance RSS + Finnhub
자동 한국어 번역: MyMemory API (무료, API 키 불필요, 일 5000단어)
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
_translate_cache: TTLCache = TTLCache(maxsize=1000, ttl=3600)  # 번역 1시간 캐시


def _clean_html(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", text).strip()


def _extract_tickers(text: str) -> List[str]:
    tickers = re.findall(r'\b([A-Z]{1,5})\b', text)
    stopwords = {
        "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
        "WAS", "ONE", "OUR", "OUT", "WHO", "HIS", "HAS", "ITS", "NEW", "NOW",
        "CEO", "CFO", "SEC", "ETF", "IPO", "FED", "GDP", "CPI", "PCE", "US",
        "WILL", "FROM", "WITH", "THIS", "THAT", "THEY", "BEEN", "HAVE", "AI",
        "INTO", "OVER", "THAN", "THEN", "WHEN", "WHAT", "SAYS", "SAID",
    }
    return list(set(t for t in tickers if t not in stopwords and len(t) >= 2))[:5]


def _sentiment_score(text: str) -> str:
    positive = ["surge", "rally", "gain", "rise", "beat", "record", "growth",
                "profit", "strong", "upgrade", "bullish", "jump", "soar", "high"]
    negative = ["fall", "drop", "plunge", "decline", "miss", "loss", "weak",
                "downgrade", "bearish", "cut", "layoff", "crash", "low", "sell"]
    text_lower = text.lower()
    pos = sum(1 for w in positive if w in text_lower)
    neg = sum(1 for w in negative if w in text_lower)
    if pos > neg + 1:
        return "positive"
    elif neg > pos + 1:
        return "negative"
    return "neutral"


def _extract_youtube_id(url: str) -> Optional[str]:
    """URL에서 YouTube 영상 ID 추출"""
    patterns = [
        r'youtube\.com/watch\?v=([^&\s]+)',
        r'youtu\.be/([^?\s]+)',
        r'youtube\.com/embed/([^?\s]+)',
        r'youtube\.com/shorts/([^?\s]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _extract_media_from_entry(entry: Any) -> dict:
    """RSS 항목에서 이미지/영상 정보 추출"""
    result = {"image": None, "video_url": None, "video_thumbnail": None, "media_type": "article"}

    # 링크에서 YouTube 감지
    link = entry.get("link", "")
    yt_id = _extract_youtube_id(link)
    if yt_id:
        result["video_url"] = link
        result["video_thumbnail"] = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
        result["media_type"] = "video"
        return result

    # media:content에서 영상/이미지 감지
    if hasattr(entry, "media_content") and entry.media_content:
        for m in entry.media_content:
            url = m.get("url", "")
            media_type = m.get("type", "")
            if "video" in media_type or url.endswith((".mp4", ".m3u8")):
                yt_id = _extract_youtube_id(url)
                if yt_id:
                    result["video_url"] = url
                    result["video_thumbnail"] = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
                else:
                    result["video_url"] = url
                    result["video_thumbnail"] = m.get("thumbnail", {}).get("url")
                result["media_type"] = "video"
                return result
            elif url and any(ext in url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                result["image"] = url

    # media:thumbnail
    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        url = entry.media_thumbnail[0].get("url", "")
        if url and not result["image"]:
            result["image"] = url

    # enclosures
    if hasattr(entry, "enclosures") and entry.enclosures:
        for enc in entry.enclosures:
            enc_type = enc.get("type", "")
            href = enc.get("href", "")
            if "video" in enc_type:
                result["video_url"] = href
                result["media_type"] = "video"
                return result
            elif "image" in enc_type and not result["image"]:
                result["image"] = href

    # summary에서 img 태그 및 YouTube iframe 추출
    summary = entry.get("summary", "")
    if summary:
        yt_match = re.search(r'youtube\.com/embed/([^?"]+)', summary)
        if yt_match:
            yt_id = yt_match.group(1)
            result["video_url"] = f"https://www.youtube.com/watch?v={yt_id}"
            result["video_thumbnail"] = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
            result["media_type"] = "video"
            return result

        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
        if img_match and not result["image"]:
            result["image"] = img_match.group(1)

    return result


async def _translate_mymemory(text: str) -> Optional[str]:
    """MyMemory 무료 번역 API (API 키 불필요, 일 5000단어)"""
    if not text or len(text) < 5:
        return None

    cache_key = f"tr:{text[:100]}"
    if cache_key in _translate_cache:
        return _translate_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.mymemory.translated.net/get",
                params={
                    "q": text[:500],
                    "langpair": "en|ko",
                    "de": "rkdtkdwhd@gmail.com",  # 이메일 추가하면 일 10000단어
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                translated = data.get("responseData", {}).get("translatedText", "")
                if translated and translated != text:
                    _translate_cache[cache_key] = translated
                    return translated
    except Exception:
        pass
    return None


async def _translate_gemini(text: str, api_key: str) -> Optional[str]:
    """Gemini 번역 (API 키 있을 때 우선 사용)"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(
            model.generate_content,
            f"다음 영문 금융 뉴스 제목을 자연스러운 한국어로 번역해줘. 번역문만 출력해:\n\n{text}"
        )
        return response.text.strip()
    except Exception:
        return None


async def translate_article(title: str, summary: str = "", user_api_key: Optional[str] = None) -> Dict[str, Optional[str]]:
    """제목과 요약 번역"""
    gemini_key = user_api_key or settings.GEMINI_API_KEY

    if gemini_key:
        title_kr = await _translate_gemini(title, gemini_key)
        summary_kr = await _translate_gemini(summary[:300], gemini_key) if summary else None
    else:
        title_kr = await _translate_mymemory(title)
        summary_kr = await _translate_mymemory(summary[:300]) if summary else None

    return {"title_ko": title_kr, "summary_ko": summary_kr}


async def get_yahoo_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    cache_key = f"news:yahoo:{symbol or 'market'}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    articles = []
    try:
        if symbol:
            url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
        else:
            url = "https://finance.yahoo.com/rss/topstories"

        feed = await asyncio.to_thread(feedparser.parse, url)

        # 번역 병렬 처리
        async def process_entry(entry):
            title = entry.get("title", "")
            summary = _clean_html(entry.get("summary", ""))[:300]
            media = _extract_media_from_entry(entry)
            translation = await translate_article(title, summary)

            return {
                "id": entry.get("id", entry.get("link", "")),
                "title": title,
                "title_ko": translation.get("title_ko"),
                "summary": summary,
                "summary_ko": translation.get("summary_ko"),
                "url": entry.get("link", ""),
                "published_at": entry.get("published", ""),
                "source": "Yahoo Finance",
                "image": media.get("image"),
                "video_url": media.get("video_url"),
                "video_thumbnail": media.get("video_thumbnail"),
                "media_type": media.get("media_type", "article"),
                "tickers": _extract_tickers(title + " " + summary),
                "sentiment": _sentiment_score(title + " " + summary),
                "importance": "high" if any(
                    w in title.lower() for w in ["fed", "earnings", "crash", "rally", "recession", "rate"]
                ) else "normal",
                "data_source": "yahoo_rss",
            }

        tasks = [process_entry(e) for e in feed.entries[:limit]]
        articles = await asyncio.gather(*tasks)
        articles = [a for a in articles if a]

    except Exception as e:
        articles = []

    _news_cache[cache_key] = list(articles)
    return list(articles)


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

        async with httpx.AsyncClient(timeout=10) as client:
            if symbol:
                url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={week_ago}&to={today}&token={settings.FINNHUB_API_KEY}"
            else:
                url = f"https://finnhub.io/api/v1/news?category=general&token={settings.FINNHUB_API_KEY}"
            resp = await client.get(url)
            data = resp.json()

        async def process_item(item):
            title = item.get("headline", "")
            summary = item.get("summary", "")[:300]
            translation = await translate_article(title, summary)
            return {
                "id": str(item.get("id", "")),
                "title": title,
                "title_ko": translation.get("title_ko"),
                "summary": summary,
                "summary_ko": translation.get("summary_ko"),
                "url": item.get("url", ""),
                "published_at": str(item.get("datetime", "")),
                "source": item.get("source", "Finnhub"),
                "image": item.get("image") or None,
                "tickers": [item["related"]] if item.get("related") else _extract_tickers(title),
                "sentiment": _sentiment_score(title + summary),
                "importance": "normal",
                "data_source": "finnhub",
            }

        tasks = [process_item(item) for item in data[:limit]]
        articles = await asyncio.gather(*tasks)
        articles = [a for a in articles if a]
        _news_cache[cache_key] = list(articles)
        return list(articles)

    except Exception:
        return []


async def get_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    finnhub = await get_finnhub_news(symbol, limit)
    if finnhub:
        return finnhub
    return await get_yahoo_news(symbol, limit)


async def translate_with_gemini(text: str, api_key: Optional[str] = None) -> Optional[str]:
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        result = await _translate_mymemory(text)
        return result
    return await _translate_gemini(text, key)
