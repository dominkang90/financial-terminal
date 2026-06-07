"""
AI 분석 서비스. Gemini API 키가 있으면 사용하고,
없으면 규칙 기반 간단 분석으로 폴백.
"""
import asyncio
from typing import Optional, Dict, Any, List

from app.core.config import settings


RULE_BASED_TEMPLATES = {
    "bullish": "기술적으로 상승 추세입니다. RSI가 과매도 구간에서 반등하는 신호가 보입니다.",
    "bearish": "기술적으로 하락 추세입니다. 거래량 감소와 함께 지지선 이탈 위험이 있습니다.",
    "neutral": "현재 방향성이 불명확합니다. 주요 지지/저항 레벨을 관찰하며 대응하세요.",
}

GEMINI_FALLBACK_MODELS = ("gemini-2.0-flash", "gemini-1.5-flash")


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
        f"📊 **{name}({symbol}) 간단 분석** (규칙 기반 — Gemini API 키 없음)",
        f"",
        f"현재가: {cs}{price:,.{dec}f}  |  전일 대비: {'+' if change_pct > 0 else ''}{change_pct:.2f}%",
        f"",
    ]

    if abs_pct > 5:
        lines.append(f"⚠️ 오늘 {abs_pct:.1f}% 급{direction}했습니다. 주요 이벤트나 뉴스를 확인하세요.")
    elif abs_pct > 2:
        lines.append(f"오늘 {abs_pct:.1f}% {direction}하며 상대적으로 큰 움직임을 보이고 있습니다.")
    else:
        lines.append(f"오늘 {abs_pct:.1f}% {direction}하며 비교적 안정적인 거래를 보이고 있습니다.")

    if news_sentiment == "positive":
        lines.append("뉴스 감성: 긍정적 📈")
    elif news_sentiment == "negative":
        lines.append("뉴스 감성: 부정적 📉")

    pe = quote.get("pe_ratio")
    if pe:
        lines.append(f"P/E: {pe:.1f}")
        if pe < 15:
            lines.append("→ P/E 기준 상대적 저평가 구간입니다.")
        elif pe > 40:
            lines.append("→ P/E 기준 상대적 고평가 구간입니다.")

    lines.append("")
    lines.append("*실제 AI 분석을 위해 설정에서 Gemini API 키를 입력하세요.*")
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
            "note": "Gemini API 키가 없어 규칙 기반 분석을 사용합니다.",
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

        prompt = f"""당신은 전문 투자 분석가입니다. 다음 정보를 바탕으로 {symbol} 종목을 한국어로 분석해주세요.

**시세 정보:**
{quote_str}

**최근 뉴스:**
{news_titles[:500] if news_titles else '없음'}

다음을 포함하여 500자 이내로 분석해주세요:
1. 현재 주가 동향 평가
2. 주요 리스크 요인
3. 투자자가 주목할 포인트
4. 단기 전망 (상승/중립/하락)

⚠️ 이 분석은 참고용이며 투자 권유가 아닙니다."""

        response = await _generate_gemini_text(prompt, api_key)
        return {
            "analysis": response["text"],
            "method": "gemini",
            "model": response["model"],
        }
    except Exception as e:
        return {
            "analysis": _rule_based_analysis(quote or {}, news_sentiment),
            "method": "rule_based_fallback",
            "error": f"Gemini 오류: {str(e)}",
        }


