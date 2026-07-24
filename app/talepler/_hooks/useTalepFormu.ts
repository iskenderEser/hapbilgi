// app/talepler/_hooks/useTalepFormu.ts
//
// Talepler sayfasının tek state otoritesi. Form alanları + listelemeler + submit pipeline'ı.
// handleSubmit beş alt fonksiyona bölünmüştür: validateForm, submitTalep, uploadVideo,
// uploadDosyalar, resetForm.
// Madde 4 Aşama 2B: fetchTakimlar ve handleYeniUrunEkle(urun_adi, takim_id) burada.
// Hazır soru seti yapısal form kartlarıyla girilir (Y-2 — lib/soru/taslak); useHataMesaji içeride composed.
//
// E-Club üretim düzenlemesi: hedef rol eczacı/eczane teknisyeni ise teknik seçimi
// gizlenir ve teknik_id null gönderilir (teknik bu roller için anlamlı detay değil).
// Eczanem düzenlemesi (U4): 'eczanem' hedefi yalnız ürün müdürü ailesine görünür
// (İP-§4.1); teknik E-Club gibi gizlidir, ürün her hâlükârda zorunludur (dörtlü kilit).

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ureticiYetenegi,
  TALEP_TURU_KURALLARI,
  type TalepTuru,
} from "@/lib/uretici/yetenekler";
import { useOkunmamisIdler } from "@/hooks/useOkunmamisIdler";
import { useHataMesaji } from "@/components/HataMesaji";
import type {
  Talep,
  Urun,
  Teknik,
  Takim,
  KullaniciBilgi,
  BekleyenDosya,
  HedefRol,
} from "../_types";
import { type SoruTaslagi, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular } from "@/lib/soru/taslak";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETIM_HATTI_GORENLER, ECZANEM_TALEP_ACAN_ROLLER } from "@/lib/utils/roller";
import { guvenliDosyaAdi } from "@/lib/utils/guvenliDosyaAdi";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";

