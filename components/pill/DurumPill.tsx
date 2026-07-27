// components/pill/DurumPill.tsx
//
// Bir işin durumu. Metin ve renk mesaj.ts'in sözlüğünden gelir — bu dosya
// sözlük TUTMAZ, yalnız okur. Aynı durum her ekranda aynı yazsın diye tek kaynak
// oradadır (ileride Hap asistanının prompt kaynağı da o sözlüktür).
//
// Sarma açık: durum metni kısaltılmaz, uzayacaksa uzar (İskender kararı 25.07).

"use client";

import { durumMesaji, type DurumKodu, type IuMesajGirdi } from "@/lib/utils/durum/mesaj";
import { Pill } from "./Pill";

interface DurumPillProps {
  kod: DurumKodu;
  /** Rol metni belirler: "iu" ise İÜ dili, değilse üretici dili. */
  rol?: string | null;
  tarih?: string | null;
  /** İÜ mesajının aşama/unvan gibi ek girdileri. */
  girdi?: IuMesajGirdi;
  sarabilir?: boolean;
  className?: string;
}

export function DurumPill({ kod, rol, tarih, girdi = {}, sarabilir = true, className }: DurumPillProps) {
  const mesaj = durumMesaji(kod, rol, { ...girdi, tarih: tarih ?? girdi.tarih });

  return (
    <Pill
      renk={{ bg: mesaj.renk.bg, metin: mesaj.renk.text, kenar: mesaj.renk.border }}
      sarabilir={sarabilir}
      className={className}
    >
      {mesaj.metin}
    </Pill>
  );
}
