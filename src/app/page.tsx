'use client';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-16">
        <div className="text-6xl mb-4">🏫</div>
        <h1 className="text-4xl font-black text-blue-800 mb-2">다정초등학교</h1>
        <h2 className="text-2xl font-bold text-blue-600 mb-4">분쟁조정위원회 AI 상담실</h2>
        <p className="text-gray-500 text-lg">학교에서 어려운 일이 있나요? 편하게 이야기해 주세요.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
        <Link
          href="/teacher"
          className="flex-1 card hover:shadow-xl transition-shadow duration-200 cursor-pointer text-center group"
        >
          <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">👨‍🏫</div>
          <div className="text-xl font-bold text-gray-800">선생님</div>
          <div className="text-sm text-gray-500 mt-1">교사 로그인 및 상담실 관리</div>
        </Link>

        <Link
          href="/student"
          className="flex-1 card hover:shadow-xl transition-shadow duration-200 cursor-pointer text-center group"
        >
          <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">🧑‍🎓</div>
          <div className="text-xl font-bold text-gray-800">학생</div>
          <div className="text-sm text-gray-500 mt-1">방번호로 상담실 입장</div>
        </Link>
      </div>

      <p className="mt-12 text-xs text-gray-400 text-center">
        상담 내용은 안전하게 보호되며 담당 선생님에게만 전달됩니다.
      </p>
    </main>
  );
}
