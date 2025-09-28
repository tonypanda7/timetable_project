import Script from 'next/script';
import { Inter } from 'next/font/google';
export const metadata = { title: 'Timetable App' };
const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body className={`${inter.className} bg-gray-100`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
