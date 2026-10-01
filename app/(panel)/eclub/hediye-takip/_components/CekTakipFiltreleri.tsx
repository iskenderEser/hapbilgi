import { RotateCcw } from "lucide-react";
import type { CekTakipFiltreSecenekleri } from "@/lib/eclub/hediyeTakip/cekTakip";
import { CEK_TALEP_DURUM_META, CEK_TALEP_DURUMLARI } from "@/lib/eclub/store/eclubStoreTipler";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";

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

const alanSinifi = "h-10 w-full min-w-0 rounded-xl border border-[#dce5ef] bg-white px-3 text-xs font-semibold text-[#40556d] outline-none transition focus:border-[#8abde8] focus:ring-2 focus:ring-[#dceefa]";

export default function CekTakipFiltreleri({
  deger,
  secenekler,
  onDegistir,
}: {
  deger: CekTakipFiltreDegerleri;
  secenekler: CekTakipFiltreSecenekleri;
  onDegistir: (deger: CekTakipFiltreDegerleri) => void;
}) {
  const uyeler = deger.eczane_id
    ? secenekler.uyeler.filter((uye) => uye.eczane_id === deger.eczane_id)
    : secenekler.uyeler;
  const filtreVar = Object.values(deger).some(Boolean);
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Eczane
          <select className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.eczane_id} onChange={(event) => alanDegistir("eczane_id", event.target.value)}>
            <option value="">Tüm eczaneler</option>
            {secenekler.eczaneler.map((eczane) => <option key={eczane.eczane_id} value={eczane.eczane_id}>{eczane.eczane_adi}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Üye
          <select className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.kisi_id} onChange={(event) => alanDegistir("kisi_id", event.target.value)}>
            <option value="">Tüm üyeler</option>
            {uyeler.map((uye) => <option key={uye.kisi_id} value={uye.kisi_id}>{eclubKisiRolEtiketi(uye.rol)} · {uye.ad_soyad}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Ürün
          <select className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.urun_id} onChange={(event) => alanDegistir("urun_id", event.target.value)}>
            <option value="">Tüm ürünler</option>
            {secenekler.urunler.map((urun) => <option key={urun.urun_id} value={urun.urun_id}>{urun.urun_adi}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Durum
          <select className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.durum} onChange={(event) => alanDegistir("durum", event.target.value)}>
            <option value="">Tüm durumlar</option>
            {CEK_TALEP_DURUMLARI.map((durum) => <option key={durum} value={durum}>{CEK_TALEP_DURUM_META[durum].etiket}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Başlangıç
          <input type="date" className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.baslangic} max={deger.bitis || undefined} onChange={(event) => alanDegistir("baslangic", event.target.value)} />
        </label>
        <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#7d8fa5]">
          Bitiş
          <input type="date" className={`${alanSinifi} mt-1 normal-case tracking-normal`} value={deger.bitis} min={deger.baslangic || undefined} onChange={(event) => alanDegistir("bitis", event.target.value)} />
        </label>
      </div>
      {filtreVar && (
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => onDegistir({ ...BOS_CEK_TAKIP_FILTRELERI })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold text-[#60758d] hover:bg-[#f1f5f9] hover:text-[#237ac8]">
            <RotateCcw className="size-3.5" /> Filtreleri temizle
          </button>
        </div>
      )}
    </section>
  );
}
