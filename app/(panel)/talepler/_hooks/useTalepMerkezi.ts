// app/talepler/_hooks/useTalepMerkezi.ts
//
// Talep merkezli sayfanın tek state otoritesi: liste + seçim.
//
// Sayfanın omurgası "seçili talep"tir — kullanıcı rota değiştirmeden soldan bir
// talep seçer, sağda onun üretim şeridini görür. Bu yüzden seçim durumu burada
// yaşar; sol ve sağ kolon aynı kaynaktan beslenir.
//
// Süzme BURADA yapılır, bileşenlerde değil (bugünkü Talepler sayfasının deseni):
// bileşen ne süzer ne durum yorumlar.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { uretimToast, toastVaryant, type ToastAsama, type ToastOlay } from "@/lib/uretim/toastMesaj";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";
import { SORGU_ARALIGI_MS, TAVAN_SANIYE } from "@/lib/video/islemeDurumu";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import type { TalepDetay, TalepSatiri } from "../_ureticiRolTypes";

export type KararDurumu = "onaylandi" | "revizyon bekleniyor" | "Iptal Edildi";

export function useTalepMerkezi() {
  const { kullanici } = useAuth();
  const { mesajlar, hata, basari, uyari } = useHataMesaji();

  const [talepler, setTalepler] = useState<TalepSatiri[]>([]);
  const [loading, setLoading] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [seciliTalepId, setSeciliTalepId] = useState<string | null>(null);

  // Derin veri yalnız SEÇİLEN talep için gelir — liste hafif kalsın diye (A-5).
  const [detay, setDetay] = useState<TalepDetay | null>(null);
  const [detayYukleniyor, setDetayYukleniyor] = useState(false);
  // Karar verildikten sonra detayı yeniden çekmek için sayaç — seçim değişmediği
  // hâlde derin verinin tazelenmesi gereken tek durum budur.
  const [detayTetik, setDetayTetik] = useState(0);
  const [kararYukleniyor, setKararYukleniyor] = useState(false);
  // Hazır video yüklemesi (V2/V4): yüzde null ise yükleme sürmüyor demektir.
  const [videoYuzdesi, setVideoYuzdesi] = useState<number | null>(null);

  // Yeni talep açıldıktan sonraki ilk tazelemede en yeni talep otomatik seçilir.
  // Bayrak burada tutulur: liste sunucudan gelmeden hangi talebin yeni olduğu
  // bilinemez, seçim de o anda yapılmalı.
  const enYeniyiSec = useRef(false);

  const veriCek = useCallback(async (ilkYukleme = false) => {
    if (ilkYukleme) setLoading(true);
    else setYenileniyor(true);
    try {
      const res = await fetch("/talepler/api/uretici-rol");
      const data = await res.json();
      if (!res.ok) {
        hata(data.hata ?? "Talepler yüklenemedi.", data.adim, data.detay);
      } else {
        const gelen: TalepSatiri[] = data.talepler ?? [];
        setTalepler(gelen);
        if (enYeniyiSec.current) {
          const yeni = gelen.find((t) => !t.uretim_bitti && !t.iptal_edildi);
          if (yeni) setSeciliTalepId(yeni.talep_id);
          enYeniyiSec.current = false;
        }
      }
    } catch (err) {
      hata("Talepler yüklenemedi.", "Talep Merkezi", err instanceof Error ? err.message : undefined);
    } finally {
      if (ilkYukleme) setLoading(false);
      else setYenileniyor(false);
    }
  }, [hata]);

  /** Yeni Talep akordiyonu talep açtığında çağrılır (A-10). */
  const talepOlusturuldu = useCallback(async () => {
    enYeniyiSec.current = true;
    await veriCek();
  }, [veriCek]);

  useEffect(() => {
    if (kullanici) void veriCek(true);
  }, [kullanici, veriCek]);

  // D-4: yalnız üretimi devam edenler solda; iptaller kendi akordiyonunda (A-11);
  // üretimi bitmiş talepler bu sayfada hiç görünmez — onlar Yayın Listesi'ne ait.
  const devamEdenler = useMemo(
    () => talepler.filter((t) => !t.uretim_bitti && !t.iptal_edildi),
    [talepler],
  );

  const iptalEdilenler = useMemo(
    () => talepler.filter((t) => t.iptal_edildi),
    [talepler],
  );

  // Seçili talep listeden düşerse (onaylandı / iptal edildi) seçim temizlenir —
  // sağ kolon var olmayan bir talebi göstermeye devam etmesin.
  const seciliTalep = useMemo(
    () => devamEdenler.find((t) => t.talep_id === seciliTalepId) ?? null,
    [devamEdenler, seciliTalepId],
  );

  // Seçim değişince detay tazelenir. Yarış koşulu: hızlı seçim değişiminde geç
  // dönen eski yanıt yenisinin üzerine yazmasın diye iptal bayrağı tutulur.
  useEffect(() => {
    if (!seciliTalepId) {
      setDetay(null);
      return;
    }
    let aktif = true;
    setDetayYukleniyor(true);
    (async () => {
      const res = await fetch(`/talepler/api/detay?talep_id=${seciliTalepId}`);
      const data = await res.json();
      if (!aktif) return;
      if (!res.ok) {
        hata(data.hata ?? "Talep detayı yüklenemedi.", data.adim, data.detay);
        setDetay(null);
      } else {
        setDetay(data);
          void fetch("/bildirimler/api", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ talep_id: seciliTalepId }),
          }).then((yanit) => { if (yanit.ok) bildirimRozetleriniYenile(); });
      }
      setDetayYukleniyor(false);
    })();
    return () => { aktif = false; };
  }, [seciliTalepId, detayTetik, hata]);

  // Hazır video talebe bağlandıktan sonra arka planda işlenirken yükleme alanını
  // yeniden açma. Webhook zinciri tamamlayınca seçili talebi ve listeyi tazele.
  useEffect(() => {
    if (!seciliTalepId || !detay?.video_isleniyor) return;

    let aktif = true;
    let istekDevamEdiyor = false;
    const baslangic = Date.now();

    const durumuYenile = async () => {
      if (!aktif || istekDevamEdiyor) return;
      if (Date.now() - baslangic >= TAVAN_SANIYE * 1000) {
        window.clearInterval(zamanlayici);
        return;
      }

      istekDevamEdiyor = true;
      try {
        const res = await fetch(`/talepler/api/detay?talep_id=${seciliTalepId}`, { cache: "no-store" });
        const data = await res.json();
        if (!aktif || !res.ok) return;

        setDetay(data);
        if (!data.video_isleniyor) {
          window.clearInterval(zamanlayici);
          if (seciliTalep?.hazir_soru_seti) bildirimRozetleriniYenile();
          await veriCek();
        }
      } catch {
        // Geçici bağlantı hatasında bir sonraki sınırlı sorgu denenir.
      } finally {
        istekDevamEdiyor = false;
      }
    };

    const zamanlayici = window.setInterval(() => void durumuYenile(), SORGU_ARALIGI_MS);
    return () => {
      aktif = false;
      window.clearInterval(zamanlayici);
    };
  }, [seciliTalepId, seciliTalep?.hazir_soru_seti, detay?.video_isleniyor, veriCek]);

  /**
   * Üreticinin kararı: onay / revizyon / iptal. Hedef uç aktif adımdan çözülür.
   * Kural kontrolleri (revizyon tavanı, notun zorunluluğu, sahiplik) hem burada
   * hem sunucuda var — sunucu son sözü söyler, buradaki kapı kullanıcıyı boşuna
   * tıklatmamak içindir (kural girdide uygulanır).
   */
  const kararVer = useCallback(
    async (
      hedef: { asama: ToastAsama; id: string; revizyonSayisi: number },
      durum: KararDurumu,
      notlar?: string,
    ) => {
      const talep = talepler.find((t) => t.talep_id === seciliTalepId);
      if (!talep) return;

      setKararYukleniyor(true);
      try {
        const res = await fetch("/uretim/api/karar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gorev_id: hedef.id, karar: durum, notlar, islem_anahtari: crypto.randomUUID() }),
        });
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "İşlem gerçekleştirilemedi.", d.adim, d.detay);
          return;
        }

        // Metin merkezden çözülür (26.07): sayfa cümle tutmaz, olayı ve varyantı verir.
        // "Revize senaryoyu onayladınız" ayrımı revizyon geçmişinden gelir.
        const olay: ToastOlay =
          durum === "onaylandi"
            ? { rol: "uretici", olay: "onay", asama: hedef.asama, revize: hedef.revizyonSayisi > 0 }
            : durum === "revizyon bekleniyor"
            ? { rol: "uretici", olay: "revizyon", asama: hedef.asama }
            : { rol: "uretici", olay: "iptal", asama: hedef.asama };

        basari(uretimToast(olay, {
          varyant: toastVaryant(talep.hazir_video, talep.hazir_soru_seti),
          rolAdi: talep.uretici_rol_adi,
        }));

        if (durum === "onaylandi" && hedef.asama === "soru_seti") {
          bildirimRozetleriniYenile();
        }

        setDetayTetik((x) => x + 1);
        await veriCek();
      } finally {
        setKararYukleniyor(false);
      }
    },
    [talepler, seciliTalepId, hata, basari, veriCek],
  );

  /**
   * Hazır video yüklemesi (V2/V4) — mevcut üç uç aynen kullanılır:
   *   1) vezne izin verir (kimlik + sıra kontrolü, Bunny kaydını SİSTEM açar),
   *   2) dosya tarayıcıdan DOĞRUDAN Bunny'ye gider (sunucumuza uğramaz),
   *   3) kanonik embed adresi talebe bağlanır; Bunny Ready + pozitif süre
   *      doğrulayınca zincir kurulur.
   * TUS patlarsa vezneden açılmış ama hiçbir kayda bağlanmamış Bunny kaydı
   * temizlenir — yetim kayıt bırakılmaz.
   */
  const hazirVideoYukle = useCallback(
    async (dosya: File) => {
      const talep = talepler.find((t) => t.talep_id === seciliTalepId);
      if (!talep) return;

      setVideoYuzdesi(0);
      try {
        const res = await fetch("/talepler/api/bunny-yukleme-baslat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talep_id: talep.talep_id }),
        });
        const izin = await res.json();
        if (!res.ok) {
          hata(izin.hata ?? "Video yüklemesi başlatılamadı.", izin.adim, izin.detay);
          return;
        }

        try {
          await bunnyTusYukle(dosya, izin, setVideoYuzdesi);
        } catch (err: unknown) {
          hata("Video yüklenemedi.", "TUS yükleme", err instanceof Error ? err.message : undefined);
          fetch("/videolar/api/bunny-yukleme-iptal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_guid: izin.video_guid }),
          }).catch(() => {});
          return;
        }

        // Decouple: encode boyunca bekletme. Bir kez dener — hazırsa anında
        // tamamlanır; değilse tamamlamayı ARKA PLANA devreder (aynı idempotent uç;
        // prod'da webhook + mutabakat da toplar).
        const denemePut = async () => {
          const res2 = await fetch("/uretim/api/hazir-video", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ talep_id: talep.talep_id, video_url: izin.embed_url, islem_anahtari: izin.video_guid }),
          });
          const d2 = await res2.json().catch(() => ({}));
          return { status: res2.status, ok: res2.ok, d2 };
        };

        let tamamlandi = false;
        try {
          const ilk = await denemePut();
          if (ilk.ok && ilk.status !== 202) tamamlandi = true;
          else if (ilk.status !== 202 && ilk.status < 500) {
            hata(ilk.d2.hata ?? "Video doğrulanamadı.", ilk.d2.adim, ilk.d2.detay);
            return;
          }
        } catch {
          // Geçici hata → arka plana devret.
        }

        if (!tamamlandi) {
          void (async () => {
            const baslangic = Date.now();
            while (Date.now() - baslangic < TAVAN_SANIYE * 1000) {
              await new Promise((coz) => setTimeout(coz, SORGU_ARALIGI_MS));
              try {
                const t = await denemePut();
                if (t.ok && t.status !== 202) return;
                if (t.status !== 202 && t.status < 500) return;
              } catch { /* geçici hata; sonraki tur */ }
            }
          })();
          uyari(
            "Video yüklendi — hazır olunca otomatik yayına alınacak.",
            undefined,
            true
          );
          setDetayTetik((x) => x + 1);
          await veriCek();
          return;
        }

        // Zincir bu anda kurulur; metni sözlük çözer (V2'de soru seti işi İÜ'ye
        // düşer, V4'te iş üreticide kalır ve yayın yönetimine yönlendirilir).
        basari(uretimToast(
          { rol: "uretici", olay: "talep_gonderildi" },
          { varyant: toastVaryant(talep.hazir_video, talep.hazir_soru_seti) },
        ));

        setDetayTetik((x) => x + 1);
        await veriCek();
      } finally {
        setVideoYuzdesi(null);
      }
    },
    [talepler, seciliTalepId, hata, basari, uyari, veriCek],
  );

  // Biçim /talepler sayfasıyla AYNI (28.07 düzeltmesi): burada saat/dakika yoktu,
  // aynı talep iki sayfada iki farklı tarih gösteriyordu.
  const formatTarih = useCallback(
    (tarih: string | null) =>
      tarih
        ? new Date(tarih).toLocaleDateString("tr-TR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
    [],
  );

  return {
    kullanici,
    loading,
    yenileniyor,
    talepler,
    devamEdenler,
    iptalEdilenler,
    seciliTalepId,
    seciliTalep,
    setSeciliTalepId,
    detay,
    detayYukleniyor,
    kararVer,
    kararYukleniyor,
    hazirVideoYukle,
    videoYuzdesi,
    formatTarih,
    veriCek,
    talepOlusturuldu,
    mesajlar,
    hata,
  };
}
