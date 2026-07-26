// components/DurumAnahtari.tsx
//
// Üretim hattı sayfalarının (Senaryolar / Videolar / Soru Setleri) durum anahtarı.
// TEK SEÇİM: aynı anda bir durum aktiftir; sayfa "onay bekleyen" ile açılır.
// Pill'ler tek düz şeritte durur (26.07: bekleyen/takip/arşiv bölge etiketleri ve
// ayraçları kaldırıldı — anlamsız bulundu).
//
// 25.07: pill etiketleri ve renkleri artık BURADA TANIMLI DEĞİL — durum
// sözlüğünden (lib/utils/durum/mesaj.ts) okunur ve rol'e göre çözülür. Filtre
// anahtarı ham DB değeri değil DURUM KODUDUR; böylece satır rozetiyle filtre
// butonu birebir aynı metni taşır (İskender kararı: hiçbir yüzeyde ikinci sözlük
// yok, kısaltma yok — "uzayacaksa uzasın").

"use client";

import { durumMesaji, type Asama, type DurumKodu } from "@/lib/utils/durum/mesaj";

interface PillTanim {
  kod: DurumKodu;
  /** Kaydı yoksa gizlenir — her sayfada oluşamayan durumlar boş pill bırakmasın. */
  yalnizKayitVarsa?: boolean;
}

const PILLLER: PillTanim[] = [
  { kod: "onay_bekleniyor" },
  { kod: "iu_iletildi", yalnizKayitVarsa: true },
  { kod: "iu_hazirliyor", yalnizKayitVarsa: true },
  { kod: "iu_duzeltiyor" },
  { kod: "onaylandi" },
  { kod: "iptal" },
  { kod: "sistem_hatasi", yalnizKayitVarsa: true },
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
        <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">{baslik}</span>
        <span className="text-xs text-gray-500 whitespace-nowrap">{sayim[aktif] ?? 0} kayıt</span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          {PILLLER.filter((p) => !(p.yalnizKayitVarsa && (sayim[p.kod] ?? 0) === 0)).map((p) => {
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
                  border: `1px solid ${m.renk.border}`,
                  fontSize: 11,
                  fontWeight: secili ? 600 : 400,
                }}
              >
                {m.metin}
                <span style={{ background: m.renk.text, color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 10 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
