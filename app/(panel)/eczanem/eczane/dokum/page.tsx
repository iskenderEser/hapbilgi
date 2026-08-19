// app/(panel)/eczanem/eczane/dokum/page.tsx
// Eczacı/teknisyen Eczanem — İşlem Dökümü (U9, İP-§9.2): onaylanan siparişlerin
// ürün bazında kutu + indirim TL toplamı (mutabakatın eczane tarafı). Müşteri
// bilgisi bu bölümde YOKTUR — toplam görünür, kişi gizli.
"use client";

import { BarChart3 } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";
import EczanemDokum from "../_components/EczanemDokum";

export default function EczanemDokumPage() {
  const { mesajlar, hata } = useHataMesaji();

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={BarChart3}
        ustEtiket="Eczanem"
        baslik="İşlem Dökümü"
        aciklama="Onaylanan siparişlerin ürün bazında kutu ve indirim TL toplamı — firma mutabakatının eczane tarafındaki karşılığı."
      />
      <EczanemDokum hata={hata} />
    </EclubKisiSayfa>
  );
}
