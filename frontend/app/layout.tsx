import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';
import { Providers } from '@/providers/providers';
import { AppHeader } from '@/components/app-header';
import { ErrorBoundary } from '@/components/error-boundary';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Solana dApp',
  description: 'Solana dApp for ERC20 token management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='dark'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className='min-h-screen bg-background'>
            <AppHeader />
            <main className='container mx-auto px-4 py-8 max-w-4xl'>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
