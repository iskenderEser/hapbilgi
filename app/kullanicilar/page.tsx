// app/kullanicilar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  eposta: string;
  rol: string;
  firma_id: string;
  takim_id: string | null;
  bolge_id: string | null;
  aktif_mi: boolean;
  created_at: string;
  bolge_adi: string | null;
  takim_adi: string | null;
  firma_adi: string | null;
}

interface Hiyerarsi {
  firmalar: { firma_id: string; firma_adi: string }[];
  takimlar: { takim_id: string; takim_adi: string; firma_id: string }[];
  bolgeler: { bolge_id: string; bolge_adi: string; takim_id: string }[];
}

const ROLLER = ["pm", "jr_pm", "kd_pm", "iu", "tm", "bm", "utt", "kd_utt", "gm", "gm_yrd", "drk", "paz_md", "blm_md", "med_md", "grp_pm", "sm", "egt_md", "egt_yrd_md", "egt_yon", "egt_uz"];

export default function KullanicilarPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [hiyerarsi, setHiyerarsi] = useState<Hiyerarsi>({ firmalar: [], takimlar: [], bolgeler: [] });
  const [loading, setLoading] = useState(true);
  const [formAcik, setFormAcik] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [duzenle, setDuzenle] = useState<Kullanici | null>(null);
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [secilenRol, setSecilenRol] = useState("");
  const [secilenFirma, setSecilenFirma] = useState("");
  const [secilenTakim, setSecilenTakim] = useState("");
  const [secilenBolge, setSecilenBolge] = useState("");
  const { mesajlar, hata, basari } = useHataMesaji();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      setRol(data.user.user_metadata?.rol ?? "");
    });
  }, []);

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    const res = await fetch("/kullanicilar/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Kullanıcılar yüklenemedi.", data.adim, data.detay); }
    else { setKullanicilar(data.kullanicilar ?? []); }

    const { data: firmalar, error: fError } = await supabase.from("firmalar").select("firma_id, firma_adi").order("firma_adi");
    const { data: takimlar, error: tError } = await supabase.from("takimlar").select("takim_id, takim_adi, firma_id").order("takim_adi");
    const { data: bolgeler, error: bError } = await supabase.from("bolgeler").select("bolge_id, bolge_adi, takim_id").order("bolge_adi");

    if (fError) hata("Firmalar yüklenemedi.", "firmalar tablosu SELECT", fError.message);
    if (tError) hata("Takımlar yüklenemedi.", "takimlar tablosu SELECT", tError.message);
    if (bError) hata("Bölgeler yüklenemedi.", "bolgeler tablosu SELECT", bError.message);

    setHiyerarsi({ firmalar: firmalar ?? [], takimlar: takimlar ?? [], bolgeler: bolgeler ?? [] });
    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user]);

  const filtreliTakimlar = hiyerarsi.takimlar.filter(t => !secilenFirma || t.firma_id === secilenFirma);
  const filtreliBolgeler = hiyerarsi.bolgeler.filter(b => !secilenTakim || b.takim_id === secilenTakim);

  const formSifirla = () => {
    setAd(""); setSoyad("");
    setSecilenRol(""); setSecilenFirma(""); setSecilenTakim(""); setSecilenBolge("");
    setDuzenle(null); setFormAcik(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duzenle) return;
    setFormLoading(true);

    const res = await fetch(`/kullanicilar/api/${duzenle.kullanici_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad, soyad, kullanici_rol: secilenRol, firma_id: secilenFirma, takim_id: secilenTakim || null, bolge_id: secilenBolge || null }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Kullanıcı güncellenemedi.", d.adim, d.detay); }
    else { basari("Kullanıcı güncellendi."); formSifirla(); await veriCek(); }

    setFormLoading(false);
  };

  const handleDuzenle = (k: Kullanici) => {
    setDuzenle(k);
    setAd(k.ad); setSoyad(k.soyad);
    setSecilenRol(k.rol); setSecilenFirma(k.firma_id);
    setSecilenTakim(k.takim_id ?? ""); setSecilenBolge(k.bolge_id ?? "");
    setFormAcik(true);
  };

  const handlePasifYap = async (kullanici_id: string, ad: string) => {
    if (!confirm(`${ad} adlı kullanıcıyı pasif yapmak istediğinize emin misiniz?`)) return;
    const res = await fetch(`/kullanicilar/api/${kullanici_id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Kullanıcı pasif yapılamadı.", d.adim, d.detay); }
    else { basari("Kullanıcı pasif yapıldı."); await veriCek(); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-[Nunito]">
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-5">

        {/* Düzenleme formu */}
        {formAcik && duzenle && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">Kullanıcı Düzenle</span>
              <button onClick={formSifirla} className="text-gray-400 hover:text-gray-600 text-lg bg-transparent border-none cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Ad</label>
                  <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none focus:border-blue-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Soyad</label>
                  <input type="text" value={soyad} onChange={(e) => setSoyad(e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none focus:border-blue-300" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Rol</label>
                  <select value={secilenRol} onChange={(e) => setSecilenRol(e.target.value)} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none cursor-pointer">
                    <option value="">Seçiniz</option>
                    {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Firma</label>
                  <select value={secilenFirma} onChange={(e) => { setSecilenFirma(e.target.value); setSecilenTakim(""); setSecilenBolge(""); }} required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none cursor-pointer">
                    <option value="">Seçiniz</option>
                    {hiyerarsi.firmalar.map(f => <option key={f.firma_id} value={f.firma_id}>{f.firma_adi}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Takım (opsiyonel)</label>
                  <select value={secilenTakim} onChange={(e) => { setSecilenTakim(e.target.value); setSecilenBolge(""); }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none cursor-pointer">
                    <option value="">Seçiniz</option>
                    {filtreliTakimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Bölge (opsiyonel)</label>
                  <select value={secilenBolge} onChange={(e) => setSecilenBolge(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-[Nunito] outline-none cursor-pointer">
                    <option value="">Seçiniz</option>
                    {filtreliBolgeler.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={formSifirla}
                  className="px-4 py-2 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer font-[Nunito] hover:bg-gray-50">
                  İptal
                </button>
                <button type="submit" disabled={formLoading}
                  className="px-5 py-2 rounded-lg bg-blue-400 text-white text-xs font-semibold cursor-pointer font-[Nunito] disabled:opacity-60"
                  style={{ background: '#56aeff' }}>
                  {formLoading ? "Kaydediliyor..." : "Güncelle"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Kullanıcı listesi */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Kullanıcılar</span>
            <span className="text-xs text-gray-400">{kullanicilar.length} kayıt</span>
          </div>

          {kullanicilar.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">Henüz kullanıcı bulunmuyor.</div>
          ) : (
            <>
              {/* Desktop / Tablet tablo */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs">Ad Soyad</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">E-posta</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Rol</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Bölge / Takım</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs">Durum</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kullanicilar.map((k) => (
                      <tr key={k.kullanici_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-900 font-medium whitespace-nowrap">{k.ad} {k.soyad}</td>
                        <td className="px-3 py-3 text-gray-400 text-xs">{k.eposta}</td>
                        <td className="px-3 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{k.rol}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-400 text-xs">
                          {k.bolge_adi && <div>{k.bolge_adi}</div>}
                          {k.takim_adi && <div className="text-gray-300">{k.takim_adi}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${k.aktif_mi ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 border-red-100'}`}
                            style={{ color: k.aktif_mi ? '#16a34a' : '#bc2d0d' }}>
                            {k.aktif_mi ? "Aktif" : "Pasif"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => handleDuzenle(k)}
                              className="px-2.5 py-1 rounded border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer font-[Nunito] hover:bg-gray-50">
                              Düzenle
                            </button>
                            {k.aktif_mi && k.kullanici_id !== user?.id && (
                              <button onClick={() => handlePasifYap(k.kullanici_id, `${k.ad} ${k.soyad}`)}
                                className="px-2.5 py-1 rounded border border-red-100 bg-transparent text-xs cursor-pointer font-[Nunito]"
                                style={{ color: '#bc2d0d' }}>
                                Pasif
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile kart görünümü */}
              <div className="md:hidden divide-y divide-gray-100">
                {kullanicilar.map((k) => (
                  <div key={k.kullanici_id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{k.ad} {k.soyad}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{k.eposta}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${k.aktif_mi ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 border-red-100'}`}
                        style={{ color: k.aktif_mi ? '#16a34a' : '#bc2d0d' }}>
                        {k.aktif_mi ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{k.rol}</span>
                      {k.bolge_adi && <span className="text-xs text-gray-400">{k.bolge_adi}</span>}
                      {k.takim_adi && <span className="text-xs text-gray-300">{k.takim_adi}</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleDuzenle(k)}
                        className="px-3 py-1.5 rounded border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer font-[Nunito]">
                        Düzenle
                      </button>
                      {k.aktif_mi && k.kullanici_id !== user?.id && (
                        <button onClick={() => handlePasifYap(k.kullanici_id, `${k.ad} ${k.soyad}`)}
                          className="px-3 py-1.5 rounded border border-red-100 bg-transparent text-xs cursor-pointer font-[Nunito]"
                          style={{ color: '#bc2d0d' }}>
                          Pasif
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}