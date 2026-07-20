// app/senaryolar/[talep_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { HedefRolBant } from "@/components/HedefRolBant";
import type { HedefRol } from "@/app/talepler/_types";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { DosyaGoruntuleListesi, type DosyaItem } from "@/components/DosyaGoruntuleListesi";
import { SenaryoMetniGoster } from "@/components/SenaryoMetniGoster";

interface Senaryo {
  senaryo_id: string;
  talep_id: string;
  iu_id: string;
  senaryo_metni: string;
  created_at: string;
  son_durum?: string;
  son_durum_tarihi?: string;
  senaryo_durum_id?: string;
}

// G-5 (docs/senaryo_tek_metin_diff_gelistirme_is_plani.md): tüm revizyon
// turlarının notu, hangi versiyona bağlı olduğundan bağımsız, kronolojik
// ayrı bir listede gösterilir — versiyon kartlarına gömülü değil.
interface RevizyonNotu {
  senaryo_durum_id: string;
  notlar: string;
  created_at: string;
}

interface Talep {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  aciklama: string;
  dosya_urls: DosyaItem[];
}

export default function SenaryolarPage() {
  const router = useRouter();
  const params = useParams();
  const talep_id = params.talep_id as string;

  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [talep, setTalep] = useState<Talep | null>(null);
  const [senaryolar, setSenaryolar] = useState<Senaryo[]>([]);
  const [revizyonNotlari, setRevizyonNotlari] = useState<RevizyonNotu[]>([]);
  const [loading, setLoading] = useState(true);
  const [gonderLoading, setGonderLoading] = useState(false);
  const [senaryoMetni, setSenaryoMetni] = useState("");
  // G-1 (docs/talep_senaryo_is_sureci_gelistirme_is_plani.md): durum çağrısı
  // başarısız olup metin ekranda kalırsa, tekrar "Gönder" aynı senaryo satırını
  // yeniden OLUŞTURMAZ — yalnız durum çağrısını tekrarlar.
  const [beklemedekiSenaryoId, setBeklemedekiSenaryoId] = useState<string | null>(null);
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [aktifRevizyon, setAktifRevizyon] = useState<string | null>(null);
  const { mesajlar, hata, basari } = useHataMesaji();

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

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: talepData, error: talepError } = await supabase
      .from("talepler")
      .select(`talep_id, hedef_rol, aciklama, dosya_urls, urunler(urun_adi), teknikler(teknik_adi)`)
      .eq("talep_id", talep_id)
      .single();

    if (talepError || !talepData) {
      hata("Talep bulunamadı.", "talepler tablosu SELECT — talep_id");
      router.push("/talepler");
      return;
    }

    setTalep({
      talep_id: talepData.talep_id,
      hedef_rol: ((talepData as any).hedef_rol ?? "utt") as HedefRol,
      aciklama: talepData.aciklama,
      urun_adi: (talepData as any).urunler?.urun_adi ?? "-",
      teknik_adi: (talepData as any).teknikler?.teknik_adi ?? "-",
      dosya_urls: talepData.dosya_urls ?? [],
    });

    const { data: senaryolarData, error: senaryoError } = await supabase
      .from("senaryolar").select("senaryo_id, talep_id, iu_id, senaryo_metni, created_at")
      .eq("talep_id", talep_id).order("created_at", { ascending: true });

    if (senaryoError) hata("Senaryolar yüklenemedi.", "senaryolar tablosu SELECT — talep_id", senaryoError.message);

    const senaryolarWithDurum = await Promise.all(
      (senaryolarData ?? []).map(async (s) => {
        const { data: durumlar } = await supabase
          .from("senaryo_durumu").select("senaryo_durum_id, durum, created_at")
          .eq("senaryo_id", s.senaryo_id).order("created_at", { ascending: false }).limit(1);
        const sonDurum = durumlar?.[0];
        return { ...s, son_durum: sonDurum?.durum ?? null, son_durum_tarihi: sonDurum?.created_at ?? null, senaryo_durum_id: sonDurum?.senaryo_durum_id ?? null };
      })
    );

    setSenaryolar(senaryolarWithDurum);

    // G-5: tüm revizyon turlarının notu, hangi senaryo satırına ait olduğundan
    // bağımsız, kronolojik olarak toplanır.
    const senaryoIds = (senaryolarData ?? []).map(s => s.senaryo_id);
    if (senaryoIds.length > 0) {
      const { data: revizyonlar } = await supabase
        .from("senaryo_durumu")
        .select("senaryo_durum_id, notlar, created_at")
        .in("senaryo_id", senaryoIds)
        .eq("durum", "revizyon bekleniyor")
        .not("notlar", "is", null)
        .order("created_at", { ascending: true });
      setRevizyonNotlari(revizyonlar ?? []);
    } else {
      setRevizyonNotlari([]);
    }

    setLoading(false);
  };

  useEffect(() => { if (kullanici && talep_id) veriCek(); }, [kullanici, talep_id]);

  // G-2: taslak — sayfa açılışında varsa geri yüklenir, yazarken debounce'lu kaydedilir.
  const taslakAnahtari = `senaryo-taslak-${talep_id}`;
  // G-3 (docs/senaryo_tek_metin_diff_gelistirme_is_plani.md): taslak yoksa ve
  // IU revizyon yapacaksa, textarea önceki metinle önceden doldurulur —
  // sıfırdan yazılmaz. Veri yüklendikten sonra YALNIZ BİR KEZ çalışır.
  const baslangicDolduruldu = useRef(false);
  useEffect(() => {
    if (loading || baslangicDolduruldu.current) return;
    baslangicDolduruldu.current = true;

    const kayitliTaslak = localStorage.getItem(taslakAnahtari);
    if (kayitliTaslak) { setSenaryoMetni(kayitliTaslak); return; }

    const sonV = senaryolar[senaryolar.length - 1];
    if (sonV?.son_durum === "revizyon bekleniyor") setSenaryoMetni(sonV.senaryo_metni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (!talep_id) return;
    const zamanlayici = setTimeout(() => {
      if (senaryoMetni.trim()) localStorage.setItem(taslakAnahtari, senaryoMetni);
      else localStorage.removeItem(taslakAnahtari);
    }, 1000);
    return () => clearTimeout(zamanlayici);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senaryoMetni, talep_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isPM = URETICI_ROLLER.includes(rolKucu);
  const isIU = rolKucu === "iu";

  const handleSenaryoGonder = async () => {
    if (!senaryoMetni.trim()) return;
    setGonderLoading(true);

    // G-1: satır daha önce oluşturulup durum çağrısı başarısız olduysa (retry),
    // senaryo satırı YENİDEN oluşturulmaz — yalnız durum çağrısı tekrarlanır.
    let senaryoId = beklemedekiSenaryoId;
    if (!senaryoId) {
      const res = await fetch("/senaryolar/api", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talep_id, senaryo_metni: senaryoMetni.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Senaryo oluşturulamadı.", d.adim, d.detay); setGonderLoading(false); return; }
      senaryoId = d.senaryo.senaryo_id;
      setBeklemedekiSenaryoId(senaryoId);
    }

    const durumRes = await fetch("/senaryolar/api/durum", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senaryo_id: senaryoId, durum: "inceleme bekleniyor" }),
    });
    const durumData = await durumRes.json();
    if (!durumRes.ok) {
      // Metin ve taslak KORUNUR — kullanıcı veri kaybetmeden tekrar dener.
      hata(durumData.hata ?? "Durum kaydedilemedi.", durumData.adim, durumData.detay);
      setGonderLoading(false);
      return;
    }

    basari("Senaryo PM'e gönderildi.");
    setSenaryoMetni("");
    setBeklemedekiSenaryoId(null);
    localStorage.removeItem(taslakAnahtari);
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
      basari(durum === "onaylandi" ? "Senaryo onaylandı." : durum === "revizyon bekleniyor" ? "Revizyon talebi gönderildi." : "Senaryo iptal edildi.");
      setAktifRevizyon(null); setRevizyonNotu(""); await veriCek();
    }
    setGonderLoading(false);
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
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const sonSenaryo = senaryolar[senaryolar.length - 1];
  // G-2: PM inceleme ekranında diff — yalnız bir önceki versiyon varsa (ilk
  // gönderimde karşılaştıracak bir şey yok, düz metin gösterilir).
  const oncekiSenaryo = senaryolar.length > 1 ? senaryolar[senaryolar.length - 2] : null;
  const revSayisi = senaryolar.filter(x => x.son_durum === "revizyon bekleniyor").length;
  const iuYazabilir = isIU && (!sonSenaryo || sonSenaryo.son_durum === "revizyon bekleniyor" || sonSenaryo.son_durum === null);

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
      {talep && <HedefRolBant hedefRol={talep.hedef_rol} />}

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
              {talep.dosya_urls.length > 0 && (
                <div className="mt-2.5">
                  <DosyaGoruntuleListesi dosyalar={talep.dosya_urls} onHata={hata} />
                </div>
              )}
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

            {sonSenaryo && (() => {
              const renk = durumRenk(sonSenaryo.son_durum ?? "");
              const isPMKararverilebilir = isPM && sonSenaryo.son_durum === "inceleme bekleniyor";
              // G-2: PM inceleme ekranında diff — yalnız incelemedeyken ve önceki
              // versiyon varsa. Onaylı/iptal/ilk gönderim → düz metin.
              const diffGoster = sonSenaryo.son_durum === "inceleme bekleniyor" && !!oncekiSenaryo;

              return (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatTarih(sonSenaryo.created_at)}</span>
                    {sonSenaryo.son_durum && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                        {sonSenaryo.son_durum}
                      </span>
                    )}
                  </div>

                  <div className="px-3 py-3.5">
                    <SenaryoMetniGoster
                      mevcut={sonSenaryo.senaryo_metni}
                      onceki={diffGoster ? oncekiSenaryo!.senaryo_metni : undefined}
                    />
                  </div>

                  {isPMKararverilebilir && (
                    <div className="px-3 py-3 border-t border-gray-100 bg-gray-50">
                      {aktifRevizyon === sonSenaryo.senaryo_id ? (
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
                            <button onClick={() => handlePMKarar(sonSenaryo.senaryo_id, "revizyon bekleniyor", revizyonNotu)}
                              disabled={!revizyonNotu.trim() || gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer"
                              style={{ opacity: !revizyonNotu.trim() ? 0.5 : 1 }}>
                              Revizyon Gönder
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button onClick={() => handlePMKarar(sonSenaryo.senaryo_id, "onaylandi")} disabled={gonderLoading}
                            className="px-3 py-1.5 rounded-lg border-none bg-green-700 text-white text-xs font-semibold cursor-pointer">
                            Onayla
                          </button>
                          {revSayisi < 2 && (
                            <button onClick={() => setAktifRevizyon(sonSenaryo.senaryo_id)} disabled={gonderLoading}
                              className="px-3 py-1.5 rounded-lg border-none bg-amber-500 text-white text-xs font-semibold cursor-pointer">
                              Revizyon İste
                            </button>
                          )}
                          <button onClick={() => handlePMKarar(sonSenaryo.senaryo_id, "Iptal Edildi")} disabled={gonderLoading}
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
            })()}

            {/* G-5: revizyon notları — versiyon kartlarından bağımsız, kronolojik */}
            {revizyonNotlari.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500">Revizyon Notları</span>
                </div>
                <div className="flex flex-col divide-y divide-gray-100">
                  {revizyonNotlari.map(n => (
                    <div key={n.senaryo_durum_id} className="px-3 py-2.5 bg-yellow-50">
                      <div className="text-xs text-yellow-800">{n.notlar}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatTarih(n.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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