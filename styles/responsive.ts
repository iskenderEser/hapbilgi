// styles/responsive.ts
// Tüm responsive kararlar buradan yönetilir.
// Breakpoint, spacing, grid, font boyutları merkezi olarak tanımlıdır.

import { useEffect, useState } from 'react';

// ─── Breakpoint tanımları ────────────────────────────────────────────────────
export const BP = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
} as const;

// ─── Hook: ekran boyutunu takip eder ────────────────────────────────────────
export type Ekran = 'mobile' | 'tablet' | 'desktop';

export function useEkran(): Ekran {
  const [ekran, setEkran] = useState<Ekran>('desktop');

  useEffect(() => {
    const hesapla = () => {
      const w = window.innerWidth;
      if (w < BP.tablet) setEkran('mobile');
      else if (w < BP.desktop) setEkran('tablet');
      else setEkran('desktop');
    };
    hesapla();
    window.addEventListener('resize', hesapla);
    return () => window.removeEventListener('resize', hesapla);
  }, []);

  return ekran;
}

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const spacing = {
  sayfaPadding: {
    mobile: '12px 14px',
    tablet: '16px 20px',
    desktop: '24px 16px',
  },
  kartPadding: {
    mobile: '12px',
    tablet: '14px 16px',
    desktop: '1rem 1.25rem',
  },
  gap: {
    mobile: 8,
    tablet: 10,
    desktop: 12,
  },
} as const;

// ─── Tipografi ────────────────────────────────────────────────────────────────
export const font = {
  baslik: {
    mobile: 14,
    tablet: 15,
    desktop: 16,
  },
  govde: {
    mobile: 12,
    tablet: 13,
    desktop: 13,
  },
  kucuk: {
    mobile: 10,
    tablet: 11,
    desktop: 11,
  },
  stat: {
    mobile: 20,
    tablet: 24,
    desktop: 28,
  },
} as const;

// ─── Grid yapıları ───────────────────────────────────────────────────────────
export const grid = {
  stat: {
    mobile: 'repeat(2, 1fr)',
    tablet: 'repeat(4, 1fr)',
    desktop: 'repeat(4, 1fr)',
  },
  video: {
    mobile: '1fr',
    tablet: 'repeat(2, 1fr)',
    desktop: 'repeat(3, 1fr)',
  },
  ikiKolon: {
    mobile: '1fr',
    tablet: 'repeat(2, 1fr)',
    desktop: 'repeat(2, 1fr)',
  },
} as const;

// ─── Navbar ──────────────────────────────────────────────────────────────────
export const navbar = {
  yukseklik: {
    mobile: 48,
    tablet: 56,
    desktop: 56,
  },
  logoYukseklik: {
    mobile: 40,
    tablet: 55,
    desktop: 75,
  },
} as const;

// ─── Bileşen boyutları ───────────────────────────────────────────────────────
export const boyut = {
  videoThumb: {
    mobile: 72,
    tablet: 80,
    desktop: 96,
  },
  playButon: {
    mobile: 28,
    tablet: 32,
    desktop: 36,
  },
  altNavIkon: {
    mobile: 22,
    tablet: 0, // tablet ve desktop'ta alt nav yok
    desktop: 0,
  },
} as const;

// ─── Yardımcı: değer seç ─────────────────────────────────────────────────────
export function ekranDeger<T>(ekran: Ekran, degerler: Record<Ekran, T>): T {
  return degerler[ekran];
}

// ─── Navbar görünüm kararı ───────────────────────────────────────────────────
export function navbarGorunum(ekran: Ekran) {
  return {
    hamburgerGoster: ekran === 'mobile',
    pillGoster: ekran === 'tablet' || ekran === 'desktop',
    altNavGoster: ekran === 'mobile',
  };
}