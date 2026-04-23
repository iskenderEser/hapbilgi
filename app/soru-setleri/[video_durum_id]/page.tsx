// app/soru-setleri/[video_durum_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Soru {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

interface SoruSeti {
  soru_seti_id: string;
  video_durum_id: string;
  iu_id: string;
  sorular: Soru[];
  created_at: string;
  son_durum?: string;
  son_durum_notlar?: string;
  soru_seti_durum_id?: string;
}

export default function SoruSetiAkisPage() {
  const router = useRouter();
  const params = useParams();
  const video_durum_id = params.video_durum_id as string;

  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [soruSetleri, setSoruSetleri] = useState<SoruSeti[]>([]);
  const [urunAdi, setUrunAdi] = useState("");
  const [teknikAdi, setTeknikAdi] = useState("");
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [yapisTir, setYapisTir] = useState("");
  const [onizleme, setOnizleme] = useState<Soru[]>([]);
  const [parseHata, setParseHata] = useState("");
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [aktifRevizyon, setAktifRevizyon] = useState(false);
  const [acikSet, setAcikSet] = useState<string | null>(null);
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

    const { data: videoDurum, error: vdError } = await supabase
      .from("video_durumu")
      .select("video_id")
      .eq("video_durum_id", video_durum_id)
      .single();

    if (vdError || !videoDurum) {
      hata("Video durumu bulunamadı.", "video_durumu tablosu SELECT — video_durum_id", vdError?.message);
    } else {
      const { data: video } = await supabase.from("videolar").select("senaryo_durum_id").eq("video_id", videoDurum.video_id).single();
      if (video?.senaryo_durum_id) {
        const { data: senaryoDurum } = await supabase.from("senaryo_durumu").select("senaryo_id").eq("senaryo_durum_id", video.senaryo_durum_id).single();
        if (senaryoDurum?.senaryo_id) {
          const { data: senaryo } = await supabase.from("senaryolar").select("talep_id").eq("senaryo_id", senaryoDurum.senaryo_id).single();
          if (senaryo?.talep_id) {
            const { data: talep } = await supabase
              .from("talepler")
              .select(`urunler(urun_adi), teknikler(teknik_adi)`)
              .eq("talep_id", senaryo.talep_id)
              .single();
            setUrunAdi((talep as any)?.urunler?.urun_adi ?? "-");
            setTeknikAdi((talep as any)?.teknikler?.teknik_adi ?? "-");
          }
        }
      }
    }

    const { data: soruSetleriData, error: ssError } = await supabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, iu_id, sorular, created_at")
      .eq("video_durum_id", video_durum_id)
      .order("created_at", { ascending: true });

    if (ssError) hata("Soru setleri yüklenemedi.", "soru_setleri tablosu SELECT — video_durum_id", ssError.message);

    const soruSetleriWithDurum = await Promise.all(
      (soruSetleriData ?? []).map(async (ss) => {
        const { data: durumlar } = await supabase
          .from("soru_seti_durumu")
          .select("soru_seti_durum_id, durum, notlar")
          .eq("soru_seti_id", ss.soru_seti_id)
          .order("created_at", { ascending: false })
          .limit(1);

        return { ...ss, son_durum: durumlar?.[0]?.durum ?? null, son_durum_notlar: durumlar?.[0]?.notlar ?? null, soru_seti_durum_id: durumlar?.[0]?.soru_seti_durum_id ?? null };
      })
    );

    setSoruSetleri(soruSetleriWithDurum);
    setLoading(false);
  };

  useEffect(() => {
    if (user && video_durum_id) veriCek();
  }, [user, video_durum_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  const sonSet = soruSetleri[soruSetleri.length - 1];
  const iuGonderebilir = isIU && (!sonSet || sonSet.son_durum === "Revizyon Bekleniyor" || !sonSet.sorular?.length);
  const revizyonSayisi = soruSetleri.filter(ss => ss.son_durum === "Revizyon Bekleniyor").length;

  const handleParse = () => {
    setParseHata("");
    setOnizleme([]);

    const satirlar = yapisTir.split("\n").map(s => s.trim());
    const sorular: Soru[] = [];
    let mevcutSoru: Partial<Soru> | null = null;

    for (let i = 0; i < satirlar.length; i++) {
      const satir = satirlar[i];

      if (!satir) {
        if (mevcutSoru?.soru_metni && mevcutSoru.secenekler?.length === 2) {
          const dogruVar = mevcutSoru.secenekler.some(s => s.dogru);
          if (dogruVar) sorular.push(mevcutSoru as Soru);
          else { setParseHata(`${sorular.length + 1}. soruda "Doğru:" satırı eksik veya hatalı.`); return; }
        }
        mevcutSoru = null;
        continue;
      }

      const soruMatch = satir.match(/^\d+[\.\)]\s*(.+)/);
      if (soruMatch) { mevcutSoru = { soru_metni: soruMatch[1].trim(), secenekler: [] }; continue; }

      const aMatch = satir.match(/^A[\)\.]\s*(.+)/i);
      if (aMatch && mevcutSoru) { mevcutSoru.secenekler = mevcutSoru.secenekler ?? []; mevcutSoru.secenekler.push({ harf: "A", metin: aMatch[1].trim(), dogru: false }); continue; }

      const bMatch = satir.match(/^B[\)\.]\s*(.+)/i);
      if (bMatch && mevcutSoru) { mevcutSoru.secenekler = mevcutSoru.secenekler ?? []; mevcutSoru.secenekler.push({ harf: "B", metin: bMatch[1].trim(), dogru: false }); continue; }

      const dogruMatch = satir.match(/^Doğru:\s*([AB])/i);
      if (dogruMatch && mevcutSoru?.secenekler) {
        const dogruHarf = dogruMatch[1].toUpperCase();
        mevcutSoru.secenekler = mevcutSoru.secenekler.map(s => ({ ...s, dogru: s.harf === dogruHarf }));
        continue;
      }
    }

    if (mevcutSoru?.soru_metni && mevcutSoru.secenekler?.length === 2) {
      const dogruVar = mevcutSoru.secenekler.some(s => s.dogru);
      if (dogruVar) sorular.push(mevcutSoru as Soru);
      else { setParseHata(`${sorular.length + 1}. soruda "Doğru:" satırı eksik veya hatalı.`); return; }
    }

    if (sorular.length < 15 || sorular.length > 25) {
      setParseHata(`Soru sayısı 15-25 arasında olmalıdır. Şu an: ${sorular.length}`);
      return;
    }

    setOnizleme(sorular);
  };

  const handleIuGonder = async () => {
    if (!onizleme.length || !sonSet) return;
    setGonderLoading(true);

    const res = await fetch("/soru-setleri/api", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru_seti_id: sonSet.soru_seti_id, sorular: onizleme }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Soru seti kaydedilemedi.", d.adim, d.detay); setGonderLoading(false); return; }

    const res2 = await fetch("/soru-setleri/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru_seti_id: sonSet.soru_seti_id, durum: "Inceleme Bekleniyor" }),
    });
    const d2 = await res2.json();
    if (!res2.ok) { hata(d2.hata ?? "Durum kaydedilemedi.", d2.adim, d2.detay); }
    else basari("Soru seti PM'e gönderildi.");

    setYapisTir(""); setOnizleme([]);
    await veriCek();
    setGonderLoading(false);
  };

  const handlePMKarar = async (durum: string, notlar?: string) => {
    if (!sonSet) return;
    setGonderLoading(true);
    const res = await fetch("/soru-setleri/api/durum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soru_seti_id: sonSet.soru_seti_id, durum, notlar }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else {
      basari(durum === "Onaylandi" ? "Soru seti onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Soru seti iptal edildi.");
      setAktifRevizyon(false); setRevizyonNotu("");
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

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => router.push("/soru-setleri")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, width: "fit-content" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Soru Setleri
        </button>

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "16px 20px" }}>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#111" }}>{urunAdi}</span>
          <span style={{ fontSize: "12px", color: "#737373", display: "block", marginTop: "4px" }}>{teknikAdi}</span>
        </div>

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Soru Seti Akışı</span>
            <span style={{ fontSize: "11px", color: "#737373" }}>Revizyon: {revizyonSayisi} / 2</span>
          </div>

          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {soruSetleri.length === 0 && <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Henüz soru seti oluşturulmadı.</p>}

            {soruSetleri.map((ss, i) => {
              const renk = durumRenk(ss.son_durum ?? "");
              const isPMKararverilebilir = isPM && ss.son_durum === "Inceleme Bekleniyor" && i === soruSetleri.length - 1;

              return (
                <div key={ss.soru_seti_id} style={{ border: "0.5px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: "#fafafa", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#737373" }}>Versiyon {i + 1}</span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>{ss.sorular?.length ?? 0} soru</span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatTarih(ss.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {ss.son_durum && <span style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "20px", background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>{ss.son_durum}</span>}
                      {ss.sorular?.length > 0 && (
                        <button onClick={() => setAcikSet(acikSet === ss.soru_seti_id ? null : ss.soru_seti_id)} style={{ fontSize: "11px", padding: "2px 10px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", cursor: "pointer" }}>
                          {acikSet === ss.soru_seti_id ? "Gizle" : "Soruları Gör"}
                        </button>
                      )}
                    </div>
                  </div>

                  {acikSet === ss.soru_seti_id && ss.sorular?.length > 0 && (
                    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {ss.sorular.map((soru, si) => (
                        <div key={si} style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: "8px", border: "0.5px solid #e5e7eb" }}>
                          <p style={{ fontSize: "12px", color: "#374151", fontWeight: 600, margin: "0 0 6px" }}>{si + 1}. {soru.soru_metni}</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {soru.secenekler.map((s, si2) => (
                              <span key={si2} style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: s.dogru ? "#56aeff" : "#737373", background: s.dogru ? "#e6f1fb" : "white", width: "fit-content" }}>
                                {s.harf}. {s.metin}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ss.son_durum === "Revizyon Bekleniyor" && ss.son_durum_notlar && (
                    <div style={{ padding: "10px 14px", background: "#fefce8", borderTop: "0.5px solid #fde68a" }}>
                      <span style={{ fontSize: "11px", color: "#854d0e", fontWeight: 600 }}>Revizyon Notu: </span>
                      <span style={{ fontSize: "12px", color: "#854d0e" }}>{ss.son_durum_notlar}</span>
                    </div>
                  )}

                  {isPMKararverilebilir && (
                    <div style={{ padding: "12px 14px", borderTop: "0.5px solid #e5e7eb", background: "#fafafa" }}>
                      {aktifRevizyon ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)} placeholder="Revizyon notunu yazın..." rows={3} style={{ width: "100%", border: "0.5px solid #fde68a", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", resize: "vertical" }} />
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button onClick={() => { setAktifRevizyon(false); setRevizyonNotu(""); }} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "11px", cursor: "pointer" }}>İptal</button>
                            <button onClick={() => handlePMKarar("Revizyon Bekleniyor", revizyonNotu)} disabled={!revizyonNotu.trim() || gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer", opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>Revizyon Gönder</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button onClick={() => handlePMKarar("Onaylandi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#16a34a", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Onayla</button>
                          {revizyonSayisi < 2 && <button onClick={() => setAktifRevizyon(true)} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "none", background: "#f59e0b", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Revizyon İste</button>}
                          <button onClick={() => handlePMKarar("Iptal Edildi")} disabled={gonderLoading} style={{ padding: "7px 14px", borderRadius: "6px", border: "0.5px solid #fecaca", background: "transparent", color: "#bc2d0d", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>İptal Et</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {iuGonderebilir && (
            <div style={{ borderTop: "0.5px solid #e5e7eb", padding: "16px 20px", background: "#fafafa" }}>
              <p style={{ fontSize: "12px", color: "#737373", marginBottom: "4px" }}>Soruları aşağıdaki formatta yapıştırın:</p>
              <div style={{ background: "#f3f4f6", borderRadius: "6px", padding: "10px 12px", marginBottom: "10px", fontSize: "11px", color: "#737373", fontFamily: "monospace", lineHeight: 1.7 }}>
                1. Soru metni buraya yazılır<br />
                A) Birinci seçenek<br />
                B) İkinci seçenek<br />
                Doğru: A<br />
                <br />
                2. Soru metni buraya yazılır<br />
                A) Birinci seçenek<br />
                B) İkinci seçenek<br />
                Doğru: B
              </div>
              <textarea
                value={yapisTir}
                onChange={(e) => { setYapisTir(e.target.value); setOnizleme([]); setParseHata(""); }}
                placeholder="Soruları buraya yapıştırın... (15-25 soru, sorular arasında boş satır bırakın)"
                rows={12}
                style={{ width: "100%", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", resize: "vertical", marginBottom: "8px" }}
              />
              {parseHata && <p style={{ fontSize: "12px", color: "#bc2d0d", marginBottom: "8px" }}>{parseHata}</p>}

              {onizleme.length > 0 && (
                <div style={{ marginBottom: "12px", background: "white", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "12px", maxHeight: "300px", overflow: "auto" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#111", marginBottom: "8px" }}>Önizleme — {onizleme.length} soru</p>
                  {onizleme.map((s, i) => (
                    <div key={i} style={{ marginBottom: "8px", padding: "8px", background: "#f9fafb", borderRadius: "6px" }}>
                      <p style={{ fontSize: "12px", color: "#374151", margin: "0 0 4px", fontWeight: 500 }}>{i + 1}. {s.soru_metni}</p>
                      {s.secenekler.map((se, j) => (
                        <span key={j} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", border: se.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: se.dogru ? "#56aeff" : "#737373", background: se.dogru ? "#e6f1fb" : "white", marginRight: "6px", display: "inline-block" }}>
                          {se.harf}. {se.metin}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                {!onizleme.length ? (
                  <button onClick={handleParse} disabled={!yapisTir.trim()} style={{ background: "#737373", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !yapisTir.trim() ? 0.5 : 1 }}>Önizle</button>
                ) : (
                  <button onClick={handleIuGonder} disabled={gonderLoading} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                    {gonderLoading ? "Gönderiliyor..." : "Gönder"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}