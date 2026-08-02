// app/talepler-v2/_components/IptalAkordiyonu.tsx
//
// İptal edilen talepler — sol kolonun altında, kapalı akordiyonda.
//
// Neden burada: iptal edilen talep hiç içerik üretmedi, yani yayın tarafında hiç
// var olmadı. Mutfakta doğdu, mutfakta öldü — kaydı da mutfakta durur.
//
// Amaç geriye bakmak: "ne iptal ettik, HANGİ AŞAMADA kaldı, İŞ KİMDEYDİ". Bu
// yüzden sütunlar mevcut sistemdekiyle aynı tutuldu (S-3); prototipin sütun
// kümesi (üretim yöntemi + hedef rol) bu iki soruyu düşürüyordu.
//
// Tıklanabilir DEĞİL: kapalı iş, seçilmez, sağda şeridi açılmaz.
// Boşsa hiç çizilmez — iptali olmayan üreticinin sayfasında boş kutu durmasın.

"use client";

import { useState } from "react";
import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { talepIdGoster } from "@/lib/utils/talepId";
import { AsamaPill } from "@/components/pill";
import type { TalepSatiri } from "../_types";

interface Props {
  talepler: TalepSatiri[];
  formatTarih: (tarih: string | null) => string;
}

const baslikVer = (t: TalepSatiri) =>
  t.urun_adi !== "-" ? t.urun_adi : (TALEP_TURU_KURALLARI[t.egitim_turu]?.ad ?? t.egitim_turu);

export function IptalAkordiyonu({ talepler, formatTarih }: Props) {
  const [acik, setAcik] = useState(false);

  if (talepler.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        onClick={() => setAcik((a) => !a)}
        className="px-5 py-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">İptal Edilen Talepler</span>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "#fef2f2", color: "#bc2d0d", border: "0.5px solid #fecaca" }}
          >
            {talepler.length}
          </span>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          width="16"
          height="16"
          className="transition-transform duration-200 flex-shrink-0"
          style={{ transform: acik ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {acik && (
        // Sol kolon dar; tablo kesilmek yerine yatay kayar.
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Tür</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase whitespace-nowrap">İptal Aşaması</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase whitespace-nowrap">İçerik Üreticisi</th>
                <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {talepler.map((t) => (
                <tr key={t.talep_id} className="border-b border-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {talepIdGoster(t.firma_adi, t.talep_no)}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{baslikVer(t)}</td>
                  <td className="px-3 py-3"><AsamaPill asama={t.asama} /></td>
                  <td className="px-3 py-3 text-gray-500 text-xs">
                    {t.iu_ad_soyad ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTarih(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
