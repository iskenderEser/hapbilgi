// app/senaryolar/[talep_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Senaryo {
  senaryo_id: string;
  talep_id: string;
  iu_id: string;
  senaryo_metni: string;
  created_at: string;
  son_durum?: string;
  son_durum_tarihi?: string;
  son_durum_notlar?: string;
  senaryo_durum_id?: string;
}

interface Talep {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  aciklama: string;
}

export default function SenaryolarPage() {
  const router = useRouter();
  const params = useParams();
  const talep_id = params.talep_id as string;

  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [talep, setTalep] = useState<Talep | null>(null);
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [senaryoMetni, setSenaryoMetni] = useState("");
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [aktifRevizyon, setAktifRevizyon] = useState<string | null>(null);
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

    const { data: talepData, error: talepError } = await supabase
      .from("talepler")
      .select(`
        talep_id, aciklama,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talepData) {
      hata("Talep bulunamadı.", "talepler tablosu SELECT — talep_id");
      router.push("/talepler");
      return;
    }

    setTalep({
      talep_id: talepData.talep_id,
      aciklama: talepData.aciklama,
      urun_adi: (talepData as any).urunler?.urun_adi ?? "-",
      teknik_adi: (talepData as any).teknikler?.teknik_adi ?? "-",
    });

    const { data: senaryolarData, error: senaryoError } = await supabase
      .from("senaryolar")
      .select("senaryo_id, talep_id, iu_id, senaryo_metni, created_at")
      .eq("talep_id", talep_id)
      .order("created_at", { ascending: true });

    if (senaryoError) {
      hata("Senaryolar yüklenemedi.", "senaryolar tablosu SELECT — talep_id", senaryoError.message);
    }

    const senaryolarWithDurum = await Promise.all(
      (senaryolarData ?? []).map(async (s) => {
        const { data: durumlar } = await supabase
          .from("senaryo_durumu")
          .select("senaryo_durum_id, durum, notlar, created_at")
          .eq("senaryo_id", s.senaryo_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const sonDurum = durumlar?.[0];
        return {
          ...s,
          son_durum: sonDurum?.durum ?? null,
          son_durum_tarihi: sonDurum?.created_at ?? null,
          son_durum_notlar: sonDurum?.notlar ?? null,
          senaryo_durum_id: sonDurum?.senaryo_durum_id ?? null,
        };
      })
    );

    setSenaryolar(senaryolarWithDurum);
    setLoading(false);
  };

  useEffect(() => {
    if (user && talep_id) veriCek();
  }, [user, talep_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  const handleSenaryoGonder = async () => {
    if (!senaryoMetni.trim()) return;
    setGonderLoading(true);

    const res = await fetch("/senaryolar/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, senaryo_metni: senaryoMetni.trim() }),
    });

    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Senaryo oluşturulamadı.", d.adim, d.detay);
      setGonderLoading(false);
      return;
    }

    const { senaryo } = d;

    const d1 = await fetch("/senaryolar/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senaryo_id: senaryo.senaryo_id, durum: "Senaryo Yaziliyor" }),
    });
    if (!d1.ok) { const e = await d1.json(); hata(e.hata ?? "Durum kaydedilemedi.", e.adim, e.detay); }

    const d2 = await fetch("/senaryolar/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senaryo_id: senaryo.senaryo_id, durum: "Inceleme Bekleniyor" }),
    });
    if (!d2.ok) { const e = await d2.json(); hata(e.hata ?? "Durum kaydedilemedi.", e.adim, e.detay); }
    else basari("Senaryo PM'e gönderildi.");

    setSenaryoMetni("");
    await veriCek();
    setGonderLoading(false);
  };

  const handlePMKarar = async (senaryo_id: string, durum: string, notlar?: string) => {
    setGonderLoading(true);
    const res = await fetch("/senaryolar/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senaryo_id, durum, notlar }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay);
    } else {
      basari(durum === "Onaylandi" ? "Senaryo onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Senaryo iptal edildi.");
      setAktifRevizyon(null);
      setRevizyonNotu("");
      await veriCek();
    }
    setGonderLoading(false);
  };

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "Onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "Revizyon Bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "Inceleme Bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
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

  const sonSenaryo = senaryolar[senaryolar.length - 1];
  const iuYazabilir = isIU && (!sonSenaryo || sonSenaryo.son_durum === "Revizyon Bekleniyor" || sonSenaryo.son_durum === null);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => router.push("/talepler")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, width: "fit-content" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Talepler
        </button>

        {talep && (
          <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>{talep.urun_adi}</span>
              <span style={{ fontSize: "12px", color: "#737373" }}>{talep.teknik_adi}</span>
              {talep.aciklama && <p style={{ fontSize: "13px", color: "#374151", margin: "8px 0 0", lineHeight: 1.6 }}>{talep.aciklama}</p>}
            </div>
          </div>
        )}

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Senaryo Akışı</span>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {senaryolar.length === 0 && (
              <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Henüz senaryo yazılmadı.</p>
            )}

            {senaryolar.map((s, i) => {
              const renk = durumRenk(s.son_durum ?? "");
              const revSayisi = senaryolar.filter(x => x.son_durum === "Revizyon Bekleniyor").length;
              const isPMKararverilebilir = isPM && s.son_durum === "Inceleme Bekleniyor" && i === senaryolar.length - 1;

              return (
                <div key={s.senaryo_id} style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#737373" }}>Versiyon {i + 1}</span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatTarih(s.created_at)}</span>
                    </div>
                    {s.son_durum && (
                      <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "20px", background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                        {s.son_durum}
                      </span>
                    )}
                  </div>

                  <div style={{ padding: "14px", fontSize: "13px", color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                    {s.senaryo_metni}
                  </div>

                  {s.son_durum === "Revizyon Bekleniyor" && s.son_durum_notlar && (
                    <div style={{ padding: "10px 14px", background: "#fefce8", borderTop: "0.5px solid #fde68a" }}>
                      <span style={{ fontSize: "11px", color: "#854d0e", fontWeight: 600 }}>Revizyon Notu: </span>
                      <span style={{ fontSize: "12px", color: "#854d0e" }}>{s.son_durum_notlar}</span>
                    </div>
                  )}

                  {isPMKararverilebilir && (
                    <div style={{ padding: "12px 14px", borderTop: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                      {aktifRevizyon === s.senaryo_id ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)} placeholder="Revizyon notunu yazın..." rows={3} style={{ width: "100%", border: "0.5px solid #fde68a", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", resize: "vertical" }} />
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button onClick={() => { setAktifRevizyon(null); setRevizyonNotu(""); }} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "11px", cursor: "pointer" }}>İptal</button>
                            <button onClick={() => handlePMKarar(s.senaryo_id, "Revizyon Bekleniyor", revizyonNotu)} disabled={!revizyonNotu.trim() || gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer", opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>Revizyon Gönder</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button onClick={() => handlePMKarar(s.senaryo_id, "Onaylandi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#16a34a", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Onayla</button>
                          {revSayisi < 2 && (
                            <button onClick={() => setAktifRevizyon(s.senaryo_id)} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Revizyon İste</button>
                          )}
                          <button onClick={() => handlePMKarar(s.senaryo_id, "Iptal Edildi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #fecaca", background: "transparent", color: "#bc2d0d", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>İptal Et</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {iuYazabilir && (
            <div style={{ borderTop: "0.5px solid #e5e7eb", padding: "16px 20px", background: "#fafafa" }}>
              <textarea value={senaryoMetni} onChange={(e) => setSenaryoMetni(e.target.value)} placeholder="Senaryo metnini yazın..." rows={6} style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", resize: "vertical", marginBottom: "10px" }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={handleSenaryoGonder} disabled={!senaryoMetni.trim() || gonderLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !senaryoMetni.trim() ? 0.5 : 1 }}>
                  {gonderLoading ? "Gönderiliyor..." : "Gönder"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}