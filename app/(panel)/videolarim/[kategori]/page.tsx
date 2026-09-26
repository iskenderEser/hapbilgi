"use client";

import { notFound, useParams } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import UttAnaSayfa, { UttKategoriIskeleti } from "@/components/ana-sayfa/UttAnaSayfa";
import { uttVideoKategorisiBul } from "@/lib/video/uttVideoKategorileri";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";

export default function UttVideoKategoriPage() {
  const { kategori: slug } = useParams<{ kategori: string }>();
  const { kullanici, yukleniyor } = useAuth();
  const kategori = uttVideoKategorisiBul(slug);

  if (!kategori) notFound();
  if (yukleniyor || !kullanici) {
    return kategori.icerikTuru === "urun" ||
      kategori.icerikTuru === "medikal" ||
      kategori.icerikTuru === "urun_medikal" ||
      kategori.icerikTuru === "egitim" ||
      kategori.icerikTuru === "yonetim" ||
      kategori.icerikTuru === "ik"
      ? <UttKategoriIskeleti />
      : null;
  }
  if (!TUKETICI_ROLLER.includes(kullanici.rol.trim().toLowerCase())) notFound();

  return (
    <UttAnaSayfa
      user={kullanici}
      rol={kullanici.rol}
      adSoyad={kullanici.adSoyad}
      kategori={kategori.icerikTuru}
      kategoriBaslik={kategori.etiket}
      temelYol={`/videolarim/${kategori.slug}`}
    />
  );
}
