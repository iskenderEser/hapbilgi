// app/talepler/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { PM_ROLLERI } from "@/lib/utils/roller";

interface Talep {
  talep_id: string;
  pm_id: string;
  urun_id: string;
  teknik_id: string;
  kategori_id: string | null;
  urun_adi: string;
  teknik_adi: string;
  kategori_adi: string | null;
  aciklama: string;
  created_at: string;
  hazir_video: boolean;
  hazir_soru_seti: boolean;
  soru_seti_buyuklugu: number;
  video_basi_soru_sayisi: number;
}

interface Urun {
  urun_id: string;
  urun_adi: string;
}

interface Teknik {
  teknik_id: string;
  teknik_adi: string;
}

interface Kategori {
  kategori_id: string;
  kategori_adi: string;
}

interface DosyaItem {
  dosya_adi: string;
  url: string;
  boyut: number;
  yuklenme_tarihi: string;
}

interface Soru {
  soru_metni: string;
  secenekler: { harf: string; metin: string; dogru: boolean }[];
}

const DESTEKLENEN_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.mp4,.mov,.avi,.mkv,.webm";
const VIDEO_FORMATLAR = ".mp4,.mov,.avi,.mkv,.webm";
const EK_DOSYA_FORMATLAR = ".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg";
const SORU_SETI_BUYUKLUGU_SECENEKLERI = [10, 15, 20, 25];

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

const parseSoruSeti = (metin: string, maxSoru: number): { sorular: Soru[]; hata: string } => {
  const satirlar = metin.split("\n").map(s => s.trim());
  const sorular: Soru[] = [];
  let mevcutSoru: Partial<Soru> | null = null;

  for (let i = 0; i < satirlar.length; i++) {
    const satir = satirlar[i];
    if (!satir) {
      if (mevcutSoru?.soru_metni && mevcutSoru.secenekler?.length === 2) {
        const dogruVar = mevcutSoru.secenekler.some(s => s.dogru);
        if (dogruVar) sorular.push(mevcutSoru as Soru);
        else return { sorular: [], hata: `${sorular.length + 1}. soruda "Doğru:" satırı eksik veya hatalı.` };
      }
      mevcutSoru = null; continue;
    }
    const soruMatch = satir.match(/^\d+[\.\)]\s*(.+)/);
    if (soruMatch) { mevcutSoru = { soru_metni: soruMatch[1].trim(), secenekler: [] }; continue; }
    const aMatch = satir.match(/^A[\)\.]\s*(.+)/i);
    if (aMatch && mevcutSoru) { mevcutSoru.secenekler = mevcutSoru.secenekler ?? []; mevcutSoru.secenekler.push({ harf: "A", metin: aMatch[1].trim(), dogru: false }); continue; }
    const bMatch = satir.match(/^B[\)\.]\s*(.+)/i);
    if (bMatch && mevcutSoru) { mevcutSoru.secenekler = mevcutSoru.secenekler ?? []; mevcutSoru.secenekler.push({ harf: "B", metin: bMatch[1].trim(), dogru: false }); continue; }
    const dogruMatch = satir.match(/^Doğru:\s*([AB])/i);
    if (dogruMatch && mevcutSoru?.secenekler) {
      const dogruHarf = dogruMatch[1].toUpperCase();
      mevcutSoru.secenekler = mevcutSoru.secenekler.map(s => ({ ...s, dogru: s.harf === dogruHarf }));
    }
  }

  if (mevcutSoru?.soru_metni && mevcutSoru.secenekler?.length === 2) {
    const dogruVar = mevcutSoru.secenekler.some(s => s.dogru);
    if (dogruVar) sorular.push(mevcutSoru as Soru);
    else return { sorular: [], hata: `${sorular.length + 1}. soruda "Doğru:" satırı eksik veya hatalı.` };
  }

  if (sorular.length !== maxSoru) {
    return { sorular: [], hata: `Soru sayısı ${maxSoru} olmalıdır. Şu an: ${sorular.length}` };
  }

  return { sorular, hata: "" };
};

