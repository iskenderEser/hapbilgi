// app/eclub/store/adreslerim/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubStore } from "../_hooks/useEclubStore";

export default function EclubAdreslerimPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const { adresler, adresEkle, adresSil, loading } = useEclubStore({ hata, basari });

  const [form, setForm] = useState({ baslik: "", ad_soyad: "", telefon: "", il: "", ilce: "", acik_adres: "", varsayilan_mi: false });
  const [ekleAcik, setEkleAcik] = useState(false);
  const [islemLoading, setIslemLoading] = useState(false);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  const handleCikis = async () => { await cikisYap(); router.push("/login"); };

  const kaydet = async () => {
    setIslemLoading(true);
    const ok = await adresEkle(form);
    setIslemLoading(false);
    if (ok) { setForm({ baslik: "", ad_soyad: "", telefon: "", il: "", ilce: "", acik_adres: "", varsayilan_mi: false }); setEkleAcik(false); }
  };

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

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none w-full";

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} kimlikTuru={kullanici.kimlik_turu} onCikis={handleCikis} />

      <div className="max-w-2xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 m-0">Adreslerim</h1>
          <button onClick={() => router.push("/eclub/store")} className="text-xs px-3 py-1.5 rounded-lg bg-transparent cursor-pointer" style={{ border: "0.5px solid #d1d5db", color: "#6b7280" }}>Mağazaya dön</button>
        </div>

        {adresler.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-gray-400 m-0">Kayıtlı adresiniz yok.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {adresler.map((a) => (
              <div key={a.adres_id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">
                    {a.baslik ? `${a.baslik} · ` : ""}{a.ad_soyad}
                    {a.varsayilan_mi && <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded" style={{ background: "#dcfce7", color: "#166534" }}>Varsayılan</span>}
                  </span>
                  <span className="text-xs text-gray-500">{a.telefon}</span>
                  <span className="text-xs text-gray-500">{a.il}/{a.ilce} — {a.acik_adres}</span>
                </div>
                <button onClick={() => adresSil(a.adres_id)} className="text-xs px-2.5 py-1 rounded-lg bg-transparent cursor-pointer flex-shrink-0" style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>Sil</button>
              </div>
            ))}
          </div>
        )}

        {ekleAcik ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <span className="text-sm font-semibold text-gray-900">Yeni Adres</span>
            <input className={inputCls} placeholder="Başlık (Ev, İş...)" value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} />
            <input className={inputCls} placeholder="Ad Soyad" value={form.ad_soyad} onChange={(e) => setForm({ ...form, ad_soyad: e.target.value })} />
            <input className={inputCls} placeholder="Telefon" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
            <div className="flex gap-2">
              <input className={inputCls} placeholder="İl" value={form.il} onChange={(e) => setForm({ ...form, il: e.target.value })} />
              <input className={inputCls} placeholder="İlçe" value={form.ilce} onChange={(e) => setForm({ ...form, ilce: e.target.value })} />
            </div>
            <textarea className={inputCls} placeholder="Açık adres" rows={2} value={form.acik_adres} onChange={(e) => setForm({ ...form, acik_adres: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.varsayilan_mi} onChange={(e) => setForm({ ...form, varsayilan_mi: e.target.checked })} />
              Varsayılan adres yap
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEkleAcik(false)} className="text-xs px-3 py-2 rounded-lg bg-transparent cursor-pointer" style={{ border: "0.5px solid #d1d5db", color: "#6b7280" }}>Vazgeç</button>
              <button onClick={kaydet} disabled={islemLoading} className="text-xs px-4 py-2 rounded-lg border-none text-white cursor-pointer" style={{ background: "#16a34a" }}>{islemLoading ? "..." : "Kaydet"}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEkleAcik(true)} className="text-sm px-4 py-2.5 rounded-lg border-none text-white cursor-pointer w-fit" style={{ background: "#56aeff" }}>+ Yeni Adres Ekle</button>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}