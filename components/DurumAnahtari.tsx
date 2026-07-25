// components/DurumAnahtari.tsx
//
// Üretim hattı sayfalarının (Senaryolar / Videolar / Soru Setleri) durum anahtarı.
// TEK SEÇİM: aynı anda bir durum aktiftir; sayfa "bekleyen inceleme" ile açılır.
// Üç bölge:
//   - bekleyen → İnceleme bekleniyor (üreticinin işi, aksiyon)
//   - takip    → Revizyon bekleniyor + Yazım bekleniyor (top İU'da; izlenir)
//   - arşiv    → Onaylanan + İptal (bitmiş)
// Her pill kendi kayıt sayısını taşır. "Yazım bekleniyor" (durumsuz) yalnız kaydı
// varsa görünür — soru setlerinde olur, senaryo/videoda genelde olmaz.
// Renkler sayfalardaki durumRenk paletiyle aynı (uçtan uca tek dil).

"use client";

export type DurumSecim =
  | "inceleme bekleniyor"
  | "revizyon bekleniyor"
  | "onaylandi"
  | "Iptal Edildi"
  | "durumsuz";

type Bolge = "bekleyen" | "takip" | "arsiv";

interface PillTanim {
  durum: DurumSecim;
  etiket: string;
  bolge: Bolge;
  bg: string;
  text: string;
  border: string;
  yalnizKayitVarsa?: boolean;
}

const PILLLER: PillTanim[] = [
  { durum: "inceleme bekleniyor", etiket: "İnceleme", bolge: "bekleyen", bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  { durum: "durumsuz", etiket: "Yazım bekleniyor", bolge: "takip", bg: "#f9fafb", text: "#737373", border: "#e5e7eb", yalnizKayitVarsa: true },
  { durum: "revizyon bekleniyor", etiket: "Revizyon", bolge: "takip", bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  { durum: "onaylandi", etiket: "Onaylanan", bolge: "arsiv", bg: "#f9fafb", text: "#737373", border: "#e5e7eb" },
  { durum: "Iptal Edildi", etiket: "İptal", bolge: "arsiv", bg: "#f9fafb", text: "#737373", border: "#e5e7eb" },
];

const BOLGELER: { key: Bolge; etiket: string }[] = [
  { key: "bekleyen", etiket: "bekleyen" },
  { key: "takip", etiket: "takip" },
  { key: "arsiv", etiket: "arşiv" },
];

interface Props {
  baslik: string;
  aktif: DurumSecim;
  onSec: (d: DurumSecim) => void;
  sayim: Record<DurumSecim, number>;
}

export default function DurumAnahtari({ baslik, aktif, onSec, sayim }: Props) {
  return (
    <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <span className="text-sm font-semibold text-gray-900">{baslik}</span>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          {BOLGELER.map((b, bi) => {
            const bolgePilller = PILLLER.filter(
              (p) => p.bolge === b.key && !(p.yalnizKayitVarsa && (sayim[p.durum] ?? 0) === 0)
            );
            if (bolgePilller.length === 0) return null;
            return (
              <div key={b.key} className="flex items-center gap-2">
                {bi > 0 && <span className="w-px h-5 bg-gray-200 hidden md:inline-block" aria-hidden="true" />}
                <span className="text-gray-400" style={{ fontSize: 11 }}>{b.etiket}</span>
                {bolgePilller.map((p) => {
                  const secili = aktif === p.durum;
                  const n = sayim[p.durum] ?? 0;
                  return (
                    <button
                      key={p.durum}
                      onClick={() => onSec(p.durum)}
                      aria-pressed={secili}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition-shadow"
                      style={{
                        background: p.bg,
                        color: p.text,
                        border: `0.5px solid ${p.border}`,
                        fontWeight: secili ? 600 : 400,
                        boxShadow: secili ? `0 0 0 2px ${p.text}33` : "none",
                      }}
                    >
                      {p.etiket}
                      <span style={{ background: p.text, color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 11 }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <span className="text-xs text-gray-500">{sayim[aktif] ?? 0} kayıt</span>
    </div>
  );
}
