// app/soru-setleri/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";

interface SoruSetiSatir {
  talep_id: string;
  video_durum_id: string;
  soru_seti_id: string;
  urun_adi: string;
  teknik_adi: string;
  soru_sayisi: number;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "inceleme bekleniyor" | "revizyon bekleniyor" | "onaylandi" | "Iptal Edildi";

export default function SoruSetleriListePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [satirlar, setSatirlar] = useState<SoruSetiSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreler, setFiltreler] = useState<Set<FiltreDurum>>(new Set());
  const { mesajlar, hata } = useHataMesaji();

  const okunmamisIdler = useOkunmamisIdler("soru_seti");

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

  const veriCek = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // 1) Soru setlerini talep_id ile çek — zincir yürümek yok, hazır ürünler de gelir.
    //    Görünürlüğü RLS belirler (İU hepsini, üretici yalnız kendi talebini).
    const { data: soruSetleri, error: ssError } = await supabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, talep_id, sorular, created_at")
      .order("created_at", { ascending: false });

    if (ssError || !soruSetleri) {
      hata("Soru setleri yüklenemedi.", "soru_setleri tablosu SELECT", ssError?.message);
      setLoading(false);
      return;
    }

    // 2) Talep bazlı tekilleştir — her talep için sadece en yeni soru seti
    const talepMap = new Map<string, any>();
    for (const ss of soruSetleri) {
      const talep_id = (ss as any).talep_id;
      if (!talep_id) continue;
      if (!talepMap.has(talep_id)) talepMap.set(talep_id, ss);
    }
    const tekilSoruSetleri = Array.from(talepMap.values());
    const talepIdler = Array.from(talepMap.keys());

    // 3) Talep bilgisi (ürün/teknik adı) talep_id ile toplu çek
    const talepBilgiMap = new Map<string, { urun_adi: string; teknik_adi: string }>();
    if (talepIdler.length > 0) {
      const { data: talepler, error: tError } = await supabase
        .from("talepler")
        .select("talep_id, urunler (urun_adi), teknikler (teknik_adi)")
        .in("talep_id", talepIdler);

      if (tError) {
        hata("Talep bilgileri yüklenemedi.", "talepler tablosu SELECT", tError.message);
        setLoading(false);
        return;
      }

      talepler?.forEach((t: any) => {
        talepBilgiMap.set(t.talep_id, {
          urun_adi: t.urunler?.urun_adi ?? "-",
          teknik_adi: t.teknikler?.teknik_adi ?? "-",
        });
      });
    }

    // 4) Son durumları view'dan toplu çek
    const soruSetiIds = tekilSoruSetleri.map((ss: any) => ss.soru_seti_id);
    const sonDurumMap = new Map<string, { durum: string; created_at: string }>();

    if (soruSetiIds.length > 0) {
      const { data: sonDurumlar, error: sdError } = await supabase
        .from("v_soru_seti_son_durum")
        .select("soru_seti_id, durum, created_at")
        .in("soru_seti_id", soruSetiIds);

      if (sdError) {
        hata("Soru seti son durumları yüklenemedi.", "v_soru_seti_son_durum SELECT", sdError.message);
        setLoading(false);
        return;
      }

      sonDurumlar?.forEach((sd: any) => {
        sonDurumMap.set(sd.soru_seti_id, { durum: sd.durum, created_at: sd.created_at });
      });
    }

    // 5) Satırları kur — talep bazlı tek satır
    const sonuc: SoruSetiSatir[] = tekilSoruSetleri.map((ss: any) => {
      const bilgi = talepBilgiMap.get(ss.talep_id);
      const sonDurum = sonDurumMap.get(ss.soru_seti_id);

      return {
        talep_id: ss.talep_id,
        video_durum_id: ss.video_durum_id,
        soru_seti_id: ss.soru_seti_id,
        urun_adi: bilgi?.urun_adi ?? "-",
        teknik_adi: bilgi?.teknik_adi ?? "-",
        soru_sayisi: Array.isArray(ss.sorular) ? ss.sorular.length : 0,
        son_durum: sonDurum?.durum ?? null,
        son_tarih: sonDurum?.created_at ?? ss.created_at,
      };
    });

    setSatirlar(sonuc);
    setLoading(false);
  }, [hata]);

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici, veriCek]);

  const toggleFiltre = (durum: FiltreDurum) => {
    setFiltreler(prev => {
      const yeni = new Set(prev);
      if (yeni.has(durum)) { yeni.delete(durum); } else { yeni.add(durum); }
      return yeni;
    });
  };

  const filtreliSatirlar = satirlar.filter(s => {
    // G-4: durumu henüz olmayan satır yazım bekleyen iştir — filtre ne olursa olsun listede kalır.
    const durumUyumu = filtreler.size === 0 || !s.son_durum || filtreler.has(s.son_durum as FiltreDurum);
    return durumUyumu;
  });

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "revizyon bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "inceleme bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
  };

  const filtreSec: { durum: FiltreDurum; etiket: string }[] = [
    { durum: "inceleme bekleniyor", etiket: "İnceleme Bekleyenler" },
    { durum: "revizyon bekleniyor", etiket: "Revizyon Bekleyenler" },
    { durum: "onaylandi", etiket: "Onaylananlar" },
    { durum: "Iptal Edildi", etiket: "İptal Edilenler" },
  ];

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

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <span className="text-sm font-semibold text-gray-900">Soru Setleri</span>
              <div className="flex flex-wrap items-center gap-3">
                {filtreSec.map(f => (
                  <label key={f.durum} className="flex items-center gap-1 cursor-pointer text-xs"
                    style={{ color: filtreler.has(f.durum) ? "#111" : "#737373", fontWeight: filtreler.has(f.durum) ? 600 : 400 }}>
                    <input type="checkbox" checked={filtreler.has(f.durum)} onChange={() => toggleFiltre(f.durum)}
                      className="cursor-pointer w-3 h-3" style={{ accentColor: "#bc2d0d" }} />
                    {f.etiket}
                  </label>
                ))}
              </div>
            </div>
            <span className="text-xs text-gray-500">{filtreliSatirlar.length} kayıt</span>
          </div>

          {filtreliSatirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {filtreler.size > 0 ? "Seçilen filtreye uygun soru seti bulunamadı." : "Henüz soru seti bulunmuyor."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((ss) => {
                  const renk = durumRenk(ss.son_durum ?? "");
                  const okunmamis = okunmamisIdler.has(ss.soru_seti_id);
                  return (
                    <div key={ss.talep_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5">
                          {okunmamis && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                          )}
                          <span className="text-sm text-gray-900" style={{ fontWeight: okunmamis ? 700 : 600 }}>{ss.urun_adi}</span>
                        </div>
                        {ss.son_durum && (
                          <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}`, fontSize: 11 }}>
                            {ss.son_durum}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{ss.teknik_adi}</div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">{ss.soru_sayisi} soru</span>
                        <span className="text-xs text-gray-400">{formatTarih(ss.son_tarih)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase w-44">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((ss) => {
                      const renk = durumRenk(ss.son_durum ?? "");
                      const okunmamis = okunmamisIdler.has(ss.soru_seti_id);
                      return (
                        <tr key={ss.talep_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                          style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                          <td className="px-5 py-3 text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {okunmamis && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                              )}
                              <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{ss.urun_adi}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500">{ss.teknik_adi}</td>
                          <td className="px-3 py-3 text-gray-500">{ss.soru_sayisi} soru</td>
                          <td className="px-3 py-3">
                            {ss.son_durum && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full inline-block max-w-full break-words text-center leading-snug"
                                style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                                {ss.son_durum}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(ss.son_tarih)}</td>
                          <td className="px-5 py-3">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}