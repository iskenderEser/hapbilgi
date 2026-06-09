// hooks/useOkunmamisIdler.ts
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type KayitTuru = "talep" | "senaryo" | "video" | "soru_seti" | "yayin" | "oneri";

/**
 * Verilen kayit_turu için kullanıcının okunmamış bildirimlerinin
 * kayit_id'lerini Set olarak döndürür. Liste sayfalarında her satırın
 * "bekleyen iş" olup olmadığını O(1) kontrol etmek için kullanılır.
 *
 * Navbar'daki badge polling'iyle aynı /bildirimler/api endpoint'ini kullanır.
 * Sayfa değişiminde + 30sn polling + tab'a dönüşte otomatik yenilenir.
 */
export function useOkunmamisIdler(kayit_turu: KayitTuru): Set<string> {
  const pathname = usePathname();
  const [idler, setIdler] = useState<Set<string>>(new Set());

  useEffect(() => {
    let aktif = true;

    const cek = async () => {
      try {
        const res = await fetch("/bildirimler/api");
        if (!res.ok) return;
        const data = await res.json();
        if (!aktif) return;
        const ilgili = (data.bildirimler ?? [])
          .filter((b: any) => b.kayit_turu === kayit_turu)
          .map((b: any) => b.kayit_id);
        setIdler(new Set(ilgili));
      } catch {}
    };

    cek();
    const interval = setInterval(cek, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") cek();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      aktif = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pathname, kayit_turu]);

  return idler;
}