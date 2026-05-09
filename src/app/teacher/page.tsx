'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth, db, googleProvider, TEACHER_DOMAIN } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

interface Room {
  id: string;
  topic: string;
  teacherEmail: string;
  teacherName: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  roomId: string;
  studentName: string;
  messages: Message[];
  status: 'ongoing' | 'completed';
  roomTopic: string;
  teacherEmail: string;
  createdAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
}

export default function TeacherPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!firebaseUser.email?.endsWith(TEACHER_DOMAIN)) {
          await signOut(auth);
          alert(`다정초 교사 계정(${TEACHER_DOMAIN})만 로그인할 수 있습니다.`);
          setAuthLoading(false);
          return;
        }
        setUser(firebaseUser);
        loadRooms(firebaseUser.uid);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result.user.email?.endsWith(TEACHER_DOMAIN)) {
        await signOut(auth);
        alert(`다정초 교사 계정(${TEACHER_DOMAIN})만 로그인할 수 있습니다.`);
      }
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code !== 'auth/popup-closed-by-user') {
        alert('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRooms([]);
    setSelectedRoom(null);
    setSessions([]);
    setSelectedSession(null);
  };

  const loadRooms = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'rooms'),
        where('teacherUid', '==', uid)
      );
      const snapshot = await getDocs(q);
      const roomList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Room));
      // 최신순 정렬 (클라이언트)
      roomList.sort((a, b) => {
        const aTime = (a as any).createdAt?.seconds ?? 0;
        const bTime = (b as any).createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setRooms(roomList);
    } catch (err) {
      console.error('Load rooms error:', err);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!/^\d{4}$/.test(newRoomNumber)) {
      setCreateError('방번호는 숫자 4자리여야 합니다.');
      return;
    }
    if (!newTopic.trim()) {
      setCreateError('상담 주제를 입력해 주세요.');
      return;
    }

    setCreateLoading(true);
    try {
      const existing = await getDoc(doc(db, 'rooms', newRoomNumber));
      if (existing.exists()) {
        setCreateError('이미 사용 중인 방번호입니다. 다른 번호를 사용해 주세요.');
        setCreateLoading(false);
        return;
      }

      await setDoc(doc(db, 'rooms', newRoomNumber), {
        topic: newTopic.trim(),
        teacherEmail: user!.email,
        teacherName: user!.displayName || user!.email,
        teacherUid: user!.uid,
        createdAt: serverTimestamp(),
      });

      setNewTopic('');
      setNewRoomNumber('');
      setShowCreateRoom(false);
      loadRooms(user!.uid);
    } catch (err) {
      console.error(err);
      setCreateError('방 개설 중 오류가 발생했습니다.');
    } finally {
      setCreateLoading(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    if (!confirm(`방 ${roomId}를 삭제할까요? 관련 상담 내용도 모두 삭제됩니다.`)) return;
    try {
      // 관련 세션 삭제
      const q = query(collection(db, 'sessions'), where('roomId', '==', roomId));
      const snapshot = await getDocs(q);
      await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
      // 방 삭제
      await deleteDoc(doc(db, 'rooms', roomId));
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const openRoomDetail = async (room: Room) => {
    setSelectedRoom(room);
    setSelectedSession(null);
    setSummary('');
    setEmailSent(false);
    setSessionsLoading(true);

    try {
      const q = query(
        collection(db, 'sessions'),
        where('roomId', '==', room.id)
      );
      const snapshot = await getDocs(q);
      const sessionList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Session));
      // 최신순 정렬 (클라이언트)
      sessionList.sort((a, b) => {
        const aTime = a.updatedAt?.seconds ?? 0;
        const bTime = b.updatedAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setSessions(sessionList);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const generateSummary = async (session: Session) => {
    setSelectedSession(session);
    setSummary('');
    setEmailSent(false);
    setSummaryLoading(true);

    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: session.messages,
          studentName: session.studentName,
          roomTopic: session.roomTopic,
        }),
      });
      const data = await res.json();
      setSummary(data.summary || '요약 생성에 실패했습니다.');
    } catch {
      setSummary('요약 생성 중 오류가 발생했습니다.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const sendEmailWithPDF = async () => {
    if (!summaryRef.current || !selectedSession) return;
    setEmailSending(true);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const canvas = await html2canvas(summaryRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let yPosition = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      while (yPosition < pdfHeight) {
        if (yPosition > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -yPosition, pdfWidth, pdfHeight);
        yPosition += pageHeight;
      }

      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherEmail: user!.email,
          studentName: selectedSession.studentName,
          roomTopic: selectedSession.roomTopic,
          pdfBase64,
          summary,
        }),
      });

      if (res.ok) {
        setEmailSent(true);
      } else {
        alert('이메일 발송에 실패했습니다. 이메일 설정을 확인해 주세요.');
      }
    } catch (err) {
      console.error('PDF/email error:', err);
      alert('오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setEmailSending(false);
    }
  };

  const formatDate = (ts: { seconds: number } | null) => {
    if (!ts) return '-';
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ── Loading ──────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🏫</div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  // ── Login page ───────────────────────────────────────────
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center p-6">
        <Link href="/" className="self-start mb-8 text-blue-600 hover:text-blue-800">
          ← 처음으로
        </Link>
        <div className="card w-full max-w-sm text-center">
          <div className="text-5xl mb-4">👨‍🏫</div>
          <h1 className="text-2xl font-black text-blue-800 mb-2">교사 로그인</h1>
          <p className="text-gray-500 text-sm mb-6">
            다정초 교사 계정
            <br />
            <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{TEACHER_DOMAIN}</code>
            {' '}으로만 로그인할 수 있습니다.
          </p>
          <button onClick={handleLogin} className="btn-primary w-full flex items-center justify-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            구글 계정으로 로그인
          </button>
        </div>
      </main>
    );
  }

  // ── Summary modal ────────────────────────────────────────
  if (selectedSession) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => { setSelectedSession(null); setSummary(''); setEmailSent(false); }}
              className="btn-secondary text-sm py-2 px-4"
            >
              ← 목록으로
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {selectedSession.studentName} 학생 상담 요약
            </h2>
          </div>

          {summaryLoading ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4 animate-pulse">✨</div>
              <p className="text-gray-600">AI가 상담 내용을 요약하고 있습니다...</p>
            </div>
          ) : summary ? (
            <>
              {/* Summary content (captured for PDF) */}
              <div ref={summaryRef} className="bg-white rounded-2xl shadow-md overflow-hidden">
                {/* PDF Header */}
                <div className="bg-blue-700 text-white px-8 py-6">
                  <div className="text-xs opacity-70 mb-1">다정초등학교 분쟁조정위원회</div>
                  <h1 className="text-xl font-black">AI 상담 요약 보고서</h1>
                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div><span className="opacity-70">학생</span><br /><strong>{selectedSession.studentName}</strong></div>
                    <div><span className="opacity-70">상담 주제</span><br /><strong>{selectedSession.roomTopic}</strong></div>
                    <div>
                      <span className="opacity-70">보고 일시</span>
                      <br />
                      <strong>{new Date().toLocaleDateString('ko-KR')}</strong>
                    </div>
                  </div>
                </div>

                {/* Summary body */}
                <div className="px-8 py-6">
                  <div className="prose prose-sm max-w-none">
                    {summary.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) {
                        return (
                          <h2 key={i} className="text-base font-black text-blue-800 mt-6 mb-2 pb-1 border-b border-blue-100">
                            {line.replace('## ', '')}
                          </h2>
                        );
                      }
                      if (line.startsWith('**') && line.endsWith('**')) {
                        return <p key={i} className="font-bold text-gray-800 mt-2">{line.replace(/\*\*/g, '')}</p>;
                      }
                      if (line.match(/^\*\*(.+?)\*\*/)) {
                        const parts = line.split(/(\*\*[^*]+\*\*)/);
                        return (
                          <p key={i} className="text-gray-700 leading-relaxed">
                            {parts.map((part, j) =>
                              part.startsWith('**') && part.endsWith('**')
                                ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
                                : part
                            )}
                          </p>
                        );
                      }
                      if (line.match(/^\d+\./)) {
                        return <p key={i} className="text-gray-700 ml-4 leading-relaxed mt-1">{line}</p>;
                      }
                      if (line.trim() === '') return <br key={i} />;
                      return <p key={i} className="text-gray-700 leading-relaxed">{line}</p>;
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-3 justify-end">
                {emailSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-3 rounded-xl font-bold">
                    ✅ 이메일 발송 완료!
                  </div>
                ) : (
                  <button
                    onClick={sendEmailWithPDF}
                    disabled={emailSending}
                    className="btn-primary flex items-center gap-2"
                  >
                    {emailSending ? (
                      <>
                        <span className="animate-spin">⏳</span> PDF 생성 및 발송 중...
                      </>
                    ) : (
                      <>📧 PDF 생성 후 이메일 발송</>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Room detail (sessions list) ─────────────────────────
  if (selectedRoom) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="bg-blue-700 text-white px-6 py-4 rounded-2xl mb-4 flex justify-between items-center">
            <div>
              <button onClick={() => setSelectedRoom(null)} className="text-sm opacity-80 hover:opacity-100 mb-1 block">
                ← 대시보드로
              </button>
              <h2 className="text-xl font-black">방 {selectedRoom.id}</h2>
              <p className="text-sm opacity-80">{selectedRoom.topic}</p>
            </div>
            <div className="bg-white/20 px-4 py-2 rounded-xl text-center">
              <div className="text-2xl font-black">{sessions.length}</div>
              <div className="text-xs">상담 건</div>
            </div>
          </div>

          {/* Refresh button */}
          <div className="flex justify-end mb-3">
            <button onClick={() => openRoomDetail(selectedRoom)} className="btn-secondary text-sm py-2 px-4">
              🔄 새로고침
            </button>
          </div>

          {sessionsLoading ? (
            <div className="card text-center py-8">
              <p className="text-gray-500">로딩 중...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-500">아직 상담 내용이 없습니다.</p>
              <p className="text-sm text-gray-400 mt-1">학생들이 방번호 <strong>{selectedRoom.id}</strong>로 접속하면 나타납니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="card flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{session.studentName}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          session.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {session.status === 'completed' ? '완료' : '진행 중'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      메시지 {session.messages?.length || 0}개 · 마지막 업데이트: {formatDate(session.updatedAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => generateSummary(session)}
                    className="btn-primary text-sm py-2 px-4 whitespace-nowrap"
                  >
                    요약 보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main dashboard ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top nav */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🏫</div>
          <div>
            <div className="font-black text-blue-800">다정초 분쟁조정위원회</div>
            <div className="text-xs text-gray-400">교사 대시보드</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-gray-800">{user.displayName}</div>
            <div className="text-xs text-gray-400">{user.email}</div>
          </div>
          <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-3">
            로그아웃
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {/* Create room button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-800">내 상담실 목록</h2>
          <button onClick={() => setShowCreateRoom(true)} className="btn-primary">
            + 새 상담실 만들기
          </button>
        </div>

        {/* Rooms grid */}
        {rooms.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 text-lg">아직 개설한 상담실이 없습니다.</p>
            <p className="text-gray-400 text-sm mt-2">상담실을 만들고 학생들에게 방번호를 알려주세요.</p>
            <button onClick={() => setShowCreateRoom(true)} className="btn-primary mt-6">
              첫 번째 상담실 만들기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <div key={room.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => openRoomDetail(room)}
                  >
                    <div className="text-3xl font-black text-blue-700 tracking-widest">{room.id}</div>
                    <div className="font-bold text-gray-800 mt-1">{room.topic}</div>
                  </div>
                  <div className="flex flex-col gap-2 ml-3">
                    <div
                      className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-sm font-medium cursor-pointer hover:bg-blue-100"
                      onClick={() => openRoomDetail(room)}
                    >
                      세부 보기 →
                    </div>
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="bg-red-50 text-red-500 px-3 py-1 rounded-xl text-sm font-medium hover:bg-red-100"
                    >
                      삭제 🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create room modal */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-gray-800 mb-4">새 상담실 만들기</h3>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">상담 주제</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="예: 친구 관계, 괴롭힘 신고, 학교폭력"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  방번호 (숫자 4자리)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="예: 1234"
                  className="input-field text-center text-2xl font-bold tracking-widest"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">학생들에게 이 번호를 알려주세요.</p>
              </div>
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm">
                  {createError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateRoom(false); setCreateError(''); setNewTopic(''); setNewRoomNumber(''); }}
                  className="btn-secondary flex-1"
                >
                  취소
                </button>
                <button type="submit" disabled={createLoading} className="btn-primary flex-1">
                  {createLoading ? '만드는 중...' : '개설하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
