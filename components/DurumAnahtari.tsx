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

import { durumMesaji, type Asama, type DurumKodu } from "@/lib/utils/durum/mesaj";

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
  /** Sayfanın aşaması — İÜ etiketleri aşamaya göre değişir. */
  asama: Asama;
  aktif: DurumKodu;
  onSec: (d: DurumKodu) => void;
  sayim: Partial<Record<DurumKodu, number>>;
}

export default function DurumAnahtari({ baslik, rol, asama, aktif, onSec, sayim }: Props) {
  // Filtreler HER ZAMAN tek satır (25.07): başlık ve kayıt sayacı kendi satırında
  // durur, filtre şeridi kartın TAM genişliğini kullanır — pill'ler ne alt satıra
  // kayar ne de kırpılır. Çok dar ekranda şerit yatay kaydırılır.
  return (
    <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{baslik}</span>
        <span className="text-xs text-gray-500 whitespace-nowrap">{sayim[aktif] ?? 0} kayıt</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-nowrap items-center gap-x-2.5 overflow-x-auto">
          {BOLGELER.map((b, bi) => {
            const bolgePilller = PILLLER.filter(
              (p) => p.bolge === b.key && !(p.yalnizKayitVarsa && (sayim[p.kod] ?? 0) === 0)
            );
            if (bolgePilller.length === 0) return null;
            return (
              <div key={b.key} className="flex flex-nowrap items-center gap-2 shrink-0">
                {bi > 0 && <span className="w-px h-5 bg-gray-200 hidden lg:inline-block" aria-hidden="true" />}
                <span className="text-gray-400 whitespace-nowrap" style={{ fontSize: 10 }}>{b.etiket}</span>
                {bolgePilller.map((p) => {
                  const secili = aktif === p.kod;
                  const n = sayim[p.kod] ?? 0;
                  const m = durumMesaji(p.kod, rol, { asama });
                  return (
                    <button
                      key={p.kod}
                      onClick={() => onSec(p.kod)}
                      aria-pressed={secili}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full cursor-pointer transition-shadow text-left whitespace-nowrap shrink-0"
                      style={{
                        background: m.renk.bg,
                        color: m.renk.text,
                        border: `0.5px solid ${m.renk.border}`,
                        fontSize: 11,
                        fontWeight: secili ? 600 : 400,
                        boxShadow: secili ? `0 0 0 2px ${m.renk.text}33` : "none",
                      }}
                    >
                      {m.metin}
                      <span style={{ background: m.renk.text, color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
