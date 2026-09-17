"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { SoruIceAktar } from "@/components/SoruIceAktar";
import { SoruSetiFormu } from "@/components/SoruSetiFormu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { TeknikPill, VaryantPill, HedefRolPilleri } from "@/components/pill";
import { bunnyTusYukle, videoYuklemeOturumuGuncelle } from "@/lib/video/bunnyTusIstemci";
import { type SoruTaslagi, sorulardanTaslaklar, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular } from "@/lib/soru/taslak";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { durumMesaji, gorevDurumKodu, type Asama } from "@/lib/utils/durum/mesaj";
import { talepIdGoster } from "@/lib/utils/talepId";
import { uretimToast, toastVaryant, type ToastAsama, type ToastOlay } from "@/lib/uretim/toastMesaj";
import type { UretimGorevIcerigi, UretimGorevi } from "@/lib/uretim/gorevTipleri";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import {
  hazirFlipPdfYukle,
  hazirGorselYukle,
  hazirPodcastYukle,
  type OgrenmeAraciYuklemeKontrolu,
} from "@/lib/ogrenmeAraci/bunnyYuklemeIstemci";
import { ogrenmeAraciMetinleri } from "@/lib/ogrenmeAraci/etiketler";
import PodcastKapakGorseli from "@/components/ogrenme-araci/PodcastKapakGorseli";
import { PodcastTranskriptEditoru } from "@/app/(panel)/talepler/_components/PodcastTranskriptEditoru";

const ASAMA: Record<ToastAsama, { etiket: Asama; liste: string }> = {
  senaryo: { etiket: "Senaryo", liste: "/senaryolar" },
  video: { etiket: "Video", liste: "/videolar" },
  soru_seti: { etiket: "Soru Seti", liste: "/soru-setleri" },
};

