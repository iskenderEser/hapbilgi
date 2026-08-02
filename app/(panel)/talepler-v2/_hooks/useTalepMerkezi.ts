// app/talepler-v2/_hooks/useTalepMerkezi.ts
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
import type { TalepDetay, TalepSatiri } from "../_types";

/** Aktif adım → hangi ucun hangi kimlikle çağrılacağı. Üç uç da mevcut, değiştirilmiyor. */
const KARAR_UCU: Record<ToastAsama, { yol: string; anahtar: string }> = {
  senaryo: { yol: "/senaryolar/api/durum", anahtar: "senaryo_id" },
  video: { yol: "/videolar/api/durum", anahtar: "video_id" },
  soru_seti: { yol: "/soru-setleri/api/durum", anahtar: "soru_seti_id" },
};

export type KararDurumu = "onaylandi" | "revizyon bekleniyor" | "Iptal Edildi";

export function useTalepMerkezi() {
  const { kullanici } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [talepler, setTalepler] = useState<TalepSatiri[]>([]);
  const [loading, setLoading] = useState(true);
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

  const veriCek = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/talepler-v2/api");
    const data = await res.json();
    if (!res.ok) {
      hata(data.hata ?? "Talepler yüklenemedi.", data.adim, data.detay);
    } else {
      const gelen: TalepSatiri[] = data.talepler ?? [];
      setTalepler(gelen);
      if (enYeniyiSec.current) {
        // Uç created_at'e göre yeniden eskiye sıralı döner; devam edenlerin ilki
        // az önce açılan taleptir.
        const yeni = gelen.find((t) => !t.uretim_bitti && !t.iptal_edildi);
        if (yeni) setSeciliTalepId(yeni.talep_id);
        enYeniyiSec.current = false;
      }
    }
    setLoading(false);
  }, [hata]);

  /** Yeni Talep akordiyonu talep açtığında çağrılır (A-10). */
  const talepOlusturuldu = useCallback(async () => {
    enYeniyiSec.current = true;
    await veriCek();
  }, [veriCek]);

  useEffect(() => {
    if (kullanici) veriCek();
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
      const res = await fetch(`/talepler-v2/api/detay?talep_id=${seciliTalepId}`);
      const data = await res.json();
      if (!aktif) return;
      if (!res.ok) {
        hata(data.hata ?? "Talep detayı yüklenemedi.", data.adim, data.detay);
        setDetay(null);
      } else {
        setDetay(data);
      }
      setDetayYukleniyor(false);
    })();
    return () => { aktif = false; };
  }, [seciliTalepId, detayTetik, hata]);

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
        const uc = KARAR_UCU[hedef.asama];
        const res = await fetch(uc.yol, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [uc.anahtar]: hedef.id, durum, notlar }),
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
   *   3) kanonik embed adresini sistem yazar ve zinciri kurar.
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
        } catch (err: any) {
          hata("Video Bunny'ye yüklenemedi.", "TUS yükleme", err?.message);
          fetch("/videolar/api/bunny-yukleme-iptal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_guid: izin.video_guid }),
          }).catch(() => {});
          return;
        }

        const res2 = await fetch("/talepler/api/hazir-video", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ talep_id: talep.talep_id, hazir_video_url: izin.embed_url }),
        });
        const d2 = await res2.json();
        if (!res2.ok) {
          hata(d2.hata ?? "Video adresi kaydedilemedi.", d2.adim, d2.detay);
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
    [talepler, seciliTalepId, hata, basari, veriCek],
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
