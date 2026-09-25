"use client";

import type { IndirimliSatisSatiri } from "@/lib/eczanem/dokum";

export default function IndirimliSatisTablosu({ satislar }: { satislar: IndirimliSatisSatiri[] }) {
  return (
    <div className="max-h-[620px] overflow-auto">
      <table className="w-full min-w-[1170px] table-fixed border-collapse text-center text-xs">
        <thead className="sticky top-0 z-10 bg-[#f6f9fc] text-[10px] font-extrabold uppercase tracking-wide text-[#718198]">
          <tr>
            <th className="px-3 py-3">Satış ID</th>
            <th className="px-3 py-3">Eczane Satış Tarihi</th>
            <th className="px-3 py-3">Ürün Adı</th>
            <th className="px-3 py-3">Takım</th>
            <th className="px-3 py-3">Bölge</th>
            <th className="px-3 py-3">UTT</th>
            <th className="px-3 py-3">Eczane Adı</th>
            <th className="px-3 py-3">Kutu Adedi</th>
            <th className="px-3 py-3">İndirim Tutarı</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#edf2f7] bg-white">
          {satislar.map((satis) => (
            <tr key={satis.satis_id} className="hover:bg-[#f8fbff]">
              <td className="truncate px-3 py-3 font-mono text-[11px] font-bold text-[#237ac8]" title={satis.satis_id}>
                {satis.satis_id.slice(0, 8).toUpperCase()}
              </td>
              <td className="px-3 py-3 font-semibold tabular-nums text-[#405976]">
                {new Date(satis.islem_tarihi).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </td>
              <td className="truncate px-3 py-3 font-extrabold text-[#263e5b]" title={satis.urun_adi}>{satis.urun_adi}</td>
              <td className="truncate px-3 py-3 font-semibold text-[#405976]" title={satis.takim_adi}>{satis.takim_adi}</td>
              <td className="truncate px-3 py-3 font-semibold text-[#405976]" title={satis.bolge_adi}>{satis.bolge_adi}</td>
              <td className="truncate px-3 py-3 font-semibold text-[#405976]" title={satis.utt_adi}>{satis.utt_adi}</td>
              <td className="truncate px-3 py-3 font-semibold text-[#405976]" title={satis.eczane_adi}>{satis.eczane_adi}</td>
              <td className="px-3 py-3 font-extrabold tabular-nums text-[#16865f]">{satis.adet.toLocaleString("tr-TR")}</td>
              <td className="px-3 py-3 font-extrabold tabular-nums text-[#b45309]">₺{satis.indirim_tl.toLocaleString("tr-TR")}</td>
            </tr>
          ))}
          {satislar.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center font-semibold text-[#718198]">
                Seçilen kapsamda indirimli satış bulunamadı.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