RULE_CHAT_QA: List[tuple] = [
    (["rsi", "상대강도"], "RSI(상대강도지수)는 0~100 사이 값으로, 70 이상이면 과매수(너무 많이 올랐을 수 있음), 30 이하면 과매도(너무 많이 떨어졌을 수 있음) 신호입니다. 추세 전환 시점을 파악할 때 많이 씁니다."),
    (["per", "p/e", "pe 비율", "pe비율"], "PER(주가수익비율)은 주가를 주당순이익(EPS)으로 나눈 값입니다. PER이 낮을수록 이익 대비 저평가, 높을수록 고평가 또는 성장 기대가 반영된 것입니다. 같은 업종 내 비교가 중요합니다."),
    (["pbr", "p/b"], "PBR(주가순자산비율)은 주가를 주당순자산(BPS)으로 나눈 값입니다. 1 미만이면 자산 대비 저평가로 볼 수 있습니다."),
    (["52주", "52w"], "52주 고가/저가는 최근 1년간 최고가와 최저가입니다. 현재 주가가 52주 고가에 근접하면 강한 추세, 저가에 근접하면 지지 여부가 중요합니다."),
    (["배당", "dividend"], "배당수익률은 연간 배당금을 현재 주가로 나눈 비율입니다. 배당주 투자는 안정적인 현금흐름이 장점이지만, 성장보다 배당을 선호하는 기업 특성을 고려해야 합니다."),
    (["etf"], "ETF(상장지수펀드)는 특정 지수나 자산을 추종하는 펀드로 주식처럼 거래할 수 있습니다. SPY는 S&P500, QQQ는 나스닥100을 추종합니다. 분산투자 효과가 있습니다."),
    (["시총", "시가총액", "market cap"], "시가총액은 주가 × 총 발행주식수로, 회사 전체 가치를 의미합니다. 대형주(Large-cap)는 시총 100억 달러 이상, 소형주(Small-cap)는 20억 달러 미만으로 구분합니다."),
    (["환율", "달러", "원화"], "원/달러 환율이 오르면(원화 약세) 수출 기업에 유리하고 수입 비용은 증가합니다. 외국인 투자자 입장에서 환율 변동은 실제 수익률에 영향을 줍니다."),
    (["금리", "연준", "fed"], "연준(Fed)이 금리를 올리면 주식 시장에 단기 부담이 됩니다. 고금리 환경에서는 채권 매력도가 높아지고, 성장주보다 가치주가 상대적으로 유리할 수 있습니다."),
]


def _rule_based_chat(message: str, context: Optional[Dict] = None) -> str:
    lower = message.lower()
    for keywords, answer in RULE_CHAT_QA:
        if any(kw in lower for kw in keywords):
            symbol = context.get("symbol", "") if context else ""
            if symbol:
                return f"{answer}\n\n현재 선택 종목: {symbol}"
            return answer

    symbol = context.get("symbol", "") if context else ""
    quote = context.get("quote") if context else None
    if symbol and quote and isinstance(quote, dict) and quote.get("data_status") != "error":
        price = quote.get("price", 0)
        change_pct = quote.get("change_pct", 0)
        cur = quote.get("currency", "USD")
        cs = "₩" if cur == "KRW" else "$"
        dec = 0 if cur == "KRW" else 2
        direction = "상승" if change_pct >= 0 else "하락"
        return (
            f"현재 {symbol} 종목 정보:\n"
            f"• 현재가: {cs}{price:,.{dec}f}\n"
            f"• 전일 대비: {'+' if change_pct >= 0 else ''}{change_pct:.2f}% ({direction})\n"
            f"• 거래소: {quote.get('exchange', '—')}\n\n"
            f"더 정확한 AI 분석을 원하시면 Gemini API 키를 설정에 입력해주세요."
        )

    return (
        "안녕하세요! 투자 관련 질문을 도와드립니다.\n\n"
        "현재 Gemini API 키가 없어 기본 답변만 제공됩니다.\n"
        "RSI, PER, PBR, 52주 고가, 배당, ETF, 시가총액, 환율, 금리 등 투자 용어를 물어보시면 설명해드립니다.\n\n"
        "더 정밀한 AI 분석을 원하시면 설정에서 Gemini API 키를 입력해주세요."
    )


async def chat_with_ai(
    message: str,
    context: Optional[Dict] = None,
    user_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    api_key = user_api_key or settings.GEMINI_API_KEY

    if not api_key:
        return {
            "reply": _rule_based_chat(message, context),
            "method": "rule_based",
        }

    try:
        system = "당신은 미국 주식 투자 전문가 AI입니다. 한국어로 친절하고 정확하게 답변해주세요. 투자 권유는 하지 않으며, 교육적 정보만 제공합니다."
        full_prompt = f"{system}\n\n사용자: {message}"

        response = await _generate_gemini_text(full_prompt, api_key)
        return {"reply": response["text"], "method": "gemini", "model": response["model"]}
    except Exception as e:
        return {"reply": f"AI 응답 오류: {str(e)}", "method": "error"}
