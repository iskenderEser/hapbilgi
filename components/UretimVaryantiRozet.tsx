// components/UretimVaryantiRozet.tsx
//
// Bir talebin üretim varyantı pill'(ler)i. İki flag BAĞIMSIZ
// (talepler.hazir_video, talepler.hazir_soru_seti) — ikisi de aynı anda true
// olabilir; o zaman iki pill yan yana (aralarında 1 mm) çıkar. İkisi de false ise
// normal üretimdir → hiçbir pill yok (null).
//
// Tasarım (İskender 24.07): navbar pill çizgisi referans; hap şekli (rounded-full),
// ince kenar. İç dolgu açık, kenar aynı renkte ama dolgudan biraz daha koyu.
//   - Video → açık mavi
//   - Soru  → açık bordo
// Yazı 1 cm'ye sığacak kadar kısa (Video / Soru).
// talep_no olan her üretici satırında kullanılır.

interface Props {
  hazirVideo?: boolean | null;
  hazirSoruSeti?: boolean | null;
}

type PillTip = { etiket: string; bg: string; border: string; text: string };

const PILL: Record<"video" | "soru", PillTip> = {
  video: { etiket: "Video", bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" },
  soru: { etiket: "Soru", bg: "#fbe4de", border: "#e9b3a6", text: "#bc2d0d" },
};

export default function UretimVaryantiRozet({ hazirVideo, hazirSoruSeti }: Props) {
  const tipler: ("video" | "soru")[] = [];
  if (hazirVideo) tipler.push("video");
  if (hazirSoruSeti) tipler.push("soru");
  if (tipler.length === 0) return null;

  // flexBasis:100% → sarmalı (flex-wrap) ana satırda kendi satırına düşer (adın ALTINA).
  return (
    <div style={{ display: "flex", gap: "1mm", flexBasis: "100%" }}>
      {tipler.map((t) => {
        const p = PILL[t];
        return (
          <span
            key={t}
            className="inline-flex items-center rounded-full whitespace-nowrap"
            style={{
              background: p.bg,
              color: p.text,
              border: `0.5px solid ${p.border}`,
              fontSize: 10,
              lineHeight: 1.05,
              padding: "0 6px",
            }}
          >
            {p.etiket}
          </span>
        );
      })}
    </div>
  );
}
