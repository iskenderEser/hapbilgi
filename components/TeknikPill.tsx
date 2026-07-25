// components/TeknikPill.tsx
//
// Üretim detay ekranlarının künye satırında tekniğin adını taşıyan rozet
// (talep detayı, senaryo, video, soru seti).
//
// 25.07 öncesi düz gri metindi: ürün adı ve eğitim türü pill'lerinin yanında
// boşta duruyordu (İskender: "teknik adı boşta kalmış"). Teknik kayıtlı değilse
// ("-" ya da boş) hiç çizilmez — boş rozet bırakmaz.

"use client";

interface TeknikPillProps {
  teknikAdi: string | null | undefined;
}

export function TeknikPill({ teknikAdi }: TeknikPillProps) {
  if (!teknikAdi || teknikAdi === "-") return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap"
      style={{ background: "#f9fafb", color: "#4b5563", border: "0.5px solid #e5e7eb" }}
    >
      {teknikAdi}
    </span>
  );
}
