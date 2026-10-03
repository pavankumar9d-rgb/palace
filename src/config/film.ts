export interface ChapterCopy {
  id: string;
  headline: string;
  subline: string;
  position: 'center' | 'left' | 'right';
  vertical: 'lower' | 'middle';
  hasCta?: boolean;
}

export const CHAPTER_COPY: Record<string, ChapterCopy> = {
  C01: {
    id: 'C01',
    headline: 'WELCOME TO AURELIA',
    subline: 'A house above the mist',
    position: 'center',
    vertical: 'lower',
  },
  C02: {
    id: 'C02',
    headline: 'A THRESHOLD OF LIGHT',
    subline: 'Bronze, oak and morning stone',
    position: 'left',
    vertical: 'lower',
  },
  C03: {
    id: 'C03',
    headline: 'ARCHITECTURE, BREATHING',
    subline: 'Travertine, still water and quiet height',
    position: 'right',
    vertical: 'lower',
  },
  C04: {
    id: 'C04',
    headline: 'THE ASCENT',
    subline: 'Every step, unhurried',
    position: 'left',
    vertical: 'lower',
  },
  C05: {
    id: 'C05',
    headline: 'WHERE ROYALTY SLEEPS',
    subline: 'Linen, oak and a horizon of glass',
    position: 'right',
    vertical: 'lower',
  },
  C06: {
    id: 'C06',
    headline: 'OPEN THE DOORS',
    subline: 'The valley, entirely yours',
    position: 'center',
    vertical: 'lower',
  },
  C07: {
    id: 'C07',
    headline: 'ABOVE THE CLOUDS',
    subline: 'Horizon dissolves into water and sky',
    position: 'left',
    vertical: 'lower',
  },
  C08: {
    id: 'C08',
    headline: 'A FEAST OF ART',
    subline: 'Stone arches and quiet candlelight',
    position: 'right',
    vertical: 'lower',
  },
  C09: {
    id: 'C09',
    headline: 'THE STILL WATER',
    subline: 'Stone underfoot, nothing ahead but calm',
    position: 'left',
    vertical: 'lower',
  },
  C10: {
    id: 'C10',
    headline: 'SILENCE, PERFECTED',
    subline: 'Waterfalls, steam and meditation gardens',
    position: 'right',
    vertical: 'lower',
  },
  C11: {
    id: 'C11',
    headline: 'EVERY SUNSET IS PRIVATE',
    subline: 'Golden hour, symmetry and dancing fountains',
    position: 'center',
    vertical: 'lower',
  },
  C12: {
    id: 'C12',
    headline: 'AN UNFORGETTABLE DESTINATION',
    subline: 'A beacon above the night valley',
    position: 'center',
    vertical: 'middle',
    hasCta: true,
  },
};

export const FILM_CONFIG = {
  scroll: {
    heightSvh: 1000,
  },
  focalPoint: {
    x: 0.5,
    y: 0.5,
  },
  portraitFocalPoint: {
    x: 0.5,
    y: 0.5,
  },
  colors: {
    bg: '#0A0703',
    bg2: '#120D05',
    goldDeep: '#3B2B0E',
    gold: '#D4AF37',
    champagne: '#EFE7DA',
    ivory: '#F9F8F5',
  },
};
