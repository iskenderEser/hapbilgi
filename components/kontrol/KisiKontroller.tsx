"use client";

import type { ComponentProps } from "react";
import { eclubKisiHedefRolu } from "@/lib/utils/roller";
import { SadeCokluAliciSecimi, SadeSecim } from "./SadeKontroller";

export interface KisiSecenegi {
  deger: string;
  adSoyad: string;
  rol?: string | null;
  altBilgi?: string;
  disabled?: boolean;
}

/** İsimler veri kaynağından unvansız gelir; yalnız eczane meslek önekleri korunur. */
export function kisiGorunenAdi(adSoyad: string, rol?: string | null) {
  const ad = adSoyad.trim().replace(/\s+/g, " ");
  const hedefRol = eclubKisiHedefRolu(rol ?? "");
  const onek = hedefRol === "eczane_teknisyeni" ? "Ecz.Tekn." : hedefRol === "eczaci" ? "Ecz." : "";
  return onek ? `${onek} ${ad}` : ad;
}

const secenekleriHazirla = (kisiler: readonly KisiSecenegi[]) => kisiler.map(({ adSoyad, rol, ...kisi }) => ({
  ...kisi, etiket: kisiGorunenAdi(adSoyad, rol),
}));

type KisiSecimiProps = Omit<ComponentProps<typeof SadeSecim>, "secenekler" | "etiket" | "placeholder" | "gorunenEtiket"> & {
  baslik: string;
  kisiler: readonly KisiSecenegi[];
  bosSecenekEtiketi?: string | false;
  /** Önceden otomatik seçilen kişi, kullanıcı seçim yapana kadar başlığı değiştirmez. */
  baslikGoster?: boolean;
};

export function SadeKisiSecimi({ baslik, kisiler, bosSecenekEtiketi = baslik, baslikGoster = false, ...props }: KisiSecimiProps) {
  const secenekler = secenekleriHazirla(kisiler);
  if (bosSecenekEtiketi !== false) secenekler.unshift({ deger: "", etiket: bosSecenekEtiketi });
  return <SadeSecim {...props} etiket={baslik} placeholder={baslik} secenekler={secenekler}
    gorunenEtiket={baslikGoster || !props.deger ? baslik : undefined} altBilgiTetikleyicide={false} />;
}

export function SadeKisiCokluSecimi({ baslik = "Alıcılar", kisiler, ...props }: Omit<ComponentProps<typeof SadeCokluAliciSecimi>, "secenekler" | "etiket" | "placeholder" | "aliciAdi"> & {
  baslik?: string; kisiler: readonly KisiSecenegi[];
}) {
  return <SadeCokluAliciSecimi {...props} secenekler={secenekleriHazirla(kisiler)} etiket={baslik} placeholder={baslik} aliciAdi="kişi" />;
}
