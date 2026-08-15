"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Home, MapPin, Plus, Store, Trash2, X } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";
import { useEclubStore } from "../_hooks/useEclubStore";

const BOS_FORM = { baslik: "", ad_soyad: "", telefon: "", il: "", ilce: "", acik_adres: "", varsayilan_mi: false };
const INPUT_CLASS = "w-full rounded-xl border border-[#d8e2ec] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#40556d] outline-none transition placeholder:text-[#a5b1bf] focus:border-[#71afe3] focus:ring-2 focus:ring-[#dbeefe]";

export default function EclubAdreslerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const { adresler, adresEkle, adresSil, loading } = useEclubStore({ hata, basari });
  const [form, setForm] = useState(BOS_FORM);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [islemLoading, setIslemLoading] = useState(false);
  const [silinenAdresId, setSilinenAdresId] = useState<string | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  const kaydet = async () => {
    setIslemLoading(true);
    try {
      const ok = await adresEkle(form);
      if (ok) { setForm(BOS_FORM); setEkleAcik(false); }
    } finally {
      setIslemLoading(false);
    }
  };

  const adresiSil = async (adresId: string) => {
    setSilinenAdresId(adresId);
    try { await adresSil(adresId); } finally { setSilinenAdresId(null); }
  };

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  return (
    <EclubKisiSayfa>
      <EclubKisiBaslik
        ikon={MapPin}
        baslik="Adreslerim"
        aciklama="E‑Club Store siparişlerinizde kullanacağınız teslimat adreslerini yönetin."
        aksiyon={(
          <div className="flex flex-wrap gap-2">
            <Link href="/eclub/store" className="inline-flex items-center gap-2 rounded-xl border border-[#d8e2ec] bg-white px-4 py-2.5 text-xs font-extrabold text-[#71859d] shadow-sm hover:bg-[#f7f9fc]"><Store size={15} /> Mağazaya Dön</Link>
            {!ekleAcik && <button type="button" onClick={() => setEkleAcik(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#237ac8] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa]"><Plus size={15} /> Yeni Adres</button>}
          </div>
        )}
      />

      {ekleAcik && (
        <section className="rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_7px_22px_rgba(31,55,90,0.04)] md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-extrabold text-[#203653]">Yeni Teslimat Adresi</h2><p className="mt-0.5 text-[10px] font-semibold text-[#8a99aa]">Sipariş teslimatı için gerekli bilgileri eksiksiz girin.</p></div>
            <button type="button" onClick={() => { setEkleAcik(false); setForm(BOS_FORM); }} className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#dfe7f1] text-[#8190a3] hover:bg-[#f5f8fb]" aria-label="Formu kapat"><X size={15} /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d]">Adres Başlığı<input className={INPUT_CLASS} placeholder="Ev, iş..." value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} /></label>
            <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d]">Ad Soyad<input className={INPUT_CLASS} placeholder="Teslim alacak kişi" value={form.ad_soyad} onChange={(e) => setForm({ ...form, ad_soyad: e.target.value })} /></label>
            <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d]">Telefon<input className={INPUT_CLASS} placeholder="05xx xxx xx xx" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d]">İl<input className={INPUT_CLASS} placeholder="İl" value={form.il} onChange={(e) => setForm({ ...form, il: e.target.value })} /></label>
              <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d]">İlçe<input className={INPUT_CLASS} placeholder="İlçe" value={form.ilce} onChange={(e) => setForm({ ...form, ilce: e.target.value })} /></label>
            </div>
            <label className="grid gap-1.5 text-[10px] font-extrabold text-[#71859d] md:col-span-2">Açık Adres<textarea className={`${INPUT_CLASS} min-h-20 resize-y`} placeholder="Mahalle, cadde, sokak, bina ve daire bilgileri" value={form.acik_adres} onChange={(e) => setForm({ ...form, acik_adres: e.target.value })} /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf1f5] pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#60758d]"><input type="checkbox" checked={form.varsayilan_mi} onChange={(e) => setForm({ ...form, varsayilan_mi: e.target.checked })} className="h-4 w-4 accent-[#237ac8]" />Varsayılan teslimat adresi yap</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEkleAcik(false); setForm(BOS_FORM); }} className="rounded-xl border border-[#d8e2ec] bg-white px-4 py-2 text-xs font-extrabold text-[#71859d] hover:bg-[#f7f9fc]">Vazgeç</button>
              <button type="button" onClick={() => void kaydet()} disabled={islemLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865f] px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#11724f] disabled:cursor-wait disabled:opacity-60"><Check size={14} /> {islemLoading ? "Kaydediliyor..." : "Adresi Kaydet"}</button>
            </div>
          </div>
        </section>
      )}

      {adresler.length === 0 ? (
        <EclubKisiBosDurum ikon={Home} baslik="Kayıtlı adresiniz yok" aciklama="Mağazadan sipariş verebilmek için ilk teslimat adresinizi ekleyin." />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {adresler.map((adres) => (
            <article key={adres.adres_id} className="relative rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf6fd] text-[#237ac8]"><MapPin size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-[#203653]">{adres.baslik || "Teslimat Adresi"}</h2>{adres.varsayilan_mi && <span className="rounded-full bg-[#ebf8f2] px-2 py-0.5 text-[9px] font-extrabold text-[#16865f]">Varsayılan</span>}</div>
                  <p className="mt-2 text-xs font-extrabold text-[#40556d]">{adres.ad_soyad}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-[#71859d]">{adres.telefon}</p>
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[#71859d]">{adres.acik_adres}<br />{adres.ilce} / {adres.il}</p>
                </div>
                <button type="button" onClick={() => void adresiSil(adres.adres_id)} disabled={silinenAdresId === adres.adres_id} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#f1cccc] text-[#bc4b4b] hover:bg-[#fff7f7] disabled:cursor-wait disabled:opacity-50" aria-label="Adresi sil"><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </section>
      )}
      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
