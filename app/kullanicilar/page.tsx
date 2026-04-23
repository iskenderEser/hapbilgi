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

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {formAcik && duzenle && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Kullanıcı Düzenle</span>
              <button onClick={formSifirla} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "18px" }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Ad</label>
                  <input type="text" value={ad} onChange={(e) => setAd(e.target.value)} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Soyad</label>
                  <input type="text" value={soyad} onChange={(e) => setSoyad(e.target.value)} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Rol</label>
                  <select value={secilenRol} onChange={(e) => setSecilenRol(e.target.value)} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }}>
                    <option value="">Seçiniz</option>
                    {ROLLER.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Firma</label>
                  <select value={secilenFirma} onChange={(e) => { setSecilenFirma(e.target.value); setSecilenTakim(""); setSecilenBolge(""); }} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }}>
                    <option value="">Seçiniz</option>
                    {hiyerarsi.firmalar.map(f => <option key={f.firma_id} value={f.firma_id}>{f.firma_adi}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Takım (opsiyonel)</label>
                  <select value={secilenTakim} onChange={(e) => { setSecilenTakim(e.target.value); setSecilenBolge(""); }} style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }}>
                    <option value="">Seçiniz</option>
                    {filtreliTakimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Bölge (opsiyonel)</label>
                  <select value={secilenBolge} onChange={(e) => setSecilenBolge(e.target.value)} style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }}>
                    <option value="">Seçiniz</option>
                    {filtreliBolgeler.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button type="button" onClick={formSifirla} style={{ padding: "8px 16px", borderRadius: "8px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                <button type="submit" disabled={formLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: formLoading ? 0.6 : 1 }}>
                  {formLoading ? "Kaydediliyor..." : "Güncelle"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Kullanıcılar</span>
            <span style={{ fontSize: "11px", color: "#737373" }}>{kullanicilar.length} kayıt</span>
          </div>

          {kullanicilar.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Henüz kullanıcı bulunmuyor.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                  <th style={{ textAlign: "left", padding: "10px 20px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Ad Soyad</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>E-posta</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Rol</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Bölge / Takım</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", color: "#9ca3af", fontWeight: 500, fontSize: "11px" }}>Durum</th>
                  <th style={{ padding: "10px 20px" }}></th>
                </tr>
              </thead>
              <tbody>
                {kullanicilar.map((k) => (
                  <tr key={k.kullanici_id} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 20px", color: "#111", fontWeight: 500 }}>{k.ad} {k.soyad}</td>
                    <td style={{ padding: "12px", color: "#737373", fontSize: "11px" }}>{k.eposta}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>{k.rol}</span>
                    </td>
                    <td style={{ padding: "12px", color: "#737373", fontSize: "11px" }}>
                      {k.bolge_adi && <div>{k.bolge_adi}</div>}
                      {k.takim_adi && <div style={{ color: "#9ca3af" }}>{k.takim_adi}</div>}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: k.aktif_mi ? "#f0fdf4" : "#fef2f2", color: k.aktif_mi ? "#16a34a" : "#bc2d0d", border: `0.5px solid ${k.aktif_mi ? "#bbf7d0" : "#fecaca"}` }}>
                        {k.aktif_mi ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 20px" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button onClick={() => handleDuzenle(k)} style={{ padding: "4px 10px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "11px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Düzenle</button>
                        {k.aktif_mi && k.kullanici_id !== user?.id && (
                          <button onClick={() => handlePasifYap(k.kullanici_id, `${k.ad} ${k.soyad}`)} style={{ padding: "4px 10px", borderRadius: "6px", border: "0.5px solid #fecaca", background: "transparent", color: "#bc2d0d", fontSize: "11px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Pasif</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}