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
import { useHataMesaji } from "@/components/HataMesaji";
import { uretimToast, toastVaryant } from "@/lib/uretim/toastMesaj";
import type {
  Urun,
  Teknik,
  Takim,
  KullaniciBilgi,
  BekleyenDosya,
  HedefRol,
} from "../_types";
import { type SoruTaslagi, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular } from "@/lib/soru/taslak";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, ECZANEM_TALEP_ACAN_ROLLER, ECLUB_HEDEF_ROLLER } from "@/lib/utils/roller";
import { guvenliDosyaAdi } from "@/lib/utils/guvenliDosyaAdi";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";
import { SORGU_ARALIGI_MS, TAVAN_SANIYE } from "@/lib/video/islemeDurumu";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";

type VideoYuklemeSonucu = "tamamlandi" | "isleniyor" | "basarisiz";

export function useTalepFormu(onTalepOlusturuldu?: () => void | Promise<void>) {
  const router = useRouter();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  // Y-2: hazır soru seti yapısal form kartlarıyla girilir (textarea/parse kapısı kalktı).
  const [soruTaslaklari, setSoruTaslaklari] = useState<SoruTaslagi[]>([]);

  // ============================================================================
  // Auth + kullanıcı
  // ============================================================================
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const [kullaniciBilgi, setKullaniciBilgi] = useState<KullaniciBilgi | null>(null);

  // ============================================================================
  // Liste + yükleme durumları
  // ============================================================================
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [dosyaYukleniyor, setDosyaYukleniyor] = useState(false);

  // ============================================================================
  // Form state
  // ============================================================================
  const [hedefRoller, setHedefRoller] = useState<HedefRol[]>([]);
  const hedefRol = hedefRoller[0] ?? null;
  const setHedefRol = useCallback((yeniRol: HedefRol | null) => {
    setHedefRoller(yeniRol ? [yeniRol] : []);
  }, []);
  const eclubHedefDegistir = useCallback((rol: HedefRol) => {
    if (!ECLUB_HEDEF_ROLLER.includes(rol)) return;
    setHedefRoller((mevcut) => {
      const eclubSecimi = mevcut.every((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef)) ? mevcut : [];
      const sonraki = eclubSecimi.includes(rol)
        ? eclubSecimi.filter((hedef) => hedef !== rol)
        : [...eclubSecimi, rol];
      return ECLUB_HEDEF_ROLLER.filter((hedef) => sonraki.includes(hedef));
    });
  }, []);
  const [egitimTuru, setEgitimTuru] = useState<TalepTuru>("urun_egitimi");
  const [egitimTuruSecildiMi, setEgitimTuruSecildiMi] = useState(false);
  const [urunler, setUrunler] = useState<Urun[]>([]);
  const [seciliUrunId, setSeciliUrunId] = useState("");
  const [teknikler, setTeknikler] = useState<Teknik[]>([]);
  const [seciliTeknikId, setSeciliTeknikId] = useState("");
  const [takimlar, setTakimlar] = useState<Takim[]>([]);
  const [soruSetiBuyuklugu, setSoruSetiBuyuklugu] = useState<number>(25);
  const [secenekSayisi, setSecenekSayisi] = useState<number>(4);
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
  const eclubHedef = hedefRoller.some((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef));
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
    if (!URETICI_ROLLER.includes(kullanici.rol)) {
      router.push("/ana-sayfa");
      return;
    }
  }, [kullanici, authYukleniyor, router]);

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

  // Form sözlükleri kullanıcı ve rol hazır olduğunda bir kez yüklenir.
  useEffect(() => {
    if (!kullanici) return;
    let aktif = true;
    (async () => {
      setLoading(true);
      if (isUretici) {
        const data = await fetchKullaniciBilgi();
        if (data?.firma_id) await fetchUreticiVerileri(data.firma_id, data.takim_id ?? null);
      }
      if (aktif) setLoading(false);
    })();
    return () => { aktif = false; };
  }, [kullanici, isUretici, fetchKullaniciBilgi, fetchUreticiVerileri]);

  // ============================================================================
  // Form handler'ları
  // ============================================================================
  const handleEgitimTuruDegis = useCallback((tur: TalepTuru) => {
    if (!yetenek?.acabilecegiTalepTurleri.includes(tur)) return;
    const kural = TALEP_TURU_KURALLARI[tur];
    setEgitimTuru(tur);
    setEgitimTuruSecildiMi(true);
    if (kural.urun === "yok") setSeciliUrunId("");
    if (kural.teknik === "yok") setSeciliTeknikId("");
    // Serbest ad yalnız ürün+teknik yoksa anlamlı; değilse temizle (submit'e sızmasın).
    if (!(kural.urun === "yok" && kural.teknik === "yok")) setSerbestAd("");
  }, [yetenek]);

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
    setSoruTaslaklari(prev => taslaklariBoyutla(prev, soruSetiBuyuklugu, secenekSayisi));
  }, [hazirSoruSeti, soruSetiBuyuklugu, secenekSayisi]);

  // İçe aktarma (toplu yapıştır / dosyadan): esnek parse formu doldurur, eksikler formda tamamlanır.
  const handleSoruIceAktar = useCallback((taslaklar: SoruTaslagi[], uyariMesaji: string) => {
    setSoruTaslaklari(taslaklariBoyutla(taslaklar, soruSetiBuyuklugu, secenekSayisi));
    if (uyariMesaji) uyari(uyariMesaji);
  }, [soruSetiBuyuklugu, secenekSayisi, uyari]);

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
      // eslint-disable-next-line hapbilgi-mimari/toast-tek-kaynak -- master veri ekleme; üretim hattı akış mesajı değil.
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
      // eslint-disable-next-line hapbilgi-mimari/toast-tek-kaynak -- master veri ekleme; üretim hattı akış mesajı değil.
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
    if (!egitimTuruSecildiMi) {
      hata("İçerik türü seçimi zorunludur.", "form kontrolü", undefined);
      return false;
    }
    if (!yetenek?.acabilecegiTalepTurleri.includes(egitimTuru)) {
      hata("Bu içerik türünü oluşturma yetkiniz bulunmuyor.", "form kontrolü", undefined);
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
    egitimTuruSecildiMi,
    egitimTuru,
    yetenek,
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
        hedef_roller: hedefRoller,
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
        secenek_sayisi: secenekSayisi,
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
    hedefRoller,
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
    secenekSayisi,
    videoBasiSoruSayisi,
    hata,
  ]);

  // A4 — hazır video Supabase storage'a hiç girmez: (1) vezneden izin (kimlik +
  // sıra kontrolü, kaydı sistem açar), (2) dosya tarayıcıdan DOĞRUDAN Bunny'ye
  // TUS ile, (3) kanonik embed adresi talebe bağlanır, Bunny hazır olana kadar
  // beklenir. Yalnız Ready + pozitif süre doğrulanınca üretim zinciri açılır.
  const [videoYuklemeYuzdesi, setVideoYuklemeYuzdesi] = useState<number | null>(null);
  const [videoIslemeBekleniyor, setVideoIslemeBekleniyor] = useState(false);

  const uploadVideo = useCallback(
    async (talep_id: string): Promise<VideoYuklemeSonucu> => {
      if (!bekleyenVideo) return "tamamlandi";
      setDosyaYukleniyor(true);
      setVideoYuklemeYuzdesi(0);
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
          return "basarisiz";
        }

        // 2) Doğrudan Bunny'ye — dosya bizim sunucuya uğramaz
        try {
          await bunnyTusYukle(bekleyenVideo.dosya, d, setVideoYuklemeYuzdesi);
        } catch (err: unknown) {
          hata("Video yüklenemedi.", "TUS yükleme", err instanceof Error ? err.message : undefined);
          // Telafi: vezneden açılan ama hiçbir kayda bağlanmayan Bunny kaydını temizle.
          fetch("/videolar/api/bunny-yukleme-iptal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_guid: d.video_guid }),
          }).catch(() => {});
          return "basarisiz";
        }

        // 3) Decouple: kullanıcıyı encode boyunca bekletme. Bir kez dener — Bunny
        // zaten hazırsa anında tamamlanır; değilse "işleniyor" döner ve tamamlamayı
        // ARKA PLANA devreder (aynı idempotent uç). Tarayıcı kapansa da prod'da
        // webhook + mutabakat zinciri tamamlar.
        const denemePut = async () => {
          const res2 = await fetch("/uretim/api/hazir-video", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ talep_id, video_url: d.embed_url, islem_anahtari: d.video_guid }),
          });
          const d2 = await res2.json().catch(() => ({}));
          return { status: res2.status, ok: res2.ok, d2 };
        };

        try {
          const ilk = await denemePut();
          if (ilk.ok && ilk.status !== 202) return "tamamlandi";
          if (ilk.status !== 202 && ilk.status < 500) {
            hata(ilk.d2.hata ?? "Video doğrulanamadı.", ilk.d2.adim, ilk.d2.detay);
            return "basarisiz";
          }
        } catch {
          // Geçici hata → arka plana devret.
        }

        // Henüz hazır değil → kullanıcıyı bekletme; tamamlamayı arka planda sürdür.
        void (async () => {
          const baslangic = Date.now();
          while (Date.now() - baslangic < TAVAN_SANIYE * 1000) {
            await new Promise((coz) => setTimeout(coz, SORGU_ARALIGI_MS));
            try {
              const t = await denemePut();
              if (t.ok && t.status !== 202) return; // tamamlandı
              if (t.status !== 202 && t.status < 500) return; // kalıcı hata — webhook/mutabakat toplar
            } catch { /* geçici hata; sonraki tur */ }
          }
        })();
        return "isleniyor";
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
          const metadataRes = await fetch("/talepler/api/dosyalar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              talep_id,
              dosya_adi: dosya.name,
              url: urlData.publicUrl,
              boyut: dosya.size,
            }),
          });
          if (!metadataRes.ok) {
            const metadataHatasi = await metadataRes.json().catch(() => ({})) as {
              hata?: string;
              adim?: string;
              detay?: string;
            };
            await supabase.storage.from("talep-dosyalari").remove([dosyaYolu]);
            hata(
              metadataHatasi.hata ?? `${dosya.name} talebe bağlanamadı.`,
              metadataHatasi.adim ?? "talep dosyası metadata kaydı",
              metadataHatasi.detay,
            );
            basarisizlar.push(dosya.name);
          }
        }
        return basarisizlar;
      } finally {
        setDosyaYukleniyor(false);
      }
    },
    [bekleyenDosyalar, hata]
  );

  const resetForm = useCallback(() => {
    setHedefRoller([]);
    setEgitimTuru("urun_egitimi");
    setEgitimTuruSecildiMi(false);
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
    setSecenekSayisi(4);
    setVideoBasiSoruSayisi(2);
  }, [yetenek]);

  // F-01/4: Gönderim iki aşamalı — "Talep Oluştur" validasyondan geçirir ve onay
  // modalını açar; asıl gönderim (gonderimiCalistir) yalnız modaldaki Evet'le başlar.
  const [onayModalAcik, setOnayModalAcik] = useState(false);
  const onayTercihAnahtari = `hapbilgi:talep-onay-modalini-atla:${kullanici?.id ?? "anonim"}`;

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
        let videoIsleniyor = false;
        if (hazirVideo && bekleyenVideo) {
          const sonuc = await uploadVideo(talep_id);
          if (sonuc === "basarisiz") basarisizlar.push(`${bekleyenVideo.preview.dosya_adi} (video)`);
          if (sonuc === "isleniyor") videoIsleniyor = true;
        }
        if (bekleyenDosyalar.length > 0) {
          basarisizlar.push(...(await uploadDosyalar(talep_id)));
        }
        if (basarisizlar.length === 0 && videoIsleniyor) {
          uyari(
            "Video yüklendi — hazır olunca otomatik yayına alınacak.",
            undefined,
            true
          );
        } else if (basarisizlar.length === 0) {
          // Metin varyanttan çözülür (26.07): talep açmak bir aşama kapatmaz,
          // yalnız doğan işi ve sahibini ilan eder. Hazır videoda zincir yükleme
          // biter bitmez kurulduğu için ilan edilen iş senaryo değil soru setidir;
          // ikisi de hazırsa İÜ'ye iş düşmez, sıra üreticinin kendisindedir.
          basari(uretimToast(
            { rol: "uretici", olay: "talep_gonderildi" },
            { varyant: toastVaryant(hazirVideo, hazirSoruSeti) },
          ));
          if (hazirVideo && hazirSoruSeti) bildirimRozetleriniYenile();
        } else {
          uyari(
            `Talep oluşturuldu ancak şu dosyalar yüklenemedi: ${basarisizlar.join(", ")}. ` +
              "Talep detay sayfasından tekrar yükleyebilirsiniz.",
            undefined,
            true
          );
        }
        resetForm();
        await onTalepOlusturuldu?.();
      } finally {
        setFormLoading(false);
      }
    },
    [
      submitTalep,
      hazirVideo,
      hazirSoruSeti,
      bekleyenVideo,
      uploadVideo,
      bekleyenDosyalar.length,
      uploadDosyalar,
      basari,
      uyari,
      resetForm,
      onTalepOlusturuldu,
    ]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;
      if (window.localStorage.getItem(onayTercihAnahtari) === "1") {
        void gonderimiCalistir();
        return;
      }
      setOnayModalAcik(true);
    },
    [validateForm, onayTercihAnahtari, gonderimiCalistir]
  );

  const handleOnayEvet = useCallback(async (birDahaHatirlatma: boolean) => {
    if (birDahaHatirlatma) window.localStorage.setItem(onayTercihAnahtari, "1");
    setOnayModalAcik(false);
    await gonderimiCalistir();
  }, [gonderimiCalistir, onayTercihAnahtari]);

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
    loading,

    // form: hedef rol seçimi
    hedefRol,
    hedefRoller,
    setHedefRol,
    eclubHedefDegistir,
    eczanemHedef,
    eczanemSecilebilir,

    // form: eğitim türü + türetilmiş
    egitimTuru,
    egitimTuruSecildiMi,
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
    secenekSayisi,
    setSecenekSayisi,
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
    videoIslemeBekleniyor,

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
