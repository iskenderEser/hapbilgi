// app/videolar/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import DurumAnahtari from "@/components/DurumAnahtari";
import { durumMesaji, kayitDurumKodu, type DurumKodu } from "@/lib/utils/durum/mesaj";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";
import UretimVaryantiRozet from "@/components/UretimVaryantiRozet";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { talepIdGoster } from "@/lib/utils/talepId";


interface VideoSatir {
  talep_id: string;
  talep_no: number;
  firma_adi: string;
  senaryo_durum_id: string;
  video_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  // Ham durum taşınmaz: ekrana çıkan her metin tek sözlükten okunur.
  durum_kodu: DurumKodu;
  uretici_rol_adi: string | null;
  son_tarih: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
}

// Talep dalı kaldırıldı (25.07, Aşama 3): künye tek kapıdan gelir. Burada yalnız
// videodan talebe ulaşan zincir tarif edilir.
interface VideoJoin {
  video_id: string;
  senaryo_durum_id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
  senaryo_durumu: {
    senaryolar: { talep_id: string } | null;
  } | null;
}

export default function VideolarListePage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [satirlar, setSatirlar] = useState<VideoSatir[]>([]);
  const [loading, setLoading] = useState(true);
  const [aktifDurum, setAktifDurum] = useState<DurumKodu>("onay_bekleniyor");
  const { mesajlar, hata } = useHataMesaji();

  const okunmamisIdler = useOkunmamisIdler("video");

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

    // 1) Videoları senaryo_durumu üzerinden talep + ürün/teknik ile çek (en yeniden eskiye)
    const { data: videolar, error: vError } = await supabase
      .from("videolar")
      .select(`
        video_id,
        senaryo_durum_id,
        iu_id,
        video_url,
        thumbnail_url,
        created_at,
        senaryo_durumu!inner (
          senaryolar!inner ( talep_id )
        )
      `)
      .order("created_at", { ascending: false });

    if (vError || !videolar) {
      hata("Videolar yüklenemedi.", "videolar tablosu SELECT", vError?.message);
      setLoading(false);
      return;
    }

    // 2) Talep bazlı tekilleştir — her talep için sadece en yeni video
    const talepMap = new Map<string, any>();
    for (const v of videolar) {
      const typed = v as unknown as VideoJoin;
      const talep_id = typed.senaryo_durumu?.senaryolar?.talep_id;
      if (!talep_id) continue;
      if (!talepMap.has(talep_id)) {
        talepMap.set(talep_id, { ...v, _talep_id: talep_id });
      }
    }
    const tekilVideolar = Array.from(talepMap.values());

    // 3) Son durumları view'dan toplu çek
    const videoIds = tekilVideolar.map((v: any) => v.video_id);
    const sonDurumMap = new Map<string, { durum: string; created_at: string }>();

    if (videoIds.length > 0) {
      const { data: sonDurumlar, error: sdError } = await supabase
        .from("v_video_son_durum")
        .select("video_id, durum, created_at")
        .in("video_id", videoIds);

      if (sdError) {
        hata("Video son durumları yüklenemedi.", "v_video_son_durum SELECT", sdError.message);
        setLoading(false);
        return;
      }

      sonDurumlar?.forEach((sd: any) => {
        sonDurumMap.set(sd.video_id, { durum: sd.durum, created_at: sd.created_at });
      });
    }


    // Talep künyeleri TEK KAPIDAN, toplu (25.07, Aşama 3).
    const kunyeMap = new Map<string, TalepBilgisi>();
    {
      const talepIdler = tekilVideolar.map((v: any) => v._talep_id);
      if (talepIdler.length > 0) {
        const res = await fetch(`/talepler/api/kunye?talep_idler=${talepIdler.join(",")}`);
        const veri = await res.json();
        if (res.ok) for (const k of veri.kunyeler as TalepBilgisi[]) kunyeMap.set(k.talep_id, k);
      }
    }

    // Talebi açanın unvanı künyeden gelir (25.07): ayrı kullanicilar sorgusu kalktı.

    // 4) Satırları kur — talep bazlı tek satır
    const sonuc: VideoSatir[] = tekilVideolar.map((v: any) => {
      const talep = kunyeMap.get(v._talep_id);
      const sonDurum = sonDurumMap.get(v.video_id);

      return {
        talep_id: v._talep_id,
        talep_no: talep?.talep_no ?? 0,
        firma_adi: talep?.firma_adi ?? "",
        senaryo_durum_id: v.senaryo_durum_id,
        video_id: v.video_id,
        urun_adi: talep?.urun_adi ?? "-",
        teknik_adi: talep?.teknik_adi ?? "-",
        hazir_video: talep?.hazir_video ?? false,
        hazir_soru_seti: talep?.hazir_soru_seti ?? false,
        video_url: v.video_url ?? null,
        thumbnail_url: v.thumbnail_url ?? null,
        durum_kodu: kayitDurumKodu(sonDurum?.durum, !!v.iu_id),
        uretici_rol_adi: talep?.uretici_rol_adi ?? null,
        son_tarih: sonDurum?.created_at ?? v.created_at,
      };
    });

    setSatirlar(sonuc);
    setLoading(false);
  }, [hata]);

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici, veriCek]);

  const sayim = useMemo(() => {
    const s: Partial<Record<DurumKodu, number>> = {};
    for (const r of satirlar) s[r.durum_kodu] = (s[r.durum_kodu] ?? 0) + 1;
    return s;
  }, [satirlar]);

  const filtreliSatirlar = satirlar.filter(s => s.durum_kodu === aktifDurum);

  const formatTarih = useCallback((tarih: string) => {
    return new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
  }, []);

  // durumRenk kaldırıldı (25.07): metin ve renk tek sözlükten — lib/utils/durum/mesaj.ts.

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

      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          <DurumAnahtari baslik="Videolar" rol={kullanici.rol} asama="Video" aktif={aktifDurum} onSec={setAktifDurum} sayim={sayim} />

          {filtreliSatirlar.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {satirlar.length === 0 ? "Henüz video bulunmuyor." : "Bu durumda video yok."}
            </div>
          ) : (
            <>
              <div className="md:hidden">
                {filtreliSatirlar.map((v) => {
                  const durum = durumMesaji(v.durum_kodu, kullanici.rol, { asama: "Video", rolAdi: v.uretici_rol_adi, tarih: v.son_tarih });
                  const okunmamis = okunmamisIdler.has(v.video_id);
                  return (
                    <div key={v.talep_id} onClick={() => router.push(`/videolar/${v.senaryo_durum_id}`)}
                      className="px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                      <div className="text-xs text-gray-500 mb-1">{talepIdGoster(v.firma_adi, v.talep_no)}</div>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {okunmamis && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                          )}
                          <span className="text-sm text-gray-900" style={{ fontWeight: okunmamis ? 700 : 600 }}>{v.urun_adi}</span>
                          <UretimVaryantiRozet hazirVideo={v.hazir_video} hazirSoruSeti={v.hazir_soru_seti} />
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full leading-tight"
                          style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}`, fontSize: 11 }}>
                          {durum.metin}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">{v.teknik_adi}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatTarih(v.son_tarih)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Eğitim</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase w-56">Son Durum</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtreliSatirlar.map((v) => {
                      const durum = durumMesaji(v.durum_kodu, kullanici.rol, { asama: "Video", rolAdi: v.uretici_rol_adi, tarih: v.son_tarih });
                      const okunmamis = okunmamisIdler.has(v.video_id);
                      return (
                        <tr key={v.talep_id} onClick={() => router.push(`/videolar/${v.senaryo_durum_id}`)}
                          className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                          style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}>
                          <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{talepIdGoster(v.firma_adi, v.talep_no)}</td>
                          <td className="px-3 py-3 text-gray-900">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {okunmamis && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#bc2d0d" }} />
                              )}
                              <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{v.urun_adi}</span>
                              <UretimVaryantiRozet hazirVideo={v.hazir_video} hazirSoruSeti={v.hazir_soru_seti} />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500">{v.teknik_adi}</td>
                          <td className="px-3 py-3">
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full inline-block max-w-full break-words text-center leading-snug"
                              style={{ background: durum.renk.bg, color: durum.renk.text, border: `0.5px solid ${durum.renk.border}` }}>
                              {durum.metin}
                            </span>
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