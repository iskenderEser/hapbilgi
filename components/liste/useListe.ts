// components/liste/useListe.ts
//
// LİSTE GÖRÜNÜMÜNÜN TEK BEYNİ (27.07.2026).
//
// Neden merkez: HapBilgi'de ~40 liste ekranı var (25'i <table>, 21'i grid tablo).
// Arama ve "daha fazla göster" her sayfada ayrı yazılırsa aynı dağınıklık pill'lerde
// olduğu gibi tekrarlanır — 40 ayrı davranış, 40 ayrı hata.
//
// SINIR — merkez SATIR ÇİZMEZ: ekranların işaretlemesi birbirinden farklı
// (tablo/grid/kart), ortak bir satır bileşeni hepsine uymaz. Merkez yalnız üç şeyi
// sahiplenir: (1) arama süzgeci, (2) kaç satır görüneceği, (3) "daha fazla" durumu.
// Sayfa kendi satırını kendi çizer, veriyi buradan alır.
//
// Arama sunucuya gitmez: veri zaten yüklüdür, süzme bellek içindedir — anında yanıt.
//
// Türkçe: karşılaştırma toLocaleLowerCase("tr") ile yapılır, yoksa "İSTANBUL"
// araması "istanbul"u bulamaz (I/ı ve İ/i eşleşmesi Türkçe'de farklıdır).

"use client";

import { useMemo, useState } from "react";

/** Aranabilir bir alan: kullanıcıya gösterilen etiket + satırdan değeri çıkaran işlev. */
export interface AramaAlani<T> {
  anahtar: string;
  etiket: string;
  deger: (satir: T) => string | number | null | undefined;
}

interface UseListeGirdi<T> {
  veri: T[];
  /** Boş bırakılırsa arama kutusu kullanılmaz, yalnız kademeli listeleme çalışır. */
  aramaAlanlari?: AramaAlani<T>[];
  /** İlk açılışta ve her "daha fazla"da eklenecek satır sayısı. */
  adim?: number;
}

const kucult = (d: unknown) => String(d ?? "").toLocaleLowerCase("tr");

export function useListe<T>({ veri, aramaAlanlari = [], adim = 10 }: UseListeGirdi<T>) {
  const [aranan, setAranan] = useState("");
  const [alanAnahtari, setAlanAnahtari] = useState(aramaAlanlari[0]?.anahtar ?? "");
  const [limit, setLimit] = useState(adim);

  const seciliAlan = aramaAlanlari.find((a) => a.anahtar === alanAnahtari) ?? aramaAlanlari[0];

  const suzulmus = useMemo(() => {
    const q = kucult(aranan).trim();
    if (!q || !seciliAlan) return veri;
    return veri.filter((satir) => kucult(seciliAlan.deger(satir)).includes(q));
  }, [veri, aranan, seciliAlan]);

  // Arama değişince listenin başına dönülür: süzülmüş sonuç 3 satırsa "daha fazla"
  // düğmesi görünmemeli, eski limit de yanıltıcı olmamalı.
  const gorunen = suzulmus.slice(0, limit);
  const dahaVar = suzulmus.length > gorunen.length;

  const aramaDegistir = (deger: string) => {
    setAranan(deger);
    setLimit(adim);
  };

  const alanDegistir = (anahtar: string) => {
    setAlanAnahtari(anahtar);
    setLimit(adim);
  };

  return {
    /** Ekrana çizilecek satırlar. */
    gorunen,
    /** Arama sonrası toplam eşleşme (kaç kayıt bulundu bilgisi için). */
    toplam: suzulmus.length,
    /** Süzgeçsiz toplam. */
    hamToplam: veri.length,
    dahaVar,
    dahaFazlaGoster: () => setLimit((l) => l + adim),
    // Arama kutusunun ihtiyaç duyduğu her şey tek nesnede — sayfa tek tek geçirmesin.
    arama: {
      aranan,
      aramaDegistir,
      alanAnahtari: seciliAlan?.anahtar ?? "",
      alanDegistir,
      alanlar: aramaAlanlari,
    },
  };
}

export type ListeArananDurumu<T> = ReturnType<typeof useListe<T>>["arama"];
