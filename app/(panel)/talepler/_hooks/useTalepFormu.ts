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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { type SoruTaslagi, sorulardanTaslaklar, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular } from "@/lib/soru/taslak";
import { useAuth } from "@/app/providers/AuthProvider";
import { URETICI_ROLLER, ECZANEM_TALEP_ACAN_ROLLER, ECLUB_HEDEF_ROLLER } from "@/lib/utils/roller";
import { guvenliDosyaAdi } from "@/lib/utils/guvenliDosyaAdi";
import { bunnyTusYukle, videoYuklemeOturumuGuncelle } from "@/lib/video/bunnyTusIstemci";
import { SORGU_ARALIGI_MS, TAVAN_SANIYE } from "@/lib/video/islemeDurumu";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";
import {
  hazirFlipPdfYukle,
  hazirGorselYukle,
  hazirPodcastYukle,
  type YuklemeAsamasi,
} from "@/lib/ogrenmeAraci/bunnyYuklemeIstemci";
import { konusmaciMetniniNormalizeEt } from "@/lib/ogrenmeAraci/konusmaciAyraci";

type VideoYuklemeSonucu = "tamamlandi" | "isleniyor" | "basarisiz";

export type PodcastAiAsamasi =
  | "bosta"
  | "taslak_hazirlaniyor"
  | "podcast_yukleniyor"
  | "podcast_dogrulaniyor"
  | "ai_kuyrukta"
  | "ai_isleniyor"
  | "transkript_hazir"
  | "hata";

