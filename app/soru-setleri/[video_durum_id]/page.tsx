// app/soru-setleri/[video_durum_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { URETICI_ROLLER, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { HedefRolBant } from "@/components/HedefRolBant";
import type { HedefRol } from "@/app/talepler/_types";
import { useAuth } from "@/app/providers/AuthProvider";
import { SoruSetiFormu } from "@/components/SoruSetiFormu";
import { SoruIceAktar } from "@/components/SoruIceAktar";
import { type SoruTaslagi, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular, sorulardanTaslaklar } from "@/lib/soru/taslak";

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
          soru_seti_buyuklugu: number;
          video_basi_soru_sayisi: number;
          hedef_rol: HedefRol;
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

  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [soruSetleri, setSoruSetleri] = useState<SoruSeti[]>([]);
  const [urunAdi, setUrunAdi] = useState("");
  const [teknikAdi, setTeknikAdi] = useState("");
  const [soruSetiBuyuklugu, setSoruSetiBuyuklugu] = useState<number>(25);
  const [videoBasiSoruSayisi, setVideoBasiSoruSayisi] = useState<number>(2);
  const [hedefRol, setHedefRol] = useState<HedefRol | null>(null);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  // Y-2: yapısal giriş — sorular form kartlarıyla yazılır (textarea/parse kapısı kalktı).
  const [taslaklar, setTaslaklar] = useState<SoruTaslagi[]>([]);
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [aktifRevizyon, setAktifRevizyon] = useState(false);
  const [acikSet, setAcikSet] = useState<string | null>(null);
  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
    if (!URETIM_HATTI_GORENLER.includes(kullanici.rol)) {
      router.push("/ana-sayfa");
      return;
    }
  }, [kullanici, authYukleniyor, router]);

  const handleCikis = async () => {
    await cikisYap();
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
                soru_seti_buyuklugu,
                video_basi_soru_sayisi,
                hedef_rol,
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
    setSoruSetiBuyuklugu(talep?.soru_seti_buyuklugu ?? 25);
    setVideoBasiSoruSayisi(talep?.video_basi_soru_sayisi ?? 2);
    setHedefRol((talep?.hedef_rol ?? "utt") as HedefRol);
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

  useEffect(() => { if (kullanici && video_durum_id) veriCek(); }, [kullanici, video_durum_id, veriCek]);

  // Form kartlarının hazırlanması: revizyonda mevcut sorular DOĞRUDAN kartlara
  // yüklenir (eski metne-çevir/textarea yolu kalktı); ilk yazımda büyüklük kadar
  // boş kart doğar. Kullanıcının başladığı form üzerine yazılmaz — yalnız boyut
  // senkronu yapılır (boyutla boş kartlara dokunur, dolu veri silinmez).
  useEffect(() => {
    if ((kullanici?.rol ?? "").toLowerCase() !== "iu") return;
    const sonSet = soruSetleri[soruSetleri.length - 1];
    setTaslaklar(prev => {
      if (prev.length === 0 && sonSet?.son_durum === "revizyon bekleniyor" && sonSet.sorular?.length > 0) {
        return sorulardanTaslaklar(sonSet.sorular);
      }
      return taslaklariBoyutla(prev, soruSetiBuyuklugu);
    });
  }, [soruSetleri, kullanici, soruSetiBuyuklugu]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isPM = URETICI_ROLLER.includes(rolKucu);
  const isIU = rolKucu === "iu";

  const sonSet = soruSetleri[soruSetleri.length - 1];
  const iuGonderebilir = isIU && (!sonSet || sonSet.son_durum === "revizyon bekleniyor" || !sonSet.sorular?.length);
  const revizyonSayisi = soruSetleri.filter(ss => ss.son_durum === "revizyon bekleniyor").length;

  // İçe aktarma (toplu yapıştır / dosyadan): esnek parse formu doldurur, eksikler formda tamamlanır.
  const handleIceAktar = (yeniTaslaklar: SoruTaslagi[], uyariMesaji: string) => {
    setTaslaklar(taslaklariBoyutla(yeniTaslaklar, soruSetiBuyuklugu));
    if (uyariMesaji) uyari(uyariMesaji);
  };

  const handleIuGonder = async () => {
    if (!sonSet) return;
    // Alan bazlı doğrulama — konumlu Türkçe mesaj ("2. sorunun B seçeneği boş" vb.).
    const taslakHatasi = taslaklariDogrula(taslaklar, soruSetiBuyuklugu);
    if (taslakHatasi) {
      hata(taslakHatasi, "soru seti kontrolü", undefined);
      return;
    }
    const sorular = taslaklardanSorular(taslaklar);
    setGonderLoading(true);

    try {
      // 1. Soruları kaydet (PUT — soru_setleri tablosunu günceller)
      const res = await fetch("/soru-setleri/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soru_seti_id: sonSet.soru_seti_id,
          sorular,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.hata ?? "Soru seti kaydedilemedi.");

      // 2. Durumu "inceleme bekleniyor" yap (POST — durum kaydı INSERT + PM'e bildirim)
      const res2 = await fetch("/soru-setleri/api/durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soru_seti_id: sonSet.soru_seti_id,
          durum: "inceleme bekleniyor",
        }),
      });
      const d2 = await res2.json();
      if (!res2.ok) throw new Error(d2.hata ?? "Durum kaydedilemedi.");

      basari("Soru seti PM'e gönderildi.");
      setTaslaklar([]);
      await veriCek();
    } catch (err: any) {
      hata(err.message, "soru seti gönderme", err.message);
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
      
      basari(durum === "onaylandi" ? "Soru seti onaylandı." : durum === "revizyon bekleniyor" ? "Revizyon talebi gönderildi." : "Soru seti iptal edildi.");
      setAktifRevizyon(false); setRevizyonNotu(""); await veriCek();
    } catch (err: any) {
      hata(err.message, "PM karar", err);
    } finally {
      setGonderLoading(false);
    }
  };

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "revizyon bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "inceleme bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
  };

  if (authYukleniyor || !kullanici || loading) {
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
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
      {hedefRol && <HedefRolBant hedefRol={hedefRol} />}

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <button onClick={() => router.push("/soru-setleri")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit hover:text-gray-700 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Soru Setleri
        </button>

        <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-4">
          <span className="text-base font-semibold text-gray-900">{urunAdi}</span>
          <span className="text-xs text-gray-500 block mt-1">{teknikAdi}</span>
          {isIU && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                Toplam soru: <strong>{soruSetiBuyuklugu}</strong>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                Her videoda: <strong>{videoBasiSoruSayisi}</strong> soru gösterilecek
              </span>
            </div>
          )}
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
              const isPMKararverilebilir = isPM && ss.son_durum === "inceleme bekleniyor" && i === soruSetleri.length - 1;

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

                  {ss.son_durum === "revizyon bekleniyor" && ss.son_durum_notlar && (
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
                            <button onClick={() => handlePMKarar("revizyon bekleniyor", revizyonNotu)}
                              disabled={!revizyonNotu.trim() || gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer hover:bg-amber-600 transition-colors"
                              style={{ opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>Revizyon Gönder</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button onClick={() => handlePMKarar("onaylandi")} disabled={gonderLoading}
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

          {/* Y-2: yapısal soru girişi — kartlar asıl yol; toplu yapıştırma formu dolduran hızlandırıcı */}
          {iuGonderebilir && (
            <div className="border-t border-gray-100 px-4 md:px-5 py-4 bg-gray-50">
              <SoruIceAktar onDoldur={handleIceAktar} />
              <SoruSetiFormu taslaklar={taslaklar} onDegis={setTaslaklar} buyukluk={soruSetiBuyuklugu} />
              <div className="flex justify-end mt-3">
                <button onClick={handleIuGonder} disabled={gonderLoading}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer hover:opacity-90 transition-colors disabled:opacity-50"
                  style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
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