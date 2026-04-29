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
      .select(`talep_id, aciklama, urunler(urun_adi), teknikler(teknik_adi)`)
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
      .from("senaryolar").select("senaryo_id, talep_id, iu_id, senaryo_metni, created_at")
      .eq("talep_id", talep_id).order("created_at", { ascending: true });

    if (senaryoError) hata("Senaryolar yüklenemedi.", "senaryolar tablosu SELECT — talep_id", senaryoError.message);

    const senaryolarWithDurum = await Promise.all(
      (senaryolarData ?? []).map(async (s) => {
        const { data: durumlar } = await supabase
          .from("senaryo_durumu").select("senaryo_durum_id, durum, notlar, created_at")
          .eq("senaryo_id", s.senaryo_id).order("created_at", { ascending: false }).limit(1);
        const sonDurum = durumlar?.[0];
        return { ...s, son_durum: sonDurum?.durum ?? null, son_durum_tarihi: sonDurum?.created_at ?? null, son_durum_notlar: sonDurum?.notlar ?? null, senaryo_durum_id: sonDurum?.senaryo_durum_id ?? null };
      })
    );

    setSenaryolar(senaryolarWithDurum);
    setLoading(false);
  };

  useEffect(() => { if (user && talep_id) veriCek(); }, [user, talep_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  const handleSenaryoGonder = async () => {
    if (!senaryoMetni.trim()) return;
    setGonderLoading(true);
    const res = await fetch("/senaryolar/api", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, senaryo_metni: senaryoMetni.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Senaryo oluşturulamadı.", d.adim, d.detay); setGonderLoading(false); return; }
    const { senaryo } = d;
    const d1 = await fetch("/senaryolar/api/durum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senaryo_id: senaryo.senaryo_id, durum: "Senaryo Yaziliyor" }) });
    if (!d1.ok) { const e = await d1.json(); hata(e.hata ?? "Durum kaydedilemedi.", e.adim, e.detay); }
    const d2 = await fetch("/senaryolar/api/durum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senaryo_id: senaryo.senaryo_id, durum: "Inceleme Bekleniyor" }) });
    if (!d2.ok) { const e = await d2.json(); hata(e.hata ?? "Durum kaydedilemedi.", e.adim, e.detay); }
    else basari("Senaryo PM'e gönderildi.");
    setSenaryoMetni("");
    await veriCek();
    setGonderLoading(false);
  };

  const handlePMKarar = async (senaryo_id: string, durum: string, notlar?: string) => {
    setGonderLoading(true);
    const res = await fetch("/senaryolar/api/durum", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senaryo_id, durum, notlar }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else {
      basari(durum === "Onaylandi" ? "Senaryo onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Senaryo iptal edildi.");
      setAktifRevizyon(null); setRevizyonNotu(""); await veriCek();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const sonSenaryo = senaryolar[senaryolar.length - 1];
  const iuYazabilir = isIU && (!sonSenaryo || sonSenaryo.son_durum === "Revizyon Bekleniyor" || sonSenaryo.son_durum === null);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <button onClick={() => router.push("/talepler")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Talepler
        </button>

        {/* Talep bilgisi */}
        {talep && (
          <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-gray-900">{talep.urun_adi}</span>
              <span className="text-xs text-gray-500">{talep.teknik_adi}</span>
              {talep.aciklama && <p className="text-sm text-gray-700 mt-2 leading-relaxed">{talep.aciklama}</p>}
            </div>
          </div>
        )}

        {/* Senaryo akışı */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Senaryo Akışı</span>
          </div>

          <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
            {senaryolar.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-5">Henüz senaryo yazılmadı.</p>
            )}

            {senaryolar.map((s, i) => {
              const renk = durumRenk(s.son_durum ?? "");
              const revSayisi = senaryolar.filter(x => x.son_durum === "Revizyon Bekleniyor").length;
              const isPMKararverilebilir = isPM && s.son_durum === "Inceleme Bekleniyor" && i === senaryolar.length - 1;

              return (
                <div key={s.senaryo_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* Versiyon başlık */}
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Versiyon {i + 1}</span>
                      <span className="text-xs text-gray-400">{formatTarih(s.created_at)}</span>
                    </div>
                    {s.son_durum && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                        {s.son_durum}
                      </span>
                    )}
                  </div>

                  {/* Senaryo metni */}
                  <div className="px-3 py-3.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {s.senaryo_metni}
                  </div>

                  {/* Revizyon notu */}
                  {s.son_durum === "Revizyon Bekleniyor" && s.son_durum_notlar && (
                    <div className="px-3 py-2.5 bg-yellow-50 border-t border-yellow-200">
                      <span className="text-xs font-semibold text-yellow-800">Revizyon Notu: </span>
                      <span className="text-xs text-yellow-800">{s.son_durum_notlar}</span>
                    </div>
                  )}

                  {/* PM karar alanı */}
                  {isPMKararverilebilir && (
                    <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
                      {aktifRevizyon === s.senaryo_id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={revizyonNotu}
                            onChange={(e) => setRevizyonNotu(e.target.value)}
                            placeholder="Revizyon notunu yazın..."
                            rows={3}
                            className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-xs resize-y"
                            style={{ fontFamily: "'Nunito', sans-serif" }}
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setAktifRevizyon(null); setRevizyonNotu(""); }}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer">
                              İptal
                            </button>
                            <button onClick={() => handlePMKarar(s.senaryo_id, "Revizyon Bekleniyor", revizyonNotu)}
                              disabled={!revizyonNotu.trim() || gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                              style={{ opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>
                              Revizyon Gönder
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button onClick={() => handlePMKarar(s.senaryo_id, "Onaylandi")} disabled={gonderLoading}
                            className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer">
                            Onayla
                          </button>
                          {revSayisi < 2 && (
                            <button onClick={() => setAktifRevizyon(s.senaryo_id)} disabled={gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer">
                              Revizyon İste
                            </button>
                          )}
                          <button onClick={() => handlePMKarar(s.senaryo_id, "Iptal Edildi")} disabled={gonderLoading}
                            className="px-3 py-1.5 rounded-lg bg-transparent text-xs font-semibold cursor-pointer"
                            style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>
                            İptal Et
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* IU yazım alanı */}
          {iuYazabilir && (
            <div className="border-t border-gray-100 px-4 md:px-5 py-4 bg-gray-50">
              <textarea
                value={senaryoMetni}
                onChange={(e) => setSenaryoMetni(e.target.value)}
                placeholder="Senaryo metnini yazın..."
                rows={6}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white resize-y mb-2.5"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
              <div className="flex justify-end">
                <button onClick={handleSenaryoGonder} disabled={!senaryoMetni.trim() || gonderLoading}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#56aeff", opacity: !senaryoMetni.trim() ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
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