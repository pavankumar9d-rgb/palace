import { Playfair_Display, Inter } from 'next/font/google';

export const fontPlayfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const fontInter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontConfig = {
  headlineFontName: 'Playfair Display',
  headlineFallback: 'serif',
  uiFontName: 'Inter',
  uiFallback: 'sans-serif',
};
