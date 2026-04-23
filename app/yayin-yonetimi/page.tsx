// app/yayin-yonetimi/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

interface Bekleyen {
  soru_seti_durum_id: string;
  soru_seti_id: string;
  video_durum_id: string;
  sorular: any[];
  video_url: string | null;
  thumbnail_url: string | null;
  video_puan_id: string | null;
  video_puani: number | null;
  soru_puan_map: Record<number, { soru_seti_puan_id: string; soru_puani: number }>;
  urun_adi: string;
  teknik_adi: string;
  onay_tarihi: string;
}

interface Yayin {
  yayin_id: string;
  soru_seti_durum_id: string;
  durum: string;
  yayin_tarihi: string;
  durdurma_tarihi: string | null;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number | null;
  soru_puani: number | null;
  sorular: any[];
  ileri_sarma_acik: boolean;
}

const VIDEO_PUAN_SECENEKLERI = [40, 45, 50, 55, 60, 65, 70];
const SORU_PUAN_SECENEKLERI = [3, 4, 5, 6, 7];

export default function YayinYonetimiPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [aktifSekme, setAktifSekme] = useState<"bekleyen" | "yayinda" | "durdurulan">("bekleyen");
  const [bekleyenler, setBekleyenler] = useState<Bekleyen[]>([]);
  const [yayinlar, setYayinlar] = useState<Yayin[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemLoading, setIslemLoading] = useState<string | null>(null);
  const [acikAkordiyon, setAcikAkordiyon] = useState<string | null>(null);
  const [acikVideo, setAcikVideo] = useState<string | null>(null);
  const [onayModal, setOnayModal] = useState<Bekleyen | null>(null);
  const [ileriSarmaOnayModal, setIleriSarmaOnayModal] = useState<{ soru_seti_durum_id: string; urun_adi: string } | null>(null);
  const [videoPuanlari, setVideoPuanlari] = useState<Record<string, number>>({});
  const [soruPuanlari, setSoruPuanlari] = useState<Record<string, Record<number, number>>>({});
  const [bekleyenIleriSarma, setBekleyenIleriSarma] = useState<Record<string, boolean>>({});
  const [ileriSarmaAcik, setIleriSarmaAcik] = useState<Record<string, boolean>>({});
  const [extraPuanlar, setExtraPuanlar] = useState<Record<string, number>>({});
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

  const veriCek = async () => {
    setLoading(true);
    const supabase = createClient();

    const bRes = await fetch("/yayin-yonetimi/api/bekleyenler");
    const bData = await bRes.json();
    if (!bRes.ok) {
      hata(bData.hata ?? "Bekleyenler yüklenemedi.", bData.adim, bData.detay);
    } else {
      const bekleyenlerData = bData.bekleyenler ?? [];
      setBekleyenler(bekleyenlerData);
      const yeniSoruPuanlari: Record<string, Record<number, number>> = {};
      for (const b of bekleyenlerData) {
        yeniSoruPuanlari[b.soru_seti_durum_id] = {};
        for (const [idx, puan] of Object.entries(b.soru_puan_map ?? {})) {
          yeniSoruPuanlari[b.soru_seti_durum_id][Number(idx)] = (puan as any).soru_puani;
        }
      }
      setSoruPuanlari(yeniSoruPuanlari);
    }

    const { data: yayinlarData, error: yayinError } = await supabase
      .from("v_yayin_detay")
      .select("yayin_id, soru_seti_durum_id, durum, yayin_tarihi, durdurma_tarihi, urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_puani, sorular")
      .order("yayin_tarihi", { ascending: false });

    if (yayinError) {
      hata("Yayınlar yüklenemedi.", "v_yayin_detay view SELECT", yayinError.message);
      setLoading(false);
      return;
    }

    // ileri_sarma_acik bilgisini yayin_yonetimi tablosundan çek
    if ((yayinlarData ?? []).length > 0) {
      const { data: yayinBilgileri } = await supabase
        .from("yayin_yonetimi")
        .select("yayin_id, ileri_sarma_acik")
        .in("yayin_id", yayinlarData!.map(y => y.yayin_id));

      const ileriSarmaMap: Record<string, boolean> = {};
      for (const yb of yayinBilgileri ?? []) {
        ileriSarmaMap[yb.yayin_id] = yb.ileri_sarma_acik ?? false;
      }
      setIleriSarmaAcik(ileriSarmaMap);

      const yayinlarWithIleriSarma = (yayinlarData ?? []).map(y => ({
        ...y,
        ileri_sarma_acik: ileriSarmaMap[y.yayin_id] ?? false,
      }));
      setYayinlar(yayinlarWithIleriSarma);
    } else {
      setYayinlar([]);
    }

    if ((yayinlarData ?? []).length > 0) {
      const { data: tumSoruPuanlari, error: spError } = await supabase
        .from("soru_seti_puanlari")
        .select("soru_seti_durum_id, soru_index, soru_puani")
        .in("soru_seti_durum_id", yayinlarData!.map(y => y.soru_seti_durum_id));

      if (!spError && tumSoruPuanlari) {
        setSoruPuanlari(prev => {
          const guncellenen = { ...prev };
          for (const sp of tumSoruPuanlari) {
            if (!guncellenen[sp.soru_seti_durum_id]) {
              guncellenen[sp.soru_seti_durum_id] = {};
            }
            guncellenen[sp.soru_seti_durum_id][sp.soru_index] = sp.soru_puani;
          }
          return guncellenen;
        });
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) veriCek();
  }, [user]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const getSoruPuani = (soru_seti_durum_id: string, soru_index: number): number | "" => {
    return soruPuanlari[soru_seti_durum_id]?.[soru_index] ?? "";
  };

  const setSoruPuani = (soru_seti_durum_id: string, soru_index: number, puan: number) => {
    setSoruPuanlari(prev => ({
      ...prev,
      [soru_seti_durum_id]: { ...(prev[soru_seti_durum_id] ?? {}), [soru_index]: puan }
    }));
  };

  const hepsineAyniPuanAta = (soru_seti_durum_id: string, sorular: any[], puan: number) => {
    const yeni: Record<number, number> = {};
    sorular.forEach((_, i) => { yeni[i] = puan; });
    setSoruPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: yeni }));
  };

  const tumPuanlarAtandiMi = (b: Bekleyen): boolean => {
    const vp = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani;
    if (!vp) return false;
    if (!extraPuanlar[b.soru_seti_durum_id]) return false;
    for (let i = 0; i < b.sorular.length; i++) {
      if (!soruPuanlari[b.soru_seti_durum_id]?.[i]) return false;
    }
    return true;
  };

  const handleBekleyenIleriSarmaToggle = (soru_seti_durum_id: string, urun_adi: string) => {
    const mevcutDurum = bekleyenIleriSarma[soru_seti_durum_id] ?? false;
    if (!mevcutDurum) {
      setIleriSarmaOnayModal({ soru_seti_durum_id, urun_adi });
    } else {
      setBekleyenIleriSarma(prev => ({ ...prev, [soru_seti_durum_id]: false }));
    }
  };

  const handleIleriSarmaOnaylaVeAc = (soru_seti_durum_id: string) => {
    setBekleyenIleriSarma(prev => ({ ...prev, [soru_seti_durum_id]: true }));
    setIleriSarmaOnayModal(null);
  };

  const handleIleriSarmaToggle = (yayin: Yayin) => {
    if (!yayin.ileri_sarma_acik) {
      setIleriSarmaOnayModal({
        soru_seti_durum_id: yayin.yayin_id,
        urun_adi: yayin.urun_adi,
      });
    } else {
      handleIleriSarmaGuncelle(yayin.yayin_id, false);
    }
  };

  const handleIleriSarmaGuncelle = async (yayin_id: string, ileri_sarma_acik: boolean) => {
    setIleriSarmaOnayModal(null);
    const res = await fetch("/yayin-yonetimi/api/ileri-sarma", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yayin_id, ileri_sarma_acik }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "İleri sarma ayarı güncellenemedi.", d.adim, d.detay);
    } else {
      setIleriSarmaAcik(prev => ({ ...prev, [yayin_id]: ileri_sarma_acik }));
      setYayinlar(prev => prev.map(y => y.yayin_id === yayin_id ? { ...y, ileri_sarma_acik } : y));
      basari(ileri_sarma_acik ? "İleri sarma açıldı." : "İleri sarma kapatıldı.");
    }
  };

  const handleYayinla = async () => {
    if (!onayModal) return;
    const b = onayModal;
    setOnayModal(null);
    setIslemLoading(b.soru_seti_durum_id);

    const vp = videoPuanlari[b.soru_seti_durum_id] ?? b.video_puani;
    if (vp) {
      const res = await fetch("/yayin-yonetimi/api/puan/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_durum_id: b.video_durum_id, video_puani: vp }),
      });
      if (!res.ok) { const d = await res.json(); hata(d.hata ?? "Video puanı kaydedilemedi.", d.adim, d.detay); setIslemLoading(null); return; }
    }

    const puanlar = b.sorular.map((_, i) => ({
      soru_index: i,
      soru_puani: soruPuanlari[b.soru_seti_durum_id]?.[i],
    })).filter(p => p.soru_puani);

    if (puanlar.length > 0) {
      const res = await fetch("/yayin-yonetimi/api/puan/sorular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soru_seti_durum_id: b.soru_seti_durum_id, puanlar }),
      });
      if (!res.ok) { const d = await res.json(); hata(d.hata ?? "Soru puanları kaydedilemedi.", d.adim, d.detay); setIslemLoading(null); return; }
    }

    const res = await fetch("/yayin-yonetimi/api/yayinlar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        soru_seti_durum_id: b.soru_seti_durum_id,
        ileri_sarma_acik: bekleyenIleriSarma[b.soru_seti_durum_id] ?? false,
        extra_puan: extraPuanlar[b.soru_seti_durum_id] ?? null,
      }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Yayına alınamadı.", d.adim, d.detay); }
    else { basari(`${b.urun_adi} yayına alındı.`); await veriCek(); }
    setIslemLoading(null);
  };

  const handleDurumDegistir = async (yayin_id: string, mevcutDurum: string) => {
    setIslemLoading(yayin_id);
    const res = await fetch(`/yayin-yonetimi/api/yayinlar/${yayin_id}`, { method: "PUT" });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay); }
    else { basari(mevcutDurum === "Yayinda" ? "Yayın durduruldu." : "Yayın yeniden başlatıldı."); await veriCek(); }
    setIslemLoading(null);
  };

  const yayindakiler = yayinlar.filter(y => y.durum === "Yayinda");
  const durdurulular = yayinlar.filter(y => y.durum === "Durduruldu");

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

  const SoruListesi = ({ sorular, soru_seti_durum_id, bekleyen }: { sorular: any[]; soru_seti_durum_id: string; bekleyen?: boolean }) => (
    <div style={{ borderTop: "0.5px solid #e5e7eb", padding: "14px 16px" }}>
      {bekleyen && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginBottom: "12px", padding: "8px 12px", background: "#f0f9ff", borderRadius: "8px", border: "0.5px solid #bfdbfe" }}>
          <span style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 600 }}>Her soru aynı</span>
          <select value="" onChange={(e) => { if (e.target.value) hepsineAyniPuanAta(soru_seti_durum_id, sorular, Number(e.target.value)); }} style={{ border: "0.5px solid #bfdbfe", borderRadius: "6px", padding: "5px 8px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#1d4ed8", background: "white", width: "90px" }}>
            <option value="">Seçiniz</option>
            {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {sorular.map((soru: any, i: number) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", border: "0.5px solid #e5e7eb", borderRadius: "8px", background: "#f9fafb" }}>
            <span style={{ fontSize: "11px", color: "#9ca3af", minWidth: "20px", paddingTop: "2px", flexShrink: 0 }}>{i + 1}.</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.5, marginBottom: "6px" }}>{soru.soru_metni}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {soru.secenekler?.map((s: any, j: number) => (
                  <span key={j} style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", border: s.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb", color: s.dogru ? "#56aeff" : "#737373", background: s.dogru ? "#e6f1fb" : "white", width: "fit-content" }}>
                    {s.harf}. {s.metin}
                  </span>
                ))}
              </div>
            </div>
            {bekleyen && (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>Puan</span>
                <select value={getSoruPuani(soru_seti_durum_id, i)} onChange={(e) => setSoruPuani(soru_seti_durum_id, i, Number(e.target.value))} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "4px 6px", fontSize: "11px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", width: "80px" }}>
                  <option value="">-</option>
                  {SORU_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
                </select>
              </div>
            )}
            {!bekleyen && (
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>Puan</span>
                <span style={{ fontSize: "12px", color: "#56aeff", fontWeight: 700 }}>{getSoruPuani(soru_seti_durum_id, i) || "-"}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const BekleyenIleriSarmaToggle = ({ soru_seti_durum_id, urun_adi }: { soru_seti_durum_id: string; urun_adi: string }) => {
    const acik = bekleyenIleriSarma[soru_seti_durum_id] ?? false;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: "#737373" }}>İleri sarma</span>
        <div
          onClick={() => handleBekleyenIleriSarmaToggle(soru_seti_durum_id, urun_adi)}
          style={{ width: "32px", height: "18px", borderRadius: "9px", background: acik ? "#56aeff" : "#e5e7eb", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
        >
          <div style={{ position: "absolute", top: "2px", left: acik ? "16px" : "2px", width: "14px", height: "14px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
        </div>
      </div>
    );
  };

  const IleriSarmaBadge = ({ acik }: { acik: boolean }) => acik ? (
    <span style={{ fontSize: "10px", color: "#bc2d0d", background: "rgba(188,45,13,0.08)", border: "0.5px solid rgba(188,45,13,0.25)", borderRadius: "20px", padding: "2px 8px", marginTop: "4px", display: "inline-block" }}>
      İleri sarma açık
    </span>
  ) : null;

  const SatirKart = ({ urun_adi, teknik_adi, video_url, thumbnail_url, video_puani, soru_seti_durum_id, sorular, bekleyen, yayin }: any) => (
    <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "130px 148px 1fr auto", alignItems: "center", gap: "14px", padding: "14px 16px", minHeight: "88px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{urun_adi}</span>
          <span style={{ fontSize: "11px", color: "#737373", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.4 }}>{teknik_adi}</span>
        </div>
        <div onClick={() => video_url && setAcikVideo(video_url)} style={{ width: "110px", height: "62px", borderRadius: "6px", overflow: "hidden", cursor: video_url ? "pointer" : "default", position: "relative", border: "0.5px solid #e5e7eb", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "center", marginLeft: "19px" }}>
          {thumbnail_url ? <img src={thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#b5d4f4" }} />}
          {video_url && <div style={{ position: "absolute", width: "28px", height: "28px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg></div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "16px" }}>
          <span style={{ fontSize: "11px", color: "#737373" }}>Video puanı</span>
          {bekleyen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <select value={videoPuanlari[soru_seti_durum_id] ?? video_puani ?? ""} onChange={(e) => setVideoPuanlari(prev => ({ ...prev, [soru_seti_durum_id]: Number(e.target.value) }))} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "5px 8px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", width: "90px" }}>
                <option value="">Seçiniz</option>
                {VIDEO_PUAN_SECENEKLERI.map(p => <option key={p} value={p}>{p} puan</option>)}
              </select>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "10px", color: "#737373" }}>Extra puan</span>
                <select value={extraPuanlar[soru_seti_durum_id] ?? ""} onChange={(e) => setExtraPuanlar(prev => ({ ...prev, [soru_seti_durum_id]: Number(e.target.value) }))} style={{ border: "0.5px solid #e5e7eb", borderRadius: "6px", padding: "5px 8px", fontSize: "12px", fontFamily: "'Nunito', sans-serif", color: "#111", background: "white", width: "90px" }}>
                  <option value="">Seçiniz</option>
                  {[5, 6, 7, 8, 9, 10].map(p => <option key={p} value={p}>{p} puan</option>)}
                </select>
              </div>
              <BekleyenIleriSarmaToggle soru_seti_durum_id={soru_seti_durum_id} urun_adi={urun_adi} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "13px", color: "#56aeff", fontWeight: 700 }}>{video_puani} puan</span>
              {yayin && <IleriSarmaBadge acik={yayin.ileri_sarma_acik} />}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {sorular?.length > 0 && (
            <button onClick={() => setAcikAkordiyon(acikAkordiyon === soru_seti_durum_id ? null : soru_seti_durum_id)} style={{ padding: "5px 8px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "#f9fafb", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "#111", display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Nunito', sans-serif" }}>
              Soru Seti
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: acikAkordiyon === soru_seti_durum_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
          )}
          {bekleyen && (
            <button onClick={() => setOnayModal(bekleyen)} disabled={!tumPuanlarAtandiMi(bekleyen) || islemLoading === soru_seti_durum_id} style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: tumPuanlarAtandiMi(bekleyen) ? "#56aeff" : "#f3f4f6", color: tumPuanlarAtandiMi(bekleyen) ? "white" : "#9ca3af", fontSize: "11px", fontWeight: 600, cursor: tumPuanlarAtandiMi(bekleyen) ? "pointer" : "not-allowed", fontFamily: "'Nunito', sans-serif" }}>
              {islemLoading === soru_seti_durum_id ? "..." : "Yayınla"}
            </button>
          )}
        </div>
      </div>
      {acikAkordiyon === soru_seti_durum_id && sorular?.length > 0 && (
        <SoruListesi sorular={sorular} soru_seti_durum_id={soru_seti_durum_id} bekleyen={bekleyen} />
      )}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "white", border: "0.5px solid #e5e7eb", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
          {(["bekleyen", "yayinda", "durdurulan"] as const).map((sekme) => (
            <button key={sekme} onClick={() => setAktifSekme(sekme)} style={{ padding: "7px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Nunito', sans-serif", background: aktifSekme === sekme ? "#56aeff" : "transparent", color: aktifSekme === sekme ? "white" : "#737373" }}>
              {sekme === "bekleyen" ? `Bekleyen (${bekleyenler.length})` : sekme === "yayinda" ? `Yayında (${yayindakiler.length})` : `Durdurulan (${durdurulular.length})`}
            </button>
          ))}
        </div>

        {aktifSekme === "bekleyen" && (
          bekleyenler.length === 0
            ? <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Bekleyen video yok.</div>
            : bekleyenler.map(b => <SatirKart key={b.soru_seti_durum_id} {...b} bekleyen={b} sorular={b.sorular} />)
        )}

        {aktifSekme === "yayinda" && (
          yayindakiler.length === 0
            ? <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Yayında video yok.</div>
            : yayindakiler.map(y => (
              <div key={y.yayin_id} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 148px 1fr auto", alignItems: "center", gap: "14px", padding: "14px 16px", minHeight: "88px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>{y.urun_adi}</span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>{y.teknik_adi}</span>
                  </div>
                  <div onClick={() => y.video_url && setAcikVideo(y.video_url)} style={{ width: "110px", height: "62px", borderRadius: "6px", overflow: "hidden", cursor: y.video_url ? "pointer" : "default", position: "relative", border: "0.5px solid #e5e7eb", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "center", marginLeft: "19px" }}>
                    {y.thumbnail_url ? <img src={y.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#b5d4f4" }} />}
                    {y.video_url && <div style={{ position: "absolute", width: "28px", height: "28px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg></div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "16px" }}>
                    <span style={{ fontSize: "11px", color: "#737373" }}>Video puanı</span>
                    <span style={{ fontSize: "13px", color: "#56aeff", fontWeight: 700 }}>{y.video_puani} puan</span>
                    <IleriSarmaBadge acik={y.ileri_sarma_acik} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {y.sorular?.length > 0 && (
                      <button onClick={() => setAcikAkordiyon(acikAkordiyon === y.yayin_id ? null : y.yayin_id)} style={{ padding: "5px 8px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "#f9fafb", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "#111", display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Nunito', sans-serif" }}>
                        Soru Seti
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: acikAkordiyon === y.yayin_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    )}
                    <button onClick={() => handleDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id} style={{ padding: "5px 10px", borderRadius: "6px", border: "0.5px solid #fecaca", background: "transparent", color: "#bc2d0d", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading === y.yayin_id ? "..." : "Durdur"}
                    </button>
                  </div>
                </div>
                {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
                  <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id} bekleyen={false} />
                )}
              </div>
            ))
        )}

        {aktifSekme === "durdurulan" && (
          durdurulular.length === 0
            ? <div style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Durdurulan video yok.</div>
            : durdurulular.map(y => (
              <div key={y.yayin_id} style={{ background: "white", border: "0.5px solid #e5e7eb", borderRadius: "12px", overflow: "hidden", marginBottom: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 148px 1fr auto", alignItems: "center", gap: "14px", padding: "14px 16px", minHeight: "88px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflow: "hidden" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>{y.urun_adi}</span>
                    <span style={{ fontSize: "11px", color: "#737373" }}>{y.teknik_adi}</span>
                  </div>
                  <div onClick={() => y.video_url && setAcikVideo(y.video_url)} style={{ width: "110px", height: "62px", borderRadius: "6px", overflow: "hidden", cursor: y.video_url ? "pointer" : "default", position: "relative", border: "0.5px solid #e5e7eb", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "center", marginLeft: "19px" }}>
                    {y.thumbnail_url ? <img src={y.thumbnail_url} alt="thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "#b5d4f4" }} />}
                    {y.video_url && <div style={{ position: "absolute", width: "28px", height: "28px", background: "rgba(0,0,0,0.5)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="12" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg></div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "16px" }}>
                    <span style={{ fontSize: "11px", color: "#737373" }}>Video puanı</span>
                    <span style={{ fontSize: "13px", color: "#56aeff", fontWeight: 700 }}>{y.video_puani} puan</span>
                    <IleriSarmaBadge acik={y.ileri_sarma_acik} />
                    {y.durdurma_tarihi && <span style={{ fontSize: "11px", color: "#9ca3af" }}>Durdurulma: {formatTarih(y.durdurma_tarihi)}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {y.sorular?.length > 0 && (
                      <button onClick={() => setAcikAkordiyon(acikAkordiyon === y.yayin_id ? null : y.yayin_id)} style={{ padding: "5px 8px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "#f9fafb", fontSize: "11px", fontWeight: 600, cursor: "pointer", color: "#111", display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Nunito', sans-serif" }}>
                        Soru Seti
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: acikAkordiyon === y.yayin_id ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    )}
                    <button onClick={() => handleDurumDegistir(y.yayin_id, y.durum)} disabled={islemLoading === y.yayin_id} style={{ padding: "5px 10px", borderRadius: "6px", border: "none", background: "#56aeff", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                      {islemLoading === y.yayin_id ? "..." : "Yayınla"}
                    </button>
                  </div>
                </div>
                {acikAkordiyon === y.yayin_id && y.sorular?.length > 0 && (
                  <SoruListesi sorular={y.sorular} soru_seti_durum_id={y.soru_seti_durum_id} bekleyen={false} />
                )}
              </div>
            ))
        )}
      </div>

      {acikVideo && (
        <div onClick={() => setAcikVideo(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "12px", overflow: "hidden", width: "80%", maxWidth: "800px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid #e5e7eb" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Video Önizleme</span>
              <button onClick={() => setAcikVideo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", fontSize: "18px" }}>✕</button>
            </div>
            <iframe src={acikVideo} width="100%" height="450" frameBorder="0" allowFullScreen />
          </div>
        </div>
      )}

      {onayModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid #e5e7eb", padding: "24px", maxWidth: "380px", width: "90%" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111", marginBottom: "10px" }}>Yayın onayı</div>
            <div style={{ fontSize: "13px", color: "#737373", lineHeight: 1.6, marginBottom: "20px" }}>
              <strong>{onayModal.urun_adi}</strong> ürünü yayınlanacaktır. Onaylıyor musunuz?
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setOnayModal(null)} style={{ padding: "8px 16px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={handleYayinla} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#56aeff", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Yayınla</button>
            </div>
          </div>
        </div>
      )}

      {ileriSarmaOnayModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid #e5e7eb", padding: "24px", maxWidth: "420px", width: "90%" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111", marginBottom: "12px" }}>İleri sarma açılacak</div>
            <div style={{ fontSize: "13px", color: "#737373", lineHeight: 1.7, marginBottom: "20px", background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: "8px", padding: "12px 14px" }}>
              Bu videonun her saniyesi <strong style={{ color: "#bc2d0d" }}>puan değer taşır</strong>. İleri sarılan süre kadar izleyici puan kaybeder. İleri sarılan videolarda sorular gösterilmez.
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setIleriSarmaOnayModal(null)} style={{ padding: "8px 16px", borderRadius: "6px", border: "0.5px solid #e5e7eb", background: "transparent", color: "#737373", fontSize: "12px", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>İptal</button>
              <button onClick={() => handleIleriSarmaOnaylaVeAc(ileriSarmaOnayModal.soru_seti_durum_id)} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#56aeff", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>Onayla, Aç</button>
            </div>
          </div>
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}