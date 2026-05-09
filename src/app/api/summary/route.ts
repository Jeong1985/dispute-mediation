import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, studentName, roomTopic } = await req.json();

    const conversation = messages
      .map((m: { role: string; content: string }) =>
        `${m.role === 'user' ? `[${studentName} 학생]` : '[AI 상담사]'}: ${m.content}`
      )
      .join('\n\n');

    const prompt = `다음은 "${studentName}" 학생이 "${roomTopic}" 상담실에서 AI 상담사와 나눈 대화입니다.

─────────────────────────────
${conversation}
─────────────────────────────

위 대화를 바탕으로 아래 형식에 맞게 보고서를 작성해 주세요. 한국어로 작성하세요.

## 육하원칙 요약

**누가:** (관련 인물 - 이니셜이나 역할로 표현)
**언제:** (사건 발생 시점)
**어디서:** (사건 발생 장소)
**무엇을:** (어떤 일이 일어났는지)
**어떻게:** (사건의 경위와 진행 과정)
**왜:** (사건의 원인 - 파악된 경우)

## 학생의 감정 상태

(대화에서 파악된 학생의 감정 상태를 2-3문장으로 요약)

## 처리 방법 추천

1. (첫 번째 추천 방법과 이유)
2. (두 번째 추천 방법과 이유)
3. (세 번째 추천 방법과 이유)

## 특이사항

(추가로 교사가 알아야 할 내용이 있다면 기술, 없다면 "없음")`;

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );

    const data = await res.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      console.error('Gemini response:', JSON.stringify(data));
      return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summary API error:', error);
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
