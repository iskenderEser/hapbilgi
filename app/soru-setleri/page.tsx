// app/soru-setleri/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface SoruSetiSatir {
  video_durum_id: string;
  urun_adi: string;
  teknik_adi: string;
  soru_sayisi: number;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "Inceleme Bekleniyor" | "Onaylandi" | "Iptal Edildi";

export default function SoruSetleriListePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [satirlar, setSatirlar] = useState<SoruSetiSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreler, setFiltreler] = useState<Set<FiltreDurum>>(new Set());
  const { mesajlar, hata } = useHataMesaji();

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

    const { data: videoDurumlari, error: vdError } = await supabase
      .from("video_durumu").select("video_durum_id, video_id")
      .order("created_at", { ascending: false });

    if (vdError) { hata("Soru setleri yüklenemedi.", "video_durumu tablosu SELECT", vdError.message); setLoading(false); return; }

    const sonuc = await Promise.all(
      (videoDurumlari ?? []).map(async (vd) => {
        const { data: soruSetleri } = await supabase
          .from("soru_setleri").select("soru_seti_id, sorular, created_at")
          .eq("video_durum_id", vd.video_durum_id).order("created_at", { ascending: false }).limit(1);
        const sonSoruSeti = soruSetleri?.[0];
        if (!sonSoruSeti) return null;

        const { data: durumlar } = await supabase
          .from("soru_seti_durumu").select("durum, created_at")
          .eq("soru_seti_id", sonSoruSeti.soru_seti_id).order("created_at", { ascending: false }).limit(1);

        let urun_adi = "-", teknik_adi = "-";
        const { data: video } = await supabase.from("videolar").select("senaryo_durum_id").eq("video_id", vd.video_id).single();
        if (video?.senaryo_durum_id) {
          const { data: senaryoDurum } = await supabase.from("senaryo_durumu").select("senaryo_id").eq("senaryo_durum_id", video.senaryo_durum_id).single();
          if (senaryoDurum?.senaryo_id) {
            const { data: senaryo } = await supabase.from("senaryolar").select("talep_id").eq("senaryo_id", senaryoDurum.senaryo_id).single();
            if (senaryo?.talep_id) {
              const { data: talep } = await supabase.from("talepler").select(`urunler(urun_adi), teknikler(teknik_adi)`).eq("talep_id", senaryo.talep_id).single();
              urun_adi = (talep as any)?.urunler?.urun_adi ?? "-";
              teknik_adi = (talep as any)?.teknikler?.teknik_adi ?? "-";
            }
          }
        }

        return {
          video_durum_id: vd.video_durum_id, urun_adi, teknik_adi,
          soru_sayisi: sonSoruSeti.sorular?.length ?? 0,
          son_durum: durumlar?.[0]?.durum ?? null,
          son_tarih: durumlar?.[0]?.created_at ?? sonSoruSeti.created_at,
        };
      })
    );

    setSatirlar(sonuc.filter(Boolean) as SoruSetiSatir[]);
    setLoading(false);
  };

  useEffect(() => { if (user) veriCek(); }, [user]);

  const toggleFiltre = (durum: FiltreDurum) => {
    setFiltreler(prev => {
      const yeni = new Set(prev);
      if (yeni.has(durum)) { yeni.delete(durum); } else { yeni.add(durum); }
      return yeni;
    });
  };

  const filtreliSatirlar = filtreler.size === 0
    ? satirlar
    : satirlar.filter(s => s.son_durum && filtreler.has(s.son_durum as FiltreDurum));

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const durumRenk = (durum: string) => {
    switch (durum) {
      case "Onaylandi": return { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" };
      case "Iptal Edildi": return { bg: "#fef2f2", text: "#bc2d0d", border: "#fecaca" };
      case "Revizyon Bekleniyor": return { bg: "#fefce8", text: "#854d0e", border: "#fde68a" };
      case "Inceleme Bekleniyor": return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      default: return { bg: "#f9fafb", text: "#737373", border: "#e5e7eb" };
    }
  };

  const filtreSec: { durum: FiltreDurum; etiket: string }[] = [
    { durum: "Inceleme Bekleniyor", etiket: "İnceleme Bekleyenler" },
    { durum: "Onaylandi", etiket: "Onaylananlar" },
    { durum: "Iptal Edildi", etiket: "İptal Edilenler" },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          {/* Başlık + filtreler */}
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
              {/* Mobile: kart görünümü */}
              <div className="md:hidden">
                {filtreliSatirlar.map((ss) => {
                  const renk = durumRenk(ss.son_durum ?? "");
                  return (
                    <div key={ss.video_durum_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-semibold text-gray-900">{ss.urun_adi}</span>
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

              {/* Desktop: tablo görünümü */}
              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((ss) => {
                      const renk = durumRenk(ss.son_durum ?? "");
                      return (
                        <tr key={ss.video_durum_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100">
                          <td className="px-5 py-3 text-gray-900 font-medium">{ss.urun_adi}</td>
                          <td className="px-3 py-3 text-gray-500">{ss.teknik_adi}</td>
                          <td className="px-3 py-3 text-gray-500">{ss.soru_sayisi} soru</td>
                          <td className="px-3 py-3">
                            {ss.son_durum && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full"
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