export function useTalepFormu() {
  const router = useRouter();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const okunmamisIdler = useOkunmamisIdler("talep");
  // Y-2: hazır soru seti yapısal form kartlarıyla girilir (textarea/parse kapısı kalktı).
  const [soruTaslaklari, setSoruTaslaklari] = useState<SoruTaslagi[]>([]);

  // ============================================================================
  // Auth + kullanıcı
  // ============================================================================
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [kullaniciBilgi, setKullaniciBilgi] = useState<KullaniciBilgi | null>(null);

  // ============================================================================
  // Liste + yükleme durumları
  // ============================================================================
  const [talepler, setTalepler] = useState<Talep[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);

  // ============================================================================
  // Form state
  // ============================================================================
  const [hedefRol, setHedefRol] = useState<HedefRol | null>(null);
  const [egitimTuru, setEgitimTuru] = useState<TalepTuru>("urun_egitimi");
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [seciliUrunId, setSeciliUrunId] = useState("");
  const [teknikler, setTeknikler] = useState<Teknik[]>([]);
  const [seciliTeknikId, setSeciliTeknikId] = useState("");
  const [takimlar, setTakimlar] = useState<Takim[]>([]);
  const [soruSetiBuyuklugu, setSoruSetiBuyuklugu] = useState<number>(25);
  const [videoBasiSoruSayisi, setVideoBasiSoruSayisi] = useState<number>(2);
  const [aciklama, setAciklama] = useState("");
  const [bekleyenDosyalar, setBekleyenDosyalar] = useState<BekleyenDosya[]>([]);
  const [bekleyenVideo, setBekleyenVideo] = useState<BekleyenDosya | null>(null);
  const [hazirVideo, setHazirVideo] = useState(false);
  const [hazirSoruSeti, setHazirSoruSeti] = useState(false);
  // Ürün de teknik de olmayan türlerde (medikal_egitim, ik_egitimi) izleyiciye
  // görünecek serbest "Eğitim/İçerik Adı" — talepler.urun_adi'na yazılır (İskender 24.07).
  const [serbestAd, setSerbestAd] = useState("");

  // ============================================================================
  // Türetilmiş değerler
  // ============================================================================
  const rol = kullanici?.rol ?? "";
  const yetenek = useMemo(() => ureticiYetenegi(rol.toLowerCase()), [rol]);
  const isUretici = yetenek !== null;
  const turKurali = TALEP_TURU_KURALLARI[egitimTuru];
  const urunGosterilsin = turKurali.urun !== "yok";
  // E-Club hedefi (eczacı / eczane teknisyeni) ise teknik gizlenir.
  const eclubHedef = hedefRol === "eczaci" || hedefRol === "eczane_teknisyeni";
  // Eczanem hedefinde de teknik gizlenir: son tüketiciye satış tekniği
  // anlatılmaz, içerik ürün odaklıdır (İP-§4.2 — zincir aynı, teknik yok).
  const eczanemHedef = hedefRol === "eczanem";
  // Eczanem hedefi yalnızca ürün müdürü ailesine görünür (İP-§4.1).
  const eczanemSecilebilir = ECZANEM_TALEP_ACAN_ROLLER.includes(rol.toLowerCase());
  const teknikGosterilsin = turKurali.teknik !== "yok" && !eclubHedef && !eczanemHedef;
  // Ürün ve teknik ikisi de yoksa serbest ad alanı gösterilir (eczanem hariç: orada ürün zorunlu).
  const serbestAdGoster = turKurali.urun === "yok" && turKurali.teknik === "yok" && !eczanemHedef;
  const kullaniciTakimId = kullaniciBilgi?.takim_id ?? null;

  // ============================================================================
  // Auth + rol kontrolü
  // ============================================================================
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

  // yetenek yüklendiğinde egitimTuru'yu rolün ilk açabildiği türe ayarla.
  // Dependency'e egitimTuru eklenmez — sonsuz döngü olur; sadece yetenek değişiminde tetiklenmeli.
  useEffect(() => {
    if (!yetenek) return;
    if (!yetenek.acabilecegiTalepTurleri.includes(egitimTuru)) {
      setEgitimTuru(yetenek.acabilecegiTalepTurleri[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yetenek]);

  // videoBasiSoruSayisi clamp — büyüklük küçüldüğünde geçerli aralığa çek.
  useEffect(() => {
    if (videoBasiSoruSayisi > soruSetiBuyuklugu) {
      setVideoBasiSoruSayisi(soruSetiBuyuklugu);
    }
  }, [soruSetiBuyuklugu, videoBasiSoruSayisi]);

  // Hedef rol teknik-siz bir hedefe (E-Club / Eczanem) çevrilirse, seçili
  // tekniği temizle — gizlenen alanda seçili değer kalmasın, submit'e sızmasın.
  useEffect(() => {
    if ((eclubHedef || eczanemHedef) && seciliTeknikId) setSeciliTeknikId("");
  }, [eclubHedef, eczanemHedef, seciliTeknikId]);

  // ============================================================================
  // Veri çekme
  // ============================================================================
  const veriCek = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/talepler/api");
    const data = await res.json();
    if (!res.ok) hata(data.hata ?? "Talepler yüklenemedi.", data.adim, data.detay);
    else setTalepler(data.talepler ?? []);
    setLoading(false);
  }, [hata]);

  // kullaniciBilgi cache'lenir — bir kere fetch, sonra state'ten okunur.
  const fetchKullaniciBilgi = useCallback(async (): Promise<KullaniciBilgi | null> => {
    if (kullaniciBilgi) return kullaniciBilgi;
    if (!kullanici?.id) return null;
    const supabase = createClient();
    const { data } = await supabase
      .from("kullanicilar")
      .select("firma_id, takim_id")
      .eq("kullanici_id", kullanici.id)
      .single();
    if (data) setKullaniciBilgi(data);
    return data;
  }, [kullanici?.id, kullaniciBilgi]);

  // Üretici için ürün, teknik, takım — Promise.all.
  const fetchUreticiVerileri = useCallback(
    async (firma_id: string, takim_id: string | null) => {
      const [urunRes, teknikRes, takimRes] = await Promise.all([
        fetch(`/urunler/api?firma_id=${firma_id}${takim_id ? `&takim_id=${takim_id}` : ""}`),
        fetch(`/teknikler/api?firma_id=${firma_id}`),
        fetch(`/takimlar/api?firma_id=${firma_id}`),
      ]);
      const [urunData, teknikData, takimData] = await Promise.all([
        urunRes.json(),
        teknikRes.json(),
        takimRes.json(),
      ]);
      if (urunRes.ok) setUrunler(urunData.urunler ?? []);
      if (teknikRes.ok) setTeknikler(teknikData.teknikler ?? []);
      if (takimRes.ok) setTakimlar(takimData.takimlar ?? []);
    },
    []
  );

  // Initial fetch — kullanici + isUretici hazır olduğunda.
  useEffect(() => {
    if (!kullanici) return;
    veriCek();
    if (isUretici) {
      fetchKullaniciBilgi().then((data) => {
        if (data?.firma_id) fetchUreticiVerileri(data.firma_id, data.takim_id ?? null);
      });
    }
  }, [kullanici, isUretici, veriCek, fetchKullaniciBilgi, fetchUreticiVerileri]);

  // ============================================================================
  // Yardımcılar
  // ============================================================================
  const formatTarih = useCallback((tarih: string) => {
    return new Date(tarih).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleTalepClick = useCallback(
    (talep_id: string) => router.push(`/talepler/${talep_id}`),
    [router]
  );

  const handleCikis = useCallback(async () => {
    await cikisYap();
    router.push("/login");
  }, [cikisYap, router]);

  // ============================================================================
  // Form handler'ları
  // ============================================================================
  const handleEgitimTuruDegis = useCallback((tur: TalepTuru) => {
    const kural = TALEP_TURU_KURALLARI[tur];
    setEgitimTuru(tur);
    if (kural.urun === "yok") setSeciliUrunId("");
    if (kural.teknik === "yok") setSeciliTeknikId("");
    // Serbest ad yalnız ürün+teknik yoksa anlamlı; değilse temizle (submit'e sızmasın).
    if (!(kural.urun === "yok" && kural.teknik === "yok")) setSerbestAd("");
  }, []);

  const toggleHazirVideo = useCallback(() => {
    setHazirVideo((prev) => !prev);
    setBekleyenVideo(null);
  }, []);

  const toggleHazirSoruSeti = useCallback(() => {
    setHazirSoruSeti((prev) => !prev);
    setSoruTaslaklari([]);
  }, []);

  // Form kartları büyüklükle senkron tutulur: eksikse boş kart doğar, büyüklük
  // küçülünce yalnız BOŞ kartlar düşer (dolu veri sessizce silinmez).
  useEffect(() => {
    if (!hazirSoruSeti) return;
    setSoruTaslaklari(prev => taslaklariBoyutla(prev, soruSetiBuyuklugu));
  }, [hazirSoruSeti, soruSetiBuyuklugu]);

  // İçe aktarma (toplu yapıştır / dosyadan): esnek parse formu doldurur, eksikler formda tamamlanır.
  const handleSoruIceAktar = useCallback((taslaklar: SoruTaslagi[], uyariMesaji: string) => {
    setSoruTaslaklari(taslaklariBoyutla(taslaklar, soruSetiBuyuklugu));
    if (uyariMesaji) uyari(uyariMesaji);
  }, [soruSetiBuyuklugu, uyari]);

  // Yeni ürün — Madde 4 Aşama 2B: takim_id parametresi.
  const handleYeniUrunEkle = useCallback(
    async (urun_adi: string, takim_id: string | null) => {
      const kullaniciVeri = await fetchKullaniciBilgi();
      if (!kullaniciVeri?.firma_id) {
        hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined);
        throw new Error("Firma bilgisi alınamadı.");
      }
      const res = await fetch("/urunler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_id: kullaniciVeri.firma_id, takim_id, urun_adi }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Ürün eklenemedi.", d.adim, d.detay);
        throw new Error(d.hata ?? "Ürün eklenemedi.");
      }
      basari(`"${urun_adi}" ürünü eklendi.`);
      await fetchUreticiVerileri(kullaniciVeri.firma_id, kullaniciVeri.takim_id ?? null);
      setSeciliUrunId(d.urun.urun_id);
    },
    [fetchKullaniciBilgi, fetchUreticiVerileri, hata, basari]
  );

  const handleYeniTeknikEkle = useCallback(
    async (teknik_adi: string) => {
      const kullaniciVeri = await fetchKullaniciBilgi();
      if (!kullaniciVeri?.firma_id) {
        hata("Firma bilgisi alınamadı.", "kullanicilar SELECT", undefined);
        throw new Error("Firma bilgisi alınamadı.");
      }
      const res = await fetch("/teknikler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firma_id: kullaniciVeri.firma_id, teknik_adi }),
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Teknik eklenemedi.", d.adim, d.detay);
        throw new Error(d.hata ?? "Teknik eklenemedi.");
      }
      basari(`"${teknik_adi}" tekniği eklendi.`);
      await fetchUreticiVerileri(kullaniciVeri.firma_id, kullaniciVeri.takim_id ?? null);
      setSeciliTeknikId(d.teknik.teknik_id);
    },
    [fetchKullaniciBilgi, fetchUreticiVerileri, hata, basari]
  );

  // ============================================================================
  // Dosya/video handler'ları
  // ============================================================================
  const handleDosyaSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dosyalar = Array.from(e.target.files ?? []);
    const yeni = dosyalar.map((dosya) => ({
      dosya,
      preview: {
        dosya_adi: dosya.name,
        url: "",
        boyut: dosya.size,
        yuklenme_tarihi: new Date().toISOString(),
      },
    }));
    setBekleyenDosyalar((prev) => [...prev, ...yeni]);
  }, []);

  const handleBekleyenDosyaSil = useCallback((index: number) => {
    setBekleyenDosyalar((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleVideoSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setBekleyenVideo({
      dosya,
      preview: {
        dosya_adi: dosya.name,
        url: "",
        boyut: dosya.size,
        yuklenme_tarihi: new Date().toISOString(),
      },
    });
  }, []);

  const handleBekleyenVideoSil = useCallback(() => setBekleyenVideo(null), []);

  // ============================================================================
  // Submit pipeline — 5 alt fonksiyon + orchestration
  // ============================================================================
  const validateForm = useCallback((): boolean => {
    if (!hedefRol) {
      hata("Hedef rol seçimi zorunludur.", "form kontrolü", undefined);
      return false;
    }
    if (turKurali.urun === "zorunlu" && !seciliUrunId) {
      hata("Ürün seçimi zorunludur.", "form kontrolü", undefined);
      return false;
    }
    // Eczanem'de puan/indirim ürüne kilitlidir (dörtlü kilit) — tür ürünsüz
    // olsa bile ürün şarttır (İP-§4.3: ürün talep aşamasında seçilidir).
    if (eczanemHedef && !seciliUrunId) {
      hata("Eczanem hedefli talepte ürün seçimi zorunludur.", "form kontrolü", undefined);
      return false;
    }
    // Teknik zorunluluğu yalnız teknik-siz hedefler (E-Club / Eczanem) dışında
    // geçerlidir; bu hedeflerde teknik gizli olduğu için kontrol atlanır.
    if (!eclubHedef && !eczanemHedef && turKurali.teknik === "zorunlu" && !seciliTeknikId) {
      hata("Teknik seçimi zorunludur.", "form kontrolü", undefined);
      return false;
    }
    // Ürünsüz+tekniksiz türlerde izleyici için ad zorunludur.
    if (serbestAdGoster && !serbestAd.trim()) {
      hata("Eğitim/İçerik adı zorunludur.", "form kontrolü", undefined);
      return false;
    }
    if (hazirVideo && !bekleyenVideo) {
      hata("Hazır video talebi için video dosyası zorunludur.", "video dosyası kontrolü", undefined);
      return false;
    }
    if (hazirSoruSeti) {
      const taslakHatasi = taslaklariDogrula(soruTaslaklari, soruSetiBuyuklugu);
      if (taslakHatasi) {
        hata(taslakHatasi, "soru seti kontrolü", undefined);
        return false;
      }
    }
    if (videoBasiSoruSayisi > soruSetiBuyuklugu) {
      hata(
        `Video başı soru sayısı soru seti büyüklüğünü (${soruSetiBuyuklugu}) geçemez.`,
        "form kontrolü",
        undefined
      );
      return false;
    }
    return true;
  }, [
    hedefRol,
    eclubHedef,
    eczanemHedef,
    turKurali,
    seciliUrunId,
    seciliTeknikId,
    serbestAdGoster,
    serbestAd,
    hazirVideo,
    bekleyenVideo,
    hazirSoruSeti,
    soruTaslaklari,
    videoBasiSoruSayisi,
    soruSetiBuyuklugu,
    hata,
  ]);

  const submitTalep = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/talepler/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        egitim_turu: egitimTuru,
        hedef_rol: hedefRol,
        // Eczanem'de ürün, tür kuralından bağımsız olarak gönderilir (dörtlü kilit).
        urun_id: (turKurali.urun !== "yok" || eczanemHedef) ? seciliUrunId || null : null,
        // Teknik-siz hedeflerde (E-Club / Eczanem) teknik her hâlükârda null gönderilir.
        teknik_id: (!eclubHedef && !eczanemHedef && turKurali.teknik !== "yok") ? seciliTeknikId || null : null,
        // Ürünsüz+tekniksiz türlerde izleyici adı; diğer türlerde ad urun_id'den gelir.
        urun_adi: serbestAdGoster ? serbestAd.trim() : null,
        aciklama,
        hazir_video: hazirVideo,
        hazir_soru_seti: hazirSoruSeti,
        hazir_soru_seti_verisi:
          hazirSoruSeti && soruTaslaklari.length > 0 ? taslaklardanSorular(soruTaslaklari) : null,
        soru_seti_buyuklugu: soruSetiBuyuklugu,
        video_basi_soru_sayisi: videoBasiSoruSayisi,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Talep oluşturulamadı.", d.adim, d.detay);
      return null;
    }
    return d.talep.talep_id as string;
  }, [
    egitimTuru,
    hedefRol,
    eclubHedef,
    eczanemHedef,
    turKurali,
    seciliUrunId,
    seciliTeknikId,
    serbestAdGoster,
    serbestAd,
    aciklama,
    hazirVideo,
    hazirSoruSeti,
    soruTaslaklari,
    soruSetiBuyuklugu,
    videoBasiSoruSayisi,
    hata,
  ]);

  // A4 — hazır video Supabase storage'a hiç girmez: (1) vezneden izin (kimlik +
  // sıra kontrolü, kaydı sistem açar), (2) dosya tarayıcıdan DOĞRUDAN Bunny'ye
  // TUS ile, (3) kanonik embed adresini sistem yazar. IU'nun indir-yükle adımı kalktı.
  const [videoYuklemeYuzdesi, setVideoYuklemeYuzdesi] = useState<number | null>(null);

  const uploadVideo = useCallback(
    async (talep_id: string): Promise<boolean> => {
      if (!bekleyenVideo) return true;
      setDosyaYukleniyor(true);
      try {
        // 1) Vezne: izin + Bunny kaydı + süreli imza
        const res = await fetch("/talepler/api/bunny-yukleme-baslat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talep_id }),
        });
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Video yüklemesi başlatılamadı.", d.adim, d.detay);
          return false;
        }

        // 2) Doğrudan Bunny'ye — dosya bizim sunucuya uğramaz
        try {
          await bunnyTusYukle(bekleyenVideo.dosya, d, setVideoYuklemeYuzdesi);
        } catch (err: any) {
          hata("Video Bunny'ye yüklenemedi.", "TUS yükleme", err?.message);
          // Telafi: vezneden açılan ama hiçbir kayda bağlanmayan Bunny kaydını temizle.
          fetch("/videolar/api/bunny-yukleme-iptal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_guid: d.video_guid }),
          }).catch(() => {});
          return false;
        }

        // 3) Kanonik embed adresini sistem yazar (adres vezneden geldi, istemci URL kurmaz)
        const res2 = await fetch("/talepler/api/hazir-video", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talep_id, hazir_video_url: d.embed_url }),
        });
        const d2 = await res2.json();
        if (!res2.ok) {
          hata(d2.hata ?? "Video adresi kaydedilemedi.", d2.adim, d2.detay);
          return false;
        }
        return true;
      } finally {
        setDosyaYukleniyor(false);
        setVideoYuklemeYuzdesi(null);
      }
    },
    [bekleyenVideo, hata]
  );

  // Dönüş: yüklenemeyen dosya adları — kısmi başarısızlık handleSubmit'te dürüstçe raporlanır (F-01/3).
  const uploadDosyalar = useCallback(
    async (talep_id: string): Promise<string[]> => {
      if (bekleyenDosyalar.length === 0) return [];
      const basarisizlar: string[] = [];
      setDosyaYukleniyor(true);
      try {
        const supabase = createClient();
        for (const { dosya } of bekleyenDosyalar) {
          const dosyaYolu = `${talep_id}/${Date.now()}_${guvenliDosyaAdi(dosya.name)}`;
          const { error: uploadError } = await supabase.storage
            .from("talep-dosyalari")
            .upload(dosyaYolu, dosya);
          if (uploadError) {
            hata(`${dosya.name} yüklenemedi.`, "storage upload", uploadError.message);
            basarisizlar.push(dosya.name);
            continue;
          }
          const { data: urlData } = supabase.storage
            .from("talep-dosyalari")
            .getPublicUrl(dosyaYolu);
          await fetch("/talepler/api/dosyalar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              talep_id,
              dosya_adi: dosya.name,
              url: urlData.publicUrl,
              boyut: dosya.size,
            }),
          });
        }
        return basarisizlar;
      } finally {
        setDosyaYukleniyor(false);
      }
    },
    [bekleyenDosyalar, hata]
  );

  const resetForm = useCallback(() => {
    setHedefRol(null);
    if (yetenek) setEgitimTuru(yetenek.acabilecegiTalepTurleri[0]);
    setSeciliUrunId("");
    setSeciliTeknikId("");
    setSerbestAd("");
    setAciklama("");
    setBekleyenDosyalar([]);
    setBekleyenVideo(null);
    setHazirVideo(false);
    setHazirSoruSeti(false);
    setSoruTaslaklari([]);
    setSoruSetiBuyuklugu(25);
    setVideoBasiSoruSayisi(2);
  }, [yetenek]);

  // F-01/4: Gönderim iki aşamalı — "Talep Oluştur" validasyondan geçirir ve onay
  // modalını açar; asıl gönderim (gonderimiCalistir) yalnız modaldaki Evet'le başlar.
  const [onayModalAcik, setOnayModalAcik] = useState(false);

  const gonderimiCalistir = useCallback(
    async () => {
      setFormLoading(true);
      try {
        const talep_id = await submitTalep();
        if (!talep_id) return;
        // Talep bu noktada oluştu — dosya sonucu ne olursa olsun kullanıcıya
        // gerçek durum söylenir; kısmi başarısızlık gizlenmez (F-01/3).
        // (Eski akış video hatasında sessizce dönüyordu; yeniden "Gönder" ise
        // aynı talebi ikinci kez yaratırdı — form artık her durumda sıfırlanır.)
        const basarisizlar: string[] = [];
        if (hazirVideo && bekleyenVideo) {
          const ok = await uploadVideo(talep_id);
          if (!ok) basarisizlar.push(`${bekleyenVideo.preview.dosya_adi} (video)`);
        }
        if (bekleyenDosyalar.length > 0) {
          basarisizlar.push(...(await uploadDosyalar(talep_id)));
        }
        if (basarisizlar.length === 0) {
          basari("Talep başarıyla oluşturuldu.");
        } else {
          uyari(
            `Talep oluşturuldu ancak şu dosyalar yüklenemedi: ${basarisizlar.join(", ")}. ` +
              "Talep detay sayfasından tekrar yükleyebilirsiniz.",
            undefined,
            true
          );
        }
        resetForm();
        await veriCek();
      } finally {
        setFormLoading(false);
      }
    },
    [
      submitTalep,
      hazirVideo,
      bekleyenVideo,
      uploadVideo,
      bekleyenDosyalar.length,
      uploadDosyalar,
      basari,
      uyari,
      resetForm,
      veriCek,
    ]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;
      setOnayModalAcik(true);
    },
    [validateForm]
  );

  const handleOnayEvet = useCallback(async () => {
    setOnayModalAcik(false);
    await gonderimiCalistir();
  }, [gonderimiCalistir]);

  // Hayır: modal kapanır, form ve girdiler aynen kalır — hiçbir şey gönderilmez.
  const handleOnayHayir = useCallback(() => setOnayModalAcik(false), []);

  // ============================================================================
  // Public API
  // ============================================================================
  return {
    // auth + kullanıcı
    kullanici,
    authYukleniyor,
    rol,
    isUretici,
    yetenek,
    handleCikis,

    // liste
    talepler,
    loading,
    okunmamisIdler,
    formatTarih,
    handleTalepClick,

    // form: hedef rol seçimi
    hedefRol,
    setHedefRol,
    eczanemHedef,
    eczanemSecilebilir,

    // form: eğitim türü + türetilmiş
    egitimTuru,
    handleEgitimTuruDegis,
    turKurali,
    urunGosterilsin,
    teknikGosterilsin,
    serbestAdGoster,
    serbestAd,
    setSerbestAd,

    // form: urun/teknik/takim
    urunler,
    seciliUrunId,
    setSeciliUrunId,
    teknikler,
    seciliTeknikId,
    setSeciliTeknikId,
    takimlar,
    kullaniciTakimId,
    handleYeniUrunEkle,
    handleYeniTeknikEkle,

    // form: soru seti ayarları
    soruSetiBuyuklugu,
    setSoruSetiBuyuklugu,
    videoBasiSoruSayisi,
    setVideoBasiSoruSayisi,

    // form: açıklama
    aciklama,
    setAciklama,

    // form: hazır video
    hazirVideo,
    toggleHazirVideo,
    bekleyenVideo,
    handleVideoSec,
    handleBekleyenVideoSil,
    videoYuklemeYuzdesi,

    // form: hazır soru seti
    hazirSoruSeti,
    toggleHazirSoruSeti,
    soruTaslaklari,
    setSoruTaslaklari,
    handleSoruIceAktar,

    // form: ek dosyalar
    bekleyenDosyalar,
    handleDosyaSec,
    handleBekleyenDosyaSil,

    // form: submit + onay modalı (F-01/4)
    formLoading,
    dosyaYukleniyor,
    handleSubmit,
    onayModalAcik,
    handleOnayEvet,
    handleOnayHayir,

    // bildirimler
    mesajlar,
  };
}