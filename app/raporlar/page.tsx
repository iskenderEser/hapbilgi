'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RaporlarPage() {
  const router = useRouter();

  useEffect(() => {
    const yonlendir = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: kullanici } = await supabase
        .from('kullanicilar')
        .select('rol')
        .eq('eposta', user.email)
        .single();

      if (!kullanici) {
        router.replace('/login');
        return;
      }

      const rol = kullanici.rol;

      if (['utt', 'kd_utt'].includes(rol)) {
        router.replace('/raporlar/utt');
      } else if (rol === 'bm') {
        router.replace('/raporlar/bm');
      } else if (rol === 'tm') {
        router.replace('/raporlar/tm');
      } else if (['pm', 'jr_pm', 'kd_pm'].includes(rol)) {
        router.replace('/raporlar/pm');
      } else if ([
        'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md',
        'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md',
        'egt_yon', 'egt_uz'
      ].includes(rol)) {
        router.replace('/raporlar/yonetici');
      } else {
        router.replace('/ana-sayfa');
      }
    };

    yonlendir();
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-gray-500">Yönlendiriliyor...</div>
    </div>
  );
}