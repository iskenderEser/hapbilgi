// app/oneriler/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Oneri {
  oneri_id: string;
  yayin_id: string;
  oneren_id: string;
  kullanici_id: string;
  oneri_baslangic: string;
  oneri_bitis: string;
  izlendi_mi: boolean;
  created_at: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  kullanici_adi: string;
  video_puani?: number | null;
  begeni_sayisi: number;
  favori_sayisi: number;
  begeni_mi: boolean;
  favori_mi: boolean;
}

interface Yayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
}

interface Kullanici {
  kullanici_id: string;
  ad: string;
  soyad: string;
  rol: string;
}

export default function OnerilerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [oneriler, setOneriler] = useState<Oneri[]>([]);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [secilenYayinlar, setSecilenYayinlar] = useState<string[]>([]);
  const [secilenKullanici, setSecilenKullanici] = useState<string>("");
  const [oneriBaslangic, setOneriBaslangic] = useState("");
  const [oneriBitis, setOneriBitis] = useState("");
  const { mesajlar, hata, basari } = useHataMesaji();

  const handleBegeni = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/begeni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Beğeni işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id
      ? { ...o, begeni_mi: d.begeni_mi, begeni_sayisi: d.begeni_mi ? o.begeni_sayisi + 1 : o.begeni_sayisi - 1 }
      : o
    ));
  };

  const handleFavori = async (e: React.MouseEvent, yayin_id: string) => {
    e.stopPropagation();
    const res = await fetch("/izle/api/favori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Favori işlemi başarısız.", d.adim, d.detay); return; }
    setOneriler(prev => prev.map(o => o.yayin_id === yayin_id
      ? { ...o, favori_mi: d.favori_mi, favori_sayisi: d.favori_mi ? o.favori_sayisi + 1 : o.favori_sayisi - 1 }
      : o
    ));
  };

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

    const res = await fetch("/oneriler/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Öneriler yüklenemedi.", data.adim, data.detay); }
    else { setOneriler(data.oneriler ?? []); }

    const rolKucu = (user?.user_metadata?.rol ?? "").toLowerCase();
    if (["tm", "bm"].includes(rolKucu)) {
      const yRes = await fetch("/oneriler/api/yayinlar");
      const yData = await yRes.json();
      if (!yRes.ok) { hata(yData.hata ?? "Yayınlar yüklenemedi.", yData.adim, yData.detay); }
      else { setYayinlar(yData.videolar ?? []); }

      const { data: kullanicilarData, error: kError } = await supabase
        .from("kullanicilar")
        .select("kullanici_id, ad, soyad, rol")
        .in("rol", ["utt", "kd_utt"])
        .eq("aktif_mi", true)
        .order("ad", { ascending: true });

      if (kError) { hata("Kullanıcılar yüklenemedi.", "kullanicilar tablosu SELECT", kError.message); }
      else { setKullanicilar(kullanicilarData ?? []); }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatTarihKisa = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });

  const rolKucu = rol.toLowerCase();
  const isBMTM = ["tm", "bm"].includes(rolKucu);
  const isUTT = ["utt", "kd_utt"].includes(rolKucu);

  const sureciGectiMi = (bitis: string) => new Date(bitis) < new Date();

  const kartDurumu = (o: Oneri): { renk: string; etiket: string; soluk: boolean } => {
    if (o.izlendi_mi) return { renk: "#56aeff", etiket: "İzlendi", soluk: false };
    if (sureciGectiMi(o.oneri_bitis)) return { renk: "#bc2d0d", etiket: "Süresi Geçti", soluk: true };
    return { renk: "#737373", etiket: "İzlenecek", soluk: false };
  };

  const handleYayinSec = (yayin_id: string) => {
    setSecilenYayinlar(prev => {
      if (prev.includes(yayin_id)) return prev.filter(id => id !== yayin_id);
      if (prev.length >= 3) { hata("Tek seferde en fazla 3 video önerilebilir."); return prev; }
      return [...prev, yayin_id];
    });
  };

  const handleBaslangicDegis = (deger: string) => {
    setOneriBaslangic(deger);
    if (oneriBitis && deger > oneriBitis) setOneriBitis("");
  };

  const handleOneriGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secilenKullanici || secilenYayinlar.length === 0 || !oneriBaslangic || !oneriBitis) return;
    setGonderLoading(true);

    const onerilerListesi = secilenYayinlar.map(yayin_id => ({
      yayin_id,
      kullanici_id: secilenKullanici,
      oneri_baslangic: new Date(oneriBaslangic).toISOString(),
      oneri_bitis: new Date(oneriBitis).toISOString(),
    }));

    const res = await fetch("/oneriler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oneriler: onerilerListesi }),
    });

    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Öneri gönderilemedi.", d.adim, d.detay); }
    else {
      basari(`${d.oneriler?.length ?? 0} öneri başarıyla gönderildi.`);
      setSecilenYayinlar([]);
      setSecilenKullanici("");
      setOneriBaslangic("");
      setOneriBitis("");
      await veriCek();
    }
    setGonderLoading(false);
  };

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

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* BM/TM — Yeni Öneri Formu */}
        {isBMTM && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Yeni Öneri</span>
              <span style={{ fontSize: "11px", color: "#737373", marginLeft: "8px" }}>Max 3 video, tek seferde</span>
            </div>

            <form onSubmit={handleOneriGonder} style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>Kişi</label>
                <select value={secilenKullanici} onChange={(e) => setSecilenKullanici(e.target.value)} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white" }}>
                  <option value="">Seçiniz</option>
                  {kullanicilar.map(k => <option key={k.kullanici_id} value={k.kullanici_id}>{k.ad} {k.soyad} ({k.rol})</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>İzlenme Başlangıcı</label>
                  <input type="datetime-local" value={oneriBaslangic} onChange={(e) => handleBaslangicDegis(e.target.value)} required style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "4px" }}>İzlenme Bitişi</label>
                  <input type="datetime-local" value={oneriBitis} onChange={(e) => setOneriBitis(e.target.value)} required min={oneriBaslangic} style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", fontFamily: "'Nunito', sans-serif" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "#737373", display: "block", marginBottom: "8px" }}>
                  Videolar — {secilenYayinlar.length} / 3 seçildi
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {yayinlar.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#9ca3af" }}>Yayında video bulunmuyor.</p>
                  ) : (
                    yayinlar.map((y) => {
                      const secili = secilenYayinlar.includes(y.yayin_id);
                      return (
                        <div key={y.yayin_id} onClick={() => handleYayinSec(y.yayin_id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "8px", border: secili ? "1.5px solid #56aeff" : "0.5px solid #e5e7eb", background: secili ? "#e6f1fb" : "white", cursor: "pointer" }}>
                          <div style={{ width: "48px", height: "28px", borderRadius: "4px", overflow: "hidden", flexShrink: 0, background: "#e5e7eb" }}>
                            {y.thumbnail_url ? <img src={y.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#b5d4f4" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: secili ? "#56aeff" : "#111" }}>{y.urun_adi}</div>
                            <div style={{ fontSize: "11px", color: "#737373" }}>{y.teknik_adi}</div>
                          </div>
                          <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: secili ? "none" : "0.5px solid #e5e7eb", background: secili ? "#56aeff" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {secili && <svg width="8" height="8" viewBox="0 0 10 8" fill="white"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" /></svg>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={gonderLoading || secilenYayinlar.length === 0 || !secilenKullanici} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: secilenYayinlar.length === 0 || !secilenKullanici ? 0.5 : 1 }}>
                  {gonderLoading ? "Gönderiliyor..." : `${secilenYayinlar.length} Öneri Gönder`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* BM/TM — Gönderilen Öneriler Listesi */}
        {isBMTM && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Gönderilen Öneriler</span>
              <span style={{ fontSize: "11px", color: "#737373" }}>{oneriler.length} kayıt</span>
            </div>
            {oneriler.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Henüz öneri gönderilmedi.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {oneriler.map((o) => (
                  <div key={o.oneri_id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 20px", borderBottom: "0.5px solid #f3f4f6" }}>
                    <div style={{ width: "60px", height: "34px", borderRadius: "5px", overflow: "hidden", flexShrink: 0, background: "#e5e7eb" }}>
                      {o.thumbnail_url ? <img src={o.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#b5d4f4" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#111" }}>{o.urun_adi}</div>
                      <div style={{ fontSize: "11px", color: "#737373" }}>{o.teknik_adi}</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{o.kullanici_adi}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: o.izlendi_mi ? "#e6f1fb" : "#f9fafb", color: o.izlendi_mi ? "#56aeff" : "#737373", border: `0.5px solid ${o.izlendi_mi ? "#56aeff" : "#e5e7eb"}` }}>
                        {o.izlendi_mi ? "İzlendi" : "Bekliyor"}
                      </span>
                      <span style={{ fontSize: "10px", color: "#9ca3af" }}>{formatTarih(o.oneri_bitis)}'e kadar</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* UTT — Kart Görünümü */}
        {isUTT && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Gelen Öneriler</span>
              <span style={{ fontSize: "12px", color: "#737373" }}>{oneriler.length} öneri</span>
            </div>

            {oneriler.length === 0 ? (
              <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                Henüz öneri gelmedi.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                {oneriler.map((o) => {
                  const { renk, etiket, soluk } = kartDurumu(o);
                  return (
                    <div
                      key={o.oneri_id}
                      style={{ background: "white", border: `1.5px solid ${renk}`, borderRadius: "12px", overflow: "hidden", opacity: soluk ? 0.6 : 1, cursor: soluk ? "default" : "pointer", transition: "box-shadow 0.15s" }}
                      onMouseEnter={e => { if (!soluk) (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
                    >
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#b5d4f4", overflow: "hidden" }}>
                        {o.thumbnail_url
                          ? <img src={o.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #b5d4f4, #56aeff)" }} />
                        }
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: "36px", height: "36px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                          </div>
                        </div>
                        <div style={{ position: "absolute", top: "8px", left: "8px" }}>
                          <span style={{ background: renk, color: "white", borderRadius: "20px", padding: "2px 8px", fontSize: "10px", fontWeight: 600 }}>{etiket}</span>
                        </div>
                      </div>

                      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.urun_adi}</div>
                          <div style={{ fontSize: "11px", color: "#737373", whiteSpace: "nowrap", flexShrink: 0 }}>{o.teknik_adi}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          <div style={{ fontSize: "11px", color: "#737373", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            <span style={{ color: "#9ca3af" }}>Öneren:</span> {o.kullanici_adi}
                          </div>
                          <div style={{ fontSize: "10px", color: "#9ca3af", flexShrink: 0 }}>{formatTarihKisa(o.oneri_bitis)}'e kadar</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                          {o.video_puani != null ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", color: "#737373" }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                              Video <span style={{ fontWeight: 600, color: "#111", marginLeft: "2px" }}>{o.video_puani}</span>
                            </div>
                          ) : <div />}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }} onClick={(e) => handleBegeni(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.begeni_mi ? "#bc2d0d" : "none"} stroke="#bc2d0d" strokeWidth="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                              </svg>
                              <span style={{ fontSize: "11px", color: o.begeni_mi ? "#bc2d0d" : "#737373", fontWeight: o.begeni_mi ? 600 : 400 }}>{o.begeni_sayisi}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer" }} onClick={(e) => handleFavori(e, o.yayin_id)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill={o.favori_mi ? "#56aeff" : "none"} stroke={o.favori_mi ? "#56aeff" : "#737373"} strokeWidth="2">
                                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                              </svg>
                              <span style={{ fontSize: "11px", color: o.favori_mi ? "#56aeff" : "#737373", fontWeight: o.favori_mi ? 600 : 400 }}>{o.favori_sayisi}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}