"""
뉴스 서비스.
- 일반 뉴스: 한국 주요 주식/경제 RSS 우선 (연합뉴스, 연합인포맥스 등)
- 종목 뉴스: Finnhub → Yahoo Finance RSS
- 유튜브 뉴스: 주요 금융 채널 RSS를 태그/인사이트와 함께 제공
"""
import asyncio
import time
import re
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any, Optional, Tuple

from cachetools import TTLCache
import feedparser
import httpx

from app.core.config import settings

_news_cache: TTLCache = TTLCache(maxsize=300, ttl=settings.NEWS_CACHE_TTL)
_translate_cache: TTLCache = TTLCache(maxsize=1000, ttl=3600)

KOREAN_NEWS_FEEDS = [
    {
        "source": "연합뉴스 경제",
        "url": "https://www.yna.co.kr/rss/economy.xml",
        "default_image": "https://www.yna.co.kr/favicon.ico",
    },
    {
        "source": "연합뉴스 산업",
        "url": "https://www.yna.co.kr/rss/industry.xml",
        "default_image": "https://www.yna.co.kr/favicon.ico",
    },
    {
        "source": "연합인포맥스",
        "url": "https://news.einfomax.co.kr/rss/allArticle.xml",
        "default_image": "https://news.einfomax.co.kr/favicon.ico",
    },
]

YOUTUBE_CHANNELS = [
    {
        "source": "연합뉴스TV",
        "channel_id": "UCTHCOPwqNfZ0uiKOvFyhGwg",
        "topic_hint": "macro",
        "tags": ["속보", "한국증시", "정책"],
    },
    {
        "source": "매일경제TV",
        "channel_id": "UCH8mTTzd0oyBQVFUiPoW4CQ",
        "topic_hint": "korea-market",
        "tags": ["코스피", "코스닥", "종목"],
    },
    {
        "source": "삼프로TV 3PROTV",
        "channel_id": "UChlv4GSd7OQl3js-jkLOnFA",
        "topic_hint": "macro",
        "tags": ["거시경제", "미국증시", "전략"],
    },
    {
        "source": "이데일리TV",
        "channel_id": "UC3Be_np3k9mVEFD9q5qFweQ",
        "topic_hint": "korea-market",
        "tags": ["국내증시", "시장체크", "기업"],
    },
    {
        "source": "조선비즈",
        "channel_id": "UCEE10-s88CeOCDzNMLhsblw",
        "topic_hint": "global-tech",
        "tags": ["기업분석", "테크", "산업"],
    },
]

TOPIC_LABELS = {
    "all": "전체",
    "macro": "거시경제",
    "korea-market": "국내증시",
    "global-tech": "글로벌/빅테크",
    "semis-ai": "반도체/AI",
    "ev-battery": "전기차/2차전지",
}

TOPIC_KEYWORDS = {
    "macro": ["금리", "연준", "fed", "cpi", "ppi", "물가", "고용", "달러", "환율", "채권", "경기", "침체"],
    "korea-market": ["코스피", "코스닥", "국내증시", "외국인", "기관", "개인", "공매도", "상장", "ipo"],
    "global-tech": ["나스닥", "s&p", "애플", "마이크로소프트", "아마존", "메타", "구글", "테슬라", "빅테크"],
    "semis-ai": ["반도체", "ai", "엔비디아", "삼성전자", "sk하이닉스", "hbm", "데이터센터", "파운드리"],
    "ev-battery": ["전기차", "2차전지", "배터리", "테슬라", "리튬", "에코프로", "lg에너지솔루션", "catl"],
}

MARKET_RELEVANCE_KEYWORDS = {
    4: ["코스피", "코스닥", "국내증시", "미국증시", "나스닥", "s&p", "다우", "주식시장", "stock market"],
    3: ["주식", "증시", "종목", "실적", "어닝", "per", "pbr", "배당", "상장", "ipo", "etf", "환율", "금리", "연준", "fed", "반도체", "ai", "엔비디아", "삼성전자", "sk하이닉스", "테슬라", "전기차", "2차전지", "배터리", "비트코인", "이더리움", "채권", "달러", "원화", "거시경제"],
    2: ["기업", "빅테크", "경기", "침체", "인플레이션", "cpi", "ppi", "고용", "관세", "수출", "파운드리", "hbm", "리서치", "투자", "포트폴리오", "자산", "크립토"],
}

