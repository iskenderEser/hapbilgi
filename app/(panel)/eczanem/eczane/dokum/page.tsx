// app/(panel)/eczanem/eczane/dokum/page.tsx
// Eczacı/teknisyen Eczanem — İşlem Dökümü (U9, İP-§9.2): onaylanan siparişlerin
// ürün bazında kutu + indirim TL toplamı (mutabakatın eczane tarafı). Müşteri
// bilgisi bu bölümde YOKTUR — toplam görünür, kişi gizli.
"use client";

import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EczanemEczaneSayfa } from "../_components/EczanemEczaneArayuz";
import EczanemDokum from "../_components/EczanemDokum";

export default function EczanemDokumPage() {
  const { mesajlar, hata } = useHataMesaji();

  return (
    <EczanemEczaneSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EczanemDokum hata={hata} />
    </EczanemEczaneSayfa>
  );
}
