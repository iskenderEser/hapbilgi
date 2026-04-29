// app/talepler/[talep_id]/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Talep {
  talep_id: string;
  pm_id: string;
  urun_adi: string;
  teknik_adi: string;
  aciklama: string;
  created_at: string;
  dosya_urls: DosyaItem[];
  hazir_video: boolean;
  hazir_video_url: string | null;
}

interface DosyaItem {
  dosya_adi: string;
  url: string;
  boyut: number;
  yuklenme_tarihi: string;
}

const DESTEKLENEN_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4,.mov,.avi,.mkv,.webm";

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

const goruntuleUrl = (dosya: DosyaItem): string => {
  const ext = dosya.dosya_adi.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "txt", "png", "jpg", "jpeg", "mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return dosya.url;
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(dosya.url)}`;
};

export default function TalepDetayPage() {
  const router = useRouter();
  const params = useParams();
  const talep_id = params.talep_id as string;

  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [talep, setTalep] = useState<Talep | null>(null);
  const [loading, setLoading] = useState(true);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);
  const [hazirVideoUrl, setHazirVideoUrl] = useState("");
  const [urlKaydediliyor, setUrlKaydediliyor] = useState(false);
  const [kararLoading, setKararLoading] = useState<"onayla" | "reddet" | null>(null);
  const dosyaInputRef = useRef<HTMLInputElement>(null);
  const { mesajlar, hata, basari } = useHataMesaji();

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

  useEffect(() => {
    if (!user || !talep_id) return;
    const supabase = createClient();
    supabase
      .from("talepler")
      .select(`talep_id, pm_id, aciklama, created_at, dosya_urls, hazir_video, hazir_video_url, urun_id, teknik_id, urunler(urun_adi), teknikler(teknik_adi)`)
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
        });
        setLoading(false);
      });
  }, [user, talep_id]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleDosyaSec = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosyalar = Array.from(e.target.files ?? []);
    if (dosyalar.length === 0) return;
    setDosyaYukleniyor(true);
    const supabase = createClient();
    for (const dosya of dosyalar) {
      const dosyaYolu = `${talep_id}/${Date.now()}_${dosya.name}`;
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

  const handleHazirVideoUrlKaydet = async () => {
    if (!hazirVideoUrl.trim()) return;
    setUrlKaydediliyor(true);
    const res = await fetch("/talepler/api/hazir-video", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ talep_id, hazir_video_url: hazirVideoUrl.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "URL kaydedilemedi.", d.adim, d.detay); }
    else { setTalep(prev => prev ? { ...prev, hazir_video_url: hazirVideoUrl.trim() } : prev); basari("Video URL kaydedildi. PM onayı bekleniyor."); }
    setUrlKaydediliyor(false);
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
      if (karar === "onayla") basari("Video onaylandı. Soru seti yazım süreci başlayabilir.");
      else { basari("Video reddedildi. IU yeni URL girebilir."); setTalep(prev => prev ? { ...prev, hazir_video_url: null } : prev); }
    }
    setKararLoading(null);
  };

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

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

  if (!talep) return null;

  const DosyaChip = ({ dosya }: { dosya: DosyaItem }) => {
    const { etiket, bg, renk } = dosyaTipiRenk(dosya.dosya_adi);
    return (
      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5">
        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: renk }}>{etiket}</span>
        </div>
        <span className="text-xs text-gray-700 max-w-28 truncate">{dosya.dosya_adi}</span>
        <span onClick={() => window.open(goruntuleUrl(dosya), "_blank")}
          className="text-xs font-semibold cursor-pointer ml-0.5 whitespace-nowrap" style={{ color: "#56aeff" }}>
          Görüntüle
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
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

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
                  {isPM && !talep.hazir_video_url && "PM tarafından hazır video talebi oluşturulmuştur. IU videoyu Bunny.net'e yükleyip URL iletecektir."}
                  {isPM && talep.hazir_video_url && "IU videoyu Bunny.net'e yükledi. Lütfen videoyu izleyerek onaylayın."}
                  {isIU && !talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. PM hazır videoyu talebe eklemiştir. Videoyu Bunny.net'e yükleyip URL'i giriniz.</span>}
                  {isIU && talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. Video URL kaydedildi, PM onayı bekleniyor.</span>}
                </span>
              </div>
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

          {/* IU — Bunny.net URL girişi */}
          {isIU && talep.hazir_video && (
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-900 mb-2.5">Bunny.net Video URL</div>
              {!talep.hazir_video_url ? (
                <>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      value={hazirVideoUrl}
                      onChange={(e) => setHazirVideoUrl(e.target.value)}
                      placeholder="https://iframe.mediadelivery.net/embed/..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none"
                      style={{ fontFamily: "'Nunito', sans-serif" }}
                    />
                    <button onClick={handleHazirVideoUrlKaydet} disabled={!hazirVideoUrl.trim() || urlKaydediliyor}
                      className="text-white border-none rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      style={{ background: "#56aeff", opacity: !hazirVideoUrl.trim() || urlKaydediliyor ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                      {urlKaydediliyor ? "..." : "URL Kaydet"}
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">Videoyu Bunny.net'e yükledikten sonra embed URL'ini buraya girin.</div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">PM onayı bekleniyor...</span>
                </div>
              )}
            </div>
          )}

          {/* PM — Video önizleme ve onay */}
          {isPM && talep.hazir_video && talep.hazir_video_url && (
            <div className="px-4 md:px-5 py-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-900 mb-2.5">Video Önizleme</div>
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
            {isIU && talep.hazir_video && (
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
            {isPM && talep.hazir_video && !talep.hazir_video_url && (
              <button disabled className="bg-gray-100 text-gray-400 border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-not-allowed"
                style={{ fontFamily: "'Nunito', sans-serif" }}>
                IU URL Bekliyor...
              </button>
            )}
            {isPM && talep.hazir_video && talep.hazir_video_url && (
              <>
                <button onClick={() => handleHazirVideoKarar("reddet")} disabled={kararLoading !== null}
                  className="bg-transparent rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ color: "#bc2d0d", border: "0.5px solid #fecaca", opacity: kararLoading !== null ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                  {kararLoading === "reddet" ? "..." : "Reddet"}
                </button>
                <button onClick={() => handleHazirVideoKarar("onayla")} disabled={kararLoading !== null}
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