import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import WigssScan from './WigssScan';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pixel Craft — Design Studio',
  description: 'A creative design studio portfolio and blog',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        {children}
        {/* WIGSS 통합: 스캔/라이브 스타일 런타임.
          * 예전의 거대한 인라인 <script> 는 wigss/scan 모듈로 승격됐다 (PROD-631).
          * 소스 주소(data-wigss)는 tsconfig "jsxImportSource": "wigss" 가 부착한다. */}
        <WigssScan />
      </body>
    </html>
  );
}
