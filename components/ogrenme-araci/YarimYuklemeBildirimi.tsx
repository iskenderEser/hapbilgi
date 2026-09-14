"use client";

import { useCallback, useEffect, useState } from "react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";

type YarimYukleme = {
  tur: "storage" | "video";
  kimlik: string;
  arac_id?: string;
  yukleme_id?: string;
  talep_id: string;
  gorev_id: string | null;
  video_id?: string | null;
  video_guid?: string;
  arac_turu: "video" | "podcast" | "gorsel" | "flip_pdf";
  kaynak: "hazir" | "iu";
  durum: string;
  dosya_adi: string;
  baslik: string;
  embed_url?: string;
  tamamlanan_parcalar?: Array<"ana" | "kapak" | "transkript">;
  kapak_yarim?: boolean;
  transkript_yarim?: boolean;
  kapak_yukleme_girisimi_id?: string | null;
  podcast_sure_hazir?: boolean;
  podcast_transkript_bilgisi_hazir?: boolean;
  created_at: string;
};

async function jsonIstek(url: string, method: string, body: Record<string, unknown>) {
  const yanit = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const veri = await yanit.json().catch(() => ({}));
  if (!yanit.ok) throw new Error(veri.hata ?? "İşlem tamamlanamadı.");
  return veri;
}

