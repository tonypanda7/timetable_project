import Script from 'next/script';
export const metadata = { title: 'Timetable App' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
        <style>{` body { font-family: 'Inter', sans-serif; } `}</style>
      </head>
      <body className="bg-gray-100">{children}</body>
    </html>
  );
}
