// app/talepler/[talep_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { URETICI_ROLLER, URETIM_HATTI_GORENLER } from "@/lib/utils/roller";
import { guvenliDosyaAdi } from "@/lib/utils/guvenliDosyaAdi";
import { HedefRolBant } from "@/components/HedefRolBant";
import { useAuth } from "@/app/providers/AuthProvider";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";
import { useBunnyIslemeDurumu } from "@/hooks/useBunnyIslemeDurumu";

interface Talep {
  talep_id: string;
  uretici_id: string;
  hedef_rol: "utt" | "bm";
  urun_adi: string;
  teknik_adi: string;
  aciklama: string;
  created_at: string;
  dosya_urls: DosyaItem[];
  hazir_video: boolean;
  hazir_video_url: string | null;
  hazir_soru_seti: boolean;
  hazir_soru_seti_verisi: any[] | null;
}

interface DosyaItem {
  dosya_adi: string;
  url: string;
  boyut: number;
  yuklenme_tarihi: string;
}

const DESTEKLENEN_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4,.mov,.avi,.mkv,.webm";
const OFFICE_FORMATLAR = ["docx", "doc", "pptx", "ppt", "xlsx", "xls"];

const dosyaTipiRenk = (dosya_adi: string): { etiket: string; bg: string; renk: string } => {
  const ext = dosya_adi.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { etiket: "PDF", bg: "#fef2f2", renk: "#bc2d0d" };
  if (["docx", "doc"].includes(ext)) return { etiket: "DOC", bg: "#eff6ff", renk: "#1d4ed8" };
  if (["pptx", "ppt"].includes(ext)) return { etiket: "PPT", bg: "#fff7ed", renk: "#c2410c" };
  if (["xlsx", "xls"].includes(ext)) return { etiket: "XLS", bg: "#f0fdf4", renk: "#15803d" };
  if (ext === "txt") return { etiket: "TXT", bg: "#f9fafb", renk: "#374151" };
  if (["png", "jpg", "jpeg"].includes(ext)) return { etiket: "IMG", bg: "#fdf4ff", renk: "#7e22ce" };
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  return { etiket: ext.toUpperCase(), bg: "#f9fafb", renk: "#737373" };
};

