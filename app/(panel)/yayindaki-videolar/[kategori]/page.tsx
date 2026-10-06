"use client";

import { notFound, useParams } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import BmEgitimYayinlari from "@/components/yayin/BmEgitimYayinlari";
import { UttKategoriIskeleti } from "@/components/ana-sayfa/UttAnaSayfa";
import { uttVideoKategorisiBul } from "@/lib/video/uttVideoKategorileri";
import { YONETICI_ROLLER } from "@/lib/utils/roller";

export default function BmEgitimKategoriPage() {
  const { kategori: slug } = useParams<{ kategori: string }>();
  const { kullanici, yukleniyor } = useAuth();
  const kategori = uttVideoKategorisiBul(slug);

  if (!kategori) notFound();
  if (yukleniyor || !kullanici) return <UttKategoriIskeleti />;
  const rol = kullanici.rol.trim().toLowerCase();
  if (rol !== "bm" && rol !== "tm" && !YONETICI_ROLLER.includes(rol)) notFound();

  return <BmEgitimYayinlari kategoriBilgisi={kategori} />;
}