export type SunucuTranskriptDurumu =
  | "yok"
  | "manuel_taslak"
  | "ai_bekliyor"
  | "ai_isleniyor"
  | "ai_taslak"
  | "onaylandi"
  | "iptal"
  | "hata";

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
  const [ogrenmeAraciTuru, setOgrenmeAraciTuru] = useState<OgrenmeAraciTuru>("video");
  const [ogrenmeAraciBayraklari, setOgrenmeAraciBayraklari] = useState<Record<OgrenmeAraciTuru, boolean>>({ video: true, podcast: false, gorsel: false, flip_pdf: false });
  const [bekleyenPodcast, setBekleyenPodcast] = useState<BekleyenDosya | null>(null);
  const [bekleyenPodcastKapak, setBekleyenPodcastKapak] = useState<BekleyenDosya | null>(null);
  const [bekleyenPodcastTranskript, setBekleyenPodcastTranskript] = useState<BekleyenDosya | null>(null);
  const [podcastTranskriptMetni, setPodcastTranskriptMetni] = useState<string>("");
  const [podcastTranskriptOnaylandi, setPodcastTranskriptOnaylandi] = useState<boolean>(false);
  const [sunucuTranskriptDurumu, setSunucuTranskriptDurumu] = useState<SunucuTranskriptDurumu>("yok");
  const [podcastSesYuklendi, setPodcastSesYuklendi] = useState<boolean>(false);
  const [podcastYuklenenDosyaAdi, setPodcastYuklenenDosyaAdi] = useState<string | null>(null);
  const [podcastKapakYuklendi, setPodcastKapakYuklendi] = useState<boolean>(false);
  const [podcastYuklenenKapakAdi, setPodcastYuklenenKapakAdi] = useState<string | null>(null);
  const [podcastAiTranskriptIstendi, setPodcastAiTranskriptIstendi] = useState<boolean>(false);
  const [podcastTaslakTalepId, setPodcastTaslakTalepId] = useState<string | null>(null);
  const [podcastAracId, setPodcastAracId] = useState<string | null>(null);
  const [podcastTaslakOturumAnahtari, setPodcastTaslakOturumAnahtari] = useState<string | null>(null);
  const [podcastAiGirisimId, setPodcastAiGirisimId] = useState<string | null>(null);
  const [podcastAiAsamasi, setPodcastAiAsamasi] = useState<PodcastAiAsamasi>("bosta");
  const [podcastAiYuklemeYuzdesi, setPodcastAiYuklemeYuzdesi] = useState<number>(0);
  const [podcastAiHatasi, setPodcastAiHatasi] = useState<string | null>(null);
  const [podcastAiYukleniyor, setPodcastAiYukleniyor] = useState<boolean>(false);
  const podcastKullaniciDuzenlediRef = useRef<boolean>(false);
  const [bekleyenGorsel, setBekleyenGorsel] = useState<BekleyenDosya | null>(null);
  const [bekleyenFlipPdf, setBekleyenFlipPdf] = useState<BekleyenDosya | null>(null);
  const ogrenmeAraciYuklemeRef = useRef<AbortController | null>(null);
  const [aracYuklemeBilgisi, setAracYuklemeBilgisi] = useState<{
    asama: YuklemeAsamasi;
    yuzde: number;
    dosyaRolu: string;
    deneme: number;
  } | null>(null);
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

  useEffect(() => {
    if (!kullanici || !isUretici) return;
    void fetch("/api/ogrenme-araclari/bayraklar", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.bayraklar) setOgrenmeAraciBayraklari(data.bayraklar); })
      .catch(() => undefined);
  }, [kullanici, isUretici]);

  useEffect(() => () => {
    ogrenmeAraciYuklemeRef.current?.abort();
  }, []);

  // Kalıcı podcast taslağı ve formun yenileme sonrası eksiksiz geri getirilmesi
  useEffect(() => {
    if (!kullanici?.id || !isUretici) return;
    let aktif = true;

    const taslagiGetirVeYukle = async () => {
      const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici.id}`;
      let yerelKayit: { oturum_anahtari?: string; talep_id?: string; arac_id?: string } | null = null;
      try {
        yerelKayit = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null");
      } catch {
        yerelKayit = null;
      }

      let taslakUrl = "/talepler/api/taslak";
      if (yerelKayit?.talep_id) {
        taslakUrl += `?talep_id=${encodeURIComponent(yerelKayit.talep_id)}`;
      } else if (yerelKayit?.oturum_anahtari) {
        taslakUrl += `?oturum_anahtari=${encodeURIComponent(yerelKayit.oturum_anahtari)}`;
      }

      try {
        const res = await fetch(taslakUrl, { cache: "no-store" });
        if (!res.ok || !aktif) return;
        const data = await res.json();
        if (!data?.ok || !data?.taslak) return;

        const taslak = data.taslak;
        if (!aktif) return;

        const kayit = {
          talep_id: taslak.talep_id,
          arac_id: taslak.arac_id,
          oturum_anahtari: taslak.oturum_anahtari,
        };

        try {
          window.sessionStorage.setItem(depoAnahtari, JSON.stringify(kayit));
        } catch {
          // sessionStorage hatasını yut
        }

        if (kayit.talep_id) setPodcastTaslakTalepId(kayit.talep_id);
        if (kayit.arac_id) setPodcastAracId(kayit.arac_id);
        if (kayit.oturum_anahtari) setPodcastTaslakOturumAnahtari(kayit.oturum_anahtari);

        // Temel form alanları
        if (taslak.egitim_turu) {
          setEgitimTuru(taslak.egitim_turu);
          setEgitimTuruSecildiMi(true);
        }
        if (Array.isArray(taslak.hedef_roller) && taslak.hedef_roller.length > 0) {
          setHedefRoller(taslak.hedef_roller);
          setHedefRol(taslak.hedef_roller[0]);
        }
        if (taslak.urun_id) setSeciliUrunId(taslak.urun_id);
        if (taslak.teknik_id) setSeciliTeknikId(taslak.teknik_id);
        if (taslak.urun_adi) setSerbestAd(taslak.urun_adi);
        if (taslak.aciklama) setAciklama(taslak.aciklama);

        // Hazır podcast yapılandırması
        setOgrenmeAraciTuru("podcast");
        setHazirVideo(true);

        // Soru seti ayarları
        if (taslak.soru_seti_buyuklugu) setSoruSetiBuyuklugu(taslak.soru_seti_buyuklugu);
        if (taslak.secenek_sayisi) setSecenekSayisi(taslak.secenek_sayisi);
        if (taslak.video_basi_soru_sayisi) setVideoBasiSoruSayisi(taslak.video_basi_soru_sayisi);

        if (taslak.hazir_soru_seti) {
          setHazirSoruSeti(true);
          if (Array.isArray(taslak.hazir_soru_seti_verisi) && taslak.hazir_soru_seti_verisi.length > 0) {
            setSoruTaslaklari(sorulardanTaslaklar(taslak.hazir_soru_seti_verisi));
          }
        }

        // Ses ve yayın görseli durumu (boş File üretilmez, özel durum ile temsil edilir)
        if (taslak.ses_yuklendi) {
          setPodcastSesYuklendi(true);
          setPodcastYuklenenDosyaAdi(taslak.ses_dosya_adi || "podcast.mp3");
        }
        if (taslak.kapak_yuklendi) {
          setPodcastKapakYuklendi(true);
          setPodcastYuklenenKapakAdi(taslak.kapak_dosya_adi || "kapak.jpg");
        }

        // Sunucu transkript durumu
        if (kayit.arac_id) {
          void fetch(`/api/ogrenme-araclari/${kayit.arac_id}/transkript-durum`)
            .then(async (res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (!data?.ok) return;
              if (data.ses_yuklendi) {
                setPodcastSesYuklendi(true);
              }
              const durum = data.transkript?.durum as SunucuTranskriptDurumu | undefined;
              if (durum) {
                setSunucuTranskriptDurumu(durum);
              }
              if (data.transkript?.ai_girisim_id) {
                setPodcastAiGirisimId(data.transkript.ai_girisim_id);
              }
              if (durum === "onaylandi") {
                setPodcastAiAsamasi("transkript_hazir");
                setPodcastAiYukleniyor(false);
                setPodcastAiTranskriptIstendi(true);
                setPodcastTranskriptOnaylandi(true);
                podcastKullaniciDuzenlediRef.current = false;
                if (data.transkript?.onaylanan_metin) {
                  setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(data.transkript.onaylanan_metin));
                }
              } else if (durum === "ai_taslak") {
                setPodcastAiAsamasi("transkript_hazir");
                setPodcastAiYukleniyor(false);
                setPodcastAiTranskriptIstendi(true);
                setPodcastTranskriptOnaylandi(false);
                if (!podcastKullaniciDuzenlediRef.current && data.transkript?.taslak_metin) {
                  setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(data.transkript.taslak_metin));
                }
              } else if (durum === "iptal") {
                setPodcastAiAsamasi("bosta");
                setPodcastAiYukleniyor(false);
                setPodcastTranskriptOnaylandi(false);
              }
            })
            .catch(() => undefined);
        }

        const t = taslak.transkript;
        const durum = (t?.durum as SunucuTranskriptDurumu | undefined) ?? "yok";
        setSunucuTranskriptDurumu(durum);

        if (t?.ai_girisim_id) {
          setPodcastAiGirisimId(t.ai_girisim_id);
        }

        if (durum === "ai_bekliyor" || durum === "ai_isleniyor") {
          // Devam eden bir AI girişimi varken önceki transkript ekranda gösterilmez
          setPodcastTranskriptMetni("");
          setPodcastAiAsamasi(durum === "ai_bekliyor" ? "ai_kuyrukta" : "ai_isleniyor");
          setPodcastAiYukleniyor(true);
          setPodcastAiTranskriptIstendi(true);
          setPodcastTranskriptOnaylandi(false);
        } else if (durum === "ai_taslak") {
          setPodcastAiAsamasi("transkript_hazir");
          setPodcastAiYukleniyor(false);
          setPodcastAiTranskriptIstendi(true);
          setPodcastTranskriptOnaylandi(false);
          podcastKullaniciDuzenlediRef.current = false;
          if (t?.taslak_metin) {
            setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(t.taslak_metin));
          }
        } else if (durum === "onaylandi") {
          setPodcastAiAsamasi("transkript_hazir");
          setPodcastAiYukleniyor(false);
          setPodcastAiTranskriptIstendi(true);
          setPodcastTranskriptOnaylandi(true);
          podcastKullaniciDuzenlediRef.current = false;
          if (t?.onaylanan_metin) {
            setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(t.onaylanan_metin));
          }
        } else if (durum === "hata") {
          setPodcastAiAsamasi("hata");
          setPodcastAiYukleniyor(false);
          setPodcastAiHatasi("Transkript oluşturulamadı");
          setPodcastTranskriptOnaylandi(false);
        } else if (durum === "iptal") {
          setPodcastAiAsamasi("bosta");
          setPodcastAiYukleniyor(false);
          setPodcastTranskriptOnaylandi(false);
        }
      } catch {
        // Taslak getirme hatasını yut
      }
    };

    void taslagiGetirVeYukle();

    return () => {
      aktif = false;
    };
  }, [kullanici?.id, isUretici]);

  // AI transkript durumu aktifken periyodik sorgulama
  useEffect(() => {
    if (!podcastAracId) return;
    if (podcastAiAsamasi !== "ai_kuyrukta" && podcastAiAsamasi !== "ai_isleniyor") return;

    let iptalEdildi = false;
    const yokla = async () => {
      try {
        const res = await fetch(`/api/ogrenme-araclari/${podcastAracId}/transkript-durum`);
        if (!res.ok || iptalEdildi) return;
        const data = await res.json();
        if (!data?.ok) return;

        const durum = data.transkript?.durum as SunucuTranskriptDurumu | undefined;
        const gelenGirisimId = data.transkript?.ai_girisim_id as string | undefined;

        // Yalnız güncel ai_girisim_id sonucu istemciye kabul edilir!
        // Eski veya gecikmiş sonuç güncel transkripti değiştiremez.
        if (podcastAiGirisimId && gelenGirisimId && gelenGirisimId !== podcastAiGirisimId) {
          return;
        }

        if (durum) {
          setSunucuTranskriptDurumu(durum);
        }
        if (durum === "ai_bekliyor") {
          setPodcastAiAsamasi("ai_kuyrukta");
          setPodcastTranskriptOnaylandi(false);
          setPodcastTranskriptMetni("");
        } else if (durum === "ai_isleniyor") {
          setPodcastAiAsamasi("ai_isleniyor");
          setPodcastTranskriptOnaylandi(false);
          setPodcastTranskriptMetni("");
        } else if (durum === "ai_taslak") {
          // Yalnızca güncel girişim kimliği doğrulandığında transkript kabul edilir
          if (!podcastAiGirisimId || gelenGirisimId === podcastAiGirisimId) {
            setPodcastAiAsamasi("transkript_hazir");
            setPodcastAiYukleniyor(false);
            setPodcastTranskriptOnaylandi(false);
            // Düzenlenen güncel metin polling tarafından ezilmez!
            if (!podcastKullaniciDuzenlediRef.current && data.transkript?.taslak_metin) {
              setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(data.transkript.taslak_metin));
            }
          }
        } else if (durum === "onaylandi") {
          setPodcastAiAsamasi("transkript_hazir");
          setPodcastAiYukleniyor(false);
          setPodcastTranskriptOnaylandi(true);
          // Düzenlenen güncel metin polling tarafından ezilmez!
          if (!podcastKullaniciDuzenlediRef.current && data.transkript?.onaylanan_metin) {
            setPodcastTranskriptMetni(konusmaciMetniniNormalizeEt(data.transkript.onaylanan_metin));
          }
        } else if (durum === "hata") {
          setPodcastAiAsamasi("hata");
          setPodcastAiYukleniyor(false);
          setPodcastAiHatasi(data.transkript?.hata_kodu || "Transkript oluşturulamadı.");
          setPodcastTranskriptOnaylandi(false);
        }
      } catch {
        // Ağ hatasında durumu bozma
      }
    };

    void yokla();
    const interval = setInterval(yokla, 2500);
    return () => {
      iptalEdildi = true;
      clearInterval(interval);
    };
  }, [podcastAracId, podcastAiAsamasi, podcastAiGirisimId]);

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
    setBekleyenPodcast(null);
    setBekleyenPodcastKapak(null);
    setBekleyenPodcastTranskript(null);
    setPodcastAiTranskriptIstendi(false);
    setBekleyenGorsel(null);
    setBekleyenFlipPdf(null);
  }, []);

  const handleOgrenmeAraciTuruDegis = useCallback((tur: OgrenmeAraciTuru) => {
    setOgrenmeAraciTuru(tur);
    setHazirVideo(false);
    setBekleyenVideo(null);
    setBekleyenPodcast(null);
    setBekleyenPodcastKapak(null);
    setBekleyenPodcastTranskript(null);
    setPodcastAiTranskriptIstendi(false);
    setBekleyenGorsel(null);
    setBekleyenFlipPdf(null);
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

  const podcastDosyasiSec = useCallback((setter: (dosya: BekleyenDosya | null) => void, e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setter({ dosya, preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() } });
  }, []);
  const handlePodcastSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    podcastDosyasiSec(setBekleyenPodcast, e);
    setPodcastTranskriptOnaylandi(false);
    setPodcastSesYuklendi(false);
    setPodcastYuklenenDosyaAdi(null);
  }, [podcastDosyasiSec]);
  const handlePodcastKapakSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    podcastDosyasiSec(setBekleyenPodcastKapak, e);
    setPodcastKapakYuklendi(false);
    setPodcastYuklenenKapakAdi(null);
  }, [podcastDosyasiSec]);
  const handlePodcastTranskriptSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    podcastDosyasiSec(setBekleyenPodcastTranskript, e);
    setPodcastAiTranskriptIstendi(false);
    setPodcastTranskriptOnaylandi(false);
    setSunucuTranskriptDurumu("manuel_taslak");
  }, [podcastDosyasiSec]);
  const handleGorselSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => podcastDosyasiSec(setBekleyenGorsel, e), [podcastDosyasiSec]);
  const handleFlipPdfSec = useCallback((e: React.ChangeEvent<HTMLInputElement>) => podcastDosyasiSec(setBekleyenFlipPdf, e), [podcastDosyasiSec]);

  const handlePodcastTranskriptMetinDegisti = useCallback((metin: string) => {
    if (metin.trim().length > 0) {
      podcastKullaniciDuzenlediRef.current = true;
    }
    setPodcastTranskriptMetni(metin);
    setPodcastTranskriptOnaylandi(false);
    setSunucuTranskriptDurumu((onceki) => {
      if (onceki === "onaylandi") return "manuel_taslak";
      if (onceki === "yok" && metin.trim().length > 0) return "manuel_taslak";
      return onceki;
    });
  }, []);
  const handlePodcastTranskriptOnayla = useCallback(() => {
    if (podcastTranskriptMetni.trim().length >= 10) {
      setPodcastTranskriptOnaylandi(true);
    }
  }, [podcastTranskriptMetni]);
  const handlePodcastTranskriptIptal = useCallback(() => {
    setPodcastTranskriptMetni("");
    setPodcastTranskriptOnaylandi(false);
    setBekleyenPodcastTranskript(null);
    setPodcastAiTranskriptIstendi(false);
    setSunucuTranskriptDurumu("iptal");
  }, []);
  const handlePodcastAiTranskriptIstendiDegisti = useCallback((istendi: boolean) => {
    setPodcastAiTranskriptIstendi(istendi);
    if (istendi) {
      setBekleyenPodcastTranskript(null);
      setPodcastTranskriptMetni("");
      setPodcastTranskriptOnaylandi(false);
      setSunucuTranskriptDurumu("ai_bekliyor");
    } else {
      setSunucuTranskriptDurumu("yok");
    }
  }, []);
  const handlePodcastTranskriptDosyaSecildi = useCallback((dosya: File, cikarilanMetin?: string) => {
    setBekleyenPodcastTranskript({
      dosya,
      preview: { dosya_adi: dosya.name, url: "", boyut: dosya.size, yuklenme_tarihi: new Date().toISOString() },
    });
    setPodcastAiTranskriptIstendi(false);
    setPodcastTranskriptOnaylandi(false);
    setSunucuTranskriptDurumu("manuel_taslak");
    if (cikarilanMetin) {
      setPodcastTranskriptMetni(cikarilanMetin);
    }
  }, []);

  const handlePodcastAiTranskriptBaslat = useCallback(async () => {
    // Çift tıklama koruması: AI süreci zaten devam ediyorsa ikinci çağrıyı engelle
    if (podcastAiYukleniyor) return;
    if (!bekleyenPodcast?.dosya) {
      uyari("Lütfen önce podcast dosyasını seçiniz.");
      return;
    }

    if (!hedefRol) {
      uyari("Lütfen önce hedef kitle (rol) seçimi yapınız.");
      return;
    }

    if (turKurali.urun === "zorunlu" && !seciliUrunId) {
      uyari("Lütfen önce ürün seçiniz.");
      return;
    }

    setPodcastAiYukleniyor(true);
    setPodcastAiHatasi(null);
    setPodcastAiAsamasi("taslak_hazirlaniyor");
    setPodcastAiYuklemeYuzdesi(0);
    setPodcastAiTranskriptIstendi(true);
    setSunucuTranskriptDurumu("ai_bekliyor");
    // Yeni AI girişimi başladığında önceki transkripti ekranda gösterme!
    podcastKullaniciDuzenlediRef.current = false;
    setPodcastTranskriptMetni("");
    setPodcastTranskriptOnaylandi(false);
    setPodcastAiGirisimId(null);

    try {
      // 1. Taslak için form oturum anahtarını hazırla veya mevcut olanı kullan
      let oturumAnahtari = podcastTaslakOturumAnahtari;
      const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici?.id ?? "anonim"}`;
      if (!oturumAnahtari) {
        try {
          const kayit = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null");
          if (kayit?.oturum_anahtari) oturumAnahtari = kayit.oturum_anahtari;
        } catch {
          // sessionStorage hatasını yut
        }
      }
      if (!oturumAnahtari) {
        oturumAnahtari = crypto.randomUUID();
        setPodcastTaslakOturumAnahtari(oturumAnahtari);
      }

      // 2. Kalıcı taslağı oluştur veya mevcut taslağı getir
      const taslakRes = await fetch("/talepler/api/taslak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oturum_anahtari: oturumAnahtari,
          egitim_turu: egitimTuru,
          hedef_roller: hedefRoller,
          urun_id: (turKurali.urun !== "yok" || eczanemHedef) ? seciliUrunId || null : null,
          teknik_id: (!eclubHedef && !eczanemHedef && turKurali.teknik !== "yok") ? seciliTeknikId || null : null,
          urun_adi: serbestAdGoster ? serbestAd.trim() : null,
          aciklama,
          ogrenme_araci_turu: "podcast",
          ogrenme_araci_tercihleri: {},
          hazir_video: true,
          hazir_soru_seti: hazirSoruSeti,
          hazir_soru_seti_verisi:
            hazirSoruSeti && soruTaslaklari.length > 0 ? taslaklardanSorular(soruTaslaklari) : null,
          soru_seti_buyuklugu: soruSetiBuyuklugu,
          secenek_sayisi: secenekSayisi,
          video_basi_soru_sayisi: videoBasiSoruSayisi,
        }),
      });

      const taslakData = await taslakRes.json();
      if (!taslakRes.ok || !taslakData.talep_id || !taslakData.arac_id) {
        setPodcastAiAsamasi("hata");
        setPodcastAiHatasi(taslakData.hata ?? "Taslak oluşturulamadı.");
        setPodcastAiYukleniyor(false);
        setSunucuTranskriptDurumu("hata");
        return;
      }

      const talepId = taslakData.talep_id as string;
      const aracId = taslakData.arac_id as string;
      setPodcastTaslakTalepId(talepId);
      setPodcastAracId(aracId);

      try {
        window.sessionStorage.setItem(
          depoAnahtari,
          JSON.stringify({ oturum_anahtari: oturumAnahtari, talep_id: talepId, arac_id: aracId })
        );
      } catch {
        // sessionStorage hatasını yut
      }

      // 3. Sunucudan aracın ses dosyasının önceden yüklenip yüklenmediğini kontrol et
      const durumRes = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-durum`);
      const durumData = durumRes.ok ? await durumRes.json() : null;
      const sesOncedenYuklendi = Boolean(durumData?.ses_yuklendi);

      // 4. Ses dosyası henüz yüklenmemişse hemen Bunny Storage'a yükle ve doğrula
      if (!sesOncedenYuklendi) {
        setPodcastAiAsamasi("podcast_yukleniyor");
        await hazirPodcastYukle({
          talepId,
          aracId,
          ses: bekleyenPodcast.dosya,
          kapak: bekleyenPodcastKapak ? bekleyenPodcastKapak.dosya : undefined,
          aiTranskriptIstendi: false,
          taslakModu: true,
          kontrol: {
            onIlerleme: (bilgi) => {
              if (bilgi.asama === "dogrulama") {
                setPodcastAiAsamasi("podcast_dogrulaniyor");
              } else if (bilgi.asama === "yukleme" || bilgi.asama === "checksum" || bilgi.asama === "hazirlama") {
                setPodcastAiAsamasi("podcast_yukleniyor");
                setPodcastAiYuklemeYuzdesi(bilgi.yuzde);
              }
            },
          },
        });
      }
      setPodcastSesYuklendi(true);

      // 5. Yükleme tamamlanınca aynı arac_id için AI transkript girişimini başlat
      setPodcastTranskriptMetni("");
      setPodcastTranskriptOnaylandi(false);
      setPodcastAiAsamasi("ai_kuyrukta");
      const aiRes = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-ai-baslat`, {
        method: "POST",
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok && aiRes.status !== 202) {
        setPodcastAiAsamasi("hata");
        setPodcastAiHatasi(aiData.hata ?? "AI transkripti başlatılamadı.");
        setPodcastAiYukleniyor(false);
        setSunucuTranskriptDurumu("hata");
        return;
      }
      if (aiData.ai_girisim_id) {
        setPodcastAiGirisimId(aiData.ai_girisim_id);
      }
    } catch (err: unknown) {
      setPodcastAiAsamasi("hata");
      setPodcastAiHatasi(err instanceof Error ? err.message : "Transkript oluşturulamadı.");
      setPodcastAiYukleniyor(false);
      setSunucuTranskriptDurumu("hata");
    }
  }, [
    podcastAiYukleniyor,
    bekleyenPodcast,
    bekleyenPodcastKapak,
    hedefRol,
    turKurali.urun,
    seciliUrunId,
    podcastTaslakOturumAnahtari,
    kullanici?.id,
    egitimTuru,
    hedefRoller,
    turKurali.teknik,
    eczanemHedef,
    eclubHedef,
    seciliTeknikId,
    serbestAdGoster,
    serbestAd,
    aciklama,
    hazirSoruSeti,
    soruTaslaklari,
    soruSetiBuyuklugu,
    secenekSayisi,
    videoBasiSoruSayisi,
    uyari,
  ]);

  const handlePodcastTranskriptSunucuOnayla = useCallback(
    async (nihaiMetin: string): Promise<{ ok: boolean; hata?: string }> => {
      const metinTemiz = nihaiMetin.trim();
      if (metinTemiz.length < 10) {
        return { ok: false, hata: "Transkript metni en az 10 karakter olmalıdır." };
      }

      let talepId = podcastTaslakTalepId;
      let aracId = podcastAracId;

      if (!talepId || !aracId) {
        let oturumAnahtari = podcastTaslakOturumAnahtari;
        const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici?.id ?? "anonim"}`;
        if (!oturumAnahtari) {
          try {
            const kayit = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null");
            if (kayit?.oturum_anahtari) oturumAnahtari = kayit.oturum_anahtari;
          } catch {
            // yut
          }
        }
        if (!oturumAnahtari) {
          oturumAnahtari = crypto.randomUUID();
          setPodcastTaslakOturumAnahtari(oturumAnahtari);
        }

        try {
          const taslakRes = await fetch("/talepler/api/taslak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              oturum_anahtari: oturumAnahtari,
              egitim_turu: egitimTuru,
              hedef_roller: hedefRoller,
              urun_id: turKurali.urun !== "yok" || eczanemHedef ? seciliUrunId || null : null,
              teknik_id: !eclubHedef && !eczanemHedef && turKurali.teknik !== "yok" ? seciliTeknikId || null : null,
              urun_adi: serbestAdGoster ? serbestAd.trim() : null,
              aciklama,
              ogrenme_araci_turu: "podcast",
              ogrenme_araci_tercihleri: {},
              hazir_video: true,
              hazir_soru_seti: hazirSoruSeti,
              hazir_soru_seti_verisi:
                hazirSoruSeti && soruTaslaklari.length > 0 ? taslaklardanSorular(soruTaslaklari) : null,
              soru_seti_buyuklugu: soruSetiBuyuklugu,
              secenek_sayisi: secenekSayisi,
              video_basi_soru_sayisi: videoBasiSoruSayisi,
            }),
          });

          const taslakData = await taslakRes.json();
          if (!taslakRes.ok || !taslakData.talep_id || !taslakData.arac_id) {
            return { ok: false, hata: taslakData.hata ?? "Taslak oluşturulamadı." };
          }

          talepId = taslakData.talep_id;
          aracId = taslakData.arac_id;
          setPodcastTaslakTalepId(talepId);
          setPodcastAracId(aracId);

          try {
            window.sessionStorage.setItem(
              depoAnahtari,
              JSON.stringify({ oturum_anahtari: oturumAnahtari, talep_id: talepId, arac_id: aracId })
            );
          } catch {
            // yut
          }
        } catch {
          return { ok: false, hata: "Taslak oluşturulurken ağ hatası oluştu." };
        }
      }

      try {
        const res = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-yonet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ islem: "onayla", nihai_metin: metinTemiz }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, hata: data.hata ?? "Transkript onaylanamadı." };
        }
        setSunucuTranskriptDurumu("onaylandi");
        setPodcastTranskriptOnaylandi(true);
        setPodcastTranskriptMetni(metinTemiz);
        podcastKullaniciDuzenlediRef.current = false;
        return { ok: true };
      } catch (err: unknown) {
        return { ok: false, hata: err instanceof Error ? err.message : "Sunucu hatası oluştu." };
      }
    },
    [
      podcastTaslakTalepId,
      podcastAracId,
      podcastTaslakOturumAnahtari,
      kullanici?.id,
      egitimTuru,
      hedefRoller,
      turKurali.urun,
      eczanemHedef,
      seciliUrunId,
      eclubHedef,
      turKurali.teknik,
      seciliTeknikId,
      serbestAdGoster,
      serbestAd,
      aciklama,
      hazirSoruSeti,
      soruTaslaklari,
      soruSetiBuyuklugu,
      secenekSayisi,
      videoBasiSoruSayisi,
    ]
  );

  const handlePodcastTranskriptSunucuIptal = useCallback(async (): Promise<{ ok: boolean; hata?: string }> => {
    if (podcastAracId) {
      try {
        const res = await fetch(`/api/ogrenme-araclari/${podcastAracId}/transkript-yonet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ islem: "iptal_et" }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, hata: data.hata ?? "Transkript iptal edilemedi." };
        }
      } catch (err: unknown) {
        return { ok: false, hata: err instanceof Error ? err.message : "İptal sırasında sunucu hatası oluştu." };
      }
    }
    setSunucuTranskriptDurumu("iptal");
    setPodcastTranskriptMetni("");
    setPodcastTranskriptOnaylandi(false);
    setBekleyenPodcastTranskript(null);
    setPodcastAiTranskriptIstendi(false);
    return { ok: true };
  }, [podcastAracId]);

  // Transkript kararı ve buton kilit mantığı (Aşama 4 Kural 1-8)
  const { gonderButonuEtkin, gonderButonuPasifNedeni } = useMemo<{
    gonderButonuEtkin: boolean;
    gonderButonuPasifNedeni: string | null;
  }>(() => {
    // Yalnız üretici V2/V4 hazır podcast formunu denetle
    if (!hazirVideo || ogrenmeAraciTuru !== "podcast") {
      return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
    }

    // Kullanıcı transkript akışını iptal ederek transkriptsiz devam etmeyi sunucuya kaydettiyse açılabilir
    if (sunucuTranskriptDurumu === "iptal") {
      return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
    }

    // Kullanıcı transkript onayladıysa (hem sunucu onaylandi hem istemci metin değişikliği yapmamış olmalı)
    if (sunucuTranskriptDurumu === "onaylandi") {
      if (podcastTranskriptOnaylandi) {
        return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
      }
      // Kullanıcı onaylı metni değiştirdi ama henüz yeniden onaylamadı
      return {
        gonderButonuEtkin: false,
        gonderButonuPasifNedeni: "Transkripti onaylayın veya transkriptsiz devam edin",
      };
    }

    // Kullanıcı baştan transkript eklememeyi seçtiyse (hiç transkript girişi/talebi yoksa)
    const transkriptBaslatildi =
      podcastAiTranskriptIstendi ||
      bekleyenPodcastTranskript !== null ||
      podcastTranskriptMetni.trim().length > 0 ||
      (podcastAracId !== null && sunucuTranskriptDurumu !== "yok");

    if (!transkriptBaslatildi && (sunucuTranskriptDurumu === "yok" || !sunucuTranskriptDurumu)) {
      return { gonderButonuEtkin: true, gonderButonuPasifNedeni: null };
    }

    // Transkript akışı aktif:
    // 1. Podcast yükleniyor / hazırlanıyor / doğrulanıyor
    if (
      podcastAiYukleniyor ||
      podcastAiAsamasi === "taslak_hazirlaniyor" ||
      podcastAiAsamasi === "podcast_yukleniyor" ||
      podcastAiAsamasi === "podcast_dogrulaniyor"
    ) {
      return {
        gonderButonuEtkin: false,
        gonderButonuPasifNedeni: "Podcast yükleniyor",
      };
    }

    // 2. AI transkripti hazırlanıyor
    if (
      podcastAiAsamasi === "ai_kuyrukta" ||
      podcastAiAsamasi === "ai_isleniyor" ||
      sunucuTranskriptDurumu === "ai_bekliyor" ||
      sunucuTranskriptDurumu === "ai_isleniyor"
    ) {
      return {
        gonderButonuEtkin: false,
        gonderButonuPasifNedeni: "AI transkripti hazırlanıyor",
      };
    }

    // 3. Hata durumu
    if (podcastAiAsamasi === "hata" || sunucuTranskriptDurumu === "hata") {
      return {
        gonderButonuEtkin: false,
        gonderButonuPasifNedeni:
          "Transkript işlemi hata verdi; tekrar deneyin veya transkriptsiz devam edin",
      };
    }

    // 4. Taslak durumu (ai_taslak, manuel_taslak veya onay bekleyen metin)
    return {
      gonderButonuEtkin: false,
      gonderButonuPasifNedeni: "Transkripti onaylayın veya transkriptsiz devam edin",
    };
  }, [
    hazirVideo,
    ogrenmeAraciTuru,
    sunucuTranskriptDurumu,
    podcastTranskriptOnaylandi,
    podcastAiTranskriptIstendi,
    bekleyenPodcastTranskript,
    podcastTranskriptMetni,
    podcastAracId,
    podcastAiYukleniyor,
    podcastAiAsamasi,
  ]);

  // ============================================================================
  // Submit pipeline — 5 alt fonksiyon + orchestration
  // ============================================================================
  const validateForm = useCallback((): boolean => {
    if (hazirVideo && ogrenmeAraciTuru === "podcast" && !gonderButonuEtkin) {
      hata(
        gonderButonuPasifNedeni ?? "Transkript onaylanmadan podcast talebi gönderilemez.",
        "transkript kontrolü",
        undefined
      );
      return false;
    }
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
    if (hazirVideo && ogrenmeAraciTuru === "video" && !bekleyenVideo) {
      hata("Hazır video talebi için video dosyası zorunludur.", "video dosyası kontrolü", undefined);
      return false;
    }
    if (hazirVideo && ogrenmeAraciTuru === "podcast" && !bekleyenPodcast) {
      if (!podcastSesYuklendi) {
        hata("Hazır podcast talebi için podcast dosyası zorunludur.", "podcast dosyası kontrolü", undefined);
        return false;
      }
    }
    if (hazirVideo && ogrenmeAraciTuru === "gorsel" && !bekleyenGorsel) {
      hata("Hazır görsel talebi için görsel dosyası zorunludur.", "görsel dosyası kontrolü", undefined);
      return false;
    }
    if (hazirVideo && ogrenmeAraciTuru === "flip_pdf" && !bekleyenFlipPdf) {
      hata("Hazır Literatür talebi için dosya zorunludur.", "PDF dosyası kontrolü", undefined);
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
    gonderButonuEtkin,
    gonderButonuPasifNedeni,
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
    ogrenmeAraciTuru,
    ogrenmeAraciBayraklari,
    bekleyenVideo,
    bekleyenPodcast,
    podcastSesYuklendi,
    bekleyenPodcastKapak,
    bekleyenPodcastTranskript,
    bekleyenGorsel,
    bekleyenFlipPdf,
    hazirSoruSeti,
    soruTaslaklari,
    videoBasiSoruSayisi,
    soruSetiBuyuklugu,
    hata,
  ]);

  const submitTalep = useCallback(async (taslakIdOverride?: string): Promise<string | null> => {
    const talepGovdesi = {
      egitim_turu: egitimTuru,
      hedef_roller: hedefRoller,
      // Eczanem'de ürün, tür kuralından bağımsız olarak gönderilir (dörtlü kilit).
      urun_id: (turKurali.urun !== "yok" || eczanemHedef) ? seciliUrunId || null : null,
      // Teknik-siz hedeflerde (E-Club / Eczanem) teknik her hâlükârda null gönderilir.
      teknik_id: (!eclubHedef && !eczanemHedef && turKurali.teknik !== "yok") ? seciliTeknikId || null : null,
      // Ürünsüz+tekniksiz türlerde izleyici adı; diğer türlerde ad urun_id'den gelir.
      urun_adi: serbestAdGoster ? serbestAd.trim() : null,
      aciklama,
      ogrenme_araci_turu: ogrenmeAraciTuru,
      ogrenme_araci_tercihleri: {},
      hazir_video: hazirVideo,
      hazir_soru_seti: hazirSoruSeti,
      hazir_soru_seti_verisi:
        hazirSoruSeti && soruTaslaklari.length > 0 ? taslaklardanSorular(soruTaslaklari) : null,
      soru_seti_buyuklugu: soruSetiBuyuklugu,
      secenek_sayisi: secenekSayisi,
      video_basi_soru_sayisi: videoBasiSoruSayisi,
    };
    const govdeImzasi = JSON.stringify(talepGovdesi);
    const depoAnahtari = `hapbilgi:talep-islem:${kullanici?.id ?? "anonim"}`;
    let islemAnahtari = crypto.randomUUID();
    try {
      const onceki = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null") as {
        govde_imzasi?: unknown;
        islem_anahtari?: unknown;
      } | null;
      if (onceki?.govde_imzasi === govdeImzasi && typeof onceki.islem_anahtari === "string") {
        islemAnahtari = onceki.islem_anahtari;
      } else {
        window.sessionStorage.setItem(depoAnahtari, JSON.stringify({ govde_imzasi: govdeImzasi, islem_anahtari: islemAnahtari }));
      }
    } catch {
      // sessionStorage kapalıysa mevcut sekmedeki formLoading yine çift tıklamayı engeller;
      // sunucu işlem anahtarı her durumda gönderilir.
    }

    let res: Response;
    try {
      // 1c. Gönderiniz tıklandığında mevcut taslak_talep_id sunucuya iletilir:
      // taslak_talep_id: podcastTaslakTalepId || undefined
      res = await fetch("/talepler/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...talepGovdesi,
          islem_anahtari: islemAnahtari,
          taslak_talep_id: taslakIdOverride || podcastTaslakTalepId || undefined,
        }),
      });
    } catch (error) {
      hata("Talep gönderimi tamamlanamadı. Aynı formu yeniden göndererek güvenle devam edebilirsiniz.", "talep gönderimi", error instanceof Error ? error.message : undefined);
      return null;
    }
    const d = await res.json();
    if (!res.ok) {
      hata(d.hata ?? "Talep oluşturulamadı.", d.adim, d.detay);
      return null;
    }
    try {
      const kayit = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null") as { islem_anahtari?: unknown } | null;
      if (kayit?.islem_anahtari === islemAnahtari) window.sessionStorage.removeItem(depoAnahtari);
      if (kullanici?.id) window.sessionStorage.removeItem(`hapbilgi:podcast-taslak:${kullanici.id}`);
    } catch {
      // İstek başarıyla sonuçlandı; depo erişimi başarısızsa sonraki farklı gövde
      // zaten yeni işlem anahtarı oluşturur.
    }
    return d.talep.talep_id as string;
  }, [
    podcastTaslakTalepId,
    kullanici?.id,
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
    ogrenmeAraciTuru,
    hazirVideo,
    hazirSoruSeti,
    soruTaslaklari,
    soruSetiBuyuklugu,
    secenekSayisi,
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
          body: JSON.stringify({
            talep_id,
            dosya_adi: bekleyenVideo.dosya.name,
            mime_type: bekleyenVideo.dosya.type || "video/mp4",
            dosya_boyutu: bekleyenVideo.dosya.size,
          }),
        });
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Video yüklemesi başlatılamadı.", d.adim, d.detay);
          return "basarisiz";
        }

        // 2) Doğrudan Bunny'ye — dosya bizim sunucuya uğramaz
        try {
          await bunnyTusYukle(bekleyenVideo.dosya, d, setVideoYuklemeYuzdesi);
          await videoYuklemeOturumuGuncelle(d.yukleme_id, "aktarim_tamamlandi");
        } catch (err: unknown) {
          hata("Video yüklenemedi.", "TUS yükleme", err instanceof Error ? err.message : undefined);
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
          if (ilk.ok && ilk.status !== 202) {
            await videoYuklemeOturumuGuncelle(d.yukleme_id, "baglandi");
            return "tamamlandi";
          }
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
              if (t.ok && t.status !== 202) {
                await videoYuklemeOturumuGuncelle(d.yukleme_id, "baglandi").catch(() => undefined);
                return;
              }
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
    setOgrenmeAraciTuru("video");
    setBekleyenPodcast(null);
    setBekleyenPodcastKapak(null);
    setBekleyenPodcastTranskript(null);
    setPodcastAiTranskriptIstendi(false);
    setBekleyenGorsel(null);
    setBekleyenFlipPdf(null);
    setHazirVideo(false);
    setHazirSoruSeti(false);
    setSoruTaslaklari([]);
    setSoruSetiBuyuklugu(25);
    setSecenekSayisi(4);
    setVideoBasiSoruSayisi(2);
    setPodcastTaslakTalepId(null);
    setPodcastAracId(null);
    setPodcastTaslakOturumAnahtari(null);
    setPodcastAiAsamasi("bosta");
    setPodcastAiYuklemeYuzdesi(0);
    setPodcastAiHatasi(null);
    setPodcastAiYukleniyor(false);
    setSunucuTranskriptDurumu("yok");
    setPodcastSesYuklendi(false);
    const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici?.id ?? "anonim"}`;
    try {
      window.sessionStorage.removeItem(depoAnahtari);
    } catch {
      // yut
    }
  }, [yetenek, kullanici?.id]);

  const handlePodcastTaslakIptal = useCallback(async (): Promise<{ ok: boolean; hata?: string }> => {
    if (podcastTaslakTalepId) {
      try {
        const res = await fetch(`/talepler/api/taslak?talep_id=${podcastTaslakTalepId}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, hata: data.hata ?? "Taslak iptal edilemedi." };
        }
      } catch (err: unknown) {
        return { ok: false, hata: err instanceof Error ? err.message : "Taslak iptal edilemedi." };
      }
    }
    const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici?.id ?? "anonim"}`;
    try {
      window.sessionStorage.removeItem(depoAnahtari);
    } catch {
      // yut
    }
    resetForm();
    return { ok: true };
  }, [podcastTaslakTalepId, kullanici?.id, resetForm]);

  // F-01/4: Gönderim iki aşamalı — "Talep Oluştur" validasyondan geçirir ve onay
  // modalını açar; asıl gönderim (gonderimiCalistir) yalnız modaldaki Evet'le başlar.
  const [onayModalAcik, setOnayModalAcik] = useState(false);
  const onayTercihAnahtari = `hapbilgi:talep-onay-modalini-atla:${kullanici?.id ?? "anonim"}`;

  const gonderimiCalistir = useCallback(
    async () => {
      setFormLoading(true);
      const yeniAracYuklenecek = hazirVideo && ogrenmeAraciTuru !== "video";
      const yuklemeDenetleyicisi = yeniAracYuklenecek ? new AbortController() : null;
      if (yuklemeDenetleyicisi) {
        ogrenmeAraciYuklemeRef.current?.abort();
        ogrenmeAraciYuklemeRef.current = yuklemeDenetleyicisi;
      }
      const kontrol = yuklemeDenetleyicisi ? {
        signal: yuklemeDenetleyicisi.signal,
        onIlerleme: setAracYuklemeBilgisi,
        onUyari: (mesaj: string) => uyari(mesaj),
      } : undefined;
      try {
        if (hazirVideo && ogrenmeAraciTuru === "podcast") {
          if (!bekleyenPodcast && !podcastSesYuklendi) {
            uyari("Lütfen önce podcast dosyasını seçiniz.");
            setFormLoading(false);
            return;
          }

          let aktifTalepId = podcastTaslakTalepId;
          let aktifAracId = podcastAracId;

          // AI kullanılmamış manuel veya transkriptsiz akışta kalıcı taslak yoksa oluştur
          if (!aktifTalepId) {
            let oturumAnahtari = podcastTaslakOturumAnahtari;
            const depoAnahtari = `hapbilgi:podcast-taslak:${kullanici?.id ?? "anonim"}`;
            if (!oturumAnahtari) {
              try {
                const kayit = JSON.parse(window.sessionStorage.getItem(depoAnahtari) ?? "null");
                if (kayit?.oturum_anahtari) oturumAnahtari = kayit.oturum_anahtari;
              } catch {}
            }
            if (!oturumAnahtari) {
              oturumAnahtari = crypto.randomUUID();
              setPodcastTaslakOturumAnahtari(oturumAnahtari);
            }

            const taslakRes = await fetch("/talepler/api/taslak", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                oturum_anahtari: oturumAnahtari,
                egitim_turu: egitimTuru,
                hedef_roller: hedefRoller,
                urun_id: (turKurali.urun !== "yok" || eczanemHedef) ? seciliUrunId || null : null,
                teknik_id: (!eclubHedef && !eczanemHedef && turKurali.teknik !== "yok") ? seciliTeknikId || null : null,
                urun_adi: serbestAdGoster ? serbestAd.trim() : null,
                aciklama,
                ogrenme_araci_turu: "podcast",
                ogrenme_araci_tercihleri: {},
                hazir_video: true,
                hazir_soru_seti: hazirSoruSeti,
                hazir_soru_seti_verisi:
                  hazirSoruSeti && soruTaslaklari.length > 0 ? taslaklardanSorular(soruTaslaklari) : null,
                soru_seti_buyuklugu: soruSetiBuyuklugu,
                secenek_sayisi: secenekSayisi,
                video_basi_soru_sayisi: videoBasiSoruSayisi,
              }),
            });

            const taslakData = await taslakRes.json().catch(() => ({}));
            if (!taslakRes.ok || !taslakData.talep_id || !taslakData.arac_id) {
              hata(taslakData.hata ?? "Podcast taslağı oluşturulamadı.", "taslak oluşturma", taslakData.detay);
              return;
            }

            aktifTalepId = taslakData.talep_id as string;
            aktifAracId = taslakData.arac_id as string;
            setPodcastTaslakTalepId(aktifTalepId);
            setPodcastAracId(aktifAracId);

            try {
              window.sessionStorage.setItem(
                depoAnahtari,
                JSON.stringify({ oturum_anahtari: oturumAnahtari, talep_id: aktifTalepId, arac_id: aktifAracId })
              );
            } catch {}
          }

          // Mevcut taslakta ses daha önce yüklenmişse tekrar yükleme yapma
          const sesOncedenYuklendi = podcastSesYuklendi || Boolean(
            aktifAracId && (
              podcastAiAsamasi === "ai_kuyrukta" ||
              podcastAiAsamasi === "ai_isleniyor" ||
              podcastAiAsamasi === "transkript_hazir" ||
              sunucuTranskriptDurumu === "onaylandi" ||
              sunucuTranskriptDurumu === "iptal" ||
              sunucuTranskriptDurumu === "ai_taslak"
            )
          );

          if (!sesOncedenYuklendi || bekleyenPodcastKapak || bekleyenPodcastTranskript) {
            if (!sesOncedenYuklendi && !bekleyenPodcast?.dosya) {
              hata("Podcast ses dosyası bulunamadı.", "podcast yükleme");
              return;
            }
            try {
              await hazirPodcastYukle({
                talepId: aktifTalepId,
                aracId: aktifAracId || undefined,
                // ses: sesOncedenYuklendi ? undefined : bekleyenPodcast.dosya
                ses: sesOncedenYuklendi ? undefined : bekleyenPodcast?.dosya,
                kapak: bekleyenPodcastKapak ? bekleyenPodcastKapak.dosya : undefined,
                transkript: bekleyenPodcastTranskript ? bekleyenPodcastTranskript.dosya : undefined,
                transkriptMetni: podcastTranskriptMetni || undefined,
                transkriptOnaylandi: podcastTranskriptOnaylandi,
                aiTranskriptIstendi: false, // Kesinleştirmede Gemini ASLA yeniden başlatılmaz
                tamamlananParcalar: sesOncedenYuklendi ? ["ana"] : undefined,
                taslakModu: true, // Erken üretim doğrulamasını engelle, teknik doğrulamayı tamamla
                kontrol,
              });
              setPodcastSesYuklendi(true);
            } catch (error) {
              setPodcastTranskriptOnaylandi(false);
              hata("Podcast dosyaları yüklenemedi.", "podcast yükleme", error instanceof Error ? error.message : undefined);
              return; // Hata durumunda taslak korunur, tekrar denenebilir
            }
          }

          // Bütün dosya hazırlıkları ve teknik doğrulamalar bitti — şimdi atomik kesinleştirme çağrısı
          const talep_id = await submitTalep(aktifTalepId);
          if (!talep_id) return; // Hata durumunda taslak korunur

          const basarisizlar: string[] = [];
          if (bekleyenDosyalar.length > 0) {
            basarisizlar.push(...(await uploadDosyalar(talep_id)));
          }

          // Kesinleştirme sonrası istemci hazirPodcastYukle veya /podcast-dogrula ÇAĞIRMAZ!
          if (basarisizlar.length === 0) {
            basari(uretimToast(
              { rol: "uretici", olay: "talep_gonderildi" },
              { varyant: toastVaryant(hazirVideo, hazirSoruSeti), ogrenmeAraciTuru },
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
          return;
        }

        const talep_id = await submitTalep();
        if (!talep_id) return;
        // Talep bu noktada oluştu — dosya sonucu ne olursa olsun kullanıcıya
        // gerçek durum söylenir; kısmi başarısızlık gizlenmez (F-01/3).
        const basarisizlar: string[] = [];
        let videoIsleniyor = false;
        if (hazirVideo && ogrenmeAraciTuru === "video" && bekleyenVideo) {
          const sonuc = await uploadVideo(talep_id);
          if (sonuc === "basarisiz") basarisizlar.push(`${bekleyenVideo.preview.dosya_adi} (video)`);
          if (sonuc === "isleniyor") videoIsleniyor = true;
        }
        if (hazirVideo && ogrenmeAraciTuru === "gorsel" && bekleyenGorsel) {
          try {
            await hazirGorselYukle({ talepId: talep_id, gorsel: bekleyenGorsel.dosya, kontrol });
          } catch (error) {
            hata("Görsel yüklenemedi.", "görsel yükleme", error instanceof Error ? error.message : undefined);
            basarisizlar.push(`${bekleyenGorsel.preview.dosya_adi} (görsel)`);
          }
        }
        if (hazirVideo && ogrenmeAraciTuru === "flip_pdf" && bekleyenFlipPdf) {
          try {
            await hazirFlipPdfYukle({ talepId: talep_id, pdf: bekleyenFlipPdf.dosya, kontrol });
          } catch (error) {
            hata("Literatür yüklenemedi.", "PDF yükleme", error instanceof Error ? error.message : undefined);
            basarisizlar.push(`${bekleyenFlipPdf.preview.dosya_adi} (Literatür)`);
          }
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
          basari(uretimToast(
            { rol: "uretici", olay: "talep_gonderildi" },
            { varyant: toastVaryant(hazirVideo, hazirSoruSeti), ogrenmeAraciTuru },
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
        if (ogrenmeAraciYuklemeRef.current === yuklemeDenetleyicisi) {
          ogrenmeAraciYuklemeRef.current = null;
        }
        setAracYuklemeBilgisi(null);
        setFormLoading(false);
      }
    },
    [
      submitTalep,
      hazirVideo,
      ogrenmeAraciTuru,
      hazirSoruSeti,
      bekleyenVideo,
      bekleyenPodcast,
      podcastTaslakTalepId,
      podcastAracId,
      podcastTaslakOturumAnahtari,
      podcastSesYuklendi,
      podcastAiAsamasi,
      sunucuTranskriptDurumu,
      podcastTranskriptMetni,
      podcastTranskriptOnaylandi,
      bekleyenPodcastKapak,
      bekleyenPodcastTranskript,
      bekleyenGorsel,
      bekleyenFlipPdf,
      uploadVideo,
      bekleyenDosyalar.length,
      uploadDosyalar,
      basari,
      hata,
      uyari,
      resetForm,
      onTalepOlusturuldu,
      kullanici?.id,
      egitimTuru,
      hedefRoller,
      turKurali,
      eczanemHedef,
      seciliUrunId,
      eclubHedef,
      seciliTeknikId,
      serbestAdGoster,
      serbestAd,
      aciklama,
      soruTaslaklari,
      soruSetiBuyuklugu,
      secenekSayisi,
      videoBasiSoruSayisi,
      bildirimRozetleriniYenile,
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
  const ogrenmeAraciYuklemeyiIptalEt = useCallback(() => {
    ogrenmeAraciYuklemeRef.current?.abort();
  }, []);

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

    // form: öğrenme aracı + hazır araç
    ogrenmeAraciBayraklari,
    ogrenmeAraciTuru,
    handleOgrenmeAraciTuruDegis,
    hazirVideo,
    toggleHazirVideo,
    bekleyenVideo,
    handleVideoSec,
    handleBekleyenVideoSil,
    videoYuklemeYuzdesi,
    videoIslemeBekleniyor,
    aracYuklemeBilgisi,
    ogrenmeAraciYuklemeyiIptalEt,

    // form: podcast
    bekleyenPodcast,
    bekleyenPodcastKapak,
    bekleyenPodcastTranskript,
    podcastTranskriptMetni,
    podcastTranskriptOnaylandi,
    sunucuTranskriptDurumu,
    gonderButonuEtkin,
    gonderButonuPasifNedeni,
    podcastAiTranskriptIstendi,
    podcastTaslakTalepId,
    podcastAracId,
    podcastAiAsamasi,
    podcastAiYuklemeYuzdesi,
    podcastAiHatasi,
    podcastAiYukleniyor,
    podcastSesYuklendi,
    podcastYuklenenDosyaAdi,
    podcastKapakYuklendi,
    podcastYuklenenKapakAdi,
    handlePodcastSec,
    handlePodcastKapakSec,
    handlePodcastTranskriptSec,
    handleBekleyenPodcastSil: () => {
      setBekleyenPodcast(null);
      setPodcastTranskriptOnaylandi(false);
      setPodcastSesYuklendi(false);
      setPodcastYuklenenDosyaAdi(null);
    },
    handleBekleyenPodcastKapakSil: () => {
      setBekleyenPodcastKapak(null);
      setPodcastKapakYuklendi(false);
      setPodcastYuklenenKapakAdi(null);
    },
    handleBekleyenPodcastTranskriptSil: () => {
      setBekleyenPodcastTranskript(null);
      setPodcastTranskriptMetni("");
      setPodcastTranskriptOnaylandi(false);
      setPodcastAiTranskriptIstendi(false);
      setSunucuTranskriptDurumu((onceki) => (onceki === "manuel_taslak" ? "yok" : onceki));
    },
    handlePodcastTranskriptMetinDegisti,
    handlePodcastTranskriptOnayla,
    handlePodcastTranskriptIptal,
    handlePodcastTranskriptSunucuOnayla,
    handlePodcastTranskriptSunucuIptal,
    handlePodcastTaslakIptal,
    handlePodcastAiTranskriptIstendiDegisti,
    handlePodcastTranskriptDosyaSecildi,
    handlePodcastAiTranskriptBaslat,

    // form: görsel
    bekleyenGorsel,
    handleGorselSec,
    handleBekleyenGorselSil: () => setBekleyenGorsel(null),

    // form: Flip PDF
    bekleyenFlipPdf,
    handleFlipPdfSec,
    handleBekleyenFlipPdfSil: () => setBekleyenFlipPdf(null),

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
