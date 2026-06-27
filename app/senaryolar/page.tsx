// app/senaryolar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";

interface SenaryoSatir {
  talep_id: string;
  senaryo_id: string;
  urun_adi: string;
  teknik_adi: string;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "inceleme bekleniyor" | "revizyon bekleniyor" | "onaylandi" | "Iptal Edildi";

interface SenaryoJoin {
  senaryo_id: string;
  talep_id: string;
  created_at: string;
  talepler: {
    urunler: { urun_adi: string } | null;
    teknikler: { teknik_adi: string } | null;
  } | null;
}

export default function SenaryolarListePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [satirlar, setSatirlar] = useState<SenaryoSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreler, setFiltreler] = useState<Set<FiltreDurum>>(new Set());
  const { mesajlar, hata } = useHataMesaji();

  const okunmamisIdler = useOkunmamisIdler("senaryo");

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

    // 1) Senaryoları talep + ürün/teknik ile çek (en yeniden eskiye)
    const { data: senaryolar, error: sError } = await supabase
      .from("senaryolar")
      .select(`
        senaryo_id,
        talep_id,
        created_at,
        talepler!inner (
          urunler (urun_adi),
          teknikler (teknik_adi)
        )
      `)
      .order("created_at", { ascending: false });

    if (sError || !senaryolar) {
      hata("Senaryolar yüklenemedi.", "senaryolar tablosu SELECT", sError?.message);
      setLoading(false);
      return;
    }

    // 2) Talep bazlı tekilleştir — her talep için sadece en yeni senaryo
    const talepMap = new Map<string, any>();
    for (const s of senaryolar) {
      if (!talepMap.has(s.talep_id)) {
        talepMap.set(s.talep_id, s);
      }
    }
    const tekilSenaryolar = Array.from(talepMap.values());

    // 3) Son durumları view'dan toplu çek
    const senaryoIds = tekilSenaryolar.map((s: any) => s.senaryo_id);
    const sonDurumMap = new Map<string, { durum: string; created_at: string }>();

    if (senaryoIds.length > 0) {
      const { data: sonDurumlar, error: sdError } = await supabase
        .from("v_senaryo_son_durum")
        .select("senaryo_id, durum, created_at")
        .in("senaryo_id", senaryoIds);

      if (sdError) {
        hata("Senaryo son durumları yüklenemedi.", "v_senaryo_son_durum SELECT", sdError.message);
        setLoading(false);
        return;
      }

      sonDurumlar?.forEach((sd: any) => {
        sonDurumMap.set(sd.senaryo_id, { durum: sd.durum, created_at: sd.created_at });
      });
    }

    // 4) Satırları kur — talep bazlı tek satır
    const sonuc: SenaryoSatir[] = tekilSenaryolar.map((s: any) => {
      const typed = s as unknown as SenaryoJoin;
      const talep = typed.talepler;
      const sonDurum = sonDurumMap.get(s.senaryo_id);

      return {
        talep_id: s.talep_id,
        senaryo_id: s.senaryo_id,
        urun_adi: talep?.urunler?.urun_adi ?? "-",
        teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
        son_durum: sonDurum?.durum ?? null,
        son_tarih: sonDurum?.created_at ?? s.created_at,
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
    const durumUyumu = filtreler.size === 0 || (s.son_durum && filtreler.has(s.son_durum as FiltreDurum));
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
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
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
              <span className="text-sm font-semibold text-gray-900">Senaryolar</span>
              <div className="flex flex-wrap items-center gap-3">
                {filtreSec.map(f => (
                  <label key={f.durum} className="flex items-center gap-1 cursor-pointer text-xs"
                    style={{ color: filtreler.has(f.durum) ? "#111" : "#737373", fontWeight: filtreler.has(f.durum) ? 600 : 400 }}>
                    <input
                      type="checkbox"
                      checked={filtreler.has(f.durum)}
                      onChange={() => toggleFiltre(f.durum)}
                      className="cursor-pointer w-3 h-3"
                      style={{ accentColor: "#bc2d0d" }}
                    />
                    {f.etiket}
                  </label>
                ))}
              </div>
            </div>
            <span className="text-xs text-gray-500">{filtreliSatirlar.length} kayıt</span>
          </div>

          {filtreliSatirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {filtreler.size > 0 ? "Seçilen filtreye uygun senaryo bulunamadı." : "Henüz senaryo bulunmuyor."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((s) => {
                  const renk = durumRenk(s.son_durum ?? "");
                  const okunmamis = okunmamisIdler.has(s.senaryo_id);
                  return (
                    <div key={s.talep_id} onClick={() => router.push(`/senaryolar/${s.talep_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5">
                          {okunmamis && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                          )}
                          <span className="text-sm text-gray-900" style={{ fontWeight: okunmamis ? 700 : 600 }}>{s.urun_adi}</span>
                        </div>
                        {s.son_durum && (
                          <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}`, fontSize: 11 }}>
                            {s.son_durum}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{s.teknik_adi}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatTarih(s.son_tarih)}</div>
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
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((s) => {
                      const renk = durumRenk(s.son_durum ?? "");
                      const okunmamis = okunmamisIdler.has(s.senaryo_id);
                      return (
                        <tr key={s.talep_id} onClick={() => router.push(`/senaryolar/${s.talep_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                          style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                          <td className="px-5 py-3 text-gray-900">
                            <div className="flex items-center gap-1.5">
                              {okunmamis && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                              )}
                              <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{s.urun_adi}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500">{s.teknik_adi}</td>
                          <td className="px-3 py-3">
                            {s.son_durum && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full"
                                style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                                {s.son_durum}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(s.son_tarih)}</td>
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