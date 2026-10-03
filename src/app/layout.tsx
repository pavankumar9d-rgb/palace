import type { Metadata, Viewport } from 'next';
import { fontPlayfair, fontInter } from '@/config/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aurelia House — Private Luxury Mountain Estate',
  description:
    'A single-page, scroll-driven cinematic journey through Aurelia House, an ultra-exclusive private luxury estate hotel above the clouds.',
  keywords: ['Aurelia House', 'luxury estate', 'private hotel', 'cinematic film', 'architecture'],
  openGraph: {
    title: 'Aurelia House — Private Luxury Mountain Estate',
    description: 'An architectural sanctuary above the mist.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0703',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontPlayfair.variable} ${fontInter.variable}`}>
      <head>
        {/* Preload first frame for zero-delay initial paint */}
        <link
          rel="preload"
          as="image"
          href="/frames/1080/frame-0001.webp"
          type="image/webp"
          fetchPriority="high"
        />
      </head>
      <body className="bg-[var(--bg)] text-[var(--ivory)] antialiased selection:bg-[var(--gold)] selection:text-[var(--bg)]">
        <a href="#film-content" className="skip-link">
          Skip to film
        </a>
        {children}
      </body>
    </html>
  );
}