MARKET_EXCLUSION_KEYWORDS = {
    5: ["개표", "투표", "선거", "대통령", "총리", "국회", "특검", "탄핵", "청와대", "북한", "시진핑", "전쟁", "살인", "체포", "사망"],
    4: ["날씨", "폭염", "호우", "태풍", "지진", "사건", "사고", "화재", "실종", "연예", "아이돌", "드라마", "영화", "축구", "야구", "농구", "배구", "골프"],
    2: ["속보", "뉴스쏙", "뉴스센터", "현장", "생중계"],
}

FINANCE_FOCUSED_SOURCES = {"매일경제TV", "삼프로TV 3PROTV", "이데일리TV", "조선비즈"}

TITLE_MARKET_KEYWORDS = [
    "주식", "증시", "코스피", "코스닥", "국내증시", "미국증시", "나스닥", "s&p", "다우",
    "실적", "환율", "금리", "연준", "fed", "반도체", "ai", "엔비디아", "삼성전자",
    "sk하이닉스", "테슬라", "비트코인", "이더리움", "2차전지", "배터리", "ipo", "etf", "투자",
]


def _clean_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def _extract_tickers(text: str) -> List[str]:
    tickers = re.findall(r"\b([A-Z]{1,5})\b", text)
    stopwords = {
        "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN", "HER",
        "WAS", "ONE", "OUR", "OUT", "WHO", "HIS", "HAS", "ITS", "NEW", "NOW",
        "CEO", "CFO", "SEC", "ETF", "IPO", "FED", "GDP", "CPI", "PCE", "US",
        "WILL", "FROM", "WITH", "THIS", "THAT", "THEY", "BEEN", "HAVE", "AI",
        "INTO", "OVER", "THAN", "THEN", "WHEN", "WHAT", "SAYS", "SAID",
    }
    return list(dict.fromkeys(t for t in tickers if t not in stopwords and len(t) >= 2))[:5]


def _sentiment_score(text: str) -> str:
    positive = ["surge", "rally", "gain", "rise", "beat", "record", "growth", "profit", "strong", "upgrade", "bullish", "jump", "soar", "high", "반등", "상승"]
    negative = ["fall", "drop", "plunge", "decline", "miss", "loss", "weak", "downgrade", "bearish", "cut", "layoff", "crash", "low", "sell", "하락", "급락"]
    text_lower = (text or "").lower()
    pos = sum(1 for w in positive if w in text_lower)
    neg = sum(1 for w in negative if w in text_lower)
    if pos > neg + 1:
        return "positive"
    if neg > pos + 1:
        return "negative"
    return "neutral"


def _extract_youtube_id(url: str) -> Optional[str]:
    patterns = [
        r"youtube\.com/watch\?v=([^&\s]+)",
        r"youtu\.be/([^?\s]+)",
        r"youtube\.com/embed/([^?\s]+)",
        r"youtube\.com/shorts/([^?\s]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url or "")
        if match:
            return match.group(1)
    return None


def _extract_media_from_entry(entry: Any) -> dict:
    result = {"image": None, "video_url": None, "video_thumbnail": None, "media_type": "article"}
    link = entry.get("link", "")
    yt_id = _extract_youtube_id(link)
    if yt_id:
        result["video_url"] = link
        result["video_thumbnail"] = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
        result["media_type"] = "video"
        return result

    if hasattr(entry, "media_content") and entry.media_content:
        for media in entry.media_content:
            url = media.get("url", "")
            media_type = media.get("type", "")
            if "video" in media_type or url.endswith((".mp4", ".m3u8")):
                yt_id = _extract_youtube_id(url)
                if yt_id:
                    result["video_url"] = url
                    result["video_thumbnail"] = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"
                else:
                    result["video_url"] = url
                    result["video_thumbnail"] = media.get("thumbnail", {}).get("url")
                result["media_type"] = "video"
                return result
            if url and any(ext in url.lower() for ext in [".jpg", ".jpeg", ".png", ".webp"]):
                result["image"] = url

    if hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
        thumb = entry.media_thumbnail[0].get("url", "")
        if thumb and not result["image"]:
            result["image"] = thumb

    if hasattr(entry, "enclosures") and entry.enclosures:
        for enclosure in entry.enclosures:
            enc_type = enclosure.get("type", "")
            href = enclosure.get("href", "")
            if "image" in enc_type and not result["image"]:
                result["image"] = href

    summary = entry.get("summary", "")
    if summary:
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary)
        if img_match and not result["image"]:
            result["image"] = img_match.group(1)

    return result