export default function UretimGorevDetayPage() {
  const params = useParams<{ gorev_id: string }>();
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();
  const [gorev, setGorev] = useState<UretimGorevi | null>(null);
  const [loading, setLoading] = useState(true);
  const [islem, setIslem] = useState(false);
  const [senaryoMetni, setSenaryoMetni] = useState("");
  const [taslaklar, setTaslaklar] = useState<SoruTaslagi[]>([]);
  const [revizyonAcik, setRevizyonAcik] = useState(false);
  const [revizyonNotu, setRevizyonNotu] = useState("");
  const [revizyondaTranskriptIstendi, setRevizyondaTranskriptIstendi] = useState(false);
  const [videoYuzdesi, setVideoYuzdesi] = useState<number | null>(null);
  const [yuklenenVideo, setYuklenenVideo] = useState<{ video_url: string; dosya_adi: string; yukleme_id?: string | null } | null>(null);
  const [podcastDosyalari, setPodcastDosyalari] = useState<{ ses?: File; kapak?: File }>({});
  const [podcastTranskriptMetni, setPodcastTranskriptMetni] = useState<string>("");
  const [podcastTranskriptOnaylandi, setPodcastTranskriptOnaylandi] = useState<boolean>(false);
  const [podcastAiGirisimId, setPodcastAiGirisimId] = useState<string | null>(null);
  const [podcastAracId, setPodcastAracId] = useState<string | null>(null);
  const [podcastAiAsamasi, setPodcastAiAsamasi] = useState<
    "bosta" | "taslak_hazirlaniyor" | "podcast_yukleniyor" | "podcast_dogrulaniyor" | "ai_kuyrukta" | "ai_isleniyor" | "transkript_hazir" | "hata"
  >("bosta");
  const [podcastAiHatasi, setPodcastAiHatasi] = useState<string | null>(null);
  const [podcastAiYukleniyor, setPodcastAiYukleniyor] = useState<boolean>(false);
  const podcastKullaniciDuzenlediRef = useRef<boolean>(false);
  const [gorselDosyasi, setGorselDosyasi] = useState<File | null>(null);
  const [flipPdfDosyasi, setFlipPdfDosyasi] = useState<File | null>(null);
  const [flipPdfKapagi, setFlipPdfKapagi] = useState<File | null>(null);
  const aracYuklemeRef = useRef<AbortController | null>(null);
  const [aracYuklemeBilgisi, setAracYuklemeBilgisi] = useState<{ yuzde: number; dosyaRolu: string } | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) router.push("/login");
  }, [authYukleniyor, kullanici, router]);

  const veriCek = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/uretim/api/gorevler?gorev_id=${params.gorev_id}`);
      const veri = await res.json();
      if (!res.ok) {
        hata(veri.hata ?? "Üretim görevi yüklenemedi.", veri.adim, veri.detay);
        setGorev(null);
      } else {
        const gelen = (veri.gorevler?.[0] ?? null) as UretimGorevi | null;
        setGorev(gelen);
        if (gelen?.arac_id) setPodcastAracId(gelen.arac_id);
        if (gelen) {
          void fetch("/bildirimler/api", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gorev_id: gelen.gorev_id }),
          }).then((yanit) => { if (yanit.ok) bildirimRozetleriniYenile(); });
        }
        if (gelen?.icerik?.asama === "senaryo") setSenaryoMetni(gelen.icerik.senaryo_metni ?? "");
        if (gelen?.asama === "soru_seti") {
          const mevcut = gelen.icerik?.asama === "soru_seti" ? sorulardanTaslaklar(gelen.icerik.sorular) : [];
          setTaslaklar(taslaklariBoyutla(mevcut, gelen.talep?.soru_seti_buyuklugu ?? 25, gelen.talep?.secenek_sayisi ?? 4));
        }
        if (gelen?.icerik?.asama === "podcast") {
          const p = gelen.icerik;
          if (p.transkript_durumu === "onaylandi") {
            setPodcastTranskriptOnaylandi(true);
            if (!podcastKullaniciDuzenlediRef.current && p.onaylanan_metin) {
              setPodcastTranskriptMetni(p.onaylanan_metin);
            }
            setPodcastAiAsamasi("transkript_hazir");
          } else if (p.transkript_durumu === "ai_taslak") {
            setPodcastTranskriptOnaylandi(false);
            if (!podcastKullaniciDuzenlediRef.current && p.taslak_metin) {
              setPodcastTranskriptMetni(p.taslak_metin);
            }
            setPodcastAiAsamasi("transkript_hazir");
          } else if (p.transkript_durumu === "ai_bekliyor") {
            setPodcastAiAsamasi("ai_kuyrukta");
            setPodcastAiGirisimId(p.ai_girisim_id ?? null);
          } else if (p.transkript_durumu === "ai_isleniyor") {
            setPodcastAiAsamasi("ai_isleniyor");
            setPodcastAiGirisimId(p.ai_girisim_id ?? null);
          } else if (p.transkript_durumu === "hata") {
            setPodcastAiAsamasi("hata");
            setPodcastAiHatasi(p.hata_kodu ?? "Transkript oluşturulamadı.");
          }
        }
      }
    } catch (err) {
      hata("Üretim görevi yüklenemedi.", "üretim görev detayı", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata, params.gorev_id]);

  // AI Transkript kuyruk durumu tek polling döngüsü
  useEffect(() => {
    const aktifAracId = podcastAracId ?? gorev?.arac_id;
    if (!aktifAracId || !gorev || !["ai_kuyrukta", "ai_isleniyor"].includes(podcastAiAsamasi)) return;

    let iptalEdildi = false;
    const yokla = async () => {
      try {
        const res = await fetch(`/api/ogrenme-araclari/${aktifAracId}/transkript-durum?gorev_id=${gorev.gorev_id}`);
        if (!res.ok || iptalEdildi) return;
        const data = await res.json();
        if (!data?.ok || iptalEdildi) return;

        const durum = data.transkript?.durum as string | undefined;
        const gelenGirisimId = data.transkript?.ai_girisim_id as string | undefined;

        if (podcastAiGirisimId && gelenGirisimId && gelenGirisimId !== podcastAiGirisimId) {
          return;
        }

        if (durum === "ai_bekliyor") {
          setPodcastAiAsamasi("ai_kuyrukta");
        } else if (durum === "ai_isleniyor") {
          setPodcastAiAsamasi("ai_isleniyor");
        } else if (durum === "ai_taslak") {
          setPodcastAiAsamasi("transkript_hazir");
          setPodcastAiYukleniyor(false);
          setPodcastTranskriptOnaylandi(false);
          if (!podcastKullaniciDuzenlediRef.current && data.transkript?.taslak_metin) {
            setPodcastTranskriptMetni(data.transkript.taslak_metin);
          }
        } else if (durum === "onaylandi") {
          setPodcastAiAsamasi("transkript_hazir");
          setPodcastAiYukleniyor(false);
          setPodcastTranskriptOnaylandi(true);
          if (!podcastKullaniciDuzenlediRef.current && data.transkript?.onaylanan_metin) {
            setPodcastTranskriptMetni(data.transkript.onaylanan_metin);
          }
        } else if (durum === "hata") {
          setPodcastAiAsamasi("hata");
          setPodcastAiYukleniyor(false);
          setPodcastAiHatasi(data.transkript?.hata_kodu || "Transkript oluşturulamadı.");
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
  }, [gorev, podcastAracId, podcastAiAsamasi, podcastAiGirisimId]);

  useEffect(() => { if (kullanici) void veriCek(); }, [kullanici, veriCek]);
  useEffect(() => () => aracYuklemeRef.current?.abort(), []);

  const asama = gorev ? ASAMA[gorev.asama] : null;
  const gorunenAsamaEtiketi = gorev?.asama === "video"
    ? ogrenmeAraciMetinleri(gorev.talep?.ogrenme_araci_turu).ad
    : asama?.etiket;
  const isIU = kullanici?.rol === IU_ROLU;
  const isUretici = !!kullanici && URETICI_ROLLER.includes(kullanici.rol);
  const iuTeslimEdebilir = isIU && !!gorev && ["hazirlaniyor", "revizyon_bekliyor"].includes(gorev.durum);
  const ureticiKararVerebilir = isUretici && gorev?.durum === "inceleme_bekliyor" && gorev.talep?.uretici_id === kullanici?.id;
  const durum = gorev && asama ? durumMesaji(gorevDurumKodu(gorev.durum), kullanici?.rol, { asama: asama.etiket, rolAdi: gorev.talep?.uretici_rol_adi, tarih: gorev.updated_at, ogrenmeAraciTuru: gorev.talep?.ogrenme_araci_turu }) : null;
  const toastBaglam = useMemo(() => ({
    varyant: toastVaryant(gorev?.talep?.hazir_video, gorev?.talep?.hazir_soru_seti),
    ogrenmeAraciTuru: gorev?.talep?.ogrenme_araci_turu,
    rolAdi: gorev?.talep?.uretici_rol_adi,
  }), [gorev]);

  const teslimEt = async (ekAlanlar: Record<string, unknown>): Promise<"tamamlandi" | "isleniyor" | "basarisiz"> => {
    if (!gorev) return "basarisiz";
    setIslem(true);
    try {
      const res = await fetch("/uretim/api/teslim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gorev_id: gorev.gorev_id, asama: gorev.asama, islem_anahtari: crypto.randomUUID(), ...ekAlanlar }),
      });
      const veri = await res.json();
      if (!res.ok) {
        hata(veri.hata ?? "Görev teslim edilemedi.", veri.adim, veri.detay);
        return "basarisiz";
      }
      basari(uretimToast({ rol: "iu", olay: "teslim", asama: gorev.asama, revize: gorev.durum === "revizyon_bekliyor" }, toastBaglam));
      if (res.status !== 202) await veriCek();
      return res.status === 202 ? "isleniyor" : "tamamlandi";
    } catch (err) {
      hata("Görev teslim edilemedi.", "üretim görevi teslimi", err instanceof Error ? err.message : undefined);
      return "basarisiz";
    } finally {
      setIslem(false);
    }
  };

  const senaryoGonder = () => {
    if (!senaryoMetni.trim()) return hata("Senaryo metni zorunludur.", "senaryo kontrolü");
    void teslimEt({ senaryo_metni: senaryoMetni });
  };

  const soruSetiGonder = () => {
    const kontrol = taslaklariDogrula(taslaklar, gorev?.talep?.soru_seti_buyuklugu ?? 25);
    if (kontrol) return hata(kontrol, "soru seti kontrolü");
    void teslimEt({ sorular: taslaklardanSorular(taslaklar) });
  };

  const videoYukle = async (dosya: File) => {
    if (!gorev?.arac_id) return hata("Göreve bağlı video kaydı bulunamadı.", "video görevi");
    setIslem(true); setVideoYuzdesi(0);
    try {
      const izinRes = await fetch("/videolar/api/bunny-yukleme-baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arac_id: gorev.arac_id, dosya_adi: dosya.name, mime_type: dosya.type || "video/mp4", dosya_boyutu: dosya.size }) });
      const izin = await izinRes.json();
      if (!izinRes.ok) return hata(izin.hata ?? "Video yüklemesi başlatılamadı.", izin.adim, izin.detay);
      await bunnyTusYukle(dosya, izin, setVideoYuzdesi);
      await videoYuklemeOturumuGuncelle(izin.yukleme_id, "aktarim_tamamlandi");
      setYuklenenVideo({ video_url: izin.embed_url, dosya_adi: dosya.name, yukleme_id: izin.yukleme_id });
      basari("Video yüklendi. Göndermek için Gönder butonuna basın.");
    } catch (err) {
      hata("Video yüklenemedi.", "TUS yükleme", err instanceof Error ? err.message : undefined);
    } finally {
      setVideoYuzdesi(null); setIslem(false);
    }
  };

  const videoTeslimEt = async () => {
    if (!yuklenenVideo) return;
    const teslimSonucu = await teslimEt({ video_url: yuklenenVideo.video_url, thumbnail_url: null });
    if (teslimSonucu === "tamamlandi") {
      await videoYuklemeOturumuGuncelle(yuklenenVideo.yukleme_id, "baglandi").catch(() => undefined);
      setYuklenenVideo(null);
    } else if (teslimSonucu === "isleniyor") {
      // Oturum kaydı webhook/mutabakatın kalıcı teslim tutanağıdır; burada
      // kapatılmaz. Kullanıcı encode süresini beklemeden iş listesine dönebilir.
      setYuklenenVideo(null);
      router.push("/videolar");
    }
  };

  const aracYuklemeKontroluOlustur = (): OgrenmeAraciYuklemeKontrolu => {
    aracYuklemeRef.current?.abort();
    const denetleyici = new AbortController();
    aracYuklemeRef.current = denetleyici;
    return {
      signal: denetleyici.signal,
      onIlerleme: ({ yuzde, dosyaRolu }) => setAracYuklemeBilgisi({ yuzde, dosyaRolu }),
      onUyari: (mesaj) => uyari(mesaj),
    };
  };

  const aracYuklemeyiBitir = () => {
    aracYuklemeRef.current = null;
    setAracYuklemeBilgisi(null);
  };

  const onAiBaslat = async () => {
    if (!gorev) return;
    let aracId = podcastAracId ?? gorev.arac_id;

    if (!aracId && !podcastDosyalari.ses) {
      hata("Lütfen önce podcast ses dosyasını seçin.", "ses dosyası");
      return;
    }

    setPodcastAiYukleniyor(true);
    setPodcastAiHatasi(null);
    podcastKullaniciDuzenlediRef.current = false;
    setPodcastTranskriptMetni("");
    setPodcastTranskriptOnaylandi(false);

    try {
      if (!aracId || podcastDosyalari.ses) {
        setPodcastAiAsamasi("podcast_yukleniyor");
        const kontrol = aracYuklemeKontroluOlustur();
        aracId = await hazirPodcastYukle({
          talepId: gorev.talep_id,
          ses: podcastDosyalari.ses,
          kapak: podcastDosyalari.kapak,
          kaynak: "iu",
          gorevId: gorev.gorev_id,
          aracId: aracId ?? undefined,
          taslakModu: true,
          kontrol,
        });
        setPodcastAracId(aracId);
        aracYuklemeyiBitir();
        await veriCek();
      }

      setPodcastAiAsamasi("podcast_dogrulaniyor");
      const res = await fetch(`/api/ogrenme-araclari/${aracId}/transkript-ai-baslat?gorev_id=${gorev.gorev_id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setPodcastAiHatasi(data.hata ?? "AI transkripti başlatılamadı.");
        setPodcastAiAsamasi("hata");
        return;
      }
      setPodcastAiGirisimId(data.ai_girisim_id ?? null);
      setPodcastAiAsamasi("ai_kuyrukta");
      basari("AI transkript işi başlatıldı ve kuyruğa alındı.");
    } catch (err) {
      setPodcastAiHatasi(err instanceof Error ? err.message : "AI transkripti başlatılamadı.");
      setPodcastAiAsamasi("hata");
    } finally {
      setPodcastAiYukleniyor(false);
      aracYuklemeyiBitir();
    }
  };

  const onSunucuOnayla = async (nihaiMetin: string) => {
    const aktifAracId = podcastAracId ?? gorev?.arac_id;
    if (!aktifAracId || !gorev) return { ok: false, hata: "Önce podcast sesinin kaydedilmesi gerekir." };
    try {
      const res = await fetch(`/api/ogrenme-araclari/${aktifAracId}/transkript-yonet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islem: "onayla", nihai_metin: nihaiMetin, gorev_id: gorev.gorev_id }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, hata: data.hata ?? "Transkript onaylanamadı." };
      setPodcastTranskriptOnaylandi(true);
      return { ok: true };
    } catch {
      return { ok: false, hata: "Transkript onaylanırken ağ hatası oluştu." };
    }
  };

  const podcastTeslimEt = async () => {
    if (!gorev) return;
    const icerikPodcast = gorev.icerik?.asama === "podcast" ? gorev.icerik : null;
    const sesMevcut = Boolean(podcastDosyalari.ses || (icerikPodcast?.ses_url && gorev.arac_id));
    if (!sesMevcut) {
      return hata("Podcast ses dosyası zorunludur.", "podcast teslimi");
    }

    const transkriptIstendi = gorev.talep?.podcast_transkript_istendi ?? (icerikPodcast ? icerikPodcast.podcast_transkript_istendi : true);
    if (transkriptIstendi && !podcastDosyalari.ses) {
      if (!podcastTranskriptOnaylandi || podcastTranskriptMetni.trim().length < 10) {
        return hata("Lütfen transkripti inceleyip onaylayın.", "transkript onayı");
      }
    }

    setIslem(true);
    const kontrol = aracYuklemeKontroluOlustur();
    try {
      if (podcastDosyalari.ses) {
        const yuklenenAracId = await hazirPodcastYukle({
          talepId: gorev.talep_id,
          ses: podcastDosyalari.ses,
          kapak: podcastDosyalari.kapak,
          kaynak: "iu",
          gorevId: gorev.gorev_id,
          aracId: podcastAracId ?? gorev.arac_id ?? undefined,
          taslakModu: transkriptIstendi,
          kontrol,
        });
        if (transkriptIstendi) {
          setPodcastAracId(yuklenenAracId);
          setPodcastDosyalari({});
          setPodcastTranskriptMetni("");
          setPodcastTranskriptOnaylandi(false);
          podcastKullaniciDuzenlediRef.current = false;
          basari("Ses doğrulandı. Şimdi AI transkripti oluşturup onaylayın.");
          await veriCek();
          return;
        }
      } else if (gorev.arac_id) {
        const res = await fetch(`/api/ogrenme-araclari/${gorev.arac_id}/podcast-dogrula`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gorev_id: gorev.gorev_id,
            sure_saniye: icerikPodcast?.sure_saniye,
            islem_anahtari: crypto.randomUUID(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return hata(data.hata ?? "Podcast teslim edilemedi.", "podcast teslimi");
        }
      }
      basari("Podcast üretici incelemesine gönderildi.");
      setPodcastDosyalari({});
      await veriCek();
    } catch (err) {
      hata("Podcast teslim edilemedi.", "podcast teslimi", err instanceof Error ? err.message : undefined);
    } finally {
      aracYuklemeyiBitir();
      setIslem(false);
    }
  };

  const gorselYukle = async () => {
    if (!gorev || !gorselDosyasi) return;
    setIslem(true);
    const kontrol = aracYuklemeKontroluOlustur();
    try {
      await hazirGorselYukle({ talepId: gorev.talep_id, gorsel: gorselDosyasi, kaynak: "iu", gorevId: gorev.gorev_id, aracId: gorev.arac_id ?? undefined, kontrol });
      basari("Dijital Broşür üretici incelemesine gönderildi.");
      setGorselDosyasi(null);
      await veriCek();
    } catch (err) {
      hata("Dijital Broşür yüklenemedi.", "Dijital Broşür yükleme", err instanceof Error ? err.message : undefined);
    } finally { aracYuklemeyiBitir(); setIslem(false); }
  };

  const flipPdfYukle = async () => {
    if (!gorev || !flipPdfDosyasi) return;
    setIslem(true);
    const kontrol = aracYuklemeKontroluOlustur();
    try {
      await hazirFlipPdfYukle({ talepId: gorev.talep_id, pdf: flipPdfDosyasi, kapak: flipPdfKapagi ?? undefined, kaynak: "iu", gorevId: gorev.gorev_id, aracId: gorev.arac_id ?? undefined, kontrol });
      basari("Literatür üretici incelemesine gönderildi.");
      setFlipPdfDosyasi(null);
      await veriCek();
    } catch (err) {
      hata("Literatür yüklenemedi.", "Literatür yükleme", err instanceof Error ? err.message : undefined);
    } finally { aracYuklemeyiBitir(); setIslem(false); }
  };

  const kararVer = async (karar: "onaylandi" | "revizyon bekleniyor" | "Iptal Edildi", notlar?: string) => {
    if (!gorev) return;
    if (!Number.isInteger(gorev.surum) || gorev.surum < 1) {
      hata("İşleminizi güncellemek için sayfanızı yenileyin");
      return;
    }
    setIslem(true);
    try {
      const res = await fetch("/uretim/api/karar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gorev_id: gorev.gorev_id, karar, notlar, beklenen_surum: gorev.surum, islem_anahtari: crypto.randomUUID(), revizyonda_transkript_istendi: karar === "revizyon bekleniyor" ? revizyondaTranskriptIstendi : false }) });
      const veri = await res.json();
      if (!res.ok) return hata(veri.hata ?? "Karar kaydedilemedi.", veri.adim, veri.detay);
      const olay: ToastOlay = karar === "onaylandi" ? { rol: "uretici", olay: "onay", asama: gorev.asama, revize: gorev.revizyon_sayisi > 0 } : karar === "revizyon bekleniyor" ? { rol: "uretici", olay: "revizyon", asama: gorev.asama } : { rol: "uretici", olay: "iptal", asama: gorev.asama };
      basari(uretimToast(olay, toastBaglam));
      if (karar === "onaylandi" && gorev.asama === "soru_seti") {
        bildirimRozetleriniYenile();
      }
      setRevizyonAcik(false); setRevizyonNotu(""); setRevizyondaTranskriptIstendi(false); await veriCek();
    } finally {
      setIslem(false);
    }
  };

  if (!kullanici || loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#56aeff]" /></div>;
  if (!gorev || !asama) return <><div className="mx-auto max-w-3xl p-8 text-center text-sm text-gray-500">Görev bulunamadı veya erişim yetkiniz yok.</div><HataMesajiContainer mesajlar={mesajlar} /></>;

  const icerik = gorev.icerik as UretimGorevIcerigi | null | undefined;
  return (
    <>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-3 py-4 md:px-6 md:py-6">
        <button type="button" onClick={() => router.push(asama.liste)} className="w-fit border-0 bg-transparent p-0 text-sm text-gray-500">‹ {gorunenAsamaEtiketi} listesi</button>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 md:px-5">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{gorunenAsamaEtiketi} görevi</p><h1 className="mt-1 text-lg font-bold text-gray-900">{gorev.talep?.urun_adi ?? "-"}</h1><p className="mt-1 text-xs text-gray-500">{talepIdGoster(gorev.talep?.firma_adi ?? "", gorev.talep?.talep_no ?? 0)}</p></div>
            {durum && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: durum.renk.bg, color: durum.renk.text, border: `1px solid ${durum.renk.border}` }}>{durum.metin}</span>}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3 md:px-5"><TeknikPill teknikAdi={gorev.talep?.teknik_adi ?? "-"} /><HedefRolPilleri hedefRoller={gorev.talep?.hedef_roller ?? []} /><VaryantPill hazirVideo={gorev.talep?.hazir_video ?? false} hazirSoruSeti={gorev.talep?.hazir_soru_seti ?? false} ogrenmeAraciTuru={gorev.talep?.ogrenme_araci_turu} kendiSatirinda={false} />{gorev.atanan_iu && <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500">İçerik Üreticisi: {gorev.atanan_iu.ad_soyad}</span>}</div>

          <div className="flex flex-col gap-4 px-4 py-4 md:px-5">
            {aracYuklemeBilgisi && <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-blue-800">{aracYuklemeBilgisi.dosyaRolu}: %{aracYuklemeBilgisi.yuzde}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-[#56aeff]" style={{ width: `${aracYuklemeBilgisi.yuzde}%` }} /></div></div><button type="button" onClick={() => aracYuklemeRef.current?.abort()} className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs text-blue-700">Durdur</button></div>}
            {icerik?.asama === "senaryo" && icerik.senaryo_metni && <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700">{icerik.senaryo_metni}</div>}
            {icerik?.asama === "video" && icerik.video_url && <VideoOnizleme videoUrl={icerik.video_url} className="rounded-xl" ariaLabel="Üretim videosunu oynat" />}
            {icerik?.asama === "podcast" && <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><PodcastKapakGorseli kapakUrl={icerik.kapak_url ?? undefined} urunAdi={gorev.talep?.urun_adi} className="mx-auto aspect-square w-full max-w-56 rounded-xl object-cover" /><audio controls preload="metadata" src={icerik.ses_url} className="w-full" />{icerik.podcast_transkript_istendi === false ? <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">Bu talepte transkript istenmedi.</p> : icerik.onaylanan_metin ? <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="mb-2 text-xs font-bold text-gray-500">Onaylı transkript</p><div className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700">{icerik.onaylanan_metin}</div></div> : null}{icerik.transkript_url && <a href={icerik.transkript_url} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold text-[#287fce]">Transkript dosyasını aç</a>}</div>}
            {icerik?.asama === "gorsel" && <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><img src={icerik.gorsel_url} alt="Dijital Broşür önizlemesi" className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain" /><p className="mt-2 text-center text-xs text-gray-500">{icerik.genislik} × {icerik.yukseklik} px</p></div>}
            {icerik?.asama === "flip_pdf" && <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><iframe src={icerik.pdf_url} title="Literatür ön izlemesi" className="h-[70vh] w-full rounded-xl border border-gray-200 bg-white" /><p className="mt-2 text-center text-xs text-gray-500">{icerik.sayfa_sayisi} sayfa</p></div>}
            {icerik?.asama === "soru_seti" && icerik.sorular.length > 0 && <div className="flex flex-col gap-2">{icerik.sorular.map((soru, i) => <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-sm font-semibold text-gray-800">{i + 1}. {soru.soru_metni}</p><div className="mt-2 flex flex-wrap gap-1.5">{soru.secenekler.map((secenek) => <span key={secenek.harf} className={`rounded-full border px-2 py-1 text-xs ${secenek.dogru ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}>{secenek.harf}. {secenek.metin}</span>)}</div></div>)}</div>}

            {(gorev.durum_gecmisi ?? []).filter((d) => d.durum === "revizyon bekleniyor" && d.notlar).map((d, i) => <div key={`${d.created_at}-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><strong>Revizyon notu:</strong> {d.notlar}</div>)}

            {iuTeslimEdebilir && gorev.asama === "senaryo" && <div className="border-t border-gray-100 pt-4"><textarea value={senaryoMetni} onChange={(e) => setSenaryoMetni(e.target.value)} rows={14} placeholder="Senaryoyu yazın..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 outline-none focus:border-[#56aeff]" /><div className="mt-3 flex justify-end"><button type="button" onClick={senaryoGonder} disabled={islem || !senaryoMetni.trim()} className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div></div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "video" && <div className="border-t border-gray-100 pt-4">{yuklenenVideo ? <div className="flex flex-col gap-3"><VideoOnizleme videoUrl={yuklenenVideo.video_url} className="rounded-xl" ariaLabel="Yüklenen videoyu oynat" /><div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-xs font-semibold text-green-800">{yuklenenVideo.dosya_adi}</p><p className="mt-0.5 text-[11px] text-green-700">Video yüklendi; henüz üretici incelemesine gönderilmedi.</p></div><button type="button" onClick={() => void videoTeslimEt()} disabled={islem} className="shrink-0 rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Gönder</button></div></div> : <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#56aeff] bg-[#f6faff] px-5 py-8 text-center"><span className="text-sm font-semibold text-[#287fce]">{videoYuzdesi === null ? "Video dosyasını seçin" : `Yükleniyor: %${videoYuzdesi}`}</span><span className="mt-1 text-xs text-gray-400">Dosya yüklendikten sonra Gönder butonuyla incelemeye iletilir.</span><input type="file" accept="video/*" disabled={islem} className="hidden" onChange={(e) => { const dosya = e.target.files?.[0]; if (dosya) void videoYukle(dosya); e.currentTarget.value = ""; }} /></label>}</div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "podcast" && (() => {
              const icerikPodcast = gorev.icerik?.asama === "podcast" ? gorev.icerik : null;
              const sesYuklendi = Boolean(icerikPodcast?.ses_url && gorev.arac_id);
              const transkriptIstendi = gorev.talep?.podcast_transkript_istendi ?? (icerikPodcast?.podcast_transkript_istendi ?? true);
              const teslimEdilebilir = Boolean(
                (sesYuklendi || podcastDosyalari.ses) &&
                (podcastDosyalari.ses || !transkriptIstendi || (podcastTranskriptOnaylandi && podcastTranskriptMetni.trim().length >= 10))
              );

              return (
                <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
                  {/* Ses Dosyası Alanı */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      Podcast Ses Dosyası <span className="text-red-500">*</span>
                    </label>
                    {sesYuklendi && icerikPodcast?.ses_url ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-green-700">✓ Ses dosyası yüklendi ve doğrulandı</span>
                          <span className="text-xs text-gray-500">{icerikPodcast.sure_saniye} sn</span>
                        </div>
                        <audio controls preload="metadata" src={icerikPodcast.ses_url} className="w-full" />
                        <div className="pt-1">
                          <label className="text-[11px] text-blue-600 hover:underline cursor-pointer">
                            Sesi değiştirmek için yeni dosya seç
                            <input
                              type="file"
                              accept="audio/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setPodcastDosyalari((d) => ({ ...d, ses: f }));
                              }}
                            />
                          </label>
                          {podcastDosyalari.ses && (
                            <span className="ml-2 text-xs text-gray-600 font-medium">({podcastDosyalari.ses.name})</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <label className="block rounded-lg border border-dashed border-gray-300 p-3 text-sm hover:border-blue-400 cursor-pointer">
                        <span className="text-xs font-semibold text-[#2483e2]">
                          {podcastDosyalari.ses ? podcastDosyalari.ses.name : "Ses dosyasını seçin (.mp3, .m4a, .aac)"}
                        </span>
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setPodcastDosyalari((d) => ({ ...d, ses: f }));
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Yayın Görseli Alanı (İsteğe Bağlı) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      Yayın Görseli <span className="text-xs font-normal text-gray-400">(İsteğe bağlı)</span>
                    </label>
                    <label className="block rounded-lg border border-dashed border-gray-300 p-3 text-sm hover:border-blue-400 cursor-pointer">
                      <span className="text-xs text-gray-600">
                        {podcastDosyalari.kapak ? podcastDosyalari.kapak.name : "Kapak görseli seçin (JPEG, PNG, WebP)"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setPodcastDosyalari((d) => ({ ...d, kapak: f }));
                        }}
                      />
                    </label>
                  </div>

                  {/* AI Transkript Alanı (Yalnızca transkript_istendi=true ise) */}
                  {transkriptIstendi && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700">
                        Podcast Transkripti <span className="text-red-500">*</span>
                      </label>
                      <PodcastTranskriptEditoru
                        iuModu={true}
                        bekleyenDosya={null}
                        aracId={podcastAracId ?? gorev.arac_id ?? undefined}
                        islemDurumu={podcastAiAsamasi}
                        yuklemeYuzdesi={aracYuklemeBilgisi?.yuzde ?? 0}
                        metin={podcastTranskriptMetni}
                        onaylandi={podcastTranskriptOnaylandi}
                        aiIstendi={true}
                        onAiBaslat={onAiBaslat}
                        aiYukleniyor={podcastAiYukleniyor}
                        hataMesaji={podcastAiHatasi}
                        onDosyaSec={() => {}}
                        onMetinDegisti={(yeniMetin) => {
                          setPodcastTranskriptMetni(yeniMetin);
                          setPodcastTranskriptOnaylandi(false);
                          podcastKullaniciDuzenlediRef.current = true;
                        }}
                        onOnayla={() => setPodcastTranskriptOnaylandi(true)}
                        onIptalEt={() => {}}
                        onSunucuOnayla={onSunucuOnayla}
                      />
                    </div>
                  )}

                  {/* İncelemeye Gönder Düğmesi */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => void podcastTeslimEt()}
                      disabled={islem || !teslimEdilebilir}
                      className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#4096e8] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {islem ? "İşleniyor..." : (podcastDosyalari.ses && transkriptIstendi ? "Sesi Yükle ve Doğrula" : "İncelemeye Gönder")}
                    </button>
                  </div>
                </div>
              );
            })()}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "gorsel" && <div className="flex flex-col gap-3 border-t border-gray-100 pt-4"><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Dijital Broşür<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={(e) => setGorselDosyasi(e.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void gorselYukle()} disabled={islem || !gorselDosyasi} className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "flip_pdf" && <div className="flex flex-col gap-3 border-t border-gray-100 pt-4"><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Nihai Literatür<input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-xs" onChange={(e) => setFlipPdfDosyasi(e.target.files?.[0] ?? null)} /></label><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Yayın Görseli (isteğe bağlı)<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={(e) => setFlipPdfKapagi(e.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void flipPdfYukle()} disabled={islem || !flipPdfDosyasi} className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div>}
            {iuTeslimEdebilir && gorev.asama === "soru_seti" && <div className="border-t border-gray-100 pt-4"><SoruIceAktar secenekSayisi={gorev.talep?.secenek_sayisi ?? 4} onDoldur={(yeni, mesaj) => { setTaslaklar(taslaklariBoyutla(yeni, gorev.talep?.soru_seti_buyuklugu ?? 25, gorev.talep?.secenek_sayisi ?? 4)); if (mesaj) uyari(mesaj); }} /><SoruSetiFormu taslaklar={taslaklar} onDegis={setTaslaklar} buyukluk={gorev.talep?.soru_seti_buyuklugu ?? 25} secenekSayisi={gorev.talep?.secenek_sayisi ?? 4} /><div className="mt-3 flex justify-end"><button type="button" onClick={soruSetiGonder} disabled={islem} className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div></div>}

            {ureticiKararVerebilir && <div className="border-t border-gray-100 pt-4">{revizyonAcik ? <div className="flex flex-col gap-2"><textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)} rows={3} placeholder="Revizyon notunu yazın..." className="rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none" />{gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "podcast" && gorev.talep.podcast_transkript_istendi === false && <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><input type="checkbox" checked={revizyondaTranskriptIstendi} onChange={(e) => setRevizyondaTranskriptIstendi(e.target.checked)} className="mt-0.5" /><span><strong>Bu revizyonda transkript de istiyorum</strong><span className="mt-0.5 block text-xs text-amber-700">İçerik Üreticisi transkripti podcast sesinden AI ile oluşturup onaylayarak yeniden teslim eder.</span></span></label>}<div className="flex justify-end gap-2"><button type="button" onClick={() => { setRevizyonAcik(false); setRevizyonNotu(""); setRevizyondaTranskriptIstendi(false); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">Vazgeç</button><button type="button" disabled={islem || !revizyonNotu.trim()} onClick={() => void kararVer("revizyon bekleniyor", revizyonNotu)} className="rounded-lg border-0 bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Revizyon Gönder</button></div></div> : <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={islem} onClick={() => void kararVer("onaylandi")} className="rounded-lg border-0 bg-green-700 px-3 py-2 text-xs font-semibold text-white">Onayla</button>{gorev.revizyon_sayisi < 2 && <button type="button" disabled={islem} onClick={() => setRevizyonAcik(true)} className="rounded-lg border-0 bg-amber-500 px-3 py-2 text-xs font-semibold text-white">Revizyon İste</button>}<button type="button" disabled={islem} onClick={() => void kararVer("Iptal Edildi")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-[#bc2d0d]">İptal Et</button></div>}</div>}
          </div>
        </section>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
