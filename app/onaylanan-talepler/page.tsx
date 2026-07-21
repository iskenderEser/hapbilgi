// app/onaylanan-talepler/page.tsx
//
// F-12 (docs/test_pm_iu_21072026.md): IU'nun "Onaylanan Talepler" sekmesi — tek
// sayfada, yukarıdan aşağıya her talebin ONAYLANAN senaryosu, videosu
// (oynatılabilir) ve soru seti, salt-okuma. Zincir: talep → onaylı senaryo →
// (o onay kaydına bağlı) onaylı video → (o onay kaydına bağlı) onaylı soru seti.

"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { HedefRolPill } from "@/components/HedefRolBant";
import type { HedefRol } from "@/app/talepler/_types";
import { useAuth } from "@/app/providers/AuthProvider";

interface SoruKaydi {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

interface OnayliTalep {
  talep_id: string;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  senaryo_metni: string;
  video_url: string | null;
  sorular: SoruKaydi[] | null;
}

export default function OnaylananTaleplerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [kayitlar, setKayitlar] = useState<OnayliTalep[]>([]);
  const [loading, setLoading] = useState(true);
  const { mesajlar, hata } = useHataMesaji();

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
    if (kullanici.rol.toLowerCase() !== "iu") {
      router.push("/ana-sayfa");
      return;
    }
  }, [kullanici, authYukleniyor, router]);

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    // Onaylı senaryolar (talep bilgisiyle)
    const { data: senaryoOnaylari, error: sErr } = await supabase
      .from("senaryo_durumu")
      .select("senaryo_durum_id, created_at, senaryolar(talep_id, senaryo_metni, talepler(talep_id, hedef_rol, urunler(urun_adi), teknikler(teknik_adi)))")
      .eq("durum", "onaylandi")
      .order("created_at", { ascending: false });
    if (sErr) {
      hata("Onaylı senaryolar yüklenemedi.", "senaryo_durumu SELECT — onaylandi", sErr.message);
      setLoading(false);
      return;
    }

    // Onaylı videolar (hangi senaryo onayına bağlı olduklarıyla)
    const { data: videoOnaylari } = await supabase
      .from("video_durumu")
      .select("video_durum_id, videolar(video_url, senaryo_durum_id)")
      .eq("durum", "onaylandi");

    // Onaylı soru setleri (hangi video onayına bağlı olduklarıyla)
    const { data: setOnaylari } = await supabase
      .from("soru_seti_durumu")
      .select("soru_setleri(video_durum_id, sorular)")
      .eq("durum", "onaylandi");

    const videoMap = new Map<string, { video_url: string; video_durum_id: string }>();
    (videoOnaylari ?? []).forEach((v: any) => {
      const video = v.videolar;
      if (video?.senaryo_durum_id && video.video_url) {
        videoMap.set(video.senaryo_durum_id, { video_url: video.video_url, video_durum_id: v.video_durum_id });
      }
    });

    const setMap = new Map<string, SoruKaydi[]>();
    (setOnaylari ?? []).forEach((s: any) => {
      const set = s.soru_setleri;
      if (set?.video_durum_id && set.sorular?.length) setMap.set(set.video_durum_id, set.sorular);
    });

    // Talep başına EN SON onaylı senaryo esas alınır (sıralama zaten yeni→eski).
    const gorulen = new Set<string>();
    const liste: OnayliTalep[] = [];
    (senaryoOnaylari ?? []).forEach((o: any) => {
      const senaryo = o.senaryolar;
      const talep = senaryo?.talepler;
      if (!senaryo || !talep || gorulen.has(talep.talep_id)) return;
      gorulen.add(talep.talep_id);
      const video = videoMap.get(o.senaryo_durum_id) ?? null;
      liste.push({
        talep_id: talep.talep_id,
        urun_adi: talep.urunler?.urun_adi ?? "-",
        teknik_adi: talep.teknikler?.teknik_adi ?? "-",
        hedef_rol: (talep.hedef_rol ?? "utt") as HedefRol,
        senaryo_metni: senaryo.senaryo_metni,
        video_url: video?.video_url ?? null,
        sorular: video ? (setMap.get(video.video_durum_id) ?? null) : null,
      });
    });

    setKayitlar(liste);
    setLoading(false);
  };

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
        <h1 className="text-lg font-bold text-gray-900 m-0">Onaylanan Talepler</h1>

        {kayitlar.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Henüz onaylanmış talep yok.</p>
        )}

        {kayitlar.map(k => (
          <div key={k.talep_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 md:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex flex-col">
                <span className="text-base font-semibold text-gray-900">{k.urun_adi}</span>
                <span className="text-xs text-gray-500">{k.teknik_adi}</span>
              </div>
              <HedefRolPill hedefRol={k.hedef_rol} />
            </div>

            <div className="px-4 md:px-5 py-4 flex flex-col gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Senaryo</div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap m-0">{k.senaryo_metni}</p>
              </div>

              {k.video_url && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Video</div>
                  <iframe src={k.video_url} width="100%" height="320" frameBorder="0" allowFullScreen
                    className="rounded-lg border border-gray-200" />
                </div>
              )}

              {k.sorular && k.sorular.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Soru Seti</div>
                  <div className="flex flex-col gap-2">
                    {k.sorular.map((soru, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg px-3 py-2.5">
                        <div className="text-sm text-gray-900 mb-1.5">{i + 1}. {soru.soru_metni}</div>
                        {soru.secenekler?.map(sec => (
                          <div key={sec.harf} className="text-xs mb-0.5 flex items-center gap-1.5"
                            style={{ color: sec.dogru ? "#16a34a" : "#6b7280", fontWeight: sec.dogru ? 700 : 400 }}>
                            <span>{sec.harf}) {sec.metin}</span>
                            {sec.dogru && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