def _parse_published(entry: Any) -> Tuple[str, int]:
    timestamp = int(time.time())
    if getattr(entry, "published_parsed", None):
        timestamp = int(time.mktime(entry.published_parsed))
    else:
        published_raw = entry.get("published") or entry.get("updated") or ""
        if published_raw:
            try:
                timestamp = int(parsedate_to_datetime(published_raw).timestamp())
            except Exception:
                pass
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(timestamp)), timestamp


def _dedupe_articles(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    deduped = []
    for item in items:
        key = (item.get("url") or "", item.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


async def _translate_mymemory(text: str) -> Optional[str]:
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
                    "de": "rkdtkdwhd@gmail.com",
                },
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
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(
            model.generate_content,
            f"다음 금융 뉴스 제목/요약을 자연스러운 한국어로 번역해줘. 번역문만 출력해:\n\n{text}",
        )
        return response.text.strip()
    except Exception:
        return None


async def translate_article(title: str, summary: str = "", user_api_key: Optional[str] = None) -> Dict[str, Optional[str]]:
    gemini_key = user_api_key or settings.GEMINI_API_KEY
    if gemini_key:
        title_kr = await _translate_gemini(title, gemini_key)
        summary_kr = await _translate_gemini(summary[:300], gemini_key) if summary else None
    else:
        title_kr = await _translate_mymemory(title)
        summary_kr = await _translate_mymemory(summary[:300]) if summary else None
    return {"title_ko": title_kr, "summary_ko": summary_kr}


async def _build_article(entry: Any, source: str, default_image: Optional[str] = None, translate: bool = False) -> Dict[str, Any]:
    title = (entry.get("title") or "").strip()
    summary = _clean_html(entry.get("summary") or entry.get("description") or "")[:400]
    published_at, published_ts = _parse_published(entry)
    media = _extract_media_from_entry(entry)
    translation = {"title_ko": None, "summary_ko": None}
    if translate and title:
        translation = await translate_article(title, summary)

    return {
        "id": entry.get("id", entry.get("link", title)),
        "title": title,
        "title_ko": translation.get("title_ko") or title,
        "summary": summary,
        "summary_ko": translation.get("summary_ko") or summary,
        "url": entry.get("link", ""),
        "published_at": published_at,
        "published_ts": published_ts,
        "source": source,
        "image": media.get("image") or default_image,
        "video_url": media.get("video_url"),
        "video_thumbnail": media.get("video_thumbnail"),
        "media_type": media.get("media_type", "article"),
        "tickers": _extract_tickers(f"{title} {summary}"),
        "sentiment": _sentiment_score(f"{title} {summary}"),
        "importance": "high" if any(w in (title + summary).lower() for w in ["금리", "연준", "반도체", "실적", "환율", "fed", "earnings", "tesla", "엔비디아"]) else "normal",
        "data_source": "rss",
    }


async def _parse_feed(url: str) -> Any:
    return await asyncio.to_thread(feedparser.parse, url)


async def get_korean_market_news(limit: int = 30) -> List[Dict[str, Any]]:
    cache_key = f"news:korean-market:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    articles: List[Dict[str, Any]] = []
    for feed in KOREAN_NEWS_FEEDS:
        try:
            parsed = await _parse_feed(feed["url"])
            tasks = [
                _build_article(entry, feed["source"], feed.get("default_image"), translate=False)
                for entry in parsed.entries[: max(limit, 15)]
            ]
            articles.extend(await asyncio.gather(*tasks))
        except Exception:
            continue

    articles = _dedupe_articles(articles)
    articles.sort(key=lambda item: item.get("published_ts", 0), reverse=True)
    trimmed = [{k: v for k, v in article.items() if k != "published_ts"} for article in articles[:limit]]
    _news_cache[cache_key] = trimmed
    return trimmed


async def get_yahoo_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    cache_key = f"news:yahoo:{symbol or 'market'}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    try:
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US" if symbol else "https://finance.yahoo.com/rss/topstories"
        parsed = await _parse_feed(url)
        tasks = [_build_article(entry, "Yahoo Finance", translate=True) for entry in parsed.entries[:limit]]
        articles = await asyncio.gather(*tasks)
        articles = [{k: v for k, v in article.items() if k != "published_ts"} for article in articles]
        _news_cache[cache_key] = articles
        return articles
    except Exception:
        return []


async def get_finnhub_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
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
                resp = await client.get(
                    "https://finnhub.io/api/v1/company-news",
                    params={"symbol": symbol, "from": week_ago, "to": today, "token": settings.FINNHUB_API_KEY},
                )
            else:
                resp = await client.get(
                    "https://finnhub.io/api/v1/news",
                    params={"category": "general", "token": settings.FINNHUB_API_KEY},
                )
            data = resp.json()

        async def process_item(item: Dict[str, Any]) -> Dict[str, Any]:
            title = item.get("headline", "")
            summary = (item.get("summary") or "")[:300]
            translation = await translate_article(title, summary)
            return {
                "id": str(item.get("id", "")),
                "title": title,
                "title_ko": translation.get("title_ko") or title,
                "summary": summary,
                "summary_ko": translation.get("summary_ko") or summary,
                "url": item.get("url", ""),
                "published_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(int(item.get("datetime", 0) or 0))),
                "source": item.get("source", "Finnhub"),
                "image": item.get("image") or None,
                "tickers": [item["related"]] if item.get("related") else _extract_tickers(title),
                "sentiment": _sentiment_score(f"{title} {summary}"),
                "importance": "normal",
                "data_source": "finnhub",
            }

        articles = await asyncio.gather(*[process_item(item) for item in data[:limit]])
        _news_cache[cache_key] = articles
        return articles
    except Exception:
        return []


def _detect_topic(text: str, topic_hint: Optional[str] = None) -> str:
    lowered = (text or "").lower()
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword.lower() in lowered for keyword in keywords):
            return topic
    return topic_hint or "macro"


