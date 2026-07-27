// components/pill/VaryantPill.tsx
//
// Talebin üretim varyantı. İki bayrak BAĞIMSIZ (talepler.hazir_video,
// talepler.hazir_soru_seti) — ikisi de true olabilir, o zaman iki pill yan yana.
// İkisi de false ise normal üretimdir → hiç pill yok (null).
//
// METİN DEĞİŞTİ (İskender kararı 27.07, docs/pill_envanteri.md §E-4):
// "Video" / "Soru" yerine "Hazır Video" / "Hazır Soru". Sebep: aynı kelime hem
// varyant hem üretim aşaması pill'iydi, bazen aynı satırda yan yana düşüyordu
// (bulgu P-3). Ayrıca talep detayı zaten "Hazır Video" yazıyordu — iki ekran iki
// ad kullanıyordu (P-6). Tek ad: "Hazır ...".
//
// Taşındı (27.07): eski yeri components/UretimVaryantiRozet.tsx. Ölçüsü kendi
// içinde yazılıydı (dikey dolgu 0, satır yüksekliği 1.05) ve yanındaki pill'lerden
// belirgin biçimde kısaydı — dört farklı yüksekliğin en uç örneğiydi (P-1).

"use client";

import { Pill, type PillRenk } from "./Pill";

interface Props {
  hazirVideo?: boolean | null;
  hazirSoruSeti?: boolean | null;
  /**
   * true → pill'ler kendi satırına düşer (liste satırında adın ALTINA).
   * Bugünkü davranış bu; varsayılan true tutuldu ki taşıma sırasında hiçbir
   * sayfanın yerleşimi kaymasın. Adım 4'te satır düzeni elden geçirilirken
   * gerekmeyen yerlerde kapatılacak.
   */
  kendiSatirinda?: boolean;
}

const VARYANT: Record<"video" | "soru", { etiket: string; renk: PillRenk }> = {
  video: { etiket: "Hazır Video", renk: { bg: "#dbeafe", metin: "#1d4ed8", kenar: "#93c5fd" } },
  soru: { etiket: "Hazır Soru", renk: { bg: "#fbe4de", metin: "#bc2d0d", kenar: "#e9b3a6" } },
};

export function VaryantPill({ hazirVideo, hazirSoruSeti, kendiSatirinda = true }: Props) {
  const tipler: ("video" | "soru")[] = [];
  if (hazirVideo) tipler.push("video");
  if (hazirSoruSeti) tipler.push("soru");
  if (tipler.length === 0) return null;

  // flexBasis:100% → sarmalı ana satırda kendi satırına düşer. Yerleşim kararı
  // aslında sayfaya aittir; Adım 4'te satır düzeni elden geçirilirken kaldırılacak.
  return (
    // flexWrap: dar sütunda (eşit paylı tabloda) iki pill yan yana sığmazsa alt
    // alta geçer; kesilmez, taşmaz.
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1mm", ...(kendiSatirinda ? { flexBasis: "100%" } : {}) }}>
      {tipler.map((t) => (
        <Pill key={t} renk={VARYANT[t].renk}>
          {VARYANT[t].etiket}
        </Pill>
      ))}
    </div>
  );
}
