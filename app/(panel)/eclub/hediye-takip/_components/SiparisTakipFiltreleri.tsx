import { SadeListeSecimi, SadeTarihAlani } from "@/components/kontrol/SadeKontroller";
import type { SiparisTakipApiYaniti } from "@/lib/eclub/hediyeTakip/siparisTakip";
import { RotateCcw } from "lucide-react";

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

const etiketSinifi = "flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]";

export default function SiparisTakipFiltreleri({ deger, secenekler, onDegistir, uttler, uttId = "", onUttDegistir }: {
  deger: SiparisTakipFiltreDegerleri;
  secenekler: SiparisTakipApiYaniti["filtre_secenekleri"];
  onDegistir: (deger: SiparisTakipFiltreDegerleri) => void;
  uttler?: Array<{ utt_id: string; utt_adi: string }>;
  uttId?: string;
  onUttDegistir?: (uttId: string) => void;
}) {
  const degistir = (alan: keyof SiparisTakipFiltreDegerleri, value: string) => onDegistir({ ...deger, [alan]: value });
  return (
    <section aria-label="Sipariş takibi filtreleri" className="rounded-2xl border border-[#dfe7f1] bg-white p-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)] md:p-4">
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${uttler ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {uttler && <label htmlFor="siparis-takip-utt" className={etiketSinifi}>UTT
          <SadeListeSecimi id="siparis-takip-utt" value={uttId} onChange={(event) => onUttDegistir?.(event.target.value)} aria-label="UTT" className="w-full">
            <option value="">Tüm UTT’ler</option>
            {uttler.map((utt) => <option key={utt.utt_id} value={utt.utt_id}>{utt.utt_adi}</option>)}
          </SadeListeSecimi>
        </label>}
        <label htmlFor="siparis-takip-eczane" className={etiketSinifi}>Eczane
          <SadeListeSecimi id="siparis-takip-eczane" value={deger.eczane_id} onChange={(event) => degistir("eczane_id", event.target.value)} aria-label="Eczane" className="w-full">
            <option value="">Tüm eczaneler</option>
            {secenekler.eczaneler.map((item) => <option key={item.id} value={item.id}>{item.etiket}</option>)}
          </SadeListeSecimi>
        </label>
        <label htmlFor="siparis-takip-urun" className={etiketSinifi}>Ürün
          <SadeListeSecimi id="siparis-takip-urun" value={deger.urun_id} onChange={(event) => degistir("urun_id", event.target.value)} aria-label="Ürün" className="w-full">
            <option value="">Tüm ürünler</option>
            {secenekler.urunler.map((item) => <option key={item.id} value={item.id}>{item.etiket}</option>)}
          </SadeListeSecimi>
        </label>
        <label htmlFor="siparis-takip-durum" className={etiketSinifi}>Durum
          <SadeListeSecimi id="siparis-takip-durum" value={deger.durum} onChange={(event) => degistir("durum", event.target.value)} aria-label="Durum" className="w-full">
            <option value="">Tüm durumlar</option>
            <option value="inceleme_bekliyor">UTT İncelemesi Bekliyor</option>
            <option value="utt_onayladi">BM Onayı Bekliyor</option>
            <option value="bm_onayladi">BM Onayladı</option>
            <option value="talep_iptal">Onaya Kapalı (Çek Talebi İptal)</option>
          </SadeListeSecimi>
        </label>
        <label htmlFor="siparis-takip-baslangic" className={etiketSinifi}>Başlangıç
          <SadeTarihAlani id="siparis-takip-baslangic" value={deger.baslangic} max={deger.bitis || undefined} onChange={(event) => degistir("baslangic", event.target.value)} />
        </label>
        <label htmlFor="siparis-takip-bitis" className={etiketSinifi}>Bitiş
          <SadeTarihAlani id="siparis-takip-bitis" value={deger.bitis} min={deger.baslangic || undefined} onChange={(event) => degistir("bitis", event.target.value)} />
        </label>
      </div>
      {(Object.values(deger).some(Boolean) || Boolean(uttId)) && <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => { onDegistir({ ...BOS_SIPARIS_TAKIP_FILTRELERI }); onUttDegistir?.(""); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#60758d] hover:bg-[#f1f5f9] hover:text-[#237ac8]">
          <RotateCcw className="size-3.5" /> Filtreleri temizle
        </button>
      </div>}
    </section>
  );
}
