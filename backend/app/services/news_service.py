"""
뉴스 서비스.
- 일반 뉴스: 한국 주요 주식/경제 RSS 우선 (연합뉴스, 연합인포맥스 등)
- 종목 뉴스: Finnhub → Yahoo Finance RSS
- 유튜브 뉴스: 주요 금융 채널 RSS를 태그/인사이트와 함께 제공
"""
import asyncio
import html
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
_youtube_feed_cache: TTLCache = TTLCache(maxsize=200, ttl=43200)
_article_image_cache: TTLCache = TTLCache(maxsize=1500, ttl=21600)
_youtube_transcript_cache: TTLCache = TTLCache(maxsize=1000, ttl=43200)

KOREAN_NEWS_FEEDS = [
    {
        "source": "연합뉴스 경제",
        "url": "https://www.yna.co.kr/rss/economy.xml",
        "source_logo": "https://www.yna.co.kr/favicon.ico",
    },
    {
        "source": "연합뉴스 산업",
        "url": "https://www.yna.co.kr/rss/industry.xml",
        "source_logo": "https://www.yna.co.kr/favicon.ico",
    },
    {
        "source": "연합인포맥스",
        "url": "https://news.einfomax.co.kr/rss/allArticle.xml",
        "source_logo": "https://news.einfomax.co.kr/favicon.ico",
    },
    {
        "source": "한국경제 증권",
        "url": "https://www.hankyung.com/feed/finance",
        "source_logo": "https://www.hankyung.com/favicon.ico",
    },
    {
        "source": "매일경제 증권",
        "url": "https://www.mk.co.kr/rss/30100041/",
        "source_logo": "https://www.mk.co.kr/favicon.ico",
    },
    {
        "source": "ChosunBiz 증권",
        "url": "https://biz.chosun.com/arc/outboundfeeds/rss/category/stock/?outputType=xml",
        "source_logo": "https://biz.chosun.com/favicon.ico",
    },
]

US_MARKET_NEWS_FEEDS = [
    {
        "source": "Yahoo Finance",
        "url": "https://finance.yahoo.com/rss/topstories",
        "source_logo": "https://s.yimg.com/rz/l/favicon.ico",
    },
    {
        "source": "MarketWatch",
        "url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "source_logo": "https://www.marketwatch.com/favicon.ico",
    },
    {
        "source": "CNBC Markets",
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "source_logo": "https://www.cnbc.com/favicon.ico",
    },
    {
        "source": "Reuters Markets",
        "url": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
        "source_logo": "https://www.reuters.com/favicon.ico",
    },
]

