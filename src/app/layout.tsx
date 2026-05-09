import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '다정초 분쟁조정위원회',
  description: '다정초등학교 분쟁조정위원회 AI 상담 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
