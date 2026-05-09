'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface StudentSession {
  roomId: string;
  studentName: string;
  pinHash: string;
  roomTopic: string;
  teacherEmail: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<StudentSession | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [completed, setCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('studentSession');
      if (!saved) {
        router.push('/student');
        return;
      }

      const info: StudentSession = JSON.parse(saved);
      setStudentInfo(info);

      try {
        const q = query(
          collection(db, 'sessions'),
          where('roomId', '==', info.roomId),
          where('studentName', '==', info.studentName),
          where('pinHash', '==', info.pinHash)
        );

        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const sessionDoc = snapshot.docs[0];
          setSessionId(sessionDoc.id);
          const data = sessionDoc.data();
          const savedMessages: Message[] = data.messages || [];
          setMessages(savedMessages);
          setCompleted(data.status === 'completed');

          if (savedMessages.length === 0) {
            await fetchInitialGreeting(info, sessionDoc.id, []);
          }
        } else {
          const newDocRef = doc(collection(db, 'sessions'));
          await setDoc(newDocRef, {
            roomId: info.roomId,
            studentName: info.studentName,
            pinHash: info.pinHash,
            roomTopic: info.roomTopic,
            teacherEmail: info.teacherEmail,
            messages: [],
            status: 'ongoing',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setSessionId(newDocRef.id);
          await fetchInitialGreeting(info, newDocRef.id, []);
        }
      } catch (err) {
        console.error('Session init error:', err);
      }

      setInitializing(false);
    };

    init();
  }, []);

  const fetchInitialGreeting = async (
    info: StudentSession,
    sid: string,
    existingMessages: Message[]
  ) => {
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          studentName: info.studentName,
          roomTopic: info.roomTopic,
          roomId: info.roomId,
        }),
      });
      const data = await res.json();
      const greeting: Message = { role: 'assistant', content: data.content };
      const newMessages = [greeting];
      setMessages(newMessages);
      await updateDoc(doc(db, 'sessions', sid), {
        messages: newMessages,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !sessionId || !studentInfo) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        messages: newMessages,
        updatedAt: serverTimestamp(),
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          studentName: studentInfo.studentName,
          roomTopic: studentInfo.roomTopic,
          roomId: studentInfo.roomId,
        }),
      });
      const data = await res.json();
      const aiMsg: Message = { role: 'assistant', content: data.content };
      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      await updateDoc(doc(db, 'sessions', sessionId), {
        messages: finalMessages,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setLoading(false);
    }
  };

  const completeSession = async () => {
    if (!sessionId || !studentInfo) return;
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    // Drive에도 완료 상태 반영
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        studentName: studentInfo.studentName,
        roomTopic: studentInfo.roomTopic,
        roomId: studentInfo.roomId,
        status: 'completed',
        driveOnlyUpdate: true,
      }),
    }).catch(console.error);
    setCompleted(true);
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert('이 브라우저는 음성 입력을 지원하지 않습니다. Chrome 브라우저를 사용해 주세요.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">💬</div>
          <p className="text-gray-600">상담실 준비 중...</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
        <div className="card text-center max-w-md w-full">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-blue-800 mb-2">상담이 완료되었어요!</h2>
          <p className="text-gray-600 mb-2">
            <strong>{studentInfo?.studentName}</strong> 학생, 용기 내서 이야기해 줘서 고마워요.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            선생님께서 내용을 확인하고 도움을 주실 거예요. 걱정하지 마세요. 💙
          </p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">
            처음 화면으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <div>
          <div className="font-bold text-lg">{studentInfo?.studentName} 학생의 상담실</div>
          <div className="text-xs opacity-80">주제: {studentInfo?.roomTopic}</div>
        </div>
        <button
          onClick={completeSession}
          className="bg-green-400 hover:bg-green-300 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors"
        >
          상담 완료 ✓
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 mt-1">
                AI
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm mr-2 flex-shrink-0">
              AI
            </div>
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex space-x-1 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-3 safe-area-pb">
        <div className="flex gap-2 items-end max-w-2xl mx-auto">
          <button
            onClick={toggleVoice}
            className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl transition-colors ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
            title={isListening ? '녹음 중지' : '마이크로 말하기'}
          >
            🎤
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isListening ? '🎤 듣고 있어요...' : '이야기를 써주세요... (Enter로 전송)'}
            rows={1}
            className="flex-1 border-2 border-gray-200 rounded-2xl px-4 py-2.5 text-[15px] focus:border-blue-400 focus:outline-none resize-none transition-colors"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        {isListening && (
          <p className="text-center text-sm text-red-500 mt-1 animate-pulse">
            🔴 말씀하세요... (버튼을 다시 누르면 중지)
          </p>
        )}
      </div>
    </div>
  );
}