YOUTUBE_CHANNELS = [
    # Tier S · Fact
    {"source": "Bloomberg TV", "channel_url": "https://www.youtube.com/@markets", "topic_hint": "macro", "tags": ["금리", "채권", "달러"], "tier": "s", "layer": "fact", "region": "us", "role": "원천 데이터", "finance_focused": True},
    {"source": "CNBC Television", "channel_url": "https://www.youtube.com/@CNBCtelevision", "topic_hint": "macro", "tags": ["미국증시", "실적", "연준"], "tier": "s", "layer": "fact", "region": "us", "role": "원천 데이터", "finance_focused": True},
    {"source": "Reuters", "channel_url": "https://www.youtube.com/@Reuters", "topic_hint": "macro", "tags": ["속보", "거시경제", "정책"], "tier": "s", "layer": "fact", "region": "us", "role": "원천 데이터", "finance_focused": False},
    {"source": "Yahoo Finance", "channel_url": "https://www.youtube.com/@YahooFinance", "topic_hint": "global-tech", "tags": ["미국증시", "기업실적", "시장체크"], "tier": "s", "layer": "fact", "region": "us", "role": "원천 데이터", "finance_focused": True},
    {"source": "Federal Reserve", "channel_url": "https://www.youtube.com/@federalreserve", "topic_hint": "macro", "tags": ["연준", "기준금리", "통화정책"], "tier": "s", "layer": "fact", "region": "us", "role": "원천 데이터", "finance_focused": True},
    {"source": "IMF", "channel_url": "https://www.youtube.com/@IMFVideos", "topic_hint": "macro", "tags": ["IMF", "세계경제", "전망"], "tier": "s", "layer": "fact", "region": "global", "role": "원천 데이터", "finance_focused": True},
    {"source": "한국경제TV", "channel_url": "https://www.youtube.com/@wowtvnews", "topic_hint": "korea-market", "tags": ["코스피", "코스닥", "국내증시"], "tier": "s", "layer": "fact", "region": "kr", "role": "원천 데이터", "finance_focused": True},
    {"source": "한경 글로벌마켓", "channel_url": "https://www.youtube.com/@HKglobalmarket", "topic_hint": "macro", "tags": ["미국증시", "달러", "거시경제"], "tier": "s", "layer": "fact", "region": "kr", "role": "원천 데이터", "finance_focused": True},

    # Tier A · Analysis
    {"source": "삼프로TV", "channel_url": "https://www.youtube.com/@3protv", "topic_hint": "macro", "tags": ["거시경제", "전략", "컨센서스"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "언더스탠딩", "channel_url": "https://www.youtube.com/@understanding_official", "topic_hint": "macro", "tags": ["해설", "시장구조", "경제흐름"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "이효석아카데미", "channel_url": "https://www.youtube.com/@hyoseokleeacademy", "topic_hint": "global-tech", "tags": ["미국증시", "전략", "매크로"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "오선의 미국증시", "channel_url": "https://www.youtube.com/@futuresnow", "topic_hint": "global-tech", "tags": ["나스닥", "미국증시", "시황"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "매경 월가월부", "channel_url": "https://www.youtube.com/@MKWallgaWallbu", "topic_hint": "global-tech", "tags": ["월가", "빅테크", "섹터"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "미래에셋 Smart Money", "channel_url": "https://www.youtube.com/@smartmoneymiraeasset", "topic_hint": "macro", "tags": ["리서치", "전략", "자산배분"], "tier": "a", "layer": "analysis", "region": "kr", "role": "전문가 해설", "finance_focused": True},
    {"source": "Bloomberg Technology", "channel_url": "https://www.youtube.com/@BloombergTechnology", "topic_hint": "global-tech", "tags": ["빅테크", "AI", "기업분석"], "tier": "a", "layer": "analysis", "region": "us", "role": "전문가 해설", "finance_focused": True},
    {"source": "Financial Times", "channel_url": "https://www.youtube.com/@FinancialTimes", "topic_hint": "macro", "tags": ["시장해설", "정책", "세계경제"], "tier": "a", "layer": "analysis", "region": "us", "role": "전문가 해설", "finance_focused": True},
    {"source": "The Economist", "channel_url": "https://www.youtube.com/@TheEconomist", "topic_hint": "macro", "tags": ["거시경제", "장기전망", "국제정세"], "tier": "a", "layer": "analysis", "region": "us", "role": "전문가 해설", "finance_focused": True},

    # Tier B · Future industries
    {"source": "NVIDIA", "channel_url": "https://www.youtube.com/@NVIDIA", "topic_hint": "semis-ai", "tags": ["AI", "GPU", "데이터센터"], "tier": "b", "layer": "future", "region": "us", "role": "미래산업", "finance_focused": True},
    {"source": "안될공학", "channel_url": "https://www.youtube.com/@underKGengineering", "topic_hint": "semis-ai", "tags": ["반도체", "하드웨어", "엔지니어링"], "tier": "b", "layer": "future", "region": "kr", "role": "미래산업", "finance_focused": True},
    {"source": "안될과학", "channel_url": "https://www.youtube.com/@Unrealscience", "topic_hint": "semis-ai", "tags": ["과학", "기술", "미래산업"], "tier": "b", "layer": "future", "region": "kr", "role": "미래산업", "finance_focused": False},
    {"source": "엔지니어TV", "channel_url": "https://www.youtube.com/@EngineerTVOfficial", "topic_hint": "semis-ai", "tags": ["반도체", "산업체인", "설비"], "tier": "b", "layer": "future", "region": "kr", "role": "미래산업", "finance_focused": True},
]

TIER_LABELS = {"s": "Tier S · 원천 데이터", "a": "Tier A · 전문가 해설", "b": "Tier B · 미래산업"}
LAYER_LABELS = {"fact": "원천 데이터", "analysis": "전문가 해석", "future": "미래산업", "sentiment": "시장 심리"}
REGION_LABELS = {"kr": "한국", "us": "미국", "global": "글로벌"}

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

EXCLUDED_CHANNEL_POLICY = [
    "급등주 추천 채널 제외",
    "차트 분석 위주 채널 제외",
    "코인 홍보 채널 제외",
    "정치 성향 강한 채널 제외",
    "자극적 썸네일/낚시성 채널 제외",
]

FINANCE_FOCUSED_SOURCES = {channel["source"] for channel in YOUTUBE_CHANNELS if channel.get("finance_focused")}

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


def _compact_text(text: str, max_len: int = 1800) -> str:
    cleaned = re.sub(r"\s+", " ", (text or "")).strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len].rsplit(" ", 1)[0].strip()


def _strip_youtube_noise(text: str) -> str:
    cleaned = _clean_html(text or "")
    cleaned = re.sub(r"https?://\S+|www\.\S+|\S+@\S+", " ", cleaned)
    cleaned = re.sub(r"[#][\w가-힣_]+", " ", cleaned)
    cleaned = re.sub(r"[=]{3,}", " ", cleaned)
    cleaned = re.sub(r"\[(?:music|applause|laughs?)\]", " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _is_promotional_sentence(text: str) -> bool:
    lowered = (text or "").lower()
    promo_tokens = [
        "구독", "좋아요", "알림", "멤버십", "문의", "프리미엄", "이벤트", "구매", "할인", "링크", "바로가기",
        "subscribe", "membership", "discount", "shop", "shopping",
    ]
    if "http" in lowered or "bit.ly" in lowered or "abr.ge" in lowered:
        return True
    if sum(token in lowered for token in promo_tokens) >= 2:
        return True
    return False


def _focus_sentence_score(sentence: str) -> int:
    lowered = sentence.lower()
    score = 0
    important_tokens = [
        "고용", "실업", "임금", "물가", "cpi", "ppi", "금리", "연준", "fed", "파월", "국채", "달러",
        "실적", "매출", "영업이익", "가이던스", "반도체", "ai", "엔비디아", "삼성전자", "sk하이닉스",
        "코스피", "코스닥", "나스닥", "s&p", "환율", "수급", "외국인", "기관", "관세", "정책",
    ]
    weak_tokens = ["안녕하세요", "브레이킹 뉴스", "오늘은", "여러분", "좋아요", "구독"]
    for token in important_tokens:
        if token in lowered:
            score += 3
    for token in weak_tokens:
        if token in lowered:
            score -= 4
    if any(ch.isdigit() for ch in sentence):
        score += 2
    if 35 <= len(sentence) <= 170:
        score += 1
    return score


def _pick_focus_sentences(*texts: str, limit: int = 2) -> List[str]:
    merged = " ".join(_strip_youtube_noise(text) for text in texts if text)
    merged = re.sub(r"\s+", " ", merged).strip()
    if not merged:
        return []

    parts = re.split(r"(?<=[.!?다])\s+|\n+|•|·", merged)
    candidates: List[Tuple[int, int, str]] = []
    seen = set()
    for index, part in enumerate(parts):
        sentence = part.strip(" -–—•·\t")
        if len(sentence) < 18:
            continue
        if _is_promotional_sentence(sentence):
            continue
        normalized = sentence.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        candidates.append((_focus_sentence_score(sentence), -index, sentence[:180]))

    candidates.sort(reverse=True)
    return [sentence for _, _, sentence in candidates[:limit]]


def _parse_json3_transcript(payload: Dict[str, Any]) -> str:
    chunks: List[str] = []
    for event in payload.get("events", []):
        for seg in event.get("segs", []) or []:
            text = _strip_youtube_noise(seg.get("utf8", ""))
            if text:
                chunks.append(text)
    return _compact_text(" ".join(chunks), max_len=2400)


async def _fetch_youtube_transcript(video_id: Optional[str]) -> Optional[str]:
    if not video_id:
        return None

    cache_key = f"yt-transcript:{video_id}"
    if cache_key in _youtube_transcript_cache:
        return _youtube_transcript_cache[cache_key]

    def _load_transcript() -> Optional[str]:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
        except Exception:
            YouTubeTranscriptApi = None  # type: ignore[assignment]

        if YouTubeTranscriptApi is not None:
            try:
                transcript_items: Any
                if hasattr(YouTubeTranscriptApi, "get_transcript"):
                    transcript_items = YouTubeTranscriptApi.get_transcript(video_id, languages=["ko", "en"])
                else:
                    api = YouTubeTranscriptApi()
                    fetched = api.fetch(video_id, languages=["ko", "en"])
                    transcript_items = list(fetched)

                chunks: List[str] = []
                for item in transcript_items:
                    if isinstance(item, dict):
                        text = item.get("text", "")
                    else:
                        text = getattr(item, "text", "")
                    text = _strip_youtube_noise(text)
                    if text and not _is_promotional_sentence(text):
                        chunks.append(text)

                transcript = _compact_text(" ".join(chunks), max_len=2400)
                if transcript:
                    return transcript
            except Exception:
                pass

        try:
            from yt_dlp import YoutubeDL

            ydl_opts: Any = {"quiet": True, "skip_download": True, "no_warnings": True}
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

            caption_pools = [info.get("subtitles") or {}, info.get("automatic_captions") or {}]
            preferred_langs = ["ko", "ko-orig", "en", "en-orig"]
            preferred_exts = ["json3", "srv3", "srv1", "vtt", "ttml"]

            for pool in caption_pools:
                for lang in preferred_langs:
                    tracks = pool.get(lang) or []
                    tracks = sorted(tracks, key=lambda item: preferred_exts.index(item.get("ext")) if item.get("ext") in preferred_exts else 999)
                    for track in tracks:
                        url = track.get("url")
                        ext = track.get("ext")
                        if not url:
                            continue
                        with httpx.Client(timeout=8.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
                            resp = client.get(url)
                            resp.raise_for_status()
                            if ext == "json3":
                                transcript = _parse_json3_transcript(resp.json())
                            else:
                                transcript = _compact_text(_strip_youtube_noise(resp.text), max_len=2400)
                        if transcript:
                            return transcript
        except Exception:
            return None

        return None

    transcript = await asyncio.to_thread(_load_transcript)
    _youtube_transcript_cache[cache_key] = transcript
    return transcript


async def _fetch_gemini_youtube_summary(video_url: str, title: str) -> Optional[str]:
    if not settings.GEMINI_API_KEY or not video_url:
        return None

    cache_key = f"yt-gemini-summary:{video_url}"
    if cache_key in _youtube_transcript_cache:
        return _youtube_transcript_cache[cache_key]

    prompt = (
        "다음 유튜브 영상의 실제 말하는 내용만 바탕으로 한국어 투자 요약을 만들어줘. "
        "영상 설명란, 광고 링크, 상품 홍보, 댓글, 채널 소개는 절대 쓰지 마. "
        "핵심 숫자, 시장 영향, 투자자가 확인할 포인트를 3문장으로 짧게 정리해.\n"
        f"영상 제목: {title}"
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"fileData": {"mimeType": "video/mp4", "fileUri": video_url}},
                ],
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 420},
    }

    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = " ".join(part.get("text", "") for part in parts if part.get("text"))
        summary = _compact_text(_strip_youtube_noise(text), max_len=900)
        if summary:
            _youtube_transcript_cache[cache_key] = summary
            return summary
    except Exception:
        return None

    return None


def _is_probable_article_image(url: str) -> bool:
    lowered = (url or "").lower()
    if not lowered.startswith(("http://", "https://")):
        return False
    if any(token in lowered for token in ["favicon", "logo", "icon", "sprite", "badge"]):
        return False
    return any(ext in lowered for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"]) or any(
        token in lowered for token in ["image", "thumb", "thumbnail", "photo", "upload"]
    )


async def _resolve_article_image(url: str) -> Optional[str]:
    if not url:
        return None

    cache_key = f"article-image:{url}"
    if cache_key in _article_image_cache:
        return _article_image_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(url)
            html = resp.text[:120000]
    except Exception:
        _article_image_cache[cache_key] = None
        return None

    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']',
        r'<img[^>]+src=["\']([^"\']+)["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html, flags=re.IGNORECASE)
        if not match:
            continue
        candidate = match.group(1).strip()
        if candidate.startswith("//"):
            candidate = f"https:{candidate}"
        if _is_probable_article_image(candidate):
            _article_image_cache[cache_key] = candidate
            return candidate

    _article_image_cache[cache_key] = None
    return None


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


def _interleave_articles_by_source(items: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    buckets: Dict[str, List[Dict[str, Any]]] = {}
    source_order: List[str] = []
    for item in sorted(items, key=lambda x: x.get("published_ts", 0), reverse=True):
        source = item.get("source") or "기타"
        if source not in buckets:
            buckets[source] = []
            source_order.append(source)
        buckets[source].append(item)

    mixed: List[Dict[str, Any]] = []
    while len(mixed) < limit:
        progressed = False
        for source in source_order:
            bucket = buckets.get(source, [])
            if not bucket:
                continue
            mixed.append(bucket.pop(0))
            progressed = True
            if len(mixed) >= limit:
                break
        if not progressed:
            break
    return mixed


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


async def _build_article(entry: Any, source: str, source_logo: Optional[str] = None, translate: bool = False) -> Dict[str, Any]:
    title = (entry.get("title") or "").strip()
    summary = _clean_html(entry.get("summary") or entry.get("description") or "")[:400]
    published_at, published_ts = _parse_published(entry)
    media = _extract_media_from_entry(entry)
    article_url = entry.get("link", "")
    image = media.get("image")
    if not image and article_url:
        image = await _resolve_article_image(article_url)
    translation = {"title_ko": None, "summary_ko": None}
    if translate and title:
        translation = await translate_article(title, summary)

    return {
        "id": entry.get("id", article_url or title),
        "title": title,
        "title_ko": translation.get("title_ko") or title,
        "summary": summary,
        "summary_ko": translation.get("summary_ko") or summary,
        "url": article_url,
        "published_at": published_at,
        "published_ts": published_ts,
        "source": source,
        "image": image,
        "source_logo": source_logo,
        "video_url": media.get("video_url"),
        "video_thumbnail": media.get("video_thumbnail"),
        "media_type": media.get("media_type", "article"),
        "tickers": _extract_tickers(f"{title} {summary}"),
        "sentiment": _sentiment_score(f"{title} {summary}"),
        "importance": "high" if any(w in (title + summary).lower() for w in ["금리", "연준", "반도체", "실적", "환율", "fed", "earnings", "tesla", "엔비디아"]) else "normal",
        "data_source": "rss",
    }


async def _parse_feed(url: str) -> Any:
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
        resp = await client.get(url)
        content = resp.text

    content = re.sub(r"&(nbsp|ensp|emsp|thinsp);", " ", content, flags=re.IGNORECASE)

    def _escape_unknown_entity(match: re.Match[str]) -> str:
        entity = match.group(0)
        return html.escape(entity)

    content = re.sub(
        r"&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)([A-Za-z][A-Za-z0-9]+);",
        _escape_unknown_entity,
        content,
    )
    return await asyncio.to_thread(feedparser.parse, content)


async def _resolve_youtube_feed_url(channel: Dict[str, Any]) -> Optional[str]:
    if channel.get("channel_id"):
        return f"https://www.youtube.com/feeds/videos.xml?channel_id={channel['channel_id']}"

    channel_url = channel.get("channel_url")
    if not channel_url:
        return None

    cache_key = f"yt-feed:{channel_url}"
    if cache_key in _youtube_feed_cache:
        return _youtube_feed_cache[cache_key]

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
            resp = await client.get(channel_url)
            html = resp.text
    except Exception:
        return None

    rss_match = re.search(r'https://www\.youtube\.com/feeds/videos\.xml\?channel_id=([^"&]+)', html)
    if rss_match:
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={rss_match.group(1)}"
        _youtube_feed_cache[cache_key] = feed_url
        return feed_url

    channel_match = re.search(r'"channelId":"([^"]+)"', html)
    if channel_match:
        feed_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_match.group(1)}"
        _youtube_feed_cache[cache_key] = feed_url
        return feed_url

    return None


async def get_korean_market_news(limit: int = 30) -> List[Dict[str, Any]]:
    cache_key = f"news:korean-market:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    articles: List[Dict[str, Any]] = []
    for feed in KOREAN_NEWS_FEEDS:
        try:
            parsed = await _parse_feed(feed["url"])
            tasks = [
                _build_article(entry, feed["source"], feed.get("source_logo"), translate=False)
                for entry in parsed.entries[: max(limit, 15)]
            ]
            articles.extend(await asyncio.gather(*tasks))
        except Exception:
            continue

    articles = _dedupe_articles(articles)
    mixed_articles = _interleave_articles_by_source(articles, limit)
    trimmed = [{k: v for k, v in article.items() if k != "published_ts"} for article in mixed_articles]
    _news_cache[cache_key] = trimmed
    return trimmed


async def get_us_market_news(limit: int = 30) -> List[Dict[str, Any]]:
    cache_key = f"news:us-market:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    articles: List[Dict[str, Any]] = []
    for feed in US_MARKET_NEWS_FEEDS:
        try:
            parsed = await _parse_feed(feed["url"])
            tasks = [
                _build_article(entry, feed["source"], feed.get("source_logo"), translate=True)
                for entry in parsed.entries[: max(limit, 15)]
            ]
            articles.extend(await asyncio.gather(*tasks))
        except Exception:
            continue

    articles = _dedupe_articles(articles)
    mixed_articles = _interleave_articles_by_source(articles, limit)
    trimmed = [{k: v for k, v in article.items() if k != "published_ts"} for article in mixed_articles]
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


def _build_video_insight(title: str, summary: str, content_text: Optional[str], source: str, topic: str, tags: List[str], content_basis: str = "none") -> str:
    tag_text = ", ".join(tags[:3]) if tags else TOPIC_LABELS.get(topic, topic)
    analysis_source = (content_text or summary or title or "").strip()
    focus_sentences = _pick_focus_sentences(analysis_source, limit=2)
    primary = focus_sentences[0] if focus_sentences else title.strip()
    secondary = focus_sentences[1] if len(focus_sentences) > 1 else ""

    if content_basis == "transcript":
        prefix = "자막 기준 핵심"
    elif content_basis == "video_ai":
        prefix = "영상 AI 요약 기준 핵심"
    else:
        prefix = "제목·설명 기준 핵심"

    if secondary:
        return f"{prefix}: {primary}. 이어서 {secondary}. 체크할 분야는 {tag_text}입니다."
    return f"{prefix}: {primary}. 체크할 분야는 {tag_text}입니다."


def _sentiment_to_stance(sentiment: str) -> str:
    return {
        "positive": "긍정",
        "negative": "부정",
        "neutral": "중립",
    }.get(sentiment or "neutral", "중립")


def _build_market_score(videos: List[Dict[str, Any]]) -> int:
    if not videos:
        return 50

    score = 50.0
    for video in videos:
        weight = 1.4 if video.get("importance") == "high" else 1.0
        sentiment = video.get("sentiment", "neutral")
        if sentiment == "positive":
            score += 3.2 * weight
        elif sentiment == "negative":
            score -= 3.2 * weight
        else:
            score += 0.6 * weight

        topic = video.get("topic")
        if topic in {"semis-ai", "global-tech"}:
            score += 0.5
        if topic == "macro":
            score += 0.3

    return max(0, min(100, int(round(score / max(len(videos) / 6, 1)))))


def _build_channel_consensus(videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for video in videos:
        source = video.get("source", "Unknown")
        bucket = grouped.setdefault(source, {
            "source": source,
            "count": 0,
            "score": 0.0,
            "tier": video.get("tier"),
            "tier_label": video.get("tier_label"),
            "layer_label": video.get("layer_label"),
        })
        bucket["count"] += 1
        sentiment = video.get("sentiment")
        if sentiment == "positive":
            bucket["score"] += 1.0
        elif sentiment == "negative":
            bucket["score"] -= 1.0

    consensus = []
    for item in grouped.values():
        avg = item["score"] / max(item["count"], 1)
        if avg >= 0.6:
            stance = "매우 긍정"
        elif avg >= 0.15:
            stance = "긍정"
        elif avg <= -0.6:
            stance = "매우 부정"
        elif avg <= -0.15:
            stance = "부정"
        else:
            stance = "중립"
        consensus.append({
            "source": item["source"],
            "stance": stance,
            "count": item["count"],
            "tier": item.get("tier"),
            "tier_label": item.get("tier_label"),
            "layer_label": item.get("layer_label"),
        })

    consensus.sort(key=lambda item: (item["count"], item["source"]), reverse=True)
    return consensus[:8]


def _build_filter_counts(videos: List[Dict[str, Any]], key: str, label_key: str) -> List[Dict[str, Any]]:
    counts: Dict[str, Dict[str, Any]] = {}
    for video in videos:
        item_id = video.get(key)
        label = video.get(label_key)
        if not item_id or not label:
            continue
        counts.setdefault(item_id, {"id": item_id, "label": label, "count": 0})
        counts[item_id]["count"] += 1
    return sorted(counts.values(), key=lambda item: (-item["count"], item["label"]))


def _build_youtube_desk_guide() -> Dict[str, Any]:
    return {
        "layers": [
            {"id": "fact", "label": "원천 데이터", "description": "금리, CPI, 고용, 국채금리, 실적 발표 같은 팩트 확인용", "tier": "s", "sources": ["Bloomberg TV", "CNBC Television", "Reuters", "Federal Reserve", "한국경제TV"]},
            {"id": "analysis", "label": "전문가 해석", "description": "왜 움직였는지, 앞으로 무엇을 볼지 해석하는 레이어", "tier": "a", "sources": ["삼프로TV", "언더스탠딩", "이효석아카데미", "Bloomberg Technology", "Financial Times"]},
            {"id": "future", "label": "미래산업", "description": "AI·반도체·전력·로봇 등 장기 성장축 점검용", "tier": "b", "sources": ["NVIDIA", "안될공학", "안될과학", "엔지니어TV"]},
        ],
        "excluded": EXCLUDED_CHANNEL_POLICY,
    }


def _build_overall_video_insight(videos: List[Dict[str, Any]]) -> str:
    if not videos:
        return "실시간 유튜브 영상을 아직 불러오지 못했습니다. 잠시 후 새로고침해 주세요."

    topic_counts: Dict[str, int] = {}
    tag_counts: Dict[str, int] = {}
    tier_counts: Dict[str, int] = {}
    for video in videos:
        topic = video.get("topic", "macro")
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        tier = video.get("tier", "a")
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        for tag in video.get("tags", [])[:4]:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    top_topics = sorted(topic_counts.items(), key=lambda item: item[1], reverse=True)[:2]
    top_tags = sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)[:4]
    top_tiers = sorted(tier_counts.items(), key=lambda item: item[1], reverse=True)[:2]
    topic_text = ", ".join(f"{TOPIC_LABELS.get(topic, topic)} {count}건" for topic, count in top_topics)
    tag_text = ", ".join(tag for tag, _ in top_tags) or "핵심 태그 집계 중"
    tier_text = ", ".join(f"{TIER_LABELS.get(tier, tier)} {count}건" for tier, count in top_tiers)
    return f"최근 유튜브 흐름은 {topic_text} 중심이며, 채널 레이어는 {tier_text} 비중이 큽니다. 반복적으로 보이는 키워드는 {tag_text}입니다. 빠른 판단은 Tier S로 팩트를 확인하고, Tier A로 해석을 붙인 뒤, Tier B로 AI·반도체 장기축을 점검하는 순서를 추천합니다."


async def get_youtube_market_videos(limit: int = 30, topic: str = "all") -> Dict[str, Any]:
    cache_key = f"news:youtube:{topic}:{limit}"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    videos: List[Dict[str, Any]] = []
    for channel in YOUTUBE_CHANNELS:
        feed_url = await _resolve_youtube_feed_url(channel)
        if not feed_url:
            continue
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
                transcript = await _fetch_youtube_transcript(video_id)
                content_basis = "transcript" if transcript else "none"
                content_text = transcript
                if not content_text:
                    content_text = await _fetch_gemini_youtube_summary(link, title)
                    content_basis = "video_ai" if content_text else "none"
                content_excerpt = _pick_focus_sentences(content_text or "", limit=3)
                analysis_text = _compact_text(f"{title} {content_text or ''}", max_len=3000)
                detected_topic = _detect_topic(analysis_text, channel.get("topic_hint"))
                tags = _extract_topic_tags(analysis_text, detected_topic, channel.get("tags"))
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
                    "tickers": _extract_tickers(analysis_text),
                    "sentiment": _sentiment_score(analysis_text),
                    "importance": "high" if any(k in analysis_text.lower() for k in ["속보", "긴급", "fed", "금리", "실적", "반도체"]) else "normal",
                    "data_source": "youtube_rss",
                    "topic": detected_topic,
                    "topic_label": TOPIC_LABELS.get(detected_topic, detected_topic),
                    "tier": channel.get("tier", "a"),
                    "tier_label": TIER_LABELS.get(channel.get("tier", "a"), channel.get("tier", "a")),
                    "layer": channel.get("layer", "analysis"),
                    "layer_label": LAYER_LABELS.get(channel.get("layer", "analysis"), channel.get("layer", "analysis")),
                    "region": channel.get("region", "global"),
                    "region_label": REGION_LABELS.get(channel.get("region", "global"), channel.get("region", "global")),
                    "source_role": channel.get("role", "전문가 해설"),
                    "tags": tags,
                    "transcript_available": bool(content_excerpt or content_text),
                    "content_basis": content_basis,
                    "transcript_excerpt": " ".join(content_excerpt) if content_excerpt else content_text,
                    "insight": _build_video_insight(title, summary, content_text, channel["source"], detected_topic, tags, content_basis),
                }
                videos.append(video)
        except Exception:
            continue

    videos = _dedupe_articles(videos)
    videos.sort(key=lambda item: item.get("published_ts", 0), reverse=True)
    if topic != "all":
        videos = [video for video in videos if video.get("topic") == topic]

    trimmed = [{k: v for k, v in video.items() if k != "published_ts"} for video in videos[:limit]]
    market_score = _build_market_score(trimmed)
    channel_consensus = _build_channel_consensus(trimmed)
    result = {
        "videos": trimmed,
        "topics": [{"id": key, "label": value} for key, value in TOPIC_LABELS.items()],
        "tier_filters": _build_filter_counts(trimmed, "tier", "tier_label"),
        "source_filters": _build_filter_counts(trimmed, "source", "source"),
        "desk_guide": _build_youtube_desk_guide(),
        "channel_consensus": channel_consensus,
        "market_score": market_score,
        "overall_insight": _build_overall_video_insight(trimmed),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _news_cache[cache_key] = result
    return result


async def get_news(symbol: Optional[str] = None, limit: int = 30, market: str = "kr") -> List[Dict]:
    normalized = (symbol or "").upper().strip()
    market_key = (market or "kr").lower().strip()
    if not normalized:
        if market_key == "us":
            us_news = await get_us_market_news(limit)
            if us_news:
                return us_news
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
