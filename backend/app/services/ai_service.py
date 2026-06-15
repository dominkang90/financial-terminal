"""
AI 분석 서비스. Gemini API 키가 있으면 사용하고,
없으면 규칙 기반 간단 분석으로 폴백.
"""
import asyncio
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from app.core.config import settings


RULE_BASED_TEMPLATES = {
    "bullish": "가격 흐름은 위쪽 힘이 조금 더 있어 보여요. 다만 RSI 같은 보조 지표는 참고 자료일 뿐이에요.",
    "bearish": "가격 흐름은 아래쪽 압력이 조금 더 있어 보여요. 놀라기보다 뉴스와 거래량을 같이 확인해요.",
    "neutral": "현재 방향은 뚜렷하지 않아요. 주요 가격대와 뉴스를 차분히 확인하는 구간에 가까워요.",
}

GEMINI_FALLBACK_MODELS = ("gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-latest")


async def _generate_gemini_text(prompt: str, api_key: str) -> Dict[str, str]:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    last_error = ""
    for model_name in dict.fromkeys([settings.GEMINI_MODEL, *GEMINI_FALLBACK_MODELS]):
        try:
            model = genai.GenerativeModel(model_name)
            response = await asyncio.to_thread(model.generate_content, prompt)
            text = getattr(response, "text", "") or ""
            if text.strip():
                return {"text": text, "model": model_name}
            last_error = f"{model_name}: empty response"
        except Exception as exc:
            last_error = f"{model_name}: {exc}"
    raise RuntimeError(last_error or "Gemini response failed")


def _build_evidence(symbol: str = "", quote: Optional[Dict] = None, news: Optional[List[Dict]] = None, method: str = "rule_based") -> Dict[str, Any]:
    news_items = news or []
    quote_status = quote.get("data_status") if isinstance(quote, dict) else None
    price = quote.get("price") if isinstance(quote, dict) else None
    currency = quote.get("currency") if isinstance(quote, dict) else None
    source = quote.get("data_source") if isinstance(quote, dict) else None
    evidence_strength = "보통" if price is not None and news_items else "제한적"
    if price is not None and len(news_items) >= 3:
        evidence_strength = "충분"
    return {
        "symbol": symbol,
        "method": method,
        "price": price,
        "currency": currency,
        "price_source": source or quote_status or "앱 시장 데이터",
        "news_count": len(news_items),
        "news_titles": [item.get("title_ko") or item.get("title") for item in news_items[:3] if item.get("title_ko") or item.get("title")],
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "reasoning_summary": "가격 변화율, 최근 뉴스 수, 데이터 제공 상태를 함께 보고 쉬운 말로 정리했어요.",
        "evidence_strength": evidence_strength,
        "safety_note": "매수·매도 지시가 아니라 공부와 점검을 돕는 참고 설명이에요.",
        "transcript_used": False,
        "transcript_note": "종목 AI 답변은 가격/뉴스 자료 기준이며, 유튜브 자막은 사용하지 않았어요.",
        "disclaimer": "투자 추천이 아니라 참고용 설명입니다.",
    }


def _rule_based_analysis(quote: Dict, news_sentiment: str = "neutral") -> str:
    if not quote or quote.get("data_status") == "error":
        return "데이터를 불러올 수 없어 분석이 어렵습니다."

    change_pct = quote.get("change_pct", 0)
    symbol = quote.get("symbol", "")
    price = quote.get("price", 0)
    name = quote.get("name", symbol)
    currency = quote.get("currency") or "USD"
    cs = "₩" if currency == "KRW" else "¥" if currency == "JPY" else "$"
    dec = 0 if currency in ("KRW", "JPY") else 2

    direction = "상승" if change_pct > 0 else "하락"
    abs_pct = abs(change_pct)

    lines = [
        f"📊 **{name}({symbol}) 종목 분석**",
        f"",
        f"현재가: {cs}{price:,.{dec}f}  |  전일 대비: {'+' if change_pct > 0 else ''}{change_pct:.2f}%",
        f"",
    ]

    if abs_pct > 5:
        lines.append(f"오늘 {abs_pct:.1f}% 크게 {direction}했어요. 놀라기보다 관련 뉴스가 있었는지 먼저 확인해보면 좋아요.")
    elif abs_pct > 2:
        lines.append(f"오늘 {abs_pct:.1f}% {direction}했어요. 평소보다 움직임이 조금 큰 편이라 이유를 확인해볼 만해요.")
    else:
        lines.append(f"오늘 {abs_pct:.1f}% {direction}했어요. 아직은 큰 변화보다 흐름을 차분히 보는 구간에 가까워요.")

    if news_sentiment == "positive":
        lines.append("뉴스 감성: 긍정적 📈")
    elif news_sentiment == "negative":
        lines.append("뉴스 감성: 부정적 📉")

    pe = quote.get("pe_ratio")
    if pe:
        lines.append(f"P/E: {pe:.1f}")
        if pe < 15:
            lines.append("→ PER만 보면 가격 부담이 낮아 보일 수 있어요. 다만 업종 평균과 함께 봐야 해요.")
        elif pe > 40:
            lines.append("→ PER만 보면 가격 부담이 커 보일 수 있어요. 성장 기대가 반영됐는지도 같이 봐야 해요.")

    lines.append("")
    lines.append("왜 이렇게 봤나요? 오늘 가격 변화, 최근 뉴스 분위기, 기본 지표를 같이 봤기 때문이에요.")
    lines.append("이 내용은 투자 추천이 아니라 공부용 참고 설명입니다.")

    return "\n".join(lines)