def _score_market_relevance(text: str, source: str) -> int:
    lowered = (text or "").lower()
    score = 0

    for weight, keywords in MARKET_RELEVANCE_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in lowered:
                score += weight

    for weight, keywords in MARKET_EXCLUSION_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in lowered:
                score -= weight

    if source in FINANCE_FOCUSED_SOURCES:
        score += 3

    if any(keyword.lower() in lowered for keyword in TOPIC_KEYWORDS["macro"]):
        score += 1

    return score



def _has_title_market_signal(title: str) -> bool:
    lowered = (title or "").lower()
    return any(keyword.lower() in lowered for keyword in TITLE_MARKET_KEYWORDS)



def _count_market_keyword_hits(text: str) -> int:
    lowered = (text or "").lower()
    hits = 0
    for keywords in MARKET_RELEVANCE_KEYWORDS.values():
        for keyword in keywords:
            if keyword.lower() in lowered:
                hits += 1
    return hits



def _is_market_video(title: str, summary: str, source: str) -> bool:
    text = f"{title} {summary}".strip()
    score = _score_market_relevance(text, source)
    title_signal = _has_title_market_signal(title)
    keyword_hits = _count_market_keyword_hits(text)

    if source in FINANCE_FOCUSED_SOURCES:
        return score >= 3 and (title_signal or keyword_hits >= 2)

    return score >= 5 and title_signal



def _extract_topic_tags(text: str, topic: str, base_tags: Optional[List[str]] = None) -> List[str]:
    tags: List[str] = []
    if base_tags:
        tags.extend(base_tags)
    lowered = (text or "").lower()
    for candidate in [
        "금리", "환율", "연준", "코스피", "코스닥", "삼성전자", "SK하이닉스", "엔비디아",
        "테슬라", "2차전지", "반도체", "AI", "실적", "빅테크", "배터리", "정책", "관세",
    ]:
        if candidate.lower() in lowered:
            tags.append(candidate)
    tags.append(TOPIC_LABELS.get(topic, topic))
    return list(dict.fromkeys(tag for tag in tags if tag))[:6]


def _build_video_insight(title: str, summary: str, source: str, topic: str, tags: List[str]) -> str:
    focus = summary.split(". ")[0].strip() if summary else title.strip()
    focus = focus[:160]
    tag_text = ", ".join(tags[:3]) if tags else TOPIC_LABELS.get(topic, topic)
    return f"핵심 포인트: {focus}. 이 영상은 {TOPIC_LABELS.get(topic, topic)} 흐름을 다루며, 주요 키워드는 {tag_text}입니다."


