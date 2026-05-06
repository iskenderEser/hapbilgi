// app/soru-setleri/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface SoruSetiSatir {
  video_durum_id: string;
  urun_adi: string;
  teknik_adi: string;
  kategori_adi: string | null;
  soru_sayisi: number;
  son_durum: string | null;
  son_tarih: string;
}

type FiltreDurum = "Inceleme Bekleniyor" | "Onaylandi" | "Iptal Edildi";

interface VideoDurumJoin {
  video_durum_id: string;
  video_id: string;
  videolar: {
    senaryo_durumu: {
      senaryolar: {
        talepler: {
          urunler: { urun_adi: string } | null;
          teknikler: { teknik_adi: string } | null;
          kategoriler: { kategori_adi: string } | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

export default function SoruSetleriListePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [satirlar, setSatirlar] = useState<SoruSetiSatir[]>([]);
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

    // Tek sorgu ile tüm video_durumları ve ilişkili verileri çek
    const { data: videoDurumlari, error: vdError } = await supabase
      .from("video_durumu")
      .select(`
        video_durum_id,
        video_id,
        videolar!inner (
          senaryo_durumu!inner (
            senaryolar!inner (
              talepler!inner (
                urunler (urun_adi),
                teknikler (teknik_adi),
                kategoriler (kategori_adi)
              )
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (vdError || !videoDurumlari) {
      hata("Soru setleri yüklenemedi.", "video_durumu tablosu SELECT", vdError?.message);
      setLoading(false);
      return;
    }

    // Tüm video_durum_id'leri topla
    const videoDurumIds = videoDurumlari.map((vd: any) => vd.video_durum_id);

    // Tek sorgu ile tüm soru setlerini ve durumlarını çek
    const { data: tumSoruSetleri } = await supabase
      .from("soru_setleri")
      .select("soru_seti_id, video_durum_id, sorular, created_at")
      .in("video_durum_id", videoDurumIds)
      .order("created_at", { ascending: false });

    // Her video_durum için en son soru setini bul
    const sonSoruSetiMap = new Map();
    tumSoruSetleri?.forEach((ss: any) => {
      const mevcut = sonSoruSetiMap.get(ss.video_durum_id);
      if (!mevcut || new Date(ss.created_at) > new Date(mevcut.created_at)) {
        sonSoruSetiMap.set(ss.video_durum_id, ss);
      }
    });

    const sonSoruSetiIds = Array.from(sonSoruSetiMap.values()).map((ss: any) => ss.soru_seti_id);

    // Tek sorgu ile tüm durumları çek
    const { data: tumDurumlar } = await supabase
      .from("soru_seti_durumu")
      .select("soru_seti_id, durum, created_at")
      .in("soru_seti_id", sonSoruSetiIds)
      .order("created_at", { ascending: false });

    // Her soru seti için en son durumu bul
    const sonDurumMap = new Map();
    tumDurumlar?.forEach((d: any) => {
      if (!sonDurumMap.has(d.soru_seti_id)) {
        sonDurumMap.set(d.soru_seti_id, d);
      }
    });

    // Sonuçları birleştir
    const sonuc: SoruSetiSatir[] = [];

    for (const vd of videoDurumlari) {
      const sonSoruSeti = sonSoruSetiMap.get(vd.video_durum_id);
      if (!sonSoruSeti) continue;

      const sonDurum = sonDurumMap.get(sonSoruSeti.soru_seti_id);
      
      const typedVd = vd as unknown as VideoDurumJoin;
      const talep = typedVd.videolar?.senaryo_durumu?.senaryolar?.talepler;
      
      sonuc.push({
        video_durum_id: vd.video_durum_id,
        urun_adi: talep?.urunler?.urun_adi ?? "-",
        teknik_adi: talep?.teknikler?.teknik_adi ?? "-",
        kategori_adi: talep?.kategoriler?.kategori_adi ?? null,
        soru_sayisi: sonSoruSeti.sorular?.length ?? 0,
        son_durum: sonDurum?.durum ?? null,
        son_tarih: sonDurum?.created_at ?? sonSoruSeti.created_at,
      });
    }

    setSatirlar(sonuc);
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
              {filtreler.size > 0 || kategoriFiltre ? "Seçilen filtreye uygun soru seti bulunamadı." : "Henüz soru seti bulunmuyor."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((ss) => {
                  const renk = durumRenk(ss.son_durum ?? "");
                  return (
                    <div key={ss.video_durum_id} onClick={() => router.push(`/soru-setleri/${ss.video_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors">
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
                      {ss.kategori_adi && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0", fontSize: 10 }}>
                          {ss.kategori_adi}
                        </span>
                      )}
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
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Kategori</th>
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
                          <td className="px-3 py-3">
                            {ss.kategori_adi ? (
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                                {ss.kategori_adi}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
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