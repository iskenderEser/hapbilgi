// components/DurumAnahtari.tsx
//
// Üretim hattı sayfalarının (Senaryolar / Videolar / Soru Setleri) durum anahtarı.
// TEK SEÇİM: aynı anda bir durum aktiftir; sayfa "onay bekleyen" ile açılır.
// Üç bölge:
//   - bekleyen → üreticiden aksiyon bekleyen iş
//   - takip    → top İçerik Üreticisi'nde; izlenir
//   - arşiv    → bitmiş (onaylanan / iptal) + sistem hatası
//
// 25.07: pill etiketleri ve renkleri artık BURADA TANIMLI DEĞİL — durum
// sözlüğünden (lib/utils/durum/mesaj.ts) okunur ve rol'e göre çözülür. Filtre
// anahtarı ham DB değeri değil DURUM KODUDUR; böylece satır rozetiyle filtre
// butonu birebir aynı metni taşır (İskender kararı: hiçbir yüzeyde ikinci sözlük
// yok, kısaltma yok — "uzayacaksa uzasın").

"use client";

import { durumMesaji, type DurumKodu } from "@/lib/utils/durum/mesaj";

type Bolge = "bekleyen" | "takip" | "arsiv";

interface PillTanim {
  kod: DurumKodu;
  bolge: Bolge;
  /** Kaydı yoksa gizlenir — her sayfada oluşamayan durumlar boş pill bırakmasın. */
  yalnizKayitVarsa?: boolean;
}

const PILLLER: PillTanim[] = [
  { kod: "onay_bekleniyor", bolge: "bekleyen" },
  { kod: "iu_iletildi", bolge: "takip", yalnizKayitVarsa: true },
  { kod: "iu_hazirliyor", bolge: "takip", yalnizKayitVarsa: true },
  { kod: "iu_duzeltiyor", bolge: "takip" },
  { kod: "onaylandi", bolge: "arsiv" },
  { kod: "iptal", bolge: "arsiv" },
  { kod: "sistem_hatasi", bolge: "arsiv", yalnizKayitVarsa: true },
];

const BOLGELER: { key: Bolge; etiket: string }[] = [
  { key: "bekleyen", etiket: "bekleyen" },
  { key: "takip", etiket: "takip" },
  { key: "arsiv", etiket: "arşiv" },
];

interface Props {
  baslik: string;
  rol: string;
  aktif: DurumKodu;
  onSec: (d: DurumKodu) => void;
  sayim: Partial<Record<DurumKodu, number>>;
}

export default function DurumAnahtari({ baslik, rol, aktif, onSec, sayim }: Props) {
  return (
    <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div className="flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-4 min-w-0">
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap lg:pt-1">{baslik}</span>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {BOLGELER.map((b, bi) => {
            const bolgePilller = PILLLER.filter(
              (p) => p.bolge === b.key && !(p.yalnizKayitVarsa && (sayim[p.kod] ?? 0) === 0)
            );
            if (bolgePilller.length === 0) return null;
            return (
              <div key={b.key} className="flex flex-wrap items-center gap-2">
                {bi > 0 && <span className="w-px h-5 bg-gray-200 hidden lg:inline-block" aria-hidden="true" />}
                <span className="text-gray-400" style={{ fontSize: 11 }}>{b.etiket}</span>
                {bolgePilller.map((p) => {
                  const secili = aktif === p.kod;
                  const n = sayim[p.kod] ?? 0;
                  const m = durumMesaji(p.kod, rol);
                  return (
                    <button
                      key={p.kod}
                      onClick={() => onSec(p.kod)}
                      aria-pressed={secili}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-shadow text-left"
                      style={{
                        background: m.renk.bg,
                        color: m.renk.text,
                        border: `0.5px solid ${m.renk.border}`,
                        fontWeight: secili ? 600 : 400,
                        boxShadow: secili ? `0 0 0 2px ${m.renk.text}33` : "none",
                      }}
                    >
                      {m.metin}
                      <span style={{ background: m.renk.text, color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 11 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap lg:pt-1">{sayim[aktif] ?? 0} kayıt</span>
    </div>
  );
}