export default function YarimYuklemeBildirimi() {
  const [yuklemeler, setYuklemeler] = useState<YarimYukleme[]>([]);
  const [dosyalar, setDosyalar] = useState<Record<string, File | undefined>>({});
  const [islem, setIslem] = useState(false);
  const [yuzde, setYuzde] = useState<number | null>(null);
  const { mesajlar, hata, basari } = useHataMesaji();

  const listele = useCallback(async () => {
    try {
      const yanit = await fetch("/api/ogrenme-araclari/yarim-yuklemeler", { cache: "no-store" });
      if (!yanit.ok) return;
      const veri = await yanit.json();
      setYuklemeler(veri.yuklemeler ?? []);
    } catch {
      // Oturum açılışı geçici bağlantı hatasıyla kesilmez; görünürlükte tekrar okunur.
    }
  }, []);

  useEffect(() => {
    void listele();
    const gorunur = () => { if (document.visibilityState === "visible") void listele(); };
    document.addEventListener("visibilitychange", gorunur);
    window.addEventListener("hapbilgi:yarim-yukleme-degisti", listele);
    return () => {
      document.removeEventListener("visibilitychange", gorunur);
      window.removeEventListener("hapbilgi:yarim-yukleme-degisti", listele);
    };
  }, [listele]);

  const aktif = yuklemeler[0];
  if (!aktif) return <HataMesajiContainer mesajlar={mesajlar} />;

  const tamamlananKaydiKapat = async (kayit: YarimYukleme) => {
    if (kayit.kaynak === "hazir") {
      if (!kayit.video_guid) throw new Error("Yarım video yükleme kaydı eksik.");
      const sonuc = await jsonIstek("/uretim/api/hazir-video", "PUT", {
        talep_id: kayit.talep_id,
        video_url: kayit.embed_url,
        islem_anahtari: kayit.video_guid,
      });
      if (sonuc?.hata) throw new Error(sonuc.hata);
    } else {
      if (!kayit.gorev_id) throw new Error("Yarım video yüklemesinin üretim görevi bulunamadı.");
      await jsonIstek("/uretim/api/teslim", "POST", {
        gorev_id: kayit.gorev_id,
        asama: "video",
        video_url: kayit.embed_url,
        thumbnail_url: null,
        islem_anahtari: crypto.randomUUID(),
      });
    }
    await jsonIstek("/api/ogrenme-araclari/yarim-yuklemeler", "POST", {
      yukleme_id: kayit.kimlik,
      islem: "baglandi",
    });
  };

  const videoDevam = async (kayit: YarimYukleme) => {
    if (kayit.durum === "dogrulama_bekliyor") {
      await tamamlananKaydiKapat(kayit);
      return;
    }

    // Tarayıcı, TUS aktarımı bittikten hemen sonra kapanmış olabilir. Bu durumda
    // oturum hâlâ "yukleniyor" görünse de Bunny'deki video tamamdır; dosyayı
    // yeniden seçtirmeden önce sunucu otoritesinden mevcut kaydı doğrula.
    const aktarimYanit = await fetch("/api/ogrenme-araclari/yarim-yuklemeler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yukleme_id: kayit.kimlik, islem: "aktarim_tamamlandi" }),
    });
    const aktarimSonucu = await aktarimYanit.json().catch(() => ({}));
    if (aktarimYanit.ok) {
      await tamamlananKaydiKapat(kayit);
      return;
    }
    if (aktarimYanit.status !== 422) {
      throw new Error(aktarimSonucu.hata ?? "Video aktarım durumu doğrulanamadı.");
    }

    const dosya = dosyalar.ana;
    if (!dosya) throw new Error("Devam etmek için aynı video dosyasını yeniden seçin.");
    const adres = kayit.kaynak === "hazir" ? "/talepler/api/bunny-yukleme-baslat" : "/videolar/api/bunny-yukleme-baslat";
    const izin = await jsonIstek(adres, "POST", {
      ...(kayit.kaynak === "hazir" ? { talep_id: kayit.talep_id } : { video_id: kayit.video_id }),
      dosya_adi: dosya.name,
      mime_type: dosya.type || "video/mp4",
      dosya_boyutu: dosya.size,
    });
    const { bunnyTusYukle, videoYuklemeOturumuGuncelle } = await import("@/lib/video/bunnyTusIstemci");
    await bunnyTusYukle(dosya, izin, setYuzde);
    await videoYuklemeOturumuGuncelle(izin.yukleme_id, "aktarim_tamamlandi");
    await tamamlananKaydiKapat({
      ...kayit,
      kimlik: izin.yukleme_id ?? kayit.kimlik,
      video_guid: izin.video_guid,
      embed_url: izin.embed_url,
    });
  };

  const storageDevam = async (kayit: YarimYukleme) => {
    const araclar = await import("@/lib/ogrenmeAraci/bunnyYuklemeIstemci");
    const kontrol = { onIlerleme: ({ yuzde: oran }: { yuzde: number }) => setYuzde(oran) };
    if (kayit.arac_turu === "podcast") {
      const tamamlanan = new Set(kayit.tamamlanan_parcalar ?? []);
      const sesGerekli = !tamamlanan.has("ana") || kayit.podcast_sure_hazir !== true;
      const transkriptGerekli = (!tamamlanan.has("transkript") && kayit.transkript_yarim === true)
        || (tamamlanan.has("transkript") && kayit.podcast_transkript_bilgisi_hazir !== true);
      const kapakGerekli = !tamamlanan.has("kapak") && kayit.kapak_yarim === true;
      if (kapakGerekli && !dosyalar.kapak) {
        throw new Error("Yayın görselini seçin veya Görselsiz Devam Et seçeneğini kullanın.");
      }
      if ((sesGerekli && !dosyalar.ana) || (transkriptGerekli && !dosyalar.transkript)) {
        throw new Error("Podcast için yalnız eksik veya doğrulama bilgisi gereken dosyaları seçin.");
      }
      await araclar.hazirPodcastYukle({
        talepId: kayit.talep_id,
        ses: dosyalar.ana,
        kapak: dosyalar.kapak,
        transkript: dosyalar.transkript,
        tamamlananParcalar: kayit.tamamlanan_parcalar,
        kapakGerekli,
        kaynak: kayit.kaynak,
        gorevId: kayit.gorev_id ?? undefined,
        aracId: kayit.arac_id,
        kontrol,
      });
    } else if (kayit.arac_turu === "gorsel") {
      const ana = dosyalar.ana;
      if (!ana) throw new Error("Devam etmek için aynı dosyayı yeniden seçin.");
      await araclar.hazirGorselYukle({ talepId: kayit.talep_id, gorsel: ana, kaynak: kayit.kaynak, gorevId: kayit.gorev_id ?? undefined, aracId: kayit.arac_id, kontrol });
    } else {
      const ana = dosyalar.ana;
      if (!ana) throw new Error("Devam etmek için aynı dosyayı yeniden seçin.");
      await araclar.hazirFlipPdfYukle({ talepId: kayit.talep_id, pdf: ana, kaynak: kayit.kaynak, gorevId: kayit.gorev_id ?? undefined, aracId: kayit.arac_id, kontrol });
    }
  };

  const devamEt = async () => {
    setIslem(true); setYuzde(null);
    try {
      if (aktif.tur === "video") await videoDevam(aktif);
      else await storageDevam(aktif);
      setYuklemeler((liste) => liste.filter((x) => x.kimlik !== aktif.kimlik));
      setDosyalar({});
      basari("Yarım kalan yükleme başarıyla tamamlandı.");
    } catch (error) {
      hata(error instanceof Error ? error.message : "Yüklemeye devam edilemedi.");
    } finally {
      setIslem(false); setYuzde(null);
    }
  };

  const iptalEt = async () => {
    setIslem(true);
    try {
      const sonuc = await jsonIstek("/api/ogrenme-araclari/yarim-yuklemeler", "DELETE", { tur: aktif.tur, kimlik: aktif.kimlik });
      setYuklemeler((liste) => liste.filter((x) => x.kimlik !== aktif.kimlik));
      setDosyalar({});
      basari(sonuc.mesaj ?? "Yarım kalan yükleme başarıyla iptal edildi.");
    } catch (error) {
      hata(error instanceof Error ? error.message : "Yükleme iptal edilemedi.");
    } finally {
      setIslem(false);
    }
  };

  const gorselsizDevamEt = async () => {
    if (!aktif.arac_id) return;
    setIslem(true); setYuzde(null);
    try {
      await jsonIstek("/api/ogrenme-araclari/yarim-yuklemeler", "POST", {
        islem: "gorselsiz_devam",
        arac_id: aktif.arac_id,
        yukleme_girisimi_id: aktif.kapak_yukleme_girisimi_id ?? null,
      });

      if (!podcastSesGerekli && !podcastTranskriptGerekli) {
        const araclar = await import("@/lib/ogrenmeAraci/bunnyYuklemeIstemci");
        const kontrol = { onIlerleme: ({ yuzde: oran }: { yuzde: number }) => setYuzde(oran) };
        await araclar.hazirPodcastYukle({
          talepId: aktif.talep_id,
          tamamlananParcalar: ["ana", ...(podcastTamamlanan.has("transkript") ? ["transkript" as const] : [])],
          kaynak: aktif.kaynak,
          gorevId: aktif.gorev_id ?? undefined,
          aracId: aktif.arac_id,
          kontrol,
        });
        setYuklemeler((liste) => liste.filter((x) => x.kimlik !== aktif.kimlik));
        setDosyalar({});
        basari("Podcast görselsiz olarak başarıyla tamamlandı.");
      } else {
        setYuklemeler((liste) => liste.map((x) => x.kimlik === aktif.kimlik ? { ...x, kapak_yarim: false } : x));
        setDosyalar((d) => { const kopya = { ...d }; delete kopya.kapak; return kopya; });
        basari("Yayın görseli iptal edildi; ses ve transkript ile devam edebilirsiniz.");
      }
    } catch (error) {
      hata(error instanceof Error ? error.message : "Görselsiz devam edilemedi.");
    } finally {
      setIslem(false); setYuzde(null);
    }
  };

  const dosyaSecici = (rol: "ana" | "kapak" | "transkript", etiket: string, accept: string) => (
    <label className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
      {etiket}
      <input type="file" accept={accept} disabled={islem} className="block w-full text-xs font-normal" onChange={(e) => setDosyalar((d) => ({ ...d, [rol]: e.target.files?.[0] }))} />
    </label>
  );

  const podcastTamamlanan = new Set(aktif.tamamlanan_parcalar ?? []);
  const podcastSesGerekli = !podcastTamamlanan.has("ana") || aktif.podcast_sure_hazir !== true;
  const podcastKapakGerekli = !podcastTamamlanan.has("kapak") && aktif.kapak_yarim === true;
  const podcastTranskriptGerekli = (!podcastTamamlanan.has("transkript") && aktif.transkript_yarim === true)
    || (podcastTamamlanan.has("transkript") && aktif.podcast_transkript_bilgisi_hazir !== true);
  const podcastDosyaGerekli = podcastSesGerekli || podcastTranskriptGerekli || podcastKapakGerekli;
  const dosyaGerekli = aktif.tur === "storage"
    ? aktif.arac_turu !== "podcast" || podcastDosyaGerekli
    : aktif.durum !== "dogrulama_bekliyor";
  return (
    <>
      <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="yarim-yukleme-baslik">
        <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#bc2d0d]">Yarım kalan yükleme</p>
          <h2 id="yarim-yukleme-baslik" className="mt-1 text-lg font-bold text-gray-900">{aktif.baslik}</h2>
          <p className="mt-2 text-sm leading-5 text-gray-600">{aktif.dosya_adi} yüklemesi tamamlanmadan kesildi. Aynı kayıtla devam edebilir veya dosya ve geçici kayıtları güvenli biçimde iptal edebilirsiniz.</p>
          {yuklemeler.length > 1 && <p className="mt-1 text-xs text-gray-400">Bekleyen {yuklemeler.length} işlem var; işlemler sırayla gösterilecektir.</p>}

          {dosyaGerekli && <div className="mt-4 flex flex-col gap-2">
            {aktif.arac_turu === "video" && dosyaSecici("ana", "Video dosyası", "video/*")}
            {aktif.arac_turu === "podcast" && <>
              {podcastSesGerekli && dosyaSecici("ana", "Podcast ses dosyası", "audio/*")}
              {podcastKapakGerekli && dosyaSecici("kapak", "Yayın Görseli (isteğe bağlı)", "image/jpeg,image/png,image/webp")}
              {podcastTranskriptGerekli && dosyaSecici("transkript", "Podcast transkripti", ".pdf,.txt,.docx")}
            </>}
            {aktif.arac_turu === "gorsel" && dosyaSecici("ana", "Dijital broşür", ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp")}
            {aktif.arac_turu === "flip_pdf" && dosyaSecici("ana", "Literatür", ".pdf,application/pdf")}
          </div>}

          {yuzde !== null && <div className="mt-4"><div className="mb-1 text-xs font-semibold text-[#287fce]">Yükleniyor: %{yuzde}</div><div className="h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-[#56aeff]" style={{ width: `${yuzde}%` }} /></div></div>}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={islem} onClick={() => void iptalEt()} className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-[#bc2d0d] disabled:opacity-50">İptal Et</button>
            {aktif.arac_turu === "podcast" && podcastKapakGerekli && (
              <button type="button" disabled={islem} onClick={() => void gorselsizDevamEt()} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Görselsiz Devam Et</button>
            )}
            <button type="button" disabled={islem} onClick={() => void devamEt()} className="rounded-lg border-0 bg-[#56aeff] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{islem ? "İşleniyor…" : "Devam Et"}</button>
          </div>
        </section>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