def _build_overall_video_insight(videos: List[Dict[str, Any]]) -> str:
    if not videos:
        return "실시간 유튜브 영상을 아직 불러오지 못했습니다. 잠시 후 새로고침해 주세요."

    topic_counts: Dict[str, int] = {}
    tag_counts: Dict[str, int] = {}
    for video in videos:
        topic = video.get("topic", "macro")
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        for tag in video.get("tags", [])[:4]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    top_topics = sorted(topic_counts.items(), key=lambda item: item[1], reverse=True)[:2]
    top_tags = sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:4]
    topic_text = ", ".join(f"{TOPIC_LABELS.get(topic, topic)} {count}건" for topic, count in top_topics)
    tag_text = ", ".join(tag for tag, _ in top_tags) or "핵심 태그 집계 중"
    return f"최근 유튜브 흐름은 {topic_text} 중심입니다. 반복적으로 보이는 키워드는 {tag_text}이며, 빠른 시장 체감용으로 국내증시/거시경제 영상부터 확인하는 것이 좋습니다."


async def get_youtube_market_videos(limit: int = 30, topic: str = "all") -> Dict[str, Any]:
    cache_key = f"news:youtube:{topic}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    videos: List[Dict[str, Any]] = []
    for channel in YOUTUBE_CHANNELS:
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel['channel_id']}"
        try:
            parsed = await _parse_feed(feed_url)
            for entry in parsed.entries[: max(6, limit // max(len(YOUTUBE_CHANNELS), 1) + 2)]:
                title = (entry.get("title") or "").strip()
                summary = _clean_html(entry.get("summary") or entry.get("media_description") or "")[:500]
                if not _is_market_video(title, summary, channel["source"]):
                    continue
                published_at, published_ts = _parse_published(entry)
                link = entry.get("link", "")
                video_id = _extract_youtube_id(link)
                detected_topic = _detect_topic(f"{title} {summary}", channel.get("topic_hint"))
                tags = _extract_topic_tags(f"{title} {summary}", detected_topic, channel.get("tags"))
                video = {
                    "id": entry.get("yt_videoid", video_id or entry.get("id", link)),
                    "title": title,
                    "title_ko": title,
                    "summary": summary,
                    "summary_ko": summary,
                    "url": link,
                    "published_at": published_at,
                    "published_ts": published_ts,
                    "source": channel["source"],
                    "channel": channel["source"],
                    "image": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
                    "video_url": link,
                    "video_thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None,
                    "media_type": "video",
                    "tickers": _extract_tickers(f"{title} {summary}"),
                    "sentiment": _sentiment_score(f"{title} {summary}"),
                    "importance": "high" if any(k in (title + summary).lower() for k in ["속보", "긴급", "fed", "금리", "실적", "반도체"]) else "normal",
                    "data_source": "youtube_rss",
                    "topic": detected_topic,
                    "topic_label": TOPIC_LABELS.get(detected_topic, detected_topic),
                    "tags": tags,
                    "insight": _build_video_insight(title, summary, channel["source"], detected_topic, tags),
                }
                videos.append(video)
        except Exception:
            continue

    videos = _dedupe_articles(videos)
    videos.sort(key=lambda item: item.get("published_ts", 0), reverse=True)
    if topic != "all":
        videos = [video for video in videos if video.get("topic") == topic]

    trimmed = [{k: v for k, v in video.items() if k != "published_ts"} for video in videos[:limit]]
    result = {
        "videos": trimmed,
        "topics": [{"id": key, "label": value} for key, value in TOPIC_LABELS.items()],
        "overall_insight": _build_overall_video_insight(trimmed),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _news_cache[cache_key] = result
    return result


async def get_news(symbol: Optional[str] = None, limit: int = 30) -> List[Dict]:
    normalized = (symbol or "").upper().strip()
    if not normalized:
        return await get_korean_market_news(limit)

    if re.fullmatch(r"\d{6}(\.(KS|KQ))?", normalized):
        return await get_korean_market_news(limit)

    finnhub = await get_finnhub_news(normalized, limit)
    if finnhub:
        return finnhub
    return await get_yahoo_news(normalized, limit)


async def translate_with_gemini(text: str, api_key: Optional[str] = None) -> Optional[str]:
    key = api_key or settings.GEMINI_API_KEY
    if not key:
        return await _translate_mymemory(text)
    return await _translate_gemini(text, key)
