// app/talepler/[talep_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import TalepSahibiKarti from "@/components/TalepSahibiKarti";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { URETICI_ROLLER, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { HedefRolPill } from "@/components/HedefRolBant";
import type { TalepBilgisi } from "@/lib/utils/talepZinciri";
import { TeknikPill } from "@/components/TeknikPill";
import { useAuth } from "@/app/providers/AuthProvider";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";
import { useBunnyIslemeDurumu } from "@/hooks/useBunnyIslemeDurumu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { DosyaGoruntuleListesi, type DosyaItem as ComponentDosyaItem } from "@/components/DosyaGoruntuleListesi";
import { uretimToast, toastVaryant } from "@/lib/uretim/toastMesaj";

// Künye ortak tipten gelir; bu ekrana özel iki alan üstüne eklenir (25.07, Aşama 3).
type Talep = TalepBilgisi & {
  hazir_video_url: string | null;
  hazir_soru_seti_verisi: any[] | null;
};

type DosyaItem = ComponentDosyaItem;

export default function TalepDetayPage() {
  const router = useRouter();
  const params = useParams();
  const talep_id = params.talep_id as string;

  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [talep, setTalep] = useState<Talep | null>(null);
  const [loading, setLoading] = useState(true);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);
  // A4 — hazır videoyu üretici buradan da yükleyebilir (form yüklemesi yarım kaldıysa ya da red sonrası).
  const [seciliVideoDosya, setSeciliVideoDosya] = useState<File | null>(null);
  const [videoYukleniyor, setVideoYukleniyor] = useState(false);
  const [yuklemeYuzdesi, setYuklemeYuzdesi] = useState<number | null>(null);
  const [soruSetiAcik, setSoruSetiAcik] = useState(false);
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

  // Künye TEK KAPIDAN, içerik ayrı (25.07, Aşama 3). hazir_video_url ve
  // hazir_soru_seti_verisi künyeye girmez: ikincisi 15+ sorunun tam metnidir ve
  // yalnız BU ekranda kullanılır — künyeye konsa her liste satırında taşınırdı.
  // Buradaki ikinci sorgu ad kuralı içermez, yalnız bu ekrana özel iki alan çeker.
  useEffect(() => {
    if (!kullanici || !talep_id) return;
    const supabase = createClient();

    (async () => {
      const kunyeRes = await fetch(`/talepler/api/kunye?talep_id=${talep_id}`);
      const kunyeVeri = await kunyeRes.json();
      if (!kunyeRes.ok) {
        hata(kunyeVeri.hata ?? "Talep bulunamadı veya erişim yetkiniz yok.", "talep künyesi", kunyeVeri.detay);
        router.push("/talepler");
        return;
      }

      const { data: icerik } = await supabase
        .from("talepler")
        .select("hazir_video_url, hazir_soru_seti_verisi")
        .eq("talep_id", talep_id)
        .single();

      setTalep({
        ...kunyeVeri.kunye,
        hazir_video_url: icerik?.hazir_video_url ?? null,
        hazir_soru_seti_verisi: icerik?.hazir_soru_seti_verisi ?? null,
      });
      setLoading(false);
    })();
  }, [kullanici, talep_id]);

  // V1-5 (İskender talimatı, 21.07): İU'nun dünyasında hazır video talebinin tek
  // görünümü Soru Setleri'ndeki iştir — doğrudan URL ile gelse bile İU bu
  // sayfayı görmez, işin yaşadığı yere yönlendirilir.
  useEffect(() => {
    const rol = (kullanici?.rol ?? "").toLowerCase();
    if (rol === "iu" && talep?.hazir_video) router.replace("/soru-setleri");
  }, [kullanici, talep, router]);

  // Video modernizasyonu (20.07.2026): tek seferlik kontrol yerine sınırlı süreli
  // tekrar-sorgu — PM ekranı sayfayı yenilemeden de "hazır"a geçişi görür.
  const bunnyIslemeDurumu = useBunnyIslemeDurumu(talep?.hazir_video_url, { talep_id });

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // F-1 (docs/test_pm_iu_21072026.md): dosya ekleme yalnız talep AÇILIRKEN yapılır —
  // gönderilmiş talebin detayında ekleme yolu kaldırıldı (silme duruyor).
  const handleDosyaSil = async (url: string) => {
    setSiliniyor(url);
    const res = await fetch("/talepler/api/dosyalar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, url }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Dosya silinemedi.", d.adim, d.detay); }
    // eslint-disable-next-line hapbilgi-mimari/toast-tek-kaynak -- ek dosya silme; üretim hattı akış mesajı değil, sözlükte yeri yok.
    else { setTalep(prev => prev ? { ...prev, dosya_urls: d.dosyalar } : prev); basari("Dosya silindi."); }
    setSiliniyor(null);
  };

  // A4 — form yüklemesi yarım kaldıysa ya da üretici reddettiyse: aynı vezne + TUS akışı buradan.
  const handleHazirVideoYukle = async () => {
    if (!seciliVideoDosya) return;
    setVideoYukleniyor(true);

    // 1) Vezne: kimlik + sıra kontrolü + Bunny kaydı + süreli imza
    const res = await fetch("/talepler/api/bunny-yukleme-baslat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Video yüklemesi başlatılamadı.", d.adim, d.detay); setVideoYukleniyor(false); return; }

    // 2) Doğrudan Bunny'ye — dosya bizim sunucuya uğramaz
    try {
      await bunnyTusYukle(seciliVideoDosya, d, setYuklemeYuzdesi);
    } catch (err: any) {
      hata("Video Bunny'ye yüklenemedi. Tekrar deneyin.", "TUS yükleme", err?.message);
      // Telafi: vezneden açılan ama hiçbir kayda bağlanmayan Bunny kaydını temizle.
      fetch("/videolar/api/bunny-yukleme-iptal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_guid: d.video_guid }),
      }).catch(() => {});
      setVideoYukleniyor(false);
      setYuklemeYuzdesi(null);
      return;
    }

    // 3) Kanonik embed adresini sistem yazar (adres vezneden geldi, istemci URL kurmaz)
    const res2 = await fetch("/talepler/api/hazir-video", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, hazir_video_url: d.embed_url }),
    });
    const d2 = await res2.json();
    if (!res2.ok) { hata(d2.hata ?? "Video adresi kaydedilemedi.", d2.adim, d2.detay); }
    else {
      setTalep(prev => prev ? { ...prev, hazir_video_url: d.embed_url } : prev);
      // Bu uç yarım kalan/reddedilen yüklemenin telafisidir; zincir burada
      // kurulduğu için mesaj talep açılışındakiyle aynıdır (26.07). Metni artık
      // sunucu değil sözlük veriyor.
      basari(uretimToast(
        { rol: "uretici", olay: "talep_gonderildi" },
        { varyant: toastVaryant(talep?.hazir_video, talep?.hazir_soru_seti) },
      ));
    }
    setSeciliVideoDosya(null);
    setVideoYukleniyor(false);
    setYuklemeYuzdesi(null);
  };

  // V1-5/V1-6 (İskender kararı, 21.07): PM'in ayrı video onay adımı kalktı — zincir
  // yükleme anında kurulur. Bu handler yalnız işlenemeyen video telafisi içindir:
  // yerel URL temizlenir, yükleme alanı geri gelir; yeni PUT zincirdeki adresi günceller.
  const handleYenidenYukle = () => {
    setSeciliVideoDosya(null);
    setTalep(prev => prev ? { ...prev, hazir_video_url: null } : prev);
  };

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isPM = URETICI_ROLLER.includes(rolKucu);
  const isIU = rolKucu === "iu";

  // Auth guard layout'ta; erişim/yönlendirme useEffect'te; burada veri spinner'ı.
  if (!kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!talep) return null;

  // V1-5: yönlendirme effect'i koşana dek İU'ya hazır video detayı bir an bile gösterilmez.
  if (isIU && talep.hazir_video) return null;

  // A4: hazır videoyu yalnız talebin üreticisi yükler (vezne de sunucuda aynı şartı arar).
  const isUretici = isPM && talep.uretici_id === kullanici.id;

  return (
    <>
      <TalepSahibiKarti rol={kullanici.rol} talepId={talep_id} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <button onClick={() => router.push("/talepler")}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer text-gray-500 text-sm p-0 w-fit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Talepler
        </button>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

          {/* Başlık */}
          <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-gray-900">{talep.urun_adi}</span>
                {talep.hazir_video && (
                  <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa" }}>
                    Hazır Video
                  </span>
                )}
                {talep.hazir_soru_seti && (
                  <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                    Hazır Soru Seti
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <TeknikPill teknikAdi={talep.teknik_adi} />
                <HedefRolPill hedefRol={talep.hedef_rol} />
              </div>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{talep.created_at ? formatTarih(talep.created_at) : "-"}</span>
          </div>

          {/* Hazır video uyarı kutusu */}
          {talep.hazir_video && (
            <div className="px-4 md:px-5 py-3 border-b border-gray-100 bg-amber-50">
              <div className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span className="text-xs text-amber-800 leading-relaxed">
                  {isPM && !talep.hazir_video_url && "Hazır video talebi — video henüz yüklenmedi. Talebin üreticisi aşağıdan video dosyasını doğrudan Bunny'ye yükleyebilir."}
                  {isPM && talep.hazir_video_url && (talep.hazir_soru_seti
                    ? "Hazır video gönderildi — hazır soru seti otomatik işlendi, video yayın bekleyenlerine düştü."
                    : "Hazır video gönderildi — soru seti içerik üreticisi tarafından hazırlanacak.")}
                  {/* V1-5: İU'ya yönelik metinler kaldırıldı — İU bu sayfaya hazır video talebi için ulaşamaz. */}
                </span>
              </div>
            </div>
          )}

          {/* Hazır soru seti bilgi kutusu */}
          {talep.hazir_soru_seti && talep.hazir_soru_seti_verisi && (
            <div className="px-4 md:px-5 py-3 border-b border-gray-100 bg-blue-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="text-xs text-blue-800 leading-relaxed">
                    {isPM && "Bu talep için soru setinizi yüklediniz. Senaryo ve video içerik üreticiniz tarafından oluşturulacaktır."}
                    {isIU && `Üretici bu talep için hazır soru seti yüklemiştir. ${talep.hazir_soru_seti_verisi.length} soru mevcut — video yüklemesiyle birlikte sistem otomatik işler.`}
                  </span>
                </div>
                <button
                  onClick={() => setSoruSetiAcik(prev => !prev)}
                  className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-white text-blue-700 cursor-pointer whitespace-nowrap"
                  style={{ fontFamily: "'Nunito', sans-serif" }}>
                  {soruSetiAcik ? "Gizle" : "Soruları Gör"}
                </button>
              </div>

              {/* Soru önizleme */}
              {soruSetiAcik && (
                <div className="mt-3 max-h-72 overflow-auto flex flex-col gap-2">
                  {talep.hazir_soru_seti_verisi.map((soru: any, i: number) => (
                    <div key={i} className="px-3 py-2.5 bg-white rounded-lg border border-blue-100">
                      <p className="text-xs text-gray-700 font-semibold m-0 mb-1.5">{i + 1}. {soru.soru_metni}</p>
                      <div className="flex flex-col gap-1">
                        {soru.secenekler?.map((s: any, j: number) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded-full inline-block w-fit"
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
            </div>
          )}

          {/* Açıklama + dosyalar */}
          <div className="px-4 md:px-5 py-4 border-b border-gray-100">
            {talep.aciklama && (
              <p className="text-sm text-gray-700 leading-relaxed mb-3">{talep.aciklama}</p>
            )}
            {(talep.dosya_urls?.length ?? 0) > 0 && (
              <div className="mb-2.5">
                <DosyaGoruntuleListesi
                  dosyalar={(talep.dosya_urls ?? []) as DosyaItem[]}
                  onHata={hata}
                  sagAksiyon={(dosya) => isPM && (
                    siliniyor === dosya.url ? (
                      <span className="text-xs text-gray-400 ml-0.5">...</span>
                    ) : (
                      <svg onClick={() => handleDosyaSil(dosya.url)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="cursor-pointer flex-shrink-0 ml-0.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    )
                  )}
                />
              </div>
            )}
          </div>

          {/* Üretici — video yükleme (A4: dosya seç + doğrudan Bunny; form yüklemesi yarım kaldıysa ya da red sonrası) */}
          {isUretici && talep.hazir_video && !talep.hazir_video_url && (
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-900 mb-2.5">Hazır Video Yükleme</div>
              <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 cursor-pointer mb-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="font-semibold">{seciliVideoDosya ? seciliVideoDosya.name : "Video dosyası seç"}</span>
                <input
                  type="file" accept="video/*" className="hidden"
                  onChange={(e) => setSeciliVideoDosya(e.target.files?.[0] ?? null)}
                />
              </label>
              {yuklemeYuzdesi !== null && (
                <div className="mb-2.5">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${yuklemeYuzdesi}%`, background: "#56aeff" }} />
                  </div>
                  <p className="text-xs text-gray-500 m-0 mt-1">Bunny'ye yükleniyor... %{yuklemeYuzdesi}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleHazirVideoYukle} disabled={!seciliVideoDosya || videoYukleniyor}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#56aeff", opacity: !seciliVideoDosya || videoYukleniyor ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {videoYukleniyor ? (yuklemeYuzdesi !== null ? `Yükleniyor... %${yuklemeYuzdesi}` : "Gönderiliyor...") : "Bunny'ye Yükle"}
                </button>
              </div>
            </div>
          )}

          {/* Üretici — video önizleme ve onay */}
          {isPM && talep.hazir_video && talep.hazir_video_url && (
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-900 mb-2.5">Video Önizleme</div>
              {/* A3/A4: encode rozeti — mavi = hazırlanıyor dili, kırmızı = dürüst hata */}
              {bunnyIslemeDurumu === "isleniyor" && (
                <div className="mb-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-800 m-0">
                    Video işleniyor — kapak ve izleme kısa süre içinde hazır olur. Sayfayı daha sonra yenileyin.
                  </p>
                </div>
              )}
              {bunnyIslemeDurumu === "hatali" && (
                <div className="mb-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-red-700 m-0">
                    Video işlenemedi — dosya bozuk olabilir. Yeni video yükleyebilirsiniz.
                  </p>
                  {isUretici && (
                    <button onClick={handleYenidenYukle}
                      className="flex-shrink-0 bg-white text-red-700 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                      style={{ border: "0.5px solid #fecaca", fontFamily: "'Nunito', sans-serif" }}>
                      Yeni Video Yükle
                    </button>
                  )}
                </div>
              )}
              <VideoOnizleme
                videoUrl={talep.hazir_video_url}
                className="rounded-lg border border-gray-200"
                ariaLabel="Hazır videoyu oynat"
              />
            </div>
          )}

          {/* Aksiyon butonları */}
          <div className="px-4 md:px-5 py-4 flex justify-end gap-2 flex-wrap">
            {isIU && !talep.hazir_video && (
              <button onClick={() => router.push(`/senaryolar/${talep_id}`)}
                className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
                Senaryo Yaz
              </button>
            )}
            {/* V1-5 (İskender talimatı, 21.07): İU'nun "Soru Seti Yaz" butonu kaldırıldı —
                İU bu sayfaya hazır video talebi için ulaşamaz; iş Soru Setleri'nde yaşar. */}
            {/* F-2: "Senaryolar" butonu kaldırıldı — PM senaryo takibini
                Navbar'daki Senaryolar sekmesi + badge ile yapar. */}
            {isPM && !isUretici && talep.hazir_video && !talep.hazir_video_url && (
              <button disabled className="bg-gray-100 text-gray-400 border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-not-allowed"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Video Yükleme Bekleniyor...
              </button>
            )}
            {/* V1-6 (İskender kararı, 21.07): PM'in kendi yüklediği videoyu ikinci kez
                onayladığı Onayla/Reddet adımı kaldırıldı — zincir yükleme anında kurulur. */}
          </div>
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