async def analyze_stock(
    symbol: str,
    quote: Optional[Dict] = None,
    news: Optional[List[Dict]] = None,
    user_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    api_key = user_api_key or settings.GEMINI_API_KEY

    news_titles = " ".join([n.get("title", "") for n in (news or [])[:5]])
    news_sentiment = "neutral"
    if news:
        sentiments = [n.get("sentiment", "neutral") for n in news[:10]]
        pos = sentiments.count("positive")
        neg = sentiments.count("negative")
        if pos > neg:
            news_sentiment = "positive"
        elif neg > pos:
            news_sentiment = "negative"

    if not api_key:
        return {
            "analysis": _rule_based_analysis(quote or {}, news_sentiment),
            "method": "rule_based",
            "note": "",
            "evidence": _build_evidence(symbol, quote, news, "rule_based"),
        }

    try:
        quote_str = ""
        if quote:
            cur = quote.get("currency") or "USD"
            cs = "₩" if cur == "KRW" else "¥" if cur == "JPY" else "$"
            quote_str = f"""
현재가: {cs}{quote.get('price', 'N/A'):,} ({cur})
전일 대비: {quote.get('change_pct', 0):+.2f}%
52주 고가: {cs}{quote.get('52w_high', 'N/A')}
52주 저가: {cs}{quote.get('52w_low', 'N/A')}
P/E: {quote.get('pe_ratio', 'N/A')}
섹터: {quote.get('sector', 'N/A')}
"""

        prompt = f"""당신은 초보자에게 금융을 쉽게 설명하는 도우미입니다. 다음 정보를 바탕으로 {symbol} 종목을 한국어로 분석해주세요.

**시세 정보:**
{quote_str}

**최근 뉴스:**
{news_titles[:500] if news_titles else '없음'}

규칙:
- 매수/매도/보유처럼 투자 행동을 지시하지 마세요.
- 무서운 말투를 피하고, 초등학교 5학년도 이해할 수 있게 쉽게 말하세요.
- 확실하지 않은 내용은 "확인 필요"라고 말하세요.
- 500자 이내로 답하세요.

다음을 포함해주세요:
1. 지금 가격 흐름을 쉬운 말로 설명
2. 왜 그렇게 봤는지 근거 2개
3. 조심해서 볼 점
4. 투자자가 스스로 확인할 질문 1개

⚠️ 이 분석은 참고용이며 투자 권유가 아닙니다."""

        response = await _generate_gemini_text(prompt, api_key)
        return {
            "analysis": response["text"],
            "method": "gemini",
            "model": response["model"],
            "evidence": _build_evidence(symbol, quote, news, "gemini"),
        }
    except Exception as e:
        return {
            "analysis": _rule_based_analysis(quote or {}, news_sentiment),
            "method": "rule_based_fallback",
            "error": f"Gemini 오류: {str(e)}",
            "evidence": _build_evidence(symbol, quote, news, "rule_based_fallback"),
        }


RULE_CHAT_QA: List[tuple] = [
    (["rsi", "상대강도"], "RSI(상대강도지수)는 주가가 최근에 너무 빠르게 올랐는지, 너무 빠르게 떨어졌는지 보는 온도계 같은 숫자예요. 70 이상이면 많이 뜨거운 편, 30 이하면 많이 식은 편으로 봐요. 단, 이것 하나만 보고 투자하면 안 돼요."),
    (["per", "p/e", "pe 비율", "pe비율"], "PER(주가수익비율)은 회사가 버는 돈에 비해 주가가 어느 정도인지 보는 숫자예요. 높다고 무조건 나쁜 건 아니고, 사람들이 앞으로 더 성장할 거라고 기대해서 높을 수도 있어요. 같은 업종의 비슷한 회사와 비교해야 더 안전해요."),
    (["pbr", "p/b"], "PBR(주가순자산비율)은 회사의 순자산에 비해 주가가 어느 정도인지 보는 숫자예요. 1보다 낮으면 자산 기준으로 싸 보일 수 있지만, 회사의 수익성이나 미래 전망도 같이 봐야 해요."),
    (["52주", "52w"], "52주 고가/저가는 최근 1년 동안 가장 높았던 가격과 낮았던 가격이에요. 지금 가격이 그 범위에서 어디쯤인지 보면, 너무 들뜬 구간인지 너무 눌린 구간인지 살펴볼 수 있어요."),
    (["배당", "dividend"], "배당수익률은 주가에 비해 배당금을 얼마나 주는지 보는 숫자예요. 배당이 높아 보여도 회사가 계속 배당을 줄 수 있는지 함께 확인해야 해요."),
    (["etf"], "ETF(상장지수펀드)는 여러 주식을 한 바구니에 담아 주식처럼 사고팔 수 있는 상품이에요. SPY는 S&P500, QQQ는 나스닥100을 따라가서 한 종목보다 분산 효과가 있어요."),
    (["시총", "시가총액", "market cap"], "시가총액은 주가 × 총 발행주식수로 계산한 회사 전체 크기예요. 회사의 덩치를 보는 숫자라고 생각하면 쉬워요."),
    (["환율", "달러", "원화"], "원/달러 환율이 오르면 원화 가치가 약해졌다는 뜻이에요. 수출 기업, 수입 비용, 해외 주식 수익률에 영향을 줄 수 있어요."),
    (["금리", "연준", "fed"], "금리가 오르면 돈을 빌리는 비용이 커져서 주식 시장에는 부담이 될 수 있어요. 특히 먼 미래 성장 기대가 큰 회사는 금리 변화에 더 민감할 수 있어요."),
]


RECOMMENDATION_INTENT_KEYWORDS = (
    "사도 돼", "사야", "사라", "매수", "매도", "팔아", "팔까", "팔아야", "보유", "홀드",
    "바로 투자", "투자해도", "몰빵", "추천해", "뭐 사", "buy", "sell", "hold",
)


def _has_recommendation_intent(message: str) -> bool:
    lower = message.lower().replace(" ", "")
    compact_keywords = [kw.lower().replace(" ", "") for kw in RECOMMENDATION_INTENT_KEYWORDS]
    return any(kw in lower for kw in compact_keywords)


def _extract_requested_symbol(message: str) -> Optional[str]:
    matches = re.findall(r"\b[A-Z]{1,5}\b", message)
    return matches[0] if matches else None


def _safe_recommendation_response(message: str, context: Optional[Dict] = None) -> str:
    context_symbol = context.get("symbol", "선택 종목") if context else "선택 종목"
    requested_symbol = _extract_requested_symbol(message)
    symbol = requested_symbol or context_symbol
    quote = context.get("quote") if context else None
    price_line = ""
    if requested_symbol and requested_symbol != context_symbol:
        price_line = f"\n지금 앱에서 선택된 종목은 {context_symbol}이라 {requested_symbol} 가격은 먼저 따로 확인해야 해요."
    elif isinstance(quote, dict) and quote.get("data_status") != "error" and quote.get("price") is not None:
        cur = quote.get("currency", "USD")
        cs = "₩" if cur == "KRW" else "¥" if cur == "JPY" else "$"
        dec = 0 if cur in ("KRW", "JPY") else 2
        change_pct = quote.get("change_pct", 0)
        price_line = f"\n현재 앱에 보이는 {symbol} 값은 {cs}{quote.get('price'):,.{dec}f}, 전일 대비 {change_pct:+.2f}%예요. 이 값도 지연될 수 있어요."

    return (
        "사라/팔라처럼 바로 행동을 정해드릴 수는 없어요. 그건 투자 추천이 될 수 있기 때문이에요."
        f"{price_line}\n\n"
        "대신 이렇게 차분히 확인해보면 좋아요:\n"
        "1. 가격이 왜 움직였는지 뉴스나 실적 이유가 있는지 보기\n"
        "2. PER, 매출 성장, 이익 흐름을 같은 업종 회사와 비교하기\n"
        "3. 내가 감당할 수 있는 손실 범위를 먼저 정하기\n"
        "4. 하루 뉴스 하나만 보고 바로 결정하지 않기\n\n"
        "왜 이렇게 말했나요? 가격 하나나 뉴스 하나만으로는 충분한 근거가 아니기 때문이에요.\n"
        "이 답변은 투자 권유가 아니라 스스로 점검하도록 돕는 참고 설명입니다."
    )


def _with_safety_footer(answer: str) -> str:
    footer = "투자 추천이 아니라 공부와 점검을 돕는 참고 설명입니다."
    return answer if footer in answer or "투자 추천" in answer or "투자 권유" in answer else f"{answer}\n\n{footer}"


def _rule_based_chat(message: str, context: Optional[Dict] = None) -> str:
    lower = message.lower()
    if _has_recommendation_intent(message):
        return _safe_recommendation_response(message, context)

    for keywords, answer in RULE_CHAT_QA:
        if any(kw in lower for kw in keywords):
            symbol = context.get("symbol", "") if context else ""
            if symbol:
                return _with_safety_footer(f"{answer}\n\n현재 선택 종목: {symbol}")
            return _with_safety_footer(answer)

    symbol = context.get("symbol", "") if context else ""
    quote = context.get("quote") if context else None
    if symbol and quote and isinstance(quote, dict) and quote.get("data_status") != "error":
        price = quote.get("price", 0)
        change_pct = quote.get("change_pct", 0)
        cur = quote.get("currency", "USD")
        cs = "₩" if cur == "KRW" else "$"
        dec = 0 if cur == "KRW" else 2
        direction = "상승" if change_pct >= 0 else "하락"
        return _with_safety_footer(
            f"현재 {symbol} 종목 정보:\n"
            f"• 현재가: {cs}{price:,.{dec}f}\n"
            f"• 전일 대비: {'+' if change_pct >= 0 else ''}{change_pct:.2f}% ({direction})\n"
            f"• 거래소: {quote.get('exchange', '—')}\n\n"
            f"RSI, PER, PBR, 배당, ETF 등 투자 용어에 대해 질문해보세요!"
        )

    return _with_safety_footer(
        "안녕하세요! 투자 관련 질문을 도와드립니다.\n\n"
        "RSI, PER, PBR, 52주 고가, 배당, ETF, 시가총액, 환율, 금리 등 투자 용어를 물어보시면 설명해드립니다."
    )


async def chat_with_ai(
    message: str,
    context: Optional[Dict] = None,
    user_api_key: Optional[str] = None,
    news: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    api_key = user_api_key or settings.GEMINI_API_KEY

    symbol = context.get("symbol", "") if context else ""
    quote = context.get("quote") if context else None

    if _has_recommendation_intent(message):
        return {
            "reply": _safe_recommendation_response(message, context),
            "method": "safety_guard",
            "evidence": _build_evidence(symbol, quote, news, "safety_guard"),
        }

    if not api_key:
        return {
            "reply": _rule_based_chat(message, context),
            "method": "rule_based",
            "evidence": _build_evidence(symbol, quote, news, "rule_based"),
        }

    try:
        symbol = context.get("symbol", "") if context else ""
        quote = context.get("quote") if context else None
        quote_line = ""
        if isinstance(quote, dict) and quote.get("data_status") != "error":
            quote_line = f"선택 종목 {symbol}: 현재가 {quote.get('price')} {quote.get('currency', '')}, 등락률 {quote.get('change_pct', 0):+.2f}%"
        system = "당신은 초보자에게 주식과 금융을 쉽게 설명하는 AI입니다. 한국어로 친절하고 차분하게 답하세요. 매수·매도·보유·비중 확대·바로 투자 같은 행동 지시는 절대 하지 마세요. 사용자가 사도 되는지/팔아야 하는지 물어도 결론을 대신 내리지 말고, 확인할 기준만 알려주세요. 답변에는 '왜 이렇게 말했는지' 근거와 '투자 추천이 아님'을 짧게 포함하세요."
        full_prompt = f"{system}\n\n앱이 가진 자료:\n{quote_line}\n뉴스 개수: {len(news or [])}\n\n사용자: {message}"

        response = await _generate_gemini_text(full_prompt, api_key)
        return {"reply": response["text"], "method": "gemini", "model": response["model"], "evidence": _build_evidence(symbol, quote, news, "gemini")}
    except Exception:
        symbol = context.get("symbol", "") if context else ""
        quote = context.get("quote") if context else None
        return {
            "reply": _rule_based_chat(message, context),
            "method": "rule_based_fallback",
            "evidence": _build_evidence(symbol, quote, news, "rule_based_fallback"),
        }
