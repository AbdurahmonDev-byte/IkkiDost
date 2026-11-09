import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Ikki Do‘st — Boshqaruv paneli',
  description: 'Restoran boshqaruv tizimi',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-paper font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
