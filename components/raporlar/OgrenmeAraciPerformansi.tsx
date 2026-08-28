import type { AracTuruRaporSatiri } from "@/lib/rapor/paylasilan/aracTuruDagilimi";

const ADLAR: Record<AracTuruRaporSatiri["arac_turu"], string> = {
  video: "Video", podcast: "Podcast", gorsel: "Görsel", flip_pdf: "Flip PDF",
};

const oran = (deger: number | null) => deger === null ? "—" : `%${deger.toLocaleString("tr-TR")}`;
const sayi = (deger: number) => deger.toLocaleString("tr-TR");

export default function OgrenmeAraciPerformansi({ dagilim }: { dagilim?: AracTuruRaporSatiri[] }) {
  if (!dagilim?.length) return null;
  return (
    <section className="my-4 overflow-hidden rounded-2xl border border-[#dce5ef] bg-white shadow-[0_8px_24px_rgba(31,55,84,0.06)]">
      <div className="border-b border-[#e6edf4] px-4 py-3">
        <h2 className="text-sm font-extrabold text-[#18304f]">Öğrenme aracı performansı</h2>
        <p className="mt-0.5 text-[11px] font-semibold text-[#74859a]">Kayıtlı araç puanı ile dönemde gerçekten kazanılan puan ayrı gösterilir.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-[11px]">
          <thead className="bg-[#f6f9fc] text-[#66798f]"><tr>
            {['Araç','Yayın','Başlatma / Tamamlama','Doğru / Yanlış','Başarı','Kayıtlı / Gerçek net puan','Öneri','Challenge','E-Club / Eczanem dağıtım'].map((x) => <th key={x} className="px-3 py-2 font-extrabold">{x}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#edf2f7]">
            {dagilim.map((satir) => <tr key={satir.arac_turu} className="text-[#31465f]">
              <td className="px-3 py-3 font-extrabold text-[#bc2d0d]">{ADLAR[satir.arac_turu]}</td>
              <td className="px-3 py-3">{sayi(satir.yayin_sayisi)}</td>
              <td className="px-3 py-3">{sayi(satir.baslatma)} / {sayi(satir.tamamlama)}</td>
              <td className="px-3 py-3">{sayi(satir.dogru_cevap)} / {sayi(satir.yanlis_cevap)}</td>
              <td className="px-3 py-3">{oran(satir.dogru_cevap_yuzdesi)}</td>
              <td className="px-3 py-3">{sayi(satir.kayitli_arac_puani)} / <strong>{sayi(satir.net_kazanilan_puan)}</strong></td>
              <td className="px-3 py-3">{sayi(satir.oneri_gonderildi)} / {sayi(satir.oneri_tamamlandi)}</td>
              <td className="px-3 py-3">{sayi(satir.challenge_gonderildi)} / {sayi(satir.challenge_tamamlandi)}</td>
              <td className="px-3 py-3">{sayi(satir.eclub_dagitim)} / {sayi(satir.eclub_dagitim_tamamlandi)} · {sayi(satir.eczanem_dagitim)} / {sayi(satir.eczanem_dagitim_tamamlandi)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 border-t border-[#e6edf4] bg-[#fbfcfe] p-3 sm:grid-cols-2 lg:grid-cols-4">
        {dagilim.map((satir) => <details key={satir.arac_turu} className="rounded-xl border border-[#e2eaf2] bg-white px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-extrabold text-[#38516d]">{ADLAR[satir.arac_turu]} yayınları ({satir.yayinlar.length})</summary>
          <div className="mt-2 space-y-1 text-[10px] text-[#718198]">
            {satir.yayinlar.length === 0 ? <div>Dönemde yayın yok.</div> : satir.yayinlar.map((y) => <div key={y.yayin_id} className="flex justify-between gap-2 border-t border-[#edf2f7] pt-1">
              <span>{y.talep_no ?? y.yayin_id.slice(0, 8)}</span><span>{y.baslatma}/{y.tamamlama} · {y.kazanilan_puan-y.kaybedilen_puan} puan</span>
            </div>)}
          </div>
        </details>)}
      </div>
    </section>
  );
}
