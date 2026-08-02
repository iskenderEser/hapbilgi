// app/raporlar/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { URETICI_ROLLER, YONETICI_ROLLER, TUKETICI_ROLLER } from '@/lib/utils/roller';

export default function RaporlarPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace('/login'); return; }

    const rol = (kullanici.rol ?? '').toLowerCase();

    if (TUKETICI_ROLLER.includes(rol)) {
      router.replace('/raporlar/utt');
    } else if (rol === 'bm') {
      router.replace('/raporlar/bm');
    } else if (rol === 'tm') {
      router.replace('/raporlar/tm');
    } else if (URETICI_ROLLER.includes(rol)) {
      router.replace('/raporlar/uretici');
    } else if (YONETICI_ROLLER.includes(rol)) {
      router.replace('/raporlar/yonetici');
    } else {
      router.replace('/ana-sayfa');
    }
  }, [kullanici, yukleniyor, router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-gray-500">Yönlendiriliyor...</div>
    </div>
  );
}