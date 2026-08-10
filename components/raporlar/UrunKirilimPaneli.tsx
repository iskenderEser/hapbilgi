// components/raporlar/UrunKirilimPaneli.tsx
//
// Ürün dağılımı — master-detail: solda ürün butonları (nav), ortada seçili ürünün
// PUAN KIRILIMI grafiği (Video/Doğru Cevap/Öneri/Extra yeşil + kayıplar kırmızı, negatif).
// Görünüm Sütun/Çizgi/Tablo (pasta yok — net puan negatif olabilir), PNG indir.
// Teknik dağılımı burada YOK (Analiz'e ait). Grafik gövdesi DagilimGrafik.

"use client";

import { useState } from "react";
import DagilimGrafik, { type DagilimKalem } from "@/components/raporlar/DagilimGrafik";

export interface UrunKirilim {
  urun_id: string;
  urun_adi: string;
  video_puani: number;
  soru_puani: number;
  oneri_puani: number;
  extra_puan: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_net_puan: number;
}

const YESIL = "#1D9E75";
const BORDO = "#bc2d0d";

function kirilim(u: UrunKirilim): DagilimKalem[] {
  return [
    { ad: "Video", puan: u.video_puani, renk: YESIL },
    { ad: "Doğru Cevap", puan: u.soru_puani, renk: YESIL },
    { ad: "Öneri", puan: u.oneri_puani, renk: YESIL },
    { ad: "Extra", puan: u.extra_puan, renk: YESIL },
    { ad: "İleri sarma", puan: -u.ileri_sarma_kaybi, renk: BORDO },
    { ad: "Yanlış cevap", puan: -u.yanlis_cevap_kaybi, renk: BORDO },
    { ad: "Öneri kaybı", puan: -u.oneri_kaybi, renk: BORDO },
  ];
}

const dosyaAdi = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();

interface Props {
  urunler: UrunKirilim[];
  modern?: boolean;
}

export default function UrunKirilimPaneli({ urunler, modern = false }: Props) {
  const [seciliId, setSeciliId] = useState<string>(urunler[0]?.urun_id ?? "");
  const secili = urunler.find((u) => u.urun_id === seciliId) ?? urunler[0];
  if (!secili) return null;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sol: ürün nav (mobilde yatay kaydırılır, masaüstünde dikey) */}
      <div className="flex md:flex-col gap-1 md:w-28 overflow-x-auto md:overflow-visible flex-shrink-0">
        {urunler.map((u) => {
          const aktif = u.urun_id === secili.urun_id;
          return (
            <button
              key={u.urun_id}
              type="button"
              onClick={() => setSeciliId(u.urun_id)}
              className="text-left px-2 py-1 rounded-md text-xs whitespace-nowrap md:whitespace-normal transition-colors leading-tight"
              style={{
                border: modern ? "1px solid transparent" : "0.5px solid #e5e7eb",
                background: aktif ? (modern ? "#e7f3ff" : "rgba(86,174,255,0.12)") : (modern ? "#f6f8fb" : "#fff"),
                color: aktif ? "#185fa5" : "#374151",
                fontWeight: aktif ? 600 : 400,
              }}
            >
              <span>{u.urun_adi}</span>
              <span className="block" style={{ fontSize: 10, color: aktif ? "#185fa5" : "#9ca3af" }}>
                {u.toplam_net_puan.toLocaleString("tr-TR")} puan
              </span>
            </button>
          );
        })}
      </div>

      {/* Orta: seçili ürünün puan kırılımı */}
      <div className="flex-1 min-w-0">
        <DagilimGrafik
          key={secili.urun_id}
          veri={kirilim(secili)}
          modlar={["bar", "line", "tablo"]}
          apsisAdi="Puan türü"
          ordinatAdi="Puan"
          indirAdi={`urun-${dosyaAdi(secili.urun_adi)}`}
          modern={modern}
        />
      </div>
    </div>
  );
}
