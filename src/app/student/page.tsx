'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function StudentPage() {
  const router = useRouter();
  const [roomNumber, setRoomNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (roomNumber.length !== 4 || !/^\d{4}$/.test(roomNumber)) {
      setError('방번호는 숫자 4자리로 입력해 주세요.');
      return;
    }
    if (!studentName.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    if (pin.length < 4) {
      setError('개인번호는 4자리 이상 입력해 주세요.');
      return;
    }

    setLoading(true);

    try {
      const roomDoc = await getDoc(doc(db, 'rooms', roomNumber));
      if (!roomDoc.exists()) {
        setError('존재하지 않는 방번호입니다. 선생님께 방번호를 다시 확인해 주세요.');
        setLoading(false);
        return;
      }

      const roomData = roomDoc.data();
      const pinHash = await hashPin(pin);

      localStorage.setItem(
        'studentSession',
        JSON.stringify({
          roomId: roomNumber,
          studentName: studentName.trim(),
          pinHash,
          roomTopic: roomData.topic,
          teacherEmail: roomData.teacherEmail,
        })
      );

      router.push('/student/chat');
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다. 다시 시도해 주세요.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
      <Link href="/" className="self-start mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-1">
        ← 처음으로
      </Link>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🧑‍🎓</div>
          <h1 className="text-2xl font-black text-blue-800">AI 상담실 입장</h1>
          <p className="text-gray-500 mt-2 text-sm">선생님이 알려준 방번호와 이름을 입력해 주세요.</p>
        </div>

        <div className="card">
          <form onSubmit={handleEnter} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">방번호 (숫자 4자리)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="예: 1234"
                className="input-field text-center text-2xl font-bold tracking-widest"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="내 이름을 써주세요"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                개인번호
                <span className="font-normal text-gray-400 ml-1">(4자리 이상, 나만 아는 숫자)</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="나만 아는 번호를 정해주세요"
                className="input-field"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                💡 다시 접속할 때 같은 번호를 쓰면 이전 상담을 이어갈 수 있어요.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full text-lg">
              {loading ? '확인 중...' : '상담실 입장 →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
