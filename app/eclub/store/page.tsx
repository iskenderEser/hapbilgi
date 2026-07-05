// app/eclub/store/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubStore } from "./_hooks/useEclubStore";
import type { EclubStoreUrun } from "@/lib/eclub/store/eclubStoreTipler";

export default function EclubStorePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";

  const {
    kategoriler, urunler, firmaBakiye, toplamBakiye, adresler, loading,
    siparisVer,
  } = useEclubStore({ hata, basari });

  const [seciliUrun, setSeciliUrun] = useState<EclubStoreUrun | null>(null);
  const [seciliAdresId, setSeciliAdresId] = useState<string>("");
  const [adet, setAdet] = useState(1);
  const [islemLoading, setIslemLoading] = useState(false);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  const handleCikis = async () => { await cikisYap(); router.push("/login"); };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const acForm = (u: EclubStoreUrun) => {
    setSeciliUrun(u);
    setAdet(1);
    const varsayilan = adresler.find((a) => a.varsayilan_mi) ?? adresler[0];
    setSeciliAdresId(varsayilan?.adres_id ?? "");
  };

  const onaylaSiparis = async () => {
    if (!seciliUrun || !seciliAdresId) return;
    setIslemLoading(true);
    const ok = await siparisVer(seciliUrun.urun_id, seciliAdresId, adet);
    setIslemLoading(false);
    if (ok) setSeciliUrun(null);
  };

  const urunlerByKategori = (kategori_id: string) => urunler.filter((u) => u.kategori_id === kategori_id);
  const kategorisizUrunler = urunler.filter((u) => !u.kategori_id || !kategoriler.some((k) => k.kategori_id === u.kategori_id));

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} kimlikTuru={kullanici.kimlik_turu} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 m-0">E-Club Store</h1>
          <p className="text-sm text-gray-500 m-0">Puanlarınızla ürün sipariş edin.</p>
        </div>

        {/* Firma bazında bakiye */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Puan Bakiyem</span>
            <span className="text-sm font-bold" style={{ color: "#16a34a" }}>Toplam: {toplamBakiye}</span>
          </div>
          {firmaBakiye.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6 m-0">Henüz puanınız yok.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {firmaBakiye.map((f) => (
                <div key={f.firma_id} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{f.firma_adi}</span>
                  <span className="text-sm font-semibold text-gray-900">{f.bakiye} puan</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ürünler */}
        {urunler.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
            <p className="text-sm text-gray-400 m-0">Şu anda satışta ürün yok.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {kategoriler.map((k) => {
              const list = urunlerByKategori(k.kategori_id);
              if (list.length === 0) return null;
              return (
                <div key={k.kategori_id}>
                  <h2 className="text-sm font-semibold text-gray-700 mb-2">{k.ad}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {list.map((u) => <UrunKart key={u.urun_id} urun={u} onSiparis={() => acForm(u)} />)}
                  </div>
                </div>
              );
            })}
            {kategorisizUrunler.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Diğer</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {kategorisizUrunler.map((u) => <UrunKart key={u.urun_id} urun={u} onSiparis={() => acForm(u)} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sipariş modalı */}
      {seciliUrun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl w-full max-w-md p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 m-0">Sipariş Onayı</h3>
              <button onClick={() => setSeciliUrun(null)} className="text-gray-400 bg-transparent border-none cursor-pointer text-lg">✕</button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900">{seciliUrun.ad}</span>
              <span className="text-sm" style={{ color: "#16a34a" }}>{seciliUrun.puan_fiyat} puan</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Adet</label>
              <input type="number" min={1} max={seciliUrun.stok} value={adet}
                onChange={(e) => setAdet(Math.max(1, Math.min(seciliUrun.stok, Number(e.target.value))))}
                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm" />
              <span className="text-xs text-gray-400">Stok: {seciliUrun.stok}</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-600">Teslimat Adresi</label>
              {adresler.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">
                  Kayıtlı adresiniz yok. <button onClick={() => router.push("/eclub/store/adreslerim")} className="underline bg-transparent border-none cursor-pointer" style={{ color: "#56aeff" }}>Adres ekle</button>
                </div>
              ) : (
                <select value={seciliAdresId} onChange={(e) => setSeciliAdresId(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-2 text-sm">
                  {adresler.map((a) => (
                    <option key={a.adres_id} value={a.adres_id}>
                      {a.baslik ? `${a.baslik} — ` : ""}{a.il}/{a.ilce} — {a.ad_soyad}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-900">Toplam: {seciliUrun.puan_fiyat * adet} puan</span>
              <button onClick={onaylaSiparis}
                disabled={islemLoading || !seciliAdresId || seciliUrun.puan_fiyat * adet > toplamBakiye}
                className="text-white border-none rounded-lg px-5 py-2 text-sm font-semibold cursor-pointer"
                style={{ background: "#16a34a", opacity: (!seciliAdresId || seciliUrun.puan_fiyat * adet > toplamBakiye) ? 0.5 : 1 }}>
                {islemLoading ? "..." : "Siparişi Onayla"}
              </button>
            </div>
            {seciliUrun.puan_fiyat * adet > toplamBakiye && (
              <span className="text-xs" style={{ color: "#bc2d0d" }}>Yetersiz puan bakiyesi.</span>
            )}
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}

function UrunKart({ urun, onSiparis }: { urun: EclubStoreUrun; onSiparis: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="bg-gray-100 flex items-center justify-center" style={{ height: "120px" }}>
        {urun.gorsel_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={urun.gorsel_url} alt={urun.ad} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-gray-400">Görsel yok</span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <span className="text-sm font-medium text-gray-900">{urun.ad}</span>
        <span className="text-sm font-semibold" style={{ color: "#16a34a" }}>{urun.puan_fiyat} puan</span>
        <div className="mt-auto pt-1">
          <button onClick={onSiparis} disabled={urun.stok <= 0}
            className="w-full text-xs px-3 py-2 rounded-lg border-none text-white font-semibold cursor-pointer"
            style={{ background: urun.stok > 0 ? "#56aeff" : "#9ca3af" }}>
            {urun.stok > 0 ? "Sipariş Ver" : "Stok Yok"}
          </button>
        </div>
      </div>
    </div>
  );
}