export default function TaleplerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<string>("");
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [seciliUrunId, setSeciliUrunId] = useState("");
  const [yeniUrunAdi, setYeniUrunAdi] = useState("");
  const [yeniUrunGoster, setYeniUrunGoster] = useState(false);
  const [urunEkleniyor, setUrunEkleniyor] = useState(false);

  const [teknikler, setTeknikler] = useState<Teknik[]>([]);
  const [seciliTeknikId, setSeciliTeknikId] = useState("");
  const [yeniTeknikAdi, setYeniTeknikAdi] = useState("");
  const [yeniTeknikGoster, setYeniTeknikGoster] = useState(false);
  const [teknikEkleniyor, setTeknikEkleniyor] = useState(false);

  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);
  const [seciliKategoriId, setSeciliKategoriId] = useState("");

  const [soruSetiBuyuklugu, setSoruSetiBuyuklugu] = useState<number>(25);
  const [videoBasiSoruSayisi, setVideoBasiSoruSayisi] = useState<number>(2);

  const [aciklama, setAciklama] = useState("");
  const [bekleyenDosyalar, setBekleyenDosyalar] = useState<{ dosya: File; preview: DosyaItem }[]>([]);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);
  const [hazirVideo, setHazirVideo] = useState(false);
  const [bekleyenVideo, setBekleyenVideo] = useState<{ dosya: File; preview: DosyaItem } | null>(null);

  const [hazirSoruSeti, setHazirSoruSeti] = useState(false);
  const [soruSetiMetni, setSoruSetiMetni] = useState("");
  const [soruSetiOnizleme, setSoruSetiOnizleme] = useState<Soru[]>([]);
  const [soruSetiParseHata, setSoruSetiParseHata] = useState("");

  const dosyaInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
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
    const res = await fetch("/talepler/api");
    const data = await res.json();
    if (!res.ok) { hata(data.hata ?? "Talepler yüklenemedi.", data.adim, data.detay); }
    else { setTalepler(data.talepler ?? []); }
    setLoading(false);
  };

  const urunleriCek = async (firma_id: string, takim_id: string) => {
    const res = await fetch(`/urunler/api?firma_id=${firma_id}&takim_id=${takim_id}`);
    const data = await res.json();
    if (res.ok) setUrunler(data.urunler ?? []);
  };

  const teknikleriCek = async (firma_id: string) => {
    const res = await fetch(`/teknikler/api?firma_id=${firma_id}`);
    const data = await res.json();
    if (res.ok) setTeknikler(data.teknikler ?? []);
  };

  const kategorileriCek = async (firma_id: string) => {
    const res = await fetch(`/kategoriler/api?firma_id=${firma_id}`);
    const data = await res.json();
    if (res.ok) setKategoriler((data.kategoriler ?? []).filter((k: Kategori & { aktif_mi: boolean }) => k.aktif_mi));
  };

  useEffect(() => {
    if (!user) return;
    const rolKucu = (user.user_metadata?.rol ?? "").toLowerCase();
    const isPM = PM_ROLLERI.includes(rolKucu);
    veriCek();
    if (isPM) {
      const supabase = createClient();
      supabase.from("kullanicilar")
        .select("firma_id, takim_id")
        .eq("kullanici_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.firma_id) {
            urunleriCek(data.firma_id, data.takim_id);
            teknikleriCek(data.firma_id);
            kategorileriCek(data.firma_id);
          }
        });
    }
  }, [user]);

  // video_basi_soru_sayisi, soru_seti_buyuklugu'nu geçemez
  useEffect(() => {
    if (videoBasiSoruSayisi > soruSetiBuyuklugu) {
      setVideoBasiSoruSayisi(soruSetiBuyuklugu);
    }
  }, [soruSetiBuyuklugu]);

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleUrunSec = (deger: string) => {
    if (deger === "yeni") { setYeniUrunGoster(true); setSeciliUrunId(""); }
    else { setSeciliUrunId(deger); setYeniUrunGoster(false); setYeniUrunAdi(""); }
  };

  const handleTeknikSec = (deger: string) => {
    if (deger === "yeni") { setYeniTeknikGoster(true); setSeciliTeknikId(""); }
    else { setSeciliTeknikId(deger); setYeniTeknikGoster(false); setYeniTeknikAdi(""); }
  };

  const handleYeniUrunEkle = async () => {
    if (!yeniUrunAdi.trim()) return;
    setUrunEkleniyor(true);
    const supabase = createClient();
    const { data: kullanici } = await supabase.from("kullanicilar").select("firma_id, takim_id").eq("kullanici_id", user.id).single();
    if (!kullanici?.firma_id) { hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined); setUrunEkleniyor(false); return; }
    const res = await fetch("/urunler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_id: kullanici.firma_id, takim_id: kullanici.takim_id ?? null, urun_adi: yeniUrunAdi.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Ürün eklenemedi.", d.adim, d.detay); }
    else {
      basari(`"${yeniUrunAdi.trim()}" ürünü eklendi.`);
      await urunleriCek(kullanici.firma_id, kullanici.takim_id);
      setSeciliUrunId(d.urun.urun_id);
      setYeniUrunGoster(false);
      setYeniUrunAdi("");
    }
    setUrunEkleniyor(false);
  };

  const handleYeniTeknikEkle = async () => {
    if (!yeniTeknikAdi.trim()) return;
    setTeknikEkleniyor(true);
    const supabase = createClient();
    const { data: kullanici } = await supabase.from("kullanicilar").select("firma_id").eq("kullanici_id", user.id).single();
    if (!kullanici?.firma_id) { hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined); setTeknikEkleniyor(false); return; }
    const res = await fetch("/teknikler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firma_id: kullanici.firma_id, teknik_adi: yeniTeknikAdi.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Teknik eklenemedi.", d.adim, d.detay); }
    else {
      basari(`"${yeniTeknikAdi.trim()}" tekniği eklendi.`);
      await teknikleriCek(kullanici.firma_id);
      setSeciliTeknikId(d.teknik.teknik_id);
      setYeniTeknikGoster(false);
      setYeniTeknikAdi("");
    }
    setTeknikEkleniyor(false);
  };

  const handleDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosyalar = Array.from(e.target.files ?? []);
    const yeniDosyalar = dosyalar.map(dosya => ({
      dosya,
      preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() }
    }));
    setBekleyenDosyalar(prev => [...prev, ...yeniDosyalar]);
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
  };

  const handleVideoSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setBekleyenVideo({ dosya, preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() } });
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleBekleyenDosyaSil = (index: number) => {
    setBekleyenDosyalar(prev => prev.filter((_, i) => i !== index));
  };

  const handleSoruSetiOnizle = () => {
    setSoruSetiParseHata("");
    setSoruSetiOnizleme([]);
    const { sorular, hata: parseHata } = parseSoruSeti(soruSetiMetni, soruSetiBuyuklugu);
    if (parseHata) { setSoruSetiParseHata(parseHata); return; }
    setSoruSetiOnizleme(sorular);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seciliUrunId) { hata("Ürün seçimi zorunludur.", "form kontrolü", undefined); return; }
    if (!seciliTeknikId) { hata("Teknik seçimi zorunludur.", "form kontrolü", undefined); return; }
    if (kategoriler.length > 0 && !seciliKategoriId) { hata("Kategori seçimi zorunludur.", "form kontrolü", undefined); return; }
    if (hazirVideo && !bekleyenVideo) { hata("Hazır video talebi için video dosyası zorunludur.", "video dosyası kontrolü", undefined); return; }
    if (hazirSoruSeti && soruSetiOnizleme.length === 0) { hata("Hazır soru seti için önce önizleme yapmalısınız.", "soru seti kontrolü", undefined); return; }
    if (videoBasiSoruSayisi > soruSetiBuyuklugu) { hata(`Video başı soru sayısı soru seti büyüklüğünü (${soruSetiBuyuklugu}) geçemez.`, "form kontrolü", undefined); return; }
    setFormLoading(true);

    const res = await fetch("/talepler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urun_id: seciliUrunId,
        teknik_id: seciliTeknikId,
        kategori_id: seciliKategoriId || null,
        aciklama,
        hazir_video: hazirVideo,
        hazir_soru_seti: hazirSoruSeti,
        hazir_soru_seti_verisi: hazirSoruSeti && soruSetiOnizleme.length > 0 ? soruSetiOnizleme : null,
        soru_seti_buyuklugu: soruSetiBuyuklugu,
        video_basi_soru_sayisi: videoBasiSoruSayisi,
      }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Talep oluşturulamadı.", d.adim, d.detay); setFormLoading(false); return; }

    const talep_id = d.talep.talep_id;
    const supabase = createClient();

    if (hazirVideo && bekleyenVideo) {
      setDosyaYukleniyor(true);
      const { dosya } = bekleyenVideo;
      const dosyaYolu = `${talep_id}/video_${Date.now()}_${dosya.name}`;
      const { error: uploadError } = await supabase.storage.from("talep-dosyalari").upload(dosyaYolu, dosya);
      if (uploadError) { hata(`Video yüklenemedi.`, "storage upload", uploadError.message); setDosyaYukleniyor(false); setFormLoading(false); return; }
      const { data: urlData } = supabase.storage.from("talep-dosyalari").getPublicUrl(dosyaYolu);
      await fetch("/talepler/api/dosyalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ talep_id, dosya_adi: dosya.name, url: urlData.publicUrl, boyut: dosya.size }) });
      setDosyaYukleniyor(false);
    }

    if (bekleyenDosyalar.length > 0) {
      setDosyaYukleniyor(true);
      for (const { dosya } of bekleyenDosyalar) {
        const dosyaYolu = `${talep_id}/${Date.now()}_${dosya.name}`;
        const { error: uploadError } = await supabase.storage.from("talep-dosyalari").upload(dosyaYolu, dosya);
        if (uploadError) { hata(`${dosya.name} yüklenemedi.`, "storage upload", uploadError.message); continue; }
        const { data: urlData } = supabase.storage.from("talep-dosyalari").getPublicUrl(dosyaYolu);
        await fetch("/talepler/api/dosyalar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ talep_id, dosya_adi: dosya.name, url: urlData.publicUrl, boyut: dosya.size }) });
      }
      setDosyaYukleniyor(false);
    }

    basari("Talep başarıyla oluşturuldu.");
    setSeciliUrunId(""); setSeciliTeknikId(""); setSeciliKategoriId(""); setAciklama("");
    setBekleyenDosyalar([]); setBekleyenVideo(null); setHazirVideo(false);
    setHazirSoruSeti(false); setSoruSetiMetni(""); setSoruSetiOnizleme([]); setSoruSetiParseHata("");
    setSoruSetiBuyuklugu(25); setVideoBasiSoruSayisi(2);
    setYeniUrunGoster(false); setYeniTeknikGoster(false);
    await veriCek();
    setFormLoading(false);
  };

  const rolKucu = rol.toLowerCase();
  const isPM = PM_ROLLERI.includes(rolKucu);

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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={user?.email ?? ""} rol={rol} onCikis={handleCikis} />

      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-5">

        {/* Yeni Talep Formu — sadece talepçi roller */}
        {isPM && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-900 m-0">Yeni Talep</h2>
              <div className="flex items-center gap-4">
                {/* Hazır Videom Var toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    onClick={() => { setHazirVideo(prev => !prev); setBekleyenVideo(null); }}
                    className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
                    style={{ width: 32, height: 18, background: hazirVideo ? "#56aeff" : "#e5e7eb" }}
                  >
                    <div
                      className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
                      style={{ left: hazirVideo ? 16 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Hazır Videom Var</span>
                </label>
                {/* Hazır Soru Setim Var toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    onClick={() => { setHazirSoruSeti(prev => !prev); setSoruSetiMetni(""); setSoruSetiOnizleme([]); setSoruSetiParseHata(""); }}
                    className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
                    style={{ width: 32, height: 18, background: hazirSoruSeti ? "#56aeff" : "#e5e7eb" }}
                  >
                    <div
                      className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
                      style={{ left: hazirSoruSeti ? 16 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">Hazır Soru Setim Var</span>
                </label>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">

              {/* Bilgi kutuları */}
              {(hazirVideo || hazirSoruSeti) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
                  {hazirVideo && hazirSoruSeti && "Hazır video ve soru seti talebi oluşturuyorsunuz. Senaryo aşaması atlanacak — IU videoyu Bunny.net'e yükleyecek, ardından sizin yüklediğiniz soru setini sisteme işleyecektir."}
                  {hazirVideo && !hazirSoruSeti && "Hazır video talebi oluşturuyorsunuz. Senaryo aşaması atlanacak — IU videoyu Bunny.net'e yükleyip URL iletecek, ardından soru seti yazım sürecine geçilecektir."}
                  {!hazirVideo && hazirSoruSeti && "Hazır soru seti talebi oluşturuyorsunuz. Normal senaryo ve video akışı işleyecek — IU soru seti yazma aşamasında sizin yüklediğiniz soru setini sisteme işleyecektir."}
                </div>
              )}

              {/* Ürün + Teknik */}
              <div className="flex flex-col md:flex-row gap-3">
                {/* Ürün seçimi */}
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Ürün Adı</label>
                  <select
                    value={yeniUrunGoster ? "yeni" : seciliUrunId}
                    onChange={e => handleUrunSec(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
                    style={{ fontFamily: "'Nunito', sans-serif", color: seciliUrunId || yeniUrunGoster ? "#111" : "#9ca3af" }}
                  >
                    <option value="">Ürün seçin...</option>
                    {urunler.map(u => <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>)}
                    <option value="yeni">+ Yeni Ürün Ekle</option>
                  </select>
                  {yeniUrunGoster && (
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        value={yeniUrunAdi}
                        onChange={e => setYeniUrunAdi(e.target.value)}
                        placeholder="Yeni ürün adı..."
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        style={{ borderColor: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
                      />
                      <button type="button" onClick={handleYeniUrunEkle} disabled={!yeniUrunAdi.trim() || urunEkleniyor}
                        className="text-white border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        style={{ background: "#56aeff", opacity: !yeniUrunAdi.trim() || urunEkleniyor ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                        {urunEkleniyor ? "..." : "Ekle"}
                      </button>
                      <button type="button" onClick={() => { setYeniUrunGoster(false); setYeniUrunAdi(""); }}
                        className="bg-transparent border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 cursor-pointer"
                        style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                    </div>
                  )}
                </div>

                {/* Teknik seçimi */}
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Teknik Adı</label>
                  <select
                    value={yeniTeknikGoster ? "yeni" : seciliTeknikId}
                    onChange={e => handleTeknikSec(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
                    style={{ fontFamily: "'Nunito', sans-serif", color: seciliTeknikId || yeniTeknikGoster ? "#111" : "#9ca3af" }}
                  >
                    <option value="">Teknik seçin...</option>
                    {teknikler.map(t => <option key={t.teknik_id} value={t.teknik_id}>{t.teknik_adi}</option>)}
                    <option value="yeni">+ Yeni Teknik Ekle</option>
                  </select>
                  {yeniTeknikGoster && (
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        value={yeniTeknikAdi}
                        onChange={e => setYeniTeknikAdi(e.target.value)}
                        placeholder="Yeni teknik adı..."
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                        style={{ borderColor: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
                      />
                      <button type="button" onClick={handleYeniTeknikEkle} disabled={!yeniTeknikAdi.trim() || teknikEkleniyor}
                        className="text-white border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        style={{ background: "#56aeff", opacity: !yeniTeknikAdi.trim() || teknikEkleniyor ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}>
                        {teknikEkleniyor ? "..." : "Ekle"}
                      </button>
                      <button type="button" onClick={() => { setYeniTeknikGoster(false); setYeniTeknikAdi(""); }}
                        className="bg-transparent border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 cursor-pointer"
                        style={{ fontFamily: "'Nunito', sans-serif" }}>İptal</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Kategori seçimi */}
              {kategoriler.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Kategori</label>
                  <select
                    value={seciliKategoriId}
                    onChange={e => setSeciliKategoriId(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
                    style={{ fontFamily: "'Nunito', sans-serif", color: seciliKategoriId ? "#111" : "#9ca3af" }}
                  >
                    <option value="" disabled>Kategori seçin...</option>
                    {kategoriler.map(k => <option key={k.kategori_id} value={k.kategori_id}>{k.kategori_adi}</option>)}
                  </select>
                </div>
              )}

              {/* Soru seti büyüklüğü + Video başı soru sayısı */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">Soru seti büyüklüğü</label>
                  <select
                    value={soruSetiBuyuklugu}
                    onChange={e => setSoruSetiBuyuklugu(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "#111" }}
                  >
                    {SORU_SETI_BUYUKLUGU_SECENEKLERI.map(s => (
                      <option key={s} value={s}>{s} soru</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 block mb-1">
                    Video başı soru sayısı
                    <span className="text-gray-400 font-normal ml-1">(max {soruSetiBuyuklugu})</span>
                  </label>
                  <select
                    value={videoBasiSoruSayisi}
                    onChange={e => setVideoBasiSoruSayisi(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
                    style={{ fontFamily: "'Nunito', sans-serif", color: "#111" }}
                  >
                    {Array.from({ length: soruSetiBuyuklugu }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} soru</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Açıklama */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Açıklama</label>
                <textarea
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                  placeholder="Talep açıklamasını girin"
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white resize-y box-border"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                />
              </div>

              {/* Hazır video dosyası */}
              {hazirVideo && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">
                    Video Dosyası <span className="font-semibold" style={{ color: "#bc2d0d" }}>*</span>{" "}
                    <span className="text-gray-400 font-normal">(IU bu videoyu Bunny.net'e yükleyecek)</span>
                  </label>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <label className="flex items-center gap-1 bg-white border rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      style={{ borderColor: "#56aeff", color: "#56aeff" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Video Ekle
                      <input ref={videoInputRef} type="file" accept={VIDEO_FORMATLAR} onChange={handleVideoSec} className="hidden" />
                    </label>
                    <span className="text-xs text-gray-400">mp4, mov, avi, mkv, webm formatları desteklenir.</span>
                  </div>
                  {bekleyenVideo && (
                    <div className="flex flex-wrap gap-1.5">
                      <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5">
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: "#f0fdf4" }}>
                          <span className="text-green-700 font-bold" style={{ fontSize: 7 }}>VID</span>
                        </div>
                        <span className="text-xs text-gray-700 max-w-40 truncate">{bekleyenVideo.preview.dosya_adi}</span>
                        <svg onClick={() => setBekleyenVideo(null)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="cursor-pointer flex-shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hazır soru seti alanı */}
              {hazirSoruSeti && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-700">Soru Seti</span>
                    <span className="text-xs text-gray-400 ml-2">(IU bu soru setini sisteme işleyecek — tam {soruSetiBuyuklugu} soru girilmeli)</span>
                  </div>
                  <div className="p-3">
                    <div className="bg-gray-100 rounded-lg px-3 py-2 mb-2.5 text-xs text-gray-500 leading-relaxed" style={{ fontFamily: "monospace" }}>
                      1. Soru metni buraya yazılır<br />
                      A) Birinci seçenek<br />
                      B) İkinci seçenek<br />
                      Doğru: A<br />
                      <br />
                      2. Soru metni buraya yazılır<br />
                      A) Birinci seçenek<br />
                      B) İkinci seçenek<br />
                      Doğru: B
                    </div>
                    <textarea
                      value={soruSetiMetni}
                      onChange={(e) => { setSoruSetiMetni(e.target.value); setSoruSetiOnizleme([]); setSoruSetiParseHata(""); }}
                      placeholder={`Soruları buraya yapıştırın... (tam ${soruSetiBuyuklugu} soru, sorular arasında boş satır bırakın)`}
                      rows={10}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-900 bg-white resize-y mb-2"
                      style={{ fontFamily: "'Nunito', sans-serif" }}
                    />
                    {soruSetiParseHata && (
                      <p className="text-xs mb-2" style={{ color: "#bc2d0d" }}>{soruSetiParseHata}</p>
                    )}
                    {soruSetiOnizleme.length > 0 && (
                      <div className="mb-2.5 bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-auto">
                        <p className="text-xs font-semibold text-gray-900 mb-2">Önizleme — {soruSetiOnizleme.length} soru ✓</p>
                        {soruSetiOnizleme.map((s, i) => (
                          <div key={i} className="mb-2 p-2 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-700 font-medium m-0 mb-1">{i + 1}. {s.soru_metni}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {s.secenekler.map((se, j) => (
                                <span key={j} className="text-xs px-2 py-0.5 rounded-full inline-block"
                                  style={{
                                    border: se.dogru ? "0.5px solid #56aeff" : "0.5px solid #e5e7eb",
                                    color: se.dogru ? "#56aeff" : "#737373",
                                    background: se.dogru ? "#e6f1fb" : "white",
                                  }}>
                                  {se.harf}. {se.metin}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {soruSetiOnizleme.length === 0 && (
                      <div className="flex justify-end">
                        <button type="button" onClick={handleSoruSetiOnizle} disabled={!soruSetiMetni.trim()}
                          className="bg-gray-500 text-white border-none rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
                          style={{ opacity: !soruSetiMetni.trim() ? 0.5 : 1, fontFamily: "'Nunito', sans-serif" }}>
                          Önizle
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ek dosyalar */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">
                  Ek Dosyalar <span className="text-gray-400 font-normal">(isteğe bağlı)</span>
                </label>
                <div className="flex items-center gap-2.5 mb-2">
                  <label className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer whitespace-nowrap">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Dosya Ekle
                    <input ref={dosyaInputRef} type="file" multiple accept={hazirVideo ? EK_DOSYA_FORMATLAR : DESTEKLENEN_FORMATLAR} onChange={handleDosyaSec} className="hidden" />
                  </label>
                  <span className="text-xs text-gray-400 leading-snug">
                    {hazirVideo ? "PDF, docx, pptx, xlsx, txt ve görsel formatları desteklenir." : "PDF, docx, pptx, xlsx, txt, görsel ve video formatları desteklenir."}
                  </span>
                </div>
                {bekleyenDosyalar.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {bekleyenDosyalar.map(({ preview }, i) => {
                      const { etiket, bg, renk } = dosyaTipiRenk(preview.dosya_adi);
                      return (
                        <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full py-1 pl-2 pr-2.5">
                          <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                            <span style={{ fontSize: 7, fontWeight: 700, color: renk }}>{etiket}</span>
                          </div>
                          <span className="text-xs text-gray-700 max-w-28 truncate">{preview.dosya_adi}</span>
                          <svg onClick={() => handleBekleyenDosyaSil(i)} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="cursor-pointer flex-shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={formLoading || dosyaYukleniyor}
                  className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
                  style={{ background: "#56aeff", opacity: formLoading || dosyaYukleniyor ? 0.6 : 1, fontFamily: "'Nunito', sans-serif" }}
                >
                  {dosyaYukleniyor ? "Dosyalar yükleniyor..." : formLoading ? "Gönderiliyor..." : "Talep Oluştur"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Talep Listesi */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">{isPM ? "Taleplerim" : "Tüm Talepler"}</span>
            <span className="text-xs text-gray-500">{talepler.length} kayıt</span>
          </div>

          {talepler.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">
              {isPM ? "Henüz talep oluşturmadınız." : "Henüz talep bulunmuyor."}
            </div>
          ) : (
            <>
              {/* Mobile: kart görünümü */}
              <div className="md:hidden">
                {talepler.map((t) => (
                  <div key={t.talep_id} onClick={() => router.push(`/talepler/${t.talep_id}`)}
                    className="px-4 py-3 border-b border-gray-50 cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{t.urun_adi}</span>
                        {t.hazir_video && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa", fontSize: 9 }}>
                            Hazır Video
                          </span>
                        )}
                        {t.hazir_soru_seti && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe", fontSize: 9 }}>
                            Hazır Soru Seti
                          </span>
                        )}
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="14" height="14"><path d="M9 5l7 7-7 7"/></svg>
                    </div>
                    <div className="text-xs text-gray-500">{t.teknik_adi}</div>
                    {t.kategori_adi && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0", fontSize: 10 }}>
                        {t.kategori_adi}
                      </span>
                    )}
                    <div className="text-xs text-gray-400 mt-0.5">{formatTarih(t.created_at)}</div>
                  </div>
                ))}
              </div>

              {/* Desktop: tablo görünümü */}
              <div className="hidden md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün Adı</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik Adı</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Kategori</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru Seti</th>
                      <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {talepler.map((t) => (
                      <tr key={t.talep_id} onClick={() => router.push(`/talepler/${t.talep_id}`)}
                        className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100">
                        <td className="px-5 py-3 text-gray-900 font-medium">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {t.urun_adi}
                            {t.hazir_video && (
                              <span className="font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                style={{ fontSize: 9, background: "#fff7ed", color: "#c2410c", border: "0.5px solid #fed7aa" }}>
                                Hazır Video
                              </span>
                            )}
                            {t.hazir_soru_seti && (
                              <span className="font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                                style={{ fontSize: 9, background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #bfdbfe" }}>
                                Hazır Soru Seti
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{t.teknik_adi}</td>
                        <td className="px-3 py-3">
                          {t.kategori_adi ? (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "#f0fdf4", color: "#15803d", border: "0.5px solid #bbf7d0" }}>
                              {t.kategori_adi}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-xs text-gray-500">{t.soru_seti_buyuklugu} soru</span>
                          <span className="text-xs text-gray-400 ml-1">/ {t.video_basi_soru_sayisi} göster</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(t.created_at)}</td>
                        <td className="px-5 py-3">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>
                        </td>
                      </tr>
                    ))}
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