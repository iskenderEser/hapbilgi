import type { CekTakipIslemi, CekTakipTalebi } from "@/lib/eclub/hediyeTakip/cekTakip";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";
import CekTakipKarti, {
  CekTakipDurumRozeti,
  CekTakipIslemButonu,
  CekTakipTeslimatOzeti,
  kosulMetni,
  tarihFormatla,
} from "./CekTakipKarti";

export default function CekTakipListesi({
  talepler,
  sonrakiKayitVarMi,
  dahaYukleniyor,
  islemdekiTalepId,
  onDahaFazla,
  onIslem,
}: {
  talepler: CekTakipTalebi[];
  sonrakiKayitVarMi: boolean;
  dahaYukleniyor: boolean;
  islemdekiTalepId: string | null;
  onDahaFazla: () => void;
  onIslem: (talepId: string, islem: CekTakipIslemi) => void;
}) {
  const th = "px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#71859d]";
  const td = "px-3 py-3 align-top text-xs";

  return (
    <section aria-label="Çek takip listesi" className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1160px] border-collapse">
          <thead className="border-b border-[#e7edf4] bg-[#f8fafc]">
            <tr>
              {[
                "Talep Tarihi", "Ürün / Koşul", "Eczane / Üye", "Kullanılan Puan",
                "Çek Tutarı", "Durum", "Teslimat", "İşlem",
              ].map((baslik) => <th key={baslik} className={th}>{baslik}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf1f5]">
            {talepler.map((talep) => (
              <tr key={talep.talep_id} className="hover:bg-[#fbfcfe]">
                <td className={`${td} whitespace-nowrap font-bold text-[#40556d]`}>{tarihFormatla(talep.created_at)}</td>
                <td className={`${td} min-w-[180px]`}><strong className="block text-[#203653]">{talep.urun.urun_adi}</strong><span className="mt-0.5 block text-[11px] font-semibold text-[#71859d]">{kosulMetni(talep)}</span></td>
                <td className={`${td} min-w-[190px]`}><strong className="block text-[#40556d]">{talep.eczane.eczane_adi}</strong><span className="mt-0.5 block text-[11px] text-[#71859d]">{talep.uye.ad_soyad} · {eclubKisiRolEtiketi(talep.uye.rol)}</span></td>
                <td className={`${td} text-right font-black tabular-nums text-[#40556d]`}>{talep.puan.kullanilan.toLocaleString("tr-TR")}</td>
                <td className={`${td} text-right font-black tabular-nums text-emerald-700`}>{talep.cek.tutar_tl.toLocaleString("tr-TR")} TL</td>
                <td className={td}><CekTakipDurumRozeti talep={talep} /></td>
                <td className={`${td} min-w-[190px]`}><CekTakipTeslimatOzeti talep={talep} /></td>
                <td className={td}><CekTakipIslemButonu talep={talep} islemde={islemdekiTalepId === talep.talep_id} onIslem={onIslem} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 bg-[#f8fafc] p-3 lg:hidden">
        {talepler.map((talep) => (
          <CekTakipKarti
            key={talep.talep_id}
            talep={talep}
            islemde={islemdekiTalepId === talep.talep_id}
            onIslem={onIslem}
          />
        ))}
      </div>

      {sonrakiKayitVarMi && (
        <div className="border-t border-[#e7edf4] px-4 py-4 text-center">
          <button type="button" onClick={onDahaFazla} disabled={dahaYukleniyor} className="rounded-xl border border-[#d7e1ec] bg-white px-5 py-2 text-xs font-extrabold text-[#45627f] transition hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-50">
            {dahaYukleniyor ? "Yükleniyor..." : "Daha Fazla Göster"}
          </button>
        </div>
      )}
    </section>
  );
}
