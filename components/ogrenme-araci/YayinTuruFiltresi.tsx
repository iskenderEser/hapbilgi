"use client";

import { SadeKapsulFiltre } from "@/components/kontrol/SadeKontroller";

import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import { YAYIN_TURLERI, YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";

export type YayinTuruFiltreDegeri = "tumu" | OgrenmeAraciTuru;

export function YayinTuruFiltresi({
  secili,
  onSec,
  sayilar,
}: {
  secili: YayinTuruFiltreDegeri;
  onSec: (tur: YayinTuruFiltreDegeri) => void;
  sayilar: Record<OgrenmeAraciTuru, number>;
}) {
  const secenekler: Array<{ deger: YayinTuruFiltreDegeri; etiket: string; sayi: number }> = [
    { deger: "tumu", etiket: "Tümü", sayi: Object.values(sayilar).reduce((toplam, sayi) => toplam + sayi, 0) },
    ...YAYIN_TURLERI.map((tur) => ({ deger: tur, etiket: YAYIN_TURU_SUNUMU[tur].cogulEtiket, sayi: sayilar[tur] })),
  ];

  return <SadeKapsulFiltre
    secenekler={secenekler.map((s) => ({ deger: s.deger, etiket: `${s.etiket} ${s.sayi}` }))}
    deger={secili} onDegistir={onSec} etiket="Yayın türüne göre filtrele"
  />;
}