export default function TalepDetayPage() {
  const router = useRouter();
  const params = useParams();
  const talep_id = params.talep_id as string;

  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [talep, setTalep] = useState<Talep | null>(null);
  const [loading, setLoading] = useState(true);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);
  const [goruntuleniyorUrl, setGoruntuleniyorUrl] = useState<string | null>(null);
  // A4 — hazır videoyu üretici buradan da yükleyebilir (form yüklemesi yarım kaldıysa ya da red sonrası).
  const [seciliVideoDosya, setSeciliVideoDosya] = useState<File | null>(null);
  const [videoYukleniyor, setVideoYukleniyor] = useState(false);
  const [yuklemeYuzdesi, setYuklemeYuzdesi] = useState<number | null>(null);
  const [kararLoading, setKararLoading] = useState<"onayla" | "reddet" | null>(null);
  const [soruSetiAcik, setSoruSetiAcik] = useState(false);
  const dosyaInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!kullanici || !talep_id) return;
    const supabase = createClient();
    supabase
      .from("talepler")
      .select(`talep_id, uretici_id, hedef_rol, aciklama, created_at, dosya_urls, hazir_video, hazir_video_url, hazir_soru_seti, hazir_soru_seti_verisi, urun_id, teknik_id, urunler(urun_adi), teknikler(teknik_adi)`)
      .eq("talep_id", talep_id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          hata("Talep bulunamadı veya erişim yetkiniz yok.", "talepler tablosu SELECT — talep_id");
          router.push("/talepler");
          return;
        }
        setTalep({
          ...data,
          urun_adi: (data as any).urunler?.urun_adi ?? "-",
          teknik_adi: (data as any).teknikler?.teknik_adi ?? "-",
          dosya_urls: data.dosya_urls ?? [],
          hazir_soru_seti: data.hazir_soru_seti ?? false,
          hazir_soru_seti_verisi: data.hazir_soru_seti_verisi ?? null,
        });
        setLoading(false);
      });
  }, [kullanici, talep_id]);

  // Video modernizasyonu (20.07.2026): tek seferlik kontrol yerine sınırlı süreli
  // tekrar-sorgu — PM ekranı sayfayı yenilemeden de "hazır"a geçişi görür.
  const bunnyIslemeDurumu = useBunnyIslemeDurumu(talep?.hazir_video_url, { talep_id });

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleGoruntule = async (dosya: DosyaItem) => {
    // URL'den storage yolunu çıkar: ".../talep-dosyalari/<yol>" → "<yol>"
    const dosyaYolu = dosya.url.split("/talep-dosyalari/")[1];
    if (!dosyaYolu) { hata("Dosya yolu çözümlenemedi.", "url parse", undefined); return; }

    setGoruntuleniyorUrl(dosya.url);
    const res = await fetch(`/talepler/api/dosyalar?yol=${encodeURIComponent(dosyaYolu)}`);
    const d = await res.json();
    setGoruntuleniyorUrl(null);

    if (!res.ok) { hata(d.hata ?? "Dosya görüntülenemedi.", d.adim, d.detay); return; }

    const ext = dosya.dosya_adi.split(".").pop()?.toLowerCase() ?? "";
    const acilacakUrl = OFFICE_FORMATLAR.includes(ext)
      ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(d.signed_url)}`
      : d.signed_url;

    window.open(acilacakUrl, "_blank");
  };

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosyalar = Array.from(e.target.files ?? []);
    if (dosyalar.length === 0) return;
    setDosyaYukleniyor(true);
    const supabase = createClient();
    for (const dosya of dosyalar) {
      const dosyaYolu = `${talep_id}/${Date.now()}_${guvenliDosyaAdi(dosya.name)}`;
      const { error: uploadError } = await supabase.storage.from("talep-dosyalari").upload(dosyaYolu, dosya);
      if (uploadError) { hata(`${dosya.name} yüklenemedi.`, "storage upload", uploadError.message); continue; }
      const { data: urlData } = supabase.storage.from("talep-dosyalari").getPublicUrl(dosyaYolu);
      const res = await fetch("/talepler/api/dosyalar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ talep_id, dosya_adi: dosya.name, url: urlData.publicUrl, boyut: dosya.size }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Dosya kaydedilemedi.", d.adim, d.detay); continue; }
      setTalep(prev => prev ? { ...prev, dosya_urls: d.dosyalar } : prev);
      basari(`${dosya.name} yüklendi.`);
    }
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
    setDosyaYukleniyor(false);
  };

  const handleDosyaSil = async (url: string) => {
    setSiliniyor(url);
    const res = await fetch("/talepler/api/dosyalar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, url }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Dosya silinemedi.", d.adim, d.detay); }
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
    else { setTalep(prev => prev ? { ...prev, hazir_video_url: d.embed_url } : prev); basari("Video yüklendi."); }
    setSeciliVideoDosya(null);
    setVideoYukleniyor(false);
    setYuklemeYuzdesi(null);
  };

  const handleHazirVideoKarar = async (karar: "onayla" | "reddet") => {
    setKararLoading(karar);
    const res = await fetch("/talepler/api/hazir-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, karar }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else {
      // Onay mesajı sunucudan gelir — hazır soru seti otomatik işlendiyse bunu söyler.
      if (karar === "onayla") basari(d.mesaj ?? "Video onaylandı.");
      else { basari("Video reddedildi. Yeni video yükleyebilirsiniz."); setTalep(prev => prev ? { ...prev, hazir_video_url: null } : prev); }
    }
    setKararLoading(null);
  };

  const rolKucu = (kullanici?.rol ?? "").toLowerCase();
  const isPM = URETICI_ROLLER.includes(rolKucu);
  const isIU = rolKucu === "iu";

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

  if (!talep) return null;

  // A4: hazır videoyu yalnız talebin üreticisi yükler (vezne de sunucuda aynı şartı arar).
  const isUretici = isPM && talep.uretici_id === kullanici.id;

  const DosyaChip = ({ dosya }: { dosya: DosyaItem }) => {
    const { etiket, bg, renk } = dosyaTipiRenk(dosya.dosya_adi);
    const isGoruntuleniyor = goruntuleniyorUrl === dosya.url;
    return (
      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5">
        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: renk }}>{etiket}</span>
        </div>
        <span className="text-xs text-gray-700 max-w-28 truncate">{dosya.dosya_adi}</span>
        <span onClick={() => !isGoruntuleniyor && handleGoruntule(dosya)}
          className="text-xs font-semibold cursor-pointer ml-0.5 whitespace-nowrap"
          style={{ color: "#56aeff", opacity: isGoruntuleniyor ? 0.5 : 1 }}>
          {isGoruntuleniyor ? "..." : "Görüntüle"}
        </span>
        {isPM && (
          siliniyor === dosya.url ? (
            <span className="text-xs text-gray-400 ml-0.5">...</span>
          ) : (
            <svg onClick={() => handleDosyaSil(dosya.url)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="cursor-pointer flex-shrink-0 ml-0.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          )
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
      <HedefRolBant hedefRol={talep.hedef_rol} />

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
                  <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa" }}>
                    Hazır Video
                  </span>
                )}
                {talep.hazir_soru_seti && (
                  <span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: 9, background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                    Hazır Soru Seti
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">{talep.teknik_adi}</span>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatTarih(talep.created_at)}</span>
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
                  {isPM && talep.hazir_video_url && "Hazır video yüklendi. Lütfen videoyu izleyerek onaylayın."}
                  {isIU && !talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. Üretici hazır videoyu doğrudan Bunny'ye yükleyecektir; onay sonrasında soru seti aşaması başlar.</span>}
                  {isIU && talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. Video yüklendi, üretici onayı bekleniyor.</span>}
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
                    {isPM && `Bu talep için hazır soru seti yüklenmiştir. ${talep.hazir_soru_seti_verisi.length} soru mevcut — video onaylandığında sistem seti otomatik işler.`}
                    {isIU && `Üretici bu talep için hazır soru seti yüklemiştir. ${talep.hazir_soru_seti_verisi.length} soru mevcut — video onayıyla birlikte sistem otomatik işler.`}
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
                          <span key={j} className="text-xs px-2 py-0.5 rounded-full inline-block w-fit"
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
            {(talep.dosya_urls.length > 0 || isPM) && (
              <div>
                {talep.dosya_urls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {talep.dosya_urls.map((dosya, i) => <DosyaChip key={i} dosya={dosya} />)}
                  </div>
                )}
                {isPM && (
                  <label className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer"
                    style={{ opacity: dosyaYukleniyor ? 0.6 : 1, cursor: dosyaYukleniyor ? "wait" : "pointer" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    {dosyaYukleniyor ? "Yükleniyor..." : "Dosya Ekle"}
                    <input ref={dosyaInputRef} type="file" multiple accept={DESTEKLENEN_FORMATLAR} onChange={handleDosyaSec} disabled={dosyaYukleniyor} className="hidden" />
                  </label>
                )}
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
                <div className="mb-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-700 m-0">
                    Video işlenemedi — dosya bozuk olabilir. Reddedip yeniden yükleyebilirsiniz.
                  </p>
                </div>
              )}
              <iframe src={talep.hazir_video_url} width="100%" height="360" frameBorder="0" allowFullScreen
                className="rounded-lg border border-gray-200" />
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
            {/* Hazır soru seti IU'suz işlenir (lib/hazirVideoSoruSeti): video onayı seti
                otomatik yazar ve onaylar — eski "Soru Setini Sisteme İşle" adımı kalktı. */}
            {isIU && talep.hazir_video && !talep.hazir_soru_seti && (
              <button disabled className="bg-gray-100 text-gray-400 border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-not-allowed"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Soru Seti Yaz
              </button>
            )}
            {isPM && !talep.hazir_video && (
              <button onClick={() => router.push(`/senaryolar/${talep_id}`)}
                className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}>
                Senaryolar
              </button>
            )}
            {isPM && !isUretici && talep.hazir_video && !talep.hazir_video_url && (
              <button disabled className="bg-gray-100 text-gray-400 border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-not-allowed"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                Video Yükleme Bekleniyor...
              </button>
            )}
            {isPM && talep.hazir_video && talep.hazir_video_url && (
              <>
                <button onClick={() => handleHazirVideoKarar("reddet")} disabled={kararLoading !== null}
                  className="bg-transparent rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ color: "#bc2d0d", border: "0.5px solid #fecaca", opacity: kararLoading !== null ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {kararLoading === "reddet" ? "..." : "Reddet"}
                </button>
                <button onClick={() => handleHazirVideoKarar("onayla") } disabled={kararLoading !== null}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer bg-green-700"
                  style={{ opacity: kararLoading !== null ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {kararLoading === "onayla" ? "..." : "Onayla"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}