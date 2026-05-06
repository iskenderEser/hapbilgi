// app/soru-setleri/[video_durum_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { PM_ROLLERI } from "@/lib/utils/roller";
import { User } from "@supabase/supabase-js";

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

interface VideoDurumJoin {
  video_id: string;
  videolar: {
    senaryo_durumu: {
      senaryolar: {
        talepler: {
          urunler: { urun_adi: string } | null;
          teknikler: { teknik_adi: string } | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

export default function SoruSetiAkisPage() {
  const router = useRouter();
  const params = useParams();
  const video_durum_id = params.video_durum_id as string;

  const [user, setUser] = useState<User | null>(null);
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

  const fetchUrunBilgileri = useCallback(async (supabase: any, video_durum_id: string) => {
    const { data, error } = await supabase
      .from("video_durumu")
      .select(`
        video_id,
        videolar!inner (
          senaryo_durumu!inner (
            senaryolar!inner (
              talepler!inner (
                urunler (urun_adi),
                teknikler (teknik_adi)
              )
            )
          )
        )
      `)
      .eq("video_durum_id", video_durum_id)
      .single();

    if (error || !data) return;
    
    const typedData = data as unknown as VideoDurumJoin;
    const talep = typedData.videolar?.senaryo_durumu?.senaryolar?.talepler;
    setUrunAdi(talep?.urunler?.urun_adi ?? "-");
    setTeknikAdi(talep?.teknikler?.teknik_adi ?? "-");
  }, []);

  const fetchSoruSetleri = useCallback(async (supabase: any, video_durum_id: string) => {
    const { data: soruSetleriData } = await supabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, iu_id, sorular, created_at")
      .eq("video_durum_id", video_durum_id)
      .order("created_at", { ascending: true });

    if (!soruSetleriData) return [];

    const soruSetiIds = soruSetleriData.map((ss: any) => ss.soru_seti_id);
    
    const { data: durumlar } = await supabase
      .from("soru_seti_durumu")
      .select("soru_seti_id, soru_seti_durum_id, durum, notlar")
      .in("soru_seti_id", soruSetiIds)
      .order("created_at", { ascending: false });

    const durumMap = new Map();
    durumlar?.forEach((d: any) => {
      if (!durumMap.has(d.soru_seti_id)) {
        durumMap.set(d.soru_seti_id, d);
      }
    });

    return soruSetleriData.map((ss: any) => {
      const durum = durumMap.get(ss.soru_seti_id);
      return {
        ...ss,
        son_durum: durum?.durum ?? null,
        son_durum_notlar: durum?.notlar ?? null,
        soru_seti_durum_id: durum?.soru_seti_durum_id ?? null,
      };
    });
  }, []);

  const veriCek = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    await fetchUrunBilgileri(supabase, video_durum_id);
    const soruSetleriData = await fetchSoruSetleri(supabase, video_durum_id);
    setSoruSetleri(soruSetleriData);
    setLoading(false);
  }, [video_durum_id, fetchUrunBilgileri, fetchSoruSetleri]);

  useEffect(() => { if (user && video_durum_id) veriCek(); }, [user, video_durum_id, veriCek]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = rol.toLowerCase();
  const isPM = PM_ROLLERI.includes(rolKucu);
  const isIU = rolKucu === "iu";

  const sonSet = soruSetleri[soruSetleri.length - 1];
  const iuGonderebilir = isIU && (!sonSet || sonSet.son_durum === "Revizyon Bekleniyor" || !sonSet.sorular?.length);
  const revizyonSayisi = soruSetleri.filter(ss => ss.son_durum === "Revizyon Bekleniyor").length;

  const parseSorular = (metin: string): { sorular: Soru[]; hata: string | null } => {
    const bloklar = metin.split(/\n\s*\n/).filter(b => b.trim());
    const sorular: Soru[] = [];

    for (let blok of bloklar) {
      const lines = blok.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 4) continue;

      const soruLine = lines.find(l => /^\d+[\.\)]/.test(l));
      if (!soruLine) return { sorular: [], hata: "Soru metni bulunamadı." };
      
      const soruMetni = soruLine.replace(/^\d+[\.\)]\s*/, "");
      
      const aLine = lines.find(l => /^A[\)\.]/i.test(l));
      const bLine = lines.find(l => /^B[\)\.]/i.test(l));
      if (!aLine || !bLine) return { sorular: [], hata: "A ve B seçenekleri bulunamadı." };

      const secenekA = aLine.replace(/^A[\)\.]\s*/i, "");
      const secenekB = bLine.replace(/^B[\)\.]\s*/i, "");
      
      const dogruLine = lines.find(l => /^Doğru:/i.test(l));
      if (!dogruLine) return { sorular: [], hata: "Doğru cevap satırı bulunamadı." };
      
      const dogruHarf = dogruLine.match(/[AB]/i)?.[0]?.toUpperCase();
      if (dogruHarf !== "A" && dogruHarf !== "B") return { sorular: [], hata: "Doğru cevap A veya B olmalıdır." };

      sorular.push({
        soru_metni: soruMetni,
        secenekler: [
          { harf: "A", metin: secenekA, dogru: dogruHarf === "A" },
          { harf: "B", metin: secenekB, dogru: dogruHarf === "B" },
        ],
      });
    }

    if (sorular.length < 15 || sorular.length > 25) {
      return { sorular: [], hata: `Soru sayısı 15-25 arasında olmalıdır. Şu an: ${sorular.length}` };
    }
    return { sorular, hata: null };
  };

  const handleParse = () => {
    const { sorular, hata: parseHataMsg } = parseSorular(yapisTir);
    if (parseHataMsg) {
      setParseHata(parseHataMsg);
      setOnizleme([]);
    } else {
      setParseHata("");
      setOnizleme(sorular);
    }
  };

  const handleIuGonder = async () => {
    if (!onizleme.length || !sonSet) return;
    setGonderLoading(true);
    
    try {
      const res = await fetch("/soru-setleri/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          soru_seti_id: sonSet.soru_seti_id, 
          sorular: onizleme,
          durum: "Inceleme Bekleniyor"
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.hata ?? "Soru seti kaydedilemedi.");
      
      basari("Soru seti PM'e gönderildi.");
      setYapisTir(""); setOnizleme([]);
      await veriCek();
    } catch (err: any) {
      hata(err.message, "soru seti gönderme", err);
    } finally {
      setGonderLoading(false);
    }
  };

  const handlePMKarar = async (durum: string, notlar?: string) => {
    if (!sonSet) return;
    setGonderLoading(true);
    
    try {
      const res = await fetch("/soru-setleri/api/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soru_seti_id: sonSet.soru_seti_id, durum, notlar }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.hata ?? "İşlem gerçekleştirilemedi.");
      
      basari(durum === "Onaylandi" ? "Soru seti onaylandı." : durum === "Revizyon Bekleniyor" ? "Revizyon talebi gönderildi." : "Soru seti iptal edildi.");
      setAktifRevizyon(false); setRevizyonNotu(""); await veriCek();
    } catch (err: any) {
      hata(err.message, "PM karar", err);
    } finally {
      setGonderLoading(false);
    }
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
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#56aeff] rounded-full animate-spin" />
          <div className="h-2 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <button onClick={() => router.push("/soru-setleri")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit hover:text-gray-700 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Soru Setleri
        </button>

        <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4">
          <span className="text-base font-semibold text-gray-900">{urunAdi}</span>
          <span className="text-xs text-gray-500 block mt-1">{teknikAdi}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Soru Seti Akışı</span>
            <span className="text-xs text-gray-500">Revizyon: {revizyonSayisi} / 2</span>
          </div>

          <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
            {soruSetleri.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-5">Henüz soru seti oluşturulmadı.</p>
            )}

            {soruSetleri.map((ss, i) => {
              const renk = durumRenk(ss.son_durum ?? "");
              const isPMKararverilebilir = isPM && ss.son_durum === "Inceleme Bekleniyor" && i === soruSetleri.length - 1;

              return (
                <div key={ss.soru_seti_id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Versiyon {i + 1}</span>
                      <span className="text-xs text-gray-400">{ss.sorular?.length ?? 0} soru</span>
                      <span className="text-xs text-gray-400">{formatTarih(ss.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {ss.son_durum && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full"
                          style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                          {ss.son_durum}
                        </span>
                      )}
                      {ss.sorular?.length > 0 && (
                        <button onClick={() => setAcikSet(acikSet === ss.soru_seti_id ? null : ss.soru_seti_id)}
                          className="text-xs px-2.5 py-0.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors">
                          {acikSet === ss.soru_seti_id ? "Gizle" : "Soruları Gör"}
                        </button>
                      )}
                    </div>
                  </div>

                  {acikSet === ss.soru_seti_id && ss.sorular?.length > 0 && (
                    <div className="p-3 flex flex-col gap-2">
                      {ss.sorular.map((soru, si) => (
                        <div key={si} className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-700 font-semibold m-0 mb-1.5">{si + 1}. {soru.soru_metni}</p>
                          <div className="flex flex-col gap-1">
                            {soru.secenekler.map((s, si2) => (
                              <span key={si2} className="text-xs px-2 py-0.5 rounded-full inline-block w-fit"
                                style={{
                                  border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb",
                                  color: s.dogru ? "#56aeff" : "#737373",
                                  background: s.dogru ? "#e6f1fb" : "white",
                                }}>
                                {s.harf}. {s.metin}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ss.son_durum === "Revizyon Bekleniyor" && ss.son_durum_notlar && (
                    <div className="px-3 py-2.5 bg-yellow-50 border-t border-yellow-200">
                      <span className="text-xs font-semibold text-yellow-800">Revizyon Notu: </span>
                      <span className="text-xs text-yellow-800">{ss.son_durum_notlar}</span>
                    </div>
                  )}

                  {isPMKararverilebilir && (
                    <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
                      {aktifRevizyon ? (
                        <div className="flex flex-col gap-2">
                          <textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)}
                            placeholder="Revizyon notunu yazın..." rows={3}
                            className="w-full border border-yellow-200 rounded-lg px-3 py-2 text-xs resize-y focus:outline-none focus:border-yellow-400"
                            style={{ fontFamily: "'Nunito', sans-serif" }} />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setAktifRevizyon(false); setRevizyonNotu(""); }}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer hover:bg-gray-100 transition-colors">İptal</button>
                            <button onClick={() => handlePMKarar("Revizyon Bekleniyor", revizyonNotu)}
                              disabled={!revizyonNotu.trim() || gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer hover:bg-amber-600 transition-colors"
                              style={{ opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>Revizyon Gönder</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button onClick={() => handlePMKarar("Onaylandi")} disabled={gonderLoading}
                            className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer hover:bg-green-800 transition-colors">Onayla</button>
                          {revizyonSayisi < 2 && (
                            <button onClick={() => setAktifRevizyon(true)} disabled={gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer hover:bg-amber-600 transition-colors">Revizyon İste</button>
                          )}
                          <button onClick={() => handlePMKarar("Iptal Edildi")} disabled={gonderLoading}
                            className="px-3 py-1.5 rounded-lg bg-transparent text-xs font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                            style={{ border: "0.5px solid #fecaca", color: "#bc2d0d" }}>İptal Et</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {iuGonderebilir && (
            <div className="border-t border-gray-100 px-4 md:px-5 py-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">Soruları aşağıdaki formatta yapıştırın:</p>
              <div className="bg-gray-100 rounded-lg px-3 py-2.5 mb-3 text-xs text-gray-500 leading-relaxed font-mono">
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 bg-white resize-y mb-2 focus:outline-none focus:border-[#56aeff] transition-colors"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              />
              {parseHata && <p className="text-xs mb-2" style={{ color: "#bc2d0d" }}>{parseHata}</p>}

              {onizleme.length > 0 && (
                <div className="mb-3 bg-white border border-gray-200 rounded-lg p-3 max-h-72 overflow-auto">
                  <p className="text-xs font-semibold text-gray-900 mb-2">Önizleme — {onizleme.length} soru</p>
                  {onizleme.map((s, i) => (
                    <div key={i} className="mb-2 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-700 font-medium m-0 mb-1">{i + 1}. {s.soru_metni}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.secenekler.map((se, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full inline-block"
                            style={{
                              border: se.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb",
                              color: se.dogru ? "#56aeff" : "#737373",
                              background: se.dogru ? "#e6f1fb" : "white",
                            }}>
                            {se.harf}. {se.metin}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                {!onizleme.length ? (
                  <button onClick={handleParse} disabled={!yapisTir.trim()}
                    className="bg-gray-500 text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer hover:bg-gray-600 transition-colors disabled:opacity-50"
                    style={{ fontFamily: "'Nunito', sans-serif" }}>
                    Önizle
                  </button>
                ) : (
                  <button onClick={handleIuGonder} disabled={gonderLoading}
                    className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer hover:opacity-90 transition-colors disabled:opacity-50"
                    style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
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