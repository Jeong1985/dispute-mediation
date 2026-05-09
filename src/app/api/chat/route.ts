import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { saveSessionToDrive } from '@/lib/google-drive';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `당신은 다정초등학교 분쟁조정위원회의 친절한 AI 상담 선생님입니다.
학생이 학교에서 겪은 갈등이나 어려운 상황에 대해 이야기를 들어주세요.

반드시 다음 지침을 따르세요:
1. 항상 따뜻하고 공감적인 태도로 대화하세요. 학생의 감정을 먼저 인정해 주세요.
2. 초등학생이 이해할 수 있는 쉬운 말을 사용하세요.
3. 학생을 절대 판단하거나 비난하지 마세요.
4. 자연스럽게 대화하면서 다음 정보를 파악하세요 (억지로 묻지 말고 대화 중에 자연스럽게):
   - 누가 관련되었는지
   - 언제 일어났는지
   - 어디서 일어났는지
   - 무슨 일이 있었는지
   - 어떻게 일어났는지
   - 왜 그런 일이 생겼는지 (알 수 있다면)
5. 학생이 충분히 이야기했다고 생각되면 "이야기해 주어서 고마워요. 선생님께서 이 상황을 살펴보고 도움을 주실 거예요."라고 마무리를 권유하세요.
6. 모든 대화는 반드시 한국어로 하세요.
7. 대화 시작 시 학생을 따뜻하게 맞이하고 어떤 일이 있었는지 물어봐 주세요.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, studentName, roomTopic, roomId, status, driveOnlyUpdate } =
      await req.json();

    // 상담 완료 Drive 업데이트만 요청한 경우
    if (driveOnlyUpdate && roomId) {
      await saveSessionToDrive({ roomId, studentName, roomTopic, messages, status });
      return NextResponse.json({ ok: true });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT + `\n\n학생 이름: ${studentName}\n상담 주제: ${roomTopic}`,
    });

    // Gemini는 role이 'user'/'model' (Anthropic은 'user'/'assistant')
    // 마지막 메시지가 현재 user 입력, 나머지는 history
    let currentMessage = '안녕하세요';
    const history: { role: string; parts: { text: string }[] }[] = [];

    if (messages.length > 0) {
      // 마지막 메시지를 현재 입력으로, 나머지를 history로
      const historyMessages: Message[] = messages.slice(0, -1);
      const lastMsg: Message = messages[messages.length - 1];
      currentMessage = lastMsg.role === 'user' ? lastMsg.content : '계속해주세요';

      for (const m of historyMessages) {
        history.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(currentMessage);
    const content = result.response.text();

    // Drive에 저장 (비동기, 응답을 막지 않음)
    if (roomId) {
      const allMessages = [...messages, { role: 'assistant', content }];
      saveSessionToDrive({
        roomId,
        studentName,
        roomTopic,
        messages: allMessages,
        status: status || 'ongoing',
      }).catch(console.error);
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }
}
