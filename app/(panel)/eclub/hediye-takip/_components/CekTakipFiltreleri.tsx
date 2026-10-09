import { SadeKisiSecimi } from "@/components/kontrol/KisiKontroller";
import { SadeListeSecimi, SadeTarihAlani } from "@/components/kontrol/SadeKontroller";
import type { CekTakipFiltreSecenekleri } from "@/lib/eclub/hediyeTakip/cekTakip";
import { CEK_TALEP_DURUM_META, CEK_TALEP_DURUMLARI } from "@/lib/eclub/store/eclubStoreTipler";
import { RotateCcw } from "lucide-react";

export interface CekTakipFiltreDegerleri {
  eczane_id: string;
  kisi_id: string;
  urun_id: string;
  durum: string;
  baslangic: string;
  bitis: string;
}

export const BOS_CEK_TAKIP_FILTRELERI: CekTakipFiltreDegerleri = {
  eczane_id: "",
  kisi_id: "",
  urun_id: "",
  durum: "",
  baslangic: "",
  bitis: "",
};


export default function CekTakipFiltreleri({
  deger,
  secenekler,
  onDegistir,
  uttler,
  uttId = "",
  onUttDegistir,
}: {
  deger: CekTakipFiltreDegerleri;
  secenekler: CekTakipFiltreSecenekleri;
  onDegistir: (deger: CekTakipFiltreDegerleri) => void;
  uttler?: Array<{ utt_id: string; utt_adi: string }>;
  uttId?: string;
  onUttDegistir?: (uttId: string) => void;
}) {
  const uyeler = deger.eczane_id
    ? secenekler.uyeler.filter((uye) => uye.eczane_id === deger.eczane_id)
    : secenekler.uyeler;
  const filtreVar = Object.values(deger).some(Boolean) || Boolean(uttId);
  const alanDegistir = (alan: keyof CekTakipFiltreDegerleri, yeniDeger: string) => {
    const sonraki = { ...deger, [alan]: yeniDeger };
    if (alan === "eczane_id" && deger.kisi_id && !secenekler.uyeler.some((uye) => (
      uye.kisi_id === deger.kisi_id && (!yeniDeger || uye.eczane_id === yeniDeger)
    ))) {
      sonraki.kisi_id = "";
    }
    onDegistir(sonraki);
  };

  return (
    <section aria-label="Çek takibi filtreleri" className="rounded-2xl border border-[#dfe7f1] bg-white p-3 shadow-[0_6px_18px_rgba(31,55,90,0.035)] md:p-4">
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${uttler ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}>
        {uttler && (
          <label htmlFor="cek-takip-utt" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
            Temsilciler
            <SadeKisiSecimi baslik="Temsilciler" bosSecenekEtiketi="Tüm Temsilciler" kisiler={uttler.map((utt) => ({ deger: utt.utt_id, adSoyad: utt.utt_adi }))} deger={uttId} onDegistir={(id) => onUttDegistir?.(id)} triggerProps={{ id: "cek-takip-utt" }} className="w-full" />
          </label>
        )}
        <label htmlFor="cek-takip-eczane" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Eczane
          <SadeListeSecimi id="cek-takip-eczane" value={deger.eczane_id} onChange={(event) => alanDegistir("eczane_id", event.target.value)} aria-label="Eczane" className="w-full">
            <option value="">Tüm eczaneler</option>
            {secenekler.eczaneler.map((eczane) => <option key={eczane.eczane_id} value={eczane.eczane_id}>{eczane.eczane_adi}</option>)}
          </SadeListeSecimi>
        </label>
        <label htmlFor="cek-takip-uye" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Üye
          <SadeKisiSecimi baslik="Üyeler" bosSecenekEtiketi="Tüm Üyeler" kisiler={uyeler.map((uye) => ({ deger: uye.kisi_id, adSoyad: uye.ad_soyad, rol: uye.rol }))} deger={deger.kisi_id} onDegistir={(id) => alanDegistir("kisi_id", id)} triggerProps={{ id: "cek-takip-uye" }} className="w-full" />
        </label>
        <label htmlFor="cek-takip-urun" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Ürün
          <SadeListeSecimi id="cek-takip-urun" value={deger.urun_id} onChange={(event) => alanDegistir("urun_id", event.target.value)} aria-label="Ürün" className="w-full">
            <option value="">Tüm ürünler</option>
            {secenekler.urunler.map((urun) => <option key={urun.urun_id} value={urun.urun_id}>{urun.urun_adi}</option>)}
          </SadeListeSecimi>
        </label>
        <label htmlFor="cek-takip-durum" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Durum
          <SadeListeSecimi id="cek-takip-durum" value={deger.durum} onChange={(event) => alanDegistir("durum", event.target.value)} aria-label="Durum" className="w-full">
            <option value="">Tüm durumlar</option>
            {CEK_TALEP_DURUMLARI.map((durum) => <option key={durum} value={durum}>{CEK_TALEP_DURUM_META[durum].etiket}</option>)}
          </SadeListeSecimi>
        </label>
        <label htmlFor="cek-takip-baslangic" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Başlangıç
          <SadeTarihAlani id="cek-takip-baslangic" value={deger.baslangic} max={deger.bitis || undefined} onChange={(event) => alanDegistir("baslangic", event.target.value)} />
        </label>
        <label htmlFor="cek-takip-bitis" className="flex min-w-0 flex-col gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Bitiş
          <SadeTarihAlani id="cek-takip-bitis" value={deger.bitis} min={deger.baslangic || undefined} onChange={(event) => alanDegistir("bitis", event.target.value)} />
        </label>
      </div>
      {filtreVar && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => { onDegistir({ ...BOS_CEK_TAKIP_FILTRELERI }); onUttDegistir?.(""); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#60758d] hover:bg-[#f1f5f9] hover:text-[#237ac8]">
            <RotateCcw className="size-3.5" /> Filtreleri temizle
          </button>
        </div>
      )}
    </section>
  );
}
