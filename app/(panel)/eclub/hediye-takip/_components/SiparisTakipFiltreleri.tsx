import { RotateCcw } from "lucide-react";
import type { SiparisTakipApiYaniti } from "@/lib/eclub/hediyeTakip/siparisTakip";

export interface SiparisTakipFiltreDegerleri {
  eczane_id: string;
  urun_id: string;
  durum: string;
  baslangic: string;
  bitis: string;
}

export const BOS_SIPARIS_TAKIP_FILTRELERI: SiparisTakipFiltreDegerleri = {
  eczane_id: "", urun_id: "", durum: "", baslangic: "", bitis: "",
};

const alanSinifi = "mt-1 h-10 w-full min-w-0 rounded-xl border border-[#dce5ef] bg-white px-3 text-xs font-semibold normal-case tracking-normal text-[#40556d] outline-none focus:border-[#8abde8] focus:ring-2 focus:ring-[#dceefa]";
const etiketSinifi = "min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]";

export default function SiparisTakipFiltreleri({ deger, secenekler, onDegistir }: {
  deger: SiparisTakipFiltreDegerleri;
  secenekler: SiparisTakipApiYaniti["filtre_secenekleri"];
  onDegistir: (deger: SiparisTakipFiltreDegerleri) => void;
}) {
  const degistir = (alan: keyof SiparisTakipFiltreDegerleri, value: string) => onDegistir({ ...deger, [alan]: value });
  return (
    <section aria-label="Sipariş takibi filtreleri" className="rounded-2xl border border-[#dfe7f1] bg-white p-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)] md:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label htmlFor="siparis-takip-eczane" className={etiketSinifi}>Eczane
          <select id="siparis-takip-eczane" className={alanSinifi} value={deger.eczane_id} onChange={(event) => degistir("eczane_id", event.target.value)}>
            <option value="">Tüm eczaneler</option>
            {secenekler.eczaneler.map((item) => <option key={item.id} value={item.id}>{item.etiket}</option>)}
          </select>
        </label>
        <label htmlFor="siparis-takip-urun" className={etiketSinifi}>Ürün
          <select id="siparis-takip-urun" className={alanSinifi} value={deger.urun_id} onChange={(event) => degistir("urun_id", event.target.value)}>
            <option value="">Tüm ürünler</option>
            {secenekler.urunler.map((item) => <option key={item.id} value={item.id}>{item.etiket}</option>)}
          </select>
        </label>
        <label htmlFor="siparis-takip-durum" className={etiketSinifi}>Durum
          <select id="siparis-takip-durum" className={alanSinifi} value={deger.durum} onChange={(event) => degistir("durum", event.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="inceleme_bekliyor">UTT İncelemesi Bekliyor</option>
            <option value="utt_onayladi">UTT Onayladı</option>
            <option value="talep_iptal">Çek Talebi İptal</option>
          </select>
        </label>
        <label htmlFor="siparis-takip-baslangic" className={etiketSinifi}>Başlangıç
          <input id="siparis-takip-baslangic" type="date" className={alanSinifi} value={deger.baslangic} max={deger.bitis || undefined} onChange={(event) => degistir("baslangic", event.target.value)} />
        </label>
        <label htmlFor="siparis-takip-bitis" className={etiketSinifi}>Bitiş
          <input id="siparis-takip-bitis" type="date" className={alanSinifi} value={deger.bitis} min={deger.baslangic || undefined} onChange={(event) => degistir("bitis", event.target.value)} />
        </label>
      </div>
      {Object.values(deger).some(Boolean) && <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => onDegistir({ ...BOS_SIPARIS_TAKIP_FILTRELERI })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#60758d] hover:bg-[#f1f5f9] hover:text-[#237ac8]">
          <RotateCcw className="size-3.5" /> Filtreleri temizle
        </button>
      </div>}
    </section>
  );
}
