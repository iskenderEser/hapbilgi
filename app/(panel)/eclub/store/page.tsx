"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Coins, MapPin, Minus, Package, Plus, ShoppingBag, Store, X } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  EclubKisiBaslik,
  EclubKisiBosDurum,
  EclubKisiSayfa,
  EclubKisiStat,
  EclubKisiYukleniyor,
} from "@/components/eclub/EclubKisiSayfa";
import { useEclubStore } from "./_hooks/useEclubStore";
import type { EclubStoreUrun } from "@/lib/eclub/store/eclubStoreTipler";

function UrunKart({ urun, onSiparis }: { urun: EclubStoreUrun; onSiparis: () => void }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-[#f1f5f8]">
        {urun.gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urun.gorsel_url} alt={urun.ad} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : <Package size={27} className="text-[#9cadbd]" />}
        {urun.stok <= 0 && <span className="absolute right-2 top-2 rounded-full bg-[#203653]/85 px-2.5 py-1 text-[9px] font-extrabold text-white">Stok Yok</span>}
      </div>
      <div className="flex min-h-[132px] flex-col gap-2 p-3.5">
        <div className="min-w-0"><h3 className="truncate text-sm font-extrabold text-[#203653]">{urun.ad}</h3>{urun.aciklama && <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[#8190a3]">{urun.aciklama}</p>}</div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-[#edf1f5] pt-2.5">
          <div><small className="block text-[9px] font-bold text-[#8190a3]">Puan Değeri</small><strong className="text-sm font-black text-[#16865f]">{urun.puan_fiyat.toLocaleString("tr-TR")} p</strong></div>
          <button type="button" onClick={onSiparis} disabled={urun.stok <= 0} className="rounded-xl bg-[#237ac8] px-3.5 py-2 text-[11px] font-extrabold text-white hover:bg-[#1d69aa] disabled:cursor-not-allowed disabled:bg-[#a9b7c4]">Sipariş Ver</button>
        </div>
      </div>
    </article>
  );
}

export default function EclubStorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();
  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const { kategoriler, urunler, firmaBakiye, toplamBakiye, adresler, loading, siparisVer } = useEclubStore({ hata, basari });
  const [seciliUrun, setSeciliUrun] = useState<EclubStoreUrun | null>(null);
  const [seciliAdresId, setSeciliAdresId] = useState("");
  const [adet, setAdet] = useState(1);
  const [islemLoading, setIslemLoading] = useState(false);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) router.replace("/ana-sayfa");
  }, [authYukleniyor, kullanici, eclubKisi, router]);

  if (authYukleniyor || !kullanici || loading) return <EclubKisiYukleniyor />;

  const acForm = (urun: EclubStoreUrun) => {
    setSeciliUrun(urun);
    setAdet(1);
    const varsayilan = adresler.find((adres) => adres.varsayilan_mi) ?? adresler[0];
    setSeciliAdresId(varsayilan?.adres_id ?? "");
  };
  const onaylaSiparis = async () => {
    if (!seciliUrun || !seciliAdresId) return;
    setIslemLoading(true);
    const ok = await siparisVer(seciliUrun.urun_id, seciliAdresId, adet);
    setIslemLoading(false);
    if (ok) setSeciliUrun(null);
  };
  const kategorisiz = urunler.filter((urun) => !urun.kategori_id || !kategoriler.some((kategori) => kategori.kategori_id === urun.kategori_id));
  const toplamTutar = (seciliUrun?.puan_fiyat ?? 0) * adet;

  return (
    <EclubKisiSayfa>
      <EclubKisiBaslik
        ikon={Store}
        baslik="Mağazam"
        aciklama="Farklı firmalardan kazandığınız puanları tek bakiyede birleştirerek E‑Club Store ürünlerinden sipariş verin."
        aksiyon={<div className="flex gap-2"><Link href="/eclub/store/siparislerim" className="rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] hover:bg-[#f6f9fc]">Siparişlerim</Link><Link href="/eclub/store/adreslerim" className="rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-2 text-xs font-extrabold text-[#45627f] hover:bg-[#f6f9fc]">Adreslerim</Link></div>}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <EclubKisiStat ikon={Coins} etiket="Kullanılabilir Puan" deger={toplamBakiye.toLocaleString("tr-TR")} detay="Tüm firmaların toplamı" renk="#16865f" zemin="#ebf8f2" />
        <EclubKisiStat ikon={Building2} etiket="Puan Gelen Firma" deger={firmaBakiye.length} detay="Aktif Store bakiyesi" />
        <div className="col-span-2 lg:col-span-1"><EclubKisiStat ikon={Package} etiket="Mağaza Ürünü" deger={urunler.length} detay="Siparişe açık ürünler" renk="#7358c7" zemin="#f2efff" /></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7edf4] px-4 py-3.5">
          <div><h2 className="text-sm font-extrabold text-[#203653]">Firma Puanlarım</h2><p className="mt-0.5 text-[10px] font-semibold text-[#8190a3]">Sipariş sırasında bu bakiyeler ihtiyaca göre birlikte kullanılır.</p></div>
          <strong className="rounded-xl bg-[#eef9f4] px-3 py-1.5 text-sm font-black text-[#16865f]">{toplamBakiye.toLocaleString("tr-TR")} puan</strong>
        </div>
        {firmaBakiye.length > 0 ? (
          <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {firmaBakiye.map((firma) => (
              <div key={firma.firma_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e4ebf2] bg-[#fbfcfe] px-3.5 py-3">
                <span className="min-w-0"><strong className="block truncate text-xs text-[#30475f]">{firma.firma_adi}</strong><small className="text-[9px] font-semibold text-[#8a99aa]">Kazanılan {firma.kazanilan.toLocaleString("tr-TR")} · Kullanılan {firma.harcanan.toLocaleString("tr-TR")}</small></span>
                <strong className="shrink-0 text-sm font-black text-[#16865f]">{firma.bakiye.toLocaleString("tr-TR")} p</strong>
              </div>
            ))}
          </div>
        ) : <div className="px-4 py-8 text-center text-xs font-semibold text-[#8a99aa]">Henüz kullanılabilir puanınız bulunmuyor.</div>}
      </section>

      {urunler.length === 0 ? (
        <EclubKisiBosDurum ikon={ShoppingBag} baslik="Şu anda ürün bulunmuyor" aciklama="Yeni ürünler mağazaya eklendiğinde burada görüntülenecek." />
      ) : (
        <div className="grid gap-5">
          {kategoriler.map((kategori) => {
            const liste = urunler.filter((urun) => urun.kategori_id === kategori.kategori_id);
            if (liste.length === 0) return null;
            return <section key={kategori.kategori_id}><div className="mb-2.5 flex items-center justify-between"><h2 className="text-sm font-extrabold text-[#30475f]">{kategori.ad}</h2><span className="text-[10px] font-bold text-[#8a99aa]">{liste.length} ürün</span></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{liste.map((urun) => <UrunKart key={urun.urun_id} urun={urun} onSiparis={() => acForm(urun)} />)}</div></section>;
          })}
          {kategorisiz.length > 0 && <section><h2 className="mb-2.5 text-sm font-extrabold text-[#30475f]">Diğer</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{kategorisiz.map((urun) => <UrunKart key={urun.urun_id} urun={urun} onSiparis={() => acForm(urun)} />)}</div></section>}
        </div>
      )}

      {seciliUrun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10213d]/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7edf4] px-4 py-3.5"><div><h3 className="text-sm font-extrabold text-[#203653]">Sipariş Onayı</h3><p className="text-[10px] font-semibold text-[#8190a3]">Ürün, adet ve teslimat adresini kontrol edin.</p></div><button type="button" onClick={() => setSeciliUrun(null)} className="rounded-lg p-1.5 text-[#8190a3] hover:bg-[#f2f5f8]"><X size={17} /></button></div>
            <div className="grid gap-4 p-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#f7f9fc] p-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#237ac8]"><Package size={18} /></span><div className="min-w-0"><strong className="block truncate text-sm text-[#203653]">{seciliUrun.ad}</strong><small className="text-[10px] font-bold text-[#16865f]">{seciliUrun.puan_fiyat.toLocaleString("tr-TR")} puan / adet</small></div></div>
              <div><label className="mb-1.5 block text-[10px] font-extrabold text-[#71859d]">Adet</label><div className="inline-flex items-center overflow-hidden rounded-xl border border-[#dfe7f1]"><button type="button" onClick={() => setAdet((mevcut) => Math.max(1, mevcut - 1))} className="p-2.5 text-[#61748b] hover:bg-[#f5f8fb]"><Minus size={14} /></button><span className="min-w-10 text-center text-sm font-black text-[#203653]">{adet}</span><button type="button" onClick={() => setAdet((mevcut) => Math.min(seciliUrun.stok, mevcut + 1))} className="p-2.5 text-[#61748b] hover:bg-[#f5f8fb]"><Plus size={14} /></button></div><span className="ml-2 text-[10px] font-semibold text-[#8a99aa]">Stok: {seciliUrun.stok}</span></div>
              <div><label className="mb-1.5 flex items-center gap-1 text-[10px] font-extrabold text-[#71859d]"><MapPin size={11} /> Teslimat Adresi</label>{adresler.length === 0 ? <div className="rounded-xl border border-[#fed7aa] bg-[#fff9f1] p-3 text-xs font-semibold text-[#a45b15]">Kayıtlı adresiniz yok. <button type="button" onClick={() => router.push("/eclub/store/adreslerim")} className="font-extrabold underline">Adres ekleyin</button>.</div> : <select value={seciliAdresId} onChange={(event) => setSeciliAdresId(event.target.value)} className="w-full rounded-xl border border-[#dfe7f1] bg-white px-3 py-2.5 text-xs font-semibold text-[#40556d] outline-none focus:border-[#8abde8]">{adresler.map((adres) => <option key={adres.adres_id} value={adres.adres_id}>{adres.baslik ? `${adres.baslik} — ` : ""}{adres.il}/{adres.ilce} — {adres.ad_soyad}</option>)}</select>}</div>
              <div className="flex items-center justify-between gap-3 border-t border-[#e7edf4] pt-4"><div><small className="block text-[9px] font-bold text-[#8190a3]">Sipariş Toplamı</small><strong className="text-lg font-black text-[#16865f]">{toplamTutar.toLocaleString("tr-TR")} p</strong></div><button type="button" onClick={() => void onaylaSiparis()} disabled={islemLoading || !seciliAdresId || toplamTutar > toplamBakiye} className="rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white hover:bg-[#1d69aa] disabled:cursor-not-allowed disabled:opacity-45">{islemLoading ? "İşleniyor..." : "Siparişi Onayla"}</button></div>
              {toplamTutar > toplamBakiye && <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-3 py-2 text-[11px] font-bold text-[#b23b31]">Bu sipariş için puan bakiyeniz yetersiz.</div>}
            </div>
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </EclubKisiSayfa>
  );
}
