// app/onaylanan-talepler/page.tsx
//
// F-12 (docs/test_pm_iu_21072026.md) + ikinci tur talebi (21.07): IU'nun
// "Onaylanan Talepler" sekmesi — tablo görünümü (Talep No | Talep Adı |
// Talep Tarihi | Talep Onay Tarihi); satıra tıklanınca talebin onaylı
// senaryosu, videosu (oynatılabilir) ve soru seti salt-okuma açılır.
// Talep No görünümü: `${firma_adi}_${talep_no}` (İskender kararı, 21.07).

"use client";

import { createClient } from "@/lib/supabase/client";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { HedefRolPill } from "@/components/HedefRolBant";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";
import type { HedefRol } from "@/app/talepler/_types";
import { useAuth } from "@/app/providers/AuthProvider";
import { talepIdGoster } from "@/lib/utils/talepId";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import TalepKlasorleri from "@/components/talep/TalepKlasorleri";
import type { DepartmanKey } from "@/lib/video/departman";

interface SoruKaydi {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

// Klasörleme alanları (firma_adi, departman, urun_adi) künyeden gelir ve
// TalepKlasorleri'nin beklediği sözleşmeyi karşılar — ekran ayrıca hesaplamaz.
interface OnayliTalep {
  talep_id: string;
  talep_no_goster: string;
  firma_adi: string;
  departman: DepartmanKey;
  urun_adi: string;
  teknik_adi: string;
  hedef_rol: HedefRol;
  talep_tarihi: string | null;
  onay_tarihi: string;
  senaryo_metni: string;
  video_url: string | null;
  sorular: SoruKaydi[] | null;
}

export default function OnaylananTaleplerPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [kayitlar, setKayitlar] = useState<OnayliTalep[]>([]);
  const [acikTalep, setAcikTalep] = useState<string | null>(null);
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

    // Onaylı senaryolar (talep + firma bilgisiyle)
    const { data: senaryoOnaylari, error: sErr } = await supabase
      .from("senaryo_durumu")
      .select("senaryo_durum_id, created_at, senaryolar(talep_id, senaryo_metni)")
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

    // Talep künyeleri TEK KAPIDAN, toplu (25.07, Aşama 3).
    const talepIdler = Array.from(new Set(
      (senaryoOnaylari ?? []).map((o: any) => o.senaryolar?.talep_id).filter(Boolean)
    )) as string[];
    const kunyeMap = new Map<string, TalepBilgisi>();
    if (talepIdler.length > 0) {
      const res = await fetch(`/talepler/api/kunye?talep_idler=${talepIdler.join(",")}`);
      const veri = await res.json();
      if (res.ok) for (const k of veri.kunyeler as TalepBilgisi[]) kunyeMap.set(k.talep_id, k);
    }

    // Talep başına EN SON onaylı senaryo esas alınır (sıralama zaten yeni→eski).
    const gorulen = new Set<string>();
    const liste: OnayliTalep[] = [];
    (senaryoOnaylari ?? []).forEach((o: any) => {
      const senaryo = o.senaryolar;
      const talep = kunyeMap.get(senaryo?.talep_id);
      if (!senaryo || !talep || gorulen.has(talep.talep_id)) return;
      gorulen.add(talep.talep_id);
      const video = videoMap.get(o.senaryo_durum_id) ?? null;
      liste.push({
        talep_id: talep.talep_id,
        talep_no_goster: talepIdGoster(talep.firma_adi, talep.talep_no),
        firma_adi: talep.firma_adi,
        departman: talep.departman,
        urun_adi: talep.urun_adi,
        teknik_adi: talep.teknik_adi,
        hedef_rol: talep.hedef_rol,
        talep_tarihi: talep.created_at,
        onay_tarihi: o.created_at,
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

  const formatTarih = (tarih: string | null) =>
    tarih ? new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

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

  const DetayIcerik = ({ k }: { k: OnayliTalep }) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900">{k.urun_adi}</span>
          <span className="text-xs text-gray-500">{k.teknik_adi}</span>
        </div>
        <HedefRolPill hedefRol={k.hedef_rol} />
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Senaryo</div>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap m-0">{k.senaryo_metni}</p>
      </div>

      {k.video_url && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Video</div>
          {/* Kutu videonun oranına göre çizilir (26.07). Kenarlık/köşe iframe'den kutuya taşındı. */}
          <VideoCercevesi videoUrl={k.video_url} className="rounded-lg border border-gray-200">
            <iframe src={k.video_url} frameBorder="0" allowFullScreen />
          </VideoCercevesi>
        </div>
      )}

      {k.sorular && k.sorular.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-500 mb-1.5">Onaylı Soru Seti</div>
          <div className="flex flex-col gap-2">
            {k.sorular.map((soru, i) => (
              <div key={i} className="border border-gray-200 rounded-lg px-3 py-2.5 bg-white">
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
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-4">
        <h1 className="text-lg font-bold text-gray-900 m-0">Onaylanan Talepler</h1>

        {kayitlar.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <p className="text-sm text-gray-400 text-center py-8 m-0">Henüz onaylanmış talep yok.</p>
          </div>
        ) : (
          // Klasör kırılımı (26.07): düz liste talep geldikçe uzuyordu ve onaylı
          // bir işin hangi firmaya/müdürlüğe/ürüne ait olduğu okunmuyordu.
          // Gösterim aşağıda aynı kaldı — yalnız hangi taleplerin görüneceğini
          // klasör belirliyor.
          <TalepKlasorleri talepler={kayitlar} render={(liste) => (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="md:hidden divide-y divide-gray-50">
              {liste.map(k => (
                <div key={k.talep_id}>
                  <div onClick={() => setAcikTalep(acikTalep === k.talep_id ? null : k.talep_id)}
                    className="px-4 py-3 cursor-pointer flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-gray-400">{k.talep_no_goster}</span>
                      <span className="text-sm font-semibold text-gray-900 truncate">{k.urun_adi}</span>
                      <span className="text-xs text-gray-500">{formatTarih(k.talep_tarihi)} → {formatTarih(k.onay_tarihi)}</span>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="14" height="14" className="flex-shrink-0"
                      style={{ transform: acikTalep === k.talep_id ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  {acikTalep === k.talep_id && (
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                      <DetayIcerik k={k} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">Talep No</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Talep Adı (Ürün Adı)</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Talep Tarihi</th>
                    <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Talep Onay Tarihi</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map(k => (
                    <Fragment key={k.talep_id}>
                      <tr onClick={() => setAcikTalep(acikTalep === k.talep_id ? null : k.talep_id)}
                        className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100">
                        <td className="px-5 py-3 text-gray-700 font-semibold">{k.talep_no_goster}</td>
                        <td className="px-3 py-3 text-gray-900">{k.urun_adi}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(k.talep_tarihi)}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(k.onay_tarihi)}</td>
                        <td className="px-5 py-3">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="14" height="14"
                            style={{ transform: acikTalep === k.talep_id ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </td>
                      </tr>
                      {acikTalep === k.talep_id && (
                        <tr>
                          <td colSpan={5} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                            <DetayIcerik k={k} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )} />
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
