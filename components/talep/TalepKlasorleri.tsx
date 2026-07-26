// components/talep/TalepKlasorleri.tsx
//
// TALEP KLASÖRLERİ — düz listeyi firma → departman → ürün kırılımına ayıran
// ortak bileşen (26.07).
//
// Neden: İU'nun gelen ve onaylanan talep ekranları düz listeydi ve talep
// geldikçe uzuyordu. Onaylanmış bir talebin hangi firmaya, hangi müdürlüğe ve
// hangi ürüne/eğitime ait olduğu listeden okunamıyordu.
//
// Yayındaki Videolar'daki KlasorGrid deseninin çok katlı hali: orada tek kırılım
// (departman) var ve firma kırılımı YOK — orası tek firmanın kendi videolarını
// gösterir. Talep ekranlarında firma katı zorunlu, bu yüzden ayrı bileşen.
//
// Yaprak (en alt kat) bu bileşenin işi değildir: talep satırının nasıl
// görüneceğine çağıran karar verir (`render`). Onaylanan talepler satırı açıp
// salt-okuma detay gösteriyor, gelen talepler tabloya basıyor — ikisini tek
// şablona sıkıştırmak yerine kırılım burada, gösterim orada kalır.

"use client";

import { useState } from "react";
import {
  DEPARTMAN_SIRA,
  DEPARTMAN_ETIKET,
  DEPARTMAN_RENK,
  type DepartmanKey,
} from "@/lib/video/departman";

/** Klasörlenebilmek için bir talebin taşıması gereken asgari alanlar. Üçü de
 *  künyeden gelir (lib/utils/talepZinciri.ts) — ekranlar ayrıca hesaplamaz. */
export interface KlasorlenebilirTalep {
  firma_adi: string;
  departman: DepartmanKey;
  urun_adi: string;
}

interface Props<T extends KlasorlenebilirTalep> {
  talepler: T[];
  /** Seçili klasörün içindeki talepler. Gösterim çağıranın sorumluluğu. */
  render: (talepler: T[]) => React.ReactNode;
  /** Yaprakta gösterilecek birim adı — "talep", "video" gibi. */
  birim?: string;
}

const FIRMA_RENK = "#6b7280";

export default function TalepKlasorleri<T extends KlasorlenebilirTalep>({
  talepler,
  render,
  birim = "talep",
}: Props<T>) {
  // Yol: [] → firmalar, [firma] → departmanlar, [firma, dept] → ürünler,
  // [firma, dept, urun] → yaprak. Tek state, geri gitmek dilimlemekle olur.
  const [yol, setYol] = useState<string[]>([]);

  const suzulmus = talepler.filter(
    (t) =>
      (yol[0] === undefined || t.firma_adi === yol[0]) &&
      (yol[1] === undefined || t.departman === yol[1]) &&
      (yol[2] === undefined || t.urun_adi === yol[2]),
  );

  const kirilimEtiketi = (deger: string, kat: number) =>
    kat === 1 ? DEPARTMAN_ETIKET[deger as DepartmanKey] ?? deger : deger;

  const KlasorKarti = ({
    ad,
    etiket,
    sayi,
    altBilgi,
    renk,
    ikon,
  }: {
    ad: string;
    etiket: string;
    sayi: number;
    altBilgi: string;
    renk: string;
    ikon: React.ReactNode;
  }) => (
    <button
      onClick={() => setYol([...yol, ad])}
      className="text-left bg-white border border-gray-200 rounded-xl p-3 md:p-4 cursor-pointer transition-shadow duration-150 flex flex-col gap-3"
      style={{ borderLeft: `3px solid ${renk}`, fontFamily: "'Nunito', sans-serif" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 2px ${renk}33`)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.boxShadow = "none")}
    >
      <div className="flex items-center justify-between">
        {ikon}
        <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 whitespace-nowrap">
          {sayi} {birim}
        </span>
      </div>
      <span className="text-sm font-bold text-gray-900">{etiket}</span>
      <span className="text-xs text-gray-500">{altBilgi}</span>
    </button>
  );

  const KlasorIkonu = ({ renk }: { renk: string }) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );

  const izGrubu = (
    <div className="flex items-center gap-2 flex-wrap mb-3">
      <button
        onClick={() => setYol([])}
        className="text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer"
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        Klasörler
      </button>
      {yol.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-2">
          <span className="text-gray-300 text-xs">/</span>
          <button
            onClick={() => setYol(yol.slice(0, i + 1))}
            className={`text-xs bg-transparent border-none cursor-pointer p-0 ${i === yol.length - 1 ? "text-gray-900 font-bold" : "text-gray-500"}`}
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            {kirilimEtiketi(p, i)}
          </button>
        </span>
      ))}
      <span className="text-xs text-gray-400 ml-auto">
        {suzulmus.length} {birim}
      </span>
    </div>
  );

  // Yaprak: kırılım bitti, gösterimi çağıran yapar.
  if (yol.length >= 3) {
    return (
      <div>
        {izGrubu}
        {render(suzulmus)}
      </div>
    );
  }

  // Klasör katları. Boş klasör hiç çizilmez — kırılım yalnız dolu dalları gösterir.
  const gruplar = new Map<string, T[]>();
  for (const t of suzulmus) {
    const anahtar = yol.length === 0 ? t.firma_adi : yol.length === 1 ? t.departman : t.urun_adi;
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar)!.push(t);
  }

  // Departman katında sabit sıra (DEPARTMAN_SIRA) korunur; firma ve ürün
  // katlarında alfabetik — Türkçe sıralama için localeCompare("tr").
  const anahtarlar =
    yol.length === 1
      ? DEPARTMAN_SIRA.filter((k) => gruplar.has(k))
      : [...gruplar.keys()].sort((a, b) => a.localeCompare(b, "tr"));

  return (
    <div>
      {yol.length > 0 && izGrubu}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {anahtarlar.map((k) => {
          const grup = gruplar.get(k) ?? [];
          const renk = yol.length === 1 ? DEPARTMAN_RENK[k as DepartmanKey] : FIRMA_RENK;
          const altBilgi =
            yol.length === 0
              ? `${new Set(grup.map((t) => t.departman)).size} müdürlük`
              : yol.length === 1
                ? `${new Set(grup.map((t) => t.urun_adi)).size} başlık`
                : "";
          return (
            <KlasorKarti
              key={k}
              ad={k}
              etiket={kirilimEtiketi(k, yol.length)}
              sayi={grup.length}
              altBilgi={altBilgi}
              renk={renk}
              ikon={<KlasorIkonu renk={renk} />}
            />
          );
        })}
      </div>
    </div>
  );
}
