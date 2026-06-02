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


def _rule_based_analysis(quote: Dict, news_sentiment: str = "neutral") -> str:
    if not quote or quote.get("data_status") == "error":
        return "데이터를 불러올 수 없어 분석이 어렵습니다."

    change_pct = quote.get("change_pct", 0)
    symbol = quote.get("symbol", "")
    price = quote.get("price", 0)
    name = quote.get("name", symbol)

    direction = "상승" if change_pct > 0 else "하락"
    abs_pct = abs(change_pct)

    lines = [
        f"📊 **{name}({symbol}) 간단 분석** (규칙 기반 — Gemini API 키 없음)",
        f"",
        f"현재가: ${price:,.2f}  |  전일 대비: {'+' if change_pct > 0 else ''}{change_pct:.2f}%",
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
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        quote_str = ""
        if quote:
            quote_str = f"""
현재가: ${quote.get('price', 'N/A'):,}
전일 대비: {quote.get('change_pct', 0):+.2f}%
52주 고가: ${quote.get('52w_high', 'N/A')}
52주 저가: ${quote.get('52w_low', 'N/A')}
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

        response = await asyncio.to_thread(model.generate_content, prompt)
        return {
            "analysis": response.text,
            "method": "gemini",
            "model": "gemini-1.5-flash",
        }
    except Exception as e:
        return {
            "analysis": _rule_based_analysis(quote or {}, news_sentiment),
            "method": "rule_based_fallback",
            "error": f"Gemini 오류: {str(e)}",
        }


async def chat_with_ai(
    message: str,
    context: Optional[Dict] = None,
    user_api_key: Optional[str] = None,
) -> Dict[str, Any]:
    api_key = user_api_key or settings.GEMINI_API_KEY

    if not api_key:
        return {
            "reply": "AI 챗봇을 사용하려면 설정에서 Gemini API 키를 입력해주세요.",
            "method": "no_api_key",
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        system = "당신은 미국 주식 투자 전문가 AI입니다. 한국어로 친절하고 정확하게 답변해주세요. 투자 권유는 하지 않으며, 교육적 정보만 제공합니다."
        full_prompt = f"{system}\n\n사용자: {message}"

        response = await asyncio.to_thread(model.generate_content, full_prompt)
        return {"reply": response.text, "method": "gemini"}
    except Exception as e:
        return {"reply": f"AI 응답 오류: {str(e)}", "method": "error"}
