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
  if (["mp4", "mov", "webm"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  if (["avi", "mkv"].includes(ext)) return { etiket: "VID", bg: "#f0fdf4", renk: "#16a34a" };
  return { etiket: ext.toUpperCase(), bg: "#f9fafb", renk: "#737373" };
};

const goruntuleUrl = (dosya: DosyaItem): string => {
  const ext = dosya.dosya_adi.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "txt", "png", "jpg", "jpeg"].includes(ext)) return dosya.url;
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return dosya.url;
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
      .select(`
        talep_id, pm_id, aciklama, created_at, dosya_urls, hazir_video, hazir_video_url,
        urun_id, teknik_id,
        urunler(urun_adi),
        teknikler(teknik_adi)
      `)
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
      const { error: uploadError } = await supabase.storage
        .from("talep-dosyalari")
        .upload(dosyaYolu, dosya);

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

  const handleGoruntule = (dosya: DosyaItem) => {
    window.open(goruntuleUrl(dosya), "_blank");
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
    else {
      setTalep(prev => prev ? { ...prev, hazir_video_url: hazirVideoUrl.trim() } : prev);
      basari("Video URL kaydedildi. PM onayı bekleniyor.");
    }
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
      else {
        basari("Video reddedildi. IU yeni URL girebilir.");
        setTalep(prev => prev ? { ...prev, hazir_video_url: null } : prev);
      }
    }
    setKararLoading(null);
  };

  const rolKucu = rol.toLowerCase();
  const isPM = ["pm", "jr_pm", "kd_pm"].includes(rolKucu);
  const isIU = rolKucu === "iu";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
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
      <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "20px", padding: "4px 10px 4px 8px" }}>
        <div style={{ width: "18px", height: "18px", background: bg, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: "7px", fontWeight: 700, color: renk }}>{etiket}</span>
        </div>
        <span style={{ fontSize: "11px", color: "#374151", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dosya.dosya_adi}</span>
        <span onClick={() => handleGoruntule(dosya)} style={{ fontSize: "10px", color: "#56aeff", fontWeight: 600, cursor: "pointer", marginLeft: "2px", whiteSpace: "nowrap" }}>Görüntüle</span>
        {isPM && (
          siliniyor === dosya.url ? (
            <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "2px" }}>...</span>
          ) : (
            <svg onClick={() => handleDosyaSil(dosya.url)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ cursor: "pointer", flexShrink: 0, marginLeft: "2px" }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          )
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <button onClick={() => router.push("/talepler")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "13px", padding: 0, width: "fit-content" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M15 19l-7-7 7-7"/></svg>
          Talepler
        </button>

        <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          {/* Başlık */}
          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: 600, color: "#111" }}>{talep.urun_adi}</span>
                {talep.hazir_video && (
                  <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "20px", background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa" }}>Hazır Video</span>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#737373" }}>{talep.teknik_adi}</span>
            </div>
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{formatTarih(talep.created_at)}</span>
          </div>

          {/* Hazır video uyarı kutusu */}
          {talep.hazir_video && (
            <div style={{ padding: "12px 20px", borderBottom: "0.5px solid #e5e7eb", background: "#fffbeb" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: "1px" }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{ fontSize: "11px", color: "#92400e", lineHeight: 1.6 }}>
                  {isPM && !talep.hazir_video_url && "PM tarafından hazır video talebi oluşturulmuştur. IU videoyu Bunny.net'e yükleyip URL iletecektir."}
                  {isPM && talep.hazir_video_url && "IU videoyu Bunny.net'e yükledi. Lütfen videoyu izleyerek onaylayın."}
                  {isIU && !talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. PM hazır videoyu talebe eklemiştir. Videoyu Bunny.net'e yükleyip URL'i giriniz.</span>}
                  {isIU && talep.hazir_video_url && <span>Bu talep için <strong>senaryo aşaması atlanmıştır</strong>. Video URL kaydedildi, PM onayı bekleniyor.</span>}
                </span>
              </div>
            </div>
          )}

          {/* Açıklama + dosyalar */}
          <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
            {talep.aciklama && (
              <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, margin: "0 0 12px 0" }}>{talep.aciklama}</p>
            )}
            {(talep.dosya_urls.length > 0 || isPM) && (
              <div>
                {talep.dosya_urls.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: isPM ? "10px" : "0" }}>
                    {talep.dosya_urls.map((dosya, i) => (
                      <DosyaChip key={i} dosya={dosya} />
                    ))}
                  </div>
                )}
                {isPM && (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "white", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "5px 10px", fontSize: "11px", fontWeight: 600, color: "#374151", cursor: dosyaYukleniyor ? "wait" : "pointer", opacity: dosyaYukleniyor ? 0.6 : 1 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {dosyaYukleniyor ? "Yükleniyor..." : "Dosya Ekle"}
                    <input ref={dosyaInputRef} type="file" multiple accept={DESTEKLENEN_FORMATLAR} onChange={handleDosyaSec} disabled={dosyaYukleniyor} style={{ display: "none" }} />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* IU — Bunny.net URL girişi */}
          {isIU && talep.hazir_video && (
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#111", marginBottom: "10px" }}>Bunny.net Video URL</div>
              {!talep.hazir_video_url ? (
                <>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input value={hazirVideoUrl} onChange={(e) => setHazirVideoUrl(e.target.value)} placeholder="https://iframe.mediadelivery.net/embed/..." style={{ flex: 1, border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", outline: "none" }} />
                    <button onClick={handleHazirVideoUrlKaydet} disabled={!hazirVideoUrl.trim() || urlKaydediliyor} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: !hazirVideoUrl.trim() || urlKaydediliyor ? 0.6 : 1, whiteSpace: "nowrap" }}>
                      {urlKaydediliyor ? "..." : "URL Kaydet"}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>Videoyu Bunny.net'e yükledikten sonra embed URL'ini buraya girin.</div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: "#737373" }}>PM onayı bekleniyor...</span>
                </div>
              )}
            </div>
          )}

          {/* PM — Video önizleme ve onay */}
          {isPM && talep.hazir_video && talep.hazir_video_url && (
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid #e5e7eb" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#111", marginBottom: "10px" }}>Video Önizleme</div>
              <iframe src={talep.hazir_video_url} width="100%" height="360" frameBorder="0" allowFullScreen style={{ borderRadius: "8px", border: "0.5px solid #e5e7eb" }} />
            </div>
          )}

          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            {isIU && !talep.hazir_video && (
              <button onClick={() => router.push(`/senaryolar/${talep_id}`)} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Senaryo Yaz
              </button>
            )}
            {isIU && talep.hazir_video && (
              <button disabled style={{ background: "#f3f4f6", color: "#9ca3af", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
                Soru Seti Yaz
              </button>
            )}
            {isPM && !talep.hazir_video && (
              <button onClick={() => router.push(`/senaryolar/${talep_id}`)} style={{ background: "#56aeff", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                Senaryolar
              </button>
            )}
            {isPM && talep.hazir_video && !talep.hazir_video_url && (
              <button disabled style={{ background: "#f3f4f6", color: "#9ca3af", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
                IU URL Bekliyor...
              </button>
            )}
            {isPM && talep.hazir_video && talep.hazir_video_url && (
              <>
                <button onClick={() => handleHazirVideoKarar("reddet")} disabled={kararLoading !== null} style={{ background: "transparent", color: "#bc2d0d", border: "0.5px solid #fecaca", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: kararLoading !== null ? 0.6 : 1 }}>
                  {kararLoading === "reddet" ? "..." : "Reddet"}
                </button>
                <button onClick={() => handleHazirVideoKarar("onayla")} disabled={kararLoading !== null} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif", opacity: kararLoading !== null ? 0.6 : 1 }}>
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