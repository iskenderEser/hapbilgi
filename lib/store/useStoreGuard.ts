// lib/store/useStoreGuard.ts
//
// HBStore sayfa guard'ı (client tarafı, tek kaynak).
// Kullanıcının firmasında hbstore_aktif=false ise store sayfalarına erişimi
// engeller ve /ana-sayfa'ya yönlendirir. Tüm /store/* sayfaları bunu çağırır.
//
// Server tarafı koruma lib/store/firmaGuard.ts ile API'lerde yapılır;
// bu hook onun client/UX karşılığıdır (URL'ye elle gelen kullanıcıyı temiz karşılar).
//
// Kullanım:
//   const { storeHazir } = useStoreGuard();
//   if (!storeHazir) return <YukleniyorEkrani />;
//
// storeHazir = true  → firma açık, kontrol bitti, içerik gösterilebilir.
// storeHazir = false → ya kontrol sürüyor ya da firma kapalı (redirect tetiklendi).

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useStoreGuard() {
  const router = useRouter();
  const [storeHazir, setStoreHazir] = useState(false);

  useEffect(() => {
    let iptal = false;

    fetch("/profil/api")
      .then((res) => res.json())
      .then((data) => {
        if (iptal) return;
        if (data.profil?.hbstore_aktif === true) {
          setStoreHazir(true);
        } else {
          router.push("/ana-sayfa");
        }
      })
      .catch(() => {
        if (!iptal) router.push("/ana-sayfa");
      });

    return () => {
      iptal = true;
    };
  }, [router]);

  return { storeHazir };
}