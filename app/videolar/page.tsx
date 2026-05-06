// app/videolar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface VideoSatir {
  senaryo_durum_id: string;
  urun_adi: string;
  teknik_adi: string;
  kategori_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "Inceleme Bekleniyor" | "Onaylandi" | "Iptal Edildi";

interface SenaryoDurumJoin {
  senaryo_durum_id: string;
  senaryo_id: string;
  videolar: {
    video_id: string;
    video_url: string | null;
    thumbnail_url: string | null;
    created_at: string;
    video_durumu: {
      durum: string;
      created_at: string;
    }[];
  }[];
  senaryolar: {
    talepler: {
      urunler: { urun_adi: string } | null;
      teknikler: { teknik_adi: string } | null;
      kategoriler: { kategori_adi: string } | null;
    } | null;
  } | null;
}

export default function VideolarListePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [satirlar, setSatirlar] = useState<VideoSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreler, setFiltreler] = useState<Set<FiltreDurum>>(new Set());
  const [kategoriFiltre, setKategoriFiltre] = useState<string>("");
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

  const veriCek = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    // Tek sorgu ile tüm verileri çek
    const { data, error } = await supabase
      .from("senaryo_durumu")
      .select(`
        senaryo_durum_id,
        senaryo_id,
        videolar!inner (
          video_id,
          video_url,
          thumbnail_url,
          created_at,
          video_durumu (
            durum,
            created_at
          )
        ),
        senaryolar!inner (
          talepler!inner (
            urunler (urun_adi),
            teknikler (teknik_adi),
            kategoriler (kategori_adi)
          )
        )
      `)
      .eq("durum", "Onaylandi")
      .order("created_at", { ascending: false });

    if (error || !data) {
      hata("Videolar yüklenemedi.", "senaryo_durumu tablosu SELECT", error?.message);
      setLoading(false);
      return;
    }

    // Her senaryo için en son videoyu ve en son durumu bul
    const senaryoMap = new Map<string, VideoSatir>();

    for (const item of data as unknown as SenaryoDurumJoin[]) {
      const senaryoId = item.senaryo_id;
      
      // Aynı senaryo için daha önce işlem yapıldıysa atla
      if (senaryoMap.has(senaryoId)) continue;

      const videolar = item.videolar || [];
      if (videolar.length === 0) continue;

      // En son videoyu bul (created_at'e göre sıralı geldiği için ilk olan en yeni)
      const sonVideo = videolar[0];
      
      // En son video durumunu bul
      const durumlar = sonVideo.video_durumu || [];
      const sonDurum = durumlar[0] || null;
      
      const talep = item.senaryolar?.talepler;

      senaryoMap.set(senaryoId, {
        senaryo_durum_id: item.senaryo_durum_id,
        urun_adi: talep?.urunler?.urun_adi ?? "-",
        teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
        kategori_adi: talep?.kategoriler?.kategori_adi ?? null,
        video_url: sonVideo.video_url ?? null,
        thumbnail_url: sonVideo.thumbnail_url ?? null,
        son_durum: sonDurum?.durum ?? null,
        son_tarih: sonDurum?.created_at ?? sonVideo.created_at,
      });
    }

    setSatirlar(Array.from(senaryoMap.values()));
    setLoading(false);
  }, [hata]);

  useEffect(() => { if (user) veriCek(); }, [user, veriCek]);

  const toggleFiltre = (durum: FiltreDurum) => {
    setFiltreler(prev => {
      const yeni = new Set(prev);
      if (yeni.has(durum)) { yeni.delete(durum); } else { yeni.add(durum); }
      return yeni;
    });
  };

  const kategoriler = Array.from(new Set(satirlar.map(s => s.kategori_adi).filter(Boolean))) as string[];

  const filtreliSatirlar = satirlar.filter(s => {
    const durumUyumu = filtreler.size === 0 || (s.son_durum && filtreler.has(s.son_durum as FiltreDurum));
    const kategoriUyumu = !kategoriFiltre || s.kategori_adi === kategoriFiltre;
    return durumUyumu && kategoriUyumu;
  });

  const formatTarih = useCallback((tarih: string) => {
    return new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, []);

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

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <span className="text-sm font-semibold text-gray-900">Videolar</span>
              <div className="flex flex-wrap items-center gap-3">
                {filtreSec.map(f => (
                  <label key={f.durum} className="flex items-center gap-1 cursor-pointer text-xs"
                    style={{ color: filtreler.has(f.durum) ? "#111" : "#737373", fontWeight: filtreler.has(f.durum) ? 600 : 400 }}>
                    <input type="checkbox" checked={filtreler.has(f.durum)} onChange={() => toggleFiltre(f.durum)}
                      className="cursor-pointer w-3 h-3" style={{ accentColor: "#bc2d0d" }} />
                    {f.etiket}
                  </label>
                ))}
                {kategoriler.length > 0 && (
                  <select
                    value={kategoriFiltre}
                    onChange={e => setKategoriFiltre(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white cursor-pointer focus:outline-none focus:border-[#56aeff]"
                    style={{ fontFamily: "'Nunito', sans-serif", color: kategoriFiltre ? "#111" : "#737373" }}
                  >
                    <option value="">Tüm Kategoriler</option>
                    {kategoriler.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-500">{filtreliSatirlar.length} kayıt</span>
          </div>

          {filtreliSatirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {filtreler.size > 0 || kategoriFiltre ? "Seçilen filtreye uygun video bulunamadı." : "Henüz video bulunmuyor."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((v) => {
                  const renk = durumRenk(v.son_durum ?? "");
                  return (
                    <div key={v.senaryo_durum_id} onClick={() => router.push(`/videolar/${v.senaryo_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-semibold text-gray-900">{v.urun_adi}</span>
                        {v.son_durum && (
                          <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}`, fontSize: 11 }}>
                            {v.son_durum}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{v.teknik_adi}</div>
                      {v.kategori_adi && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0", fontSize: 10 }}>
                          {v.kategori_adi}
                        </span>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{formatTarih(v.son_tarih)}</div>
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
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Kategori</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((v) => {
                      const renk = durumRenk(v.son_durum ?? "");
                      return (
                        <tr key={v.senaryo_durum_id} onClick={() => router.push(`/videolar/${v.senaryo_durum_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100">
                          <td className="px-5 py-3 text-gray-900 font-medium">{v.urun_adi}</td>
                          <td className="px-3 py-3 text-gray-500">{v.teknik_adi}</td>
                          <td className="px-3 py-3">
                            {v.kategori_adi ? (
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                                {v.kategori_adi}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {v.son_durum && (
                              <span className="text-xs px-2.5 py-0.5 rounded-full"
                                style={{ background: renk.bg, color: renk.text, border: `0.5px solid ${renk.border}` }}>
                                {v.son_durum}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(v.son_tarih)}</td>
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