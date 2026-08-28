"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { SoruIceAktar } from "@/components/SoruIceAktar";
import { SoruSetiFormu } from "@/components/SoruSetiFormu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { TeknikPill, VaryantPill, HedefRolPilleri } from "@/components/pill";
import { bunnyTusYukle } from "@/lib/video/bunnyTusIstemci";
import { type SoruTaslagi, sorulardanTaslaklar, taslaklariBoyutla, taslaklariDogrula, taslaklardanSorular } from "@/lib/soru/taslak";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { durumMesaji, gorevDurumKodu, type Asama } from "@/lib/utils/durum/mesaj";
import { talepIdGoster } from "@/lib/utils/talepId";
import { uretimToast, toastVaryant, type ToastAsama, type ToastOlay } from "@/lib/uretim/toastMesaj";
import type { UretimGorevIcerigi, UretimGorevi } from "@/lib/uretim/gorevTipleri";
import { bildirimRozetleriniYenile } from "@/lib/bildirimler/rozet";
import { hazirFlipPdfYukle, hazirGorselYukle, hazirPodcastYukle } from "@/lib/ogrenmeAraci/bunnyYuklemeIstemci";

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
  const [videoYuzdesi, setVideoYuzdesi] = useState<number | null>(null);
  const [yuklenenVideo, setYuklenenVideo] = useState<{ video_url: string; dosya_adi: string } | null>(null);
  const [podcastDosyalari, setPodcastDosyalari] = useState<{ ses?: File; kapak?: File; transkript?: File }>({});
  const [gorselDosyasi, setGorselDosyasi] = useState<File | null>(null);
  const [flipPdfDosyasi, setFlipPdfDosyasi] = useState<File | null>(null);

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
      }
    } catch (err) {
      hata("Üretim görevi yüklenemedi.", "üretim görev detayı", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [hata, params.gorev_id]);

  useEffect(() => { if (kullanici) void veriCek(); }, [kullanici, veriCek]);

  const asama = gorev ? ASAMA[gorev.asama] : null;
  const isIU = kullanici?.rol === IU_ROLU;
  const isUretici = !!kullanici && URETICI_ROLLER.includes(kullanici.rol);
  const iuTeslimEdebilir = isIU && !!gorev && ["hazirlaniyor", "revizyon_bekliyor"].includes(gorev.durum);
  const ureticiKararVerebilir = isUretici && gorev?.durum === "inceleme_bekliyor" && gorev.talep?.uretici_id === kullanici?.id;
  const durum = gorev && asama ? durumMesaji(gorevDurumKodu(gorev.durum), kullanici?.rol, { asama: asama.etiket, rolAdi: gorev.talep?.uretici_rol_adi, tarih: gorev.updated_at }) : null;
  const toastBaglam = useMemo(() => ({ varyant: toastVaryant(gorev?.talep?.hazir_video, gorev?.talep?.hazir_soru_seti), rolAdi: gorev?.talep?.uretici_rol_adi }), [gorev]);

  const teslimEt = async (ekAlanlar: Record<string, unknown>): Promise<boolean> => {
    if (!gorev) return false;
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
        return false;
      }
      basari(uretimToast({ rol: "iu", olay: "teslim", asama: gorev.asama, revize: gorev.durum === "revizyon_bekliyor" }, toastBaglam));
      await veriCek();
      return true;
    } catch (err) {
      hata("Görev teslim edilemedi.", "üretim görevi teslimi", err instanceof Error ? err.message : undefined);
      return false;
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
    if (!gorev?.video_id) return hata("Göreve bağlı video kaydı bulunamadı.", "video görevi");
    setIslem(true); setVideoYuzdesi(0);
    let videoGuid: string | null = null;
    try {
      const izinRes = await fetch("/videolar/api/bunny-yukleme-baslat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_id: gorev.video_id }) });
      const izin = await izinRes.json();
      if (!izinRes.ok) return hata(izin.hata ?? "Video yüklemesi başlatılamadı.", izin.adim, izin.detay);
      videoGuid = izin.video_guid;
      await bunnyTusYukle(dosya, izin, setVideoYuzdesi);
      setYuklenenVideo({ video_url: izin.embed_url, dosya_adi: dosya.name });
      basari("Video yüklendi. Göndermek için Gönder butonuna basın.");
      videoGuid = null;
    } catch (err) {
      if (videoGuid) void fetch("/videolar/api/bunny-yukleme-iptal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_guid: videoGuid }) });
      hata("Video yüklenemedi.", "TUS yükleme", err instanceof Error ? err.message : undefined);
    } finally {
      setVideoYuzdesi(null); setIslem(false);
    }
  };

  const videoTeslimEt = async () => {
    if (!yuklenenVideo) return;
    const teslimBasarili = await teslimEt({ video_url: yuklenenVideo.video_url, thumbnail_url: null });
    if (teslimBasarili) setYuklenenVideo(null);
  };

  const podcastYukle = async () => {
    if (!gorev || !podcastDosyalari.ses || !podcastDosyalari.kapak || !podcastDosyalari.transkript) return;
    setIslem(true);
    try {
      await hazirPodcastYukle({
        talepId: gorev.talep_id,
        ses: podcastDosyalari.ses,
        kapak: podcastDosyalari.kapak,
        transkript: podcastDosyalari.transkript,
        kaynak: "iu",
        gorevId: gorev.gorev_id,
        aracId: gorev.arac_id ?? undefined,
      });
      basari("Podcast üretici incelemesine gönderildi.");
      setPodcastDosyalari({});
      await veriCek();
    } catch (err) {
      hata("Podcast yüklenemedi.", "podcast yükleme", err instanceof Error ? err.message : undefined);
    } finally {
      setIslem(false);
    }
  };

  const gorselYukle = async () => {
    if (!gorev || !gorselDosyasi) return;
    setIslem(true);
    try {
      await hazirGorselYukle({ talepId: gorev.talep_id, gorsel: gorselDosyasi, kaynak: "iu", gorevId: gorev.gorev_id, aracId: gorev.arac_id ?? undefined });
      basari("Görsel üretici incelemesine gönderildi.");
      setGorselDosyasi(null);
      await veriCek();
    } catch (err) {
      hata("Görsel yüklenemedi.", "görsel yükleme", err instanceof Error ? err.message : undefined);
    } finally { setIslem(false); }
  };

  const flipPdfYukle = async () => {
    if (!gorev || !flipPdfDosyasi) return;
    setIslem(true);
    try {
      await hazirFlipPdfYukle({ talepId: gorev.talep_id, pdf: flipPdfDosyasi, kaynak: "iu", gorevId: gorev.gorev_id, aracId: gorev.arac_id ?? undefined });
      basari("Flip PDF üretici incelemesine gönderildi.");
      setFlipPdfDosyasi(null);
      await veriCek();
    } catch (err) {
      hata("Flip PDF yüklenemedi.", "PDF yükleme", err instanceof Error ? err.message : undefined);
    } finally { setIslem(false); }
  };

  const kararVer = async (karar: "onaylandi" | "revizyon bekleniyor" | "Iptal Edildi", notlar?: string) => {
    if (!gorev) return;
    setIslem(true);
    try {
      const res = await fetch("/uretim/api/karar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gorev_id: gorev.gorev_id, karar, notlar, islem_anahtari: crypto.randomUUID() }) });
      const veri = await res.json();
      if (!res.ok) return hata(veri.hata ?? "Karar kaydedilemedi.", veri.adim, veri.detay);
      const olay: ToastOlay = karar === "onaylandi" ? { rol: "uretici", olay: "onay", asama: gorev.asama, revize: gorev.revizyon_sayisi > 0 } : karar === "revizyon bekleniyor" ? { rol: "uretici", olay: "revizyon", asama: gorev.asama } : { rol: "uretici", olay: "iptal", asama: gorev.asama };
      basari(uretimToast(olay, toastBaglam));
      if (karar === "onaylandi" && gorev.asama === "soru_seti") {
        bildirimRozetleriniYenile();
      }
      setRevizyonAcik(false); setRevizyonNotu(""); await veriCek();
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
        <button type="button" onClick={() => router.push(asama.liste)} className="w-fit border-0 bg-transparent p-0 text-sm text-gray-500">‹ {asama.etiket} listesi</button>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 md:px-5">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{asama.etiket} görevi</p><h1 className="mt-1 text-lg font-bold text-gray-900">{gorev.talep?.urun_adi ?? "-"}</h1><p className="mt-1 text-xs text-gray-500">{talepIdGoster(gorev.talep?.firma_adi ?? "", gorev.talep?.talep_no ?? 0)}</p></div>
            {durum && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: durum.renk.bg, color: durum.renk.text, border: `1px solid ${durum.renk.border}` }}>{durum.metin}</span>}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3 md:px-5"><TeknikPill teknikAdi={gorev.talep?.teknik_adi ?? "-"} /><HedefRolPilleri hedefRoller={gorev.talep?.hedef_roller ?? []} /><VaryantPill hazirVideo={gorev.talep?.hazir_video ?? false} hazirSoruSeti={gorev.talep?.hazir_soru_seti ?? false} kendiSatirinda={false} />{gorev.atanan_iu && <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-500">İçerik Üreticisi: {gorev.atanan_iu.ad_soyad}</span>}</div>

          <div className="flex flex-col gap-4 px-4 py-4 md:px-5">
            {icerik?.asama === "senaryo" && icerik.senaryo_metni && <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700">{icerik.senaryo_metni}</div>}
            {icerik?.asama === "video" && icerik.video_url && <VideoOnizleme videoUrl={icerik.video_url} className="rounded-xl" ariaLabel="Üretim videosunu oynat" />}
            {icerik?.asama === "podcast" && <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><img src={icerik.kapak_url} alt="Podcast kapağı" className="mx-auto aspect-square w-full max-w-56 rounded-xl object-cover" /><audio controls preload="metadata" src={icerik.ses_url} className="w-full" /><a href={icerik.transkript_url} target="_blank" rel="noreferrer" className="text-center text-sm font-semibold text-[#287fce]">Transkripti aç</a></div>}
            {icerik?.asama === "gorsel" && <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><img src={icerik.gorsel_url} alt="Üretim görseli" className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain" /><p className="mt-2 text-center text-xs text-gray-500">{icerik.genislik} × {icerik.yukseklik} px</p></div>}
            {icerik?.asama === "flip_pdf" && <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><iframe src={icerik.pdf_url} title="Flip PDF ön izlemesi" className="h-[70vh] w-full rounded-xl border border-gray-200 bg-white" /><p className="mt-2 text-center text-xs text-gray-500">{icerik.sayfa_sayisi} sayfa</p></div>}
            {icerik?.asama === "soru_seti" && icerik.sorular.length > 0 && <div className="flex flex-col gap-2">{icerik.sorular.map((soru, i) => <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-sm font-semibold text-gray-800">{i + 1}. {soru.soru_metni}</p><div className="mt-2 flex flex-wrap gap-1.5">{soru.secenekler.map((secenek) => <span key={secenek.harf} className={`rounded-full border px-2 py-1 text-xs ${secenek.dogru ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500"}`}>{secenek.harf}. {secenek.metin}</span>)}</div></div>)}</div>}

            {(gorev.durum_gecmisi ?? []).filter((d) => d.durum === "revizyon bekleniyor" && d.notlar).map((d, i) => <div key={`${d.created_at}-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"><strong>Revizyon notu:</strong> {d.notlar}</div>)}

            {iuTeslimEdebilir && gorev.asama === "senaryo" && <div className="border-t border-gray-100 pt-4"><textarea value={senaryoMetni} onChange={(e) => setSenaryoMetni(e.target.value)} rows={14} placeholder="Senaryoyu yazın..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-6 outline-none focus:border-[#56aeff]" /><div className="mt-3 flex justify-end"><button type="button" onClick={senaryoGonder} disabled={islem || !senaryoMetni.trim()} className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div></div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "video" && <div className="border-t border-gray-100 pt-4">{yuklenenVideo ? <div className="flex flex-col gap-3"><VideoOnizleme videoUrl={yuklenenVideo.video_url} className="rounded-xl" ariaLabel="Yüklenen videoyu oynat" /><div className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-xs font-semibold text-green-800">{yuklenenVideo.dosya_adi}</p><p className="mt-0.5 text-[11px] text-green-700">Video yüklendi; henüz üretici incelemesine gönderilmedi.</p></div><button type="button" onClick={() => void videoTeslimEt()} disabled={islem} className="shrink-0 rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">Gönder</button></div></div> : <label className="flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-[#56aeff] bg-[#f6faff] px-5 py-8 text-center"><span className="text-sm font-semibold text-[#287fce]">{videoYuzdesi === null ? "Video dosyasını seçin" : `Yükleniyor: %${videoYuzdesi}`}</span><span className="mt-1 text-xs text-gray-400">Dosya yüklendikten sonra Gönder butonuyla incelemeye iletilir.</span><input type="file" accept="video/*" disabled={islem} className="hidden" onChange={(e) => { const dosya = e.target.files?.[0]; if (dosya) void videoYukle(dosya); e.currentTarget.value = ""; }} /></label>}</div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "podcast" && <div className="flex flex-col gap-3 border-t border-gray-100 pt-4"><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Ses dosyası<input type="file" accept="audio/*" className="mt-2 block w-full text-xs" onChange={(e) => setPodcastDosyalari((d) => ({ ...d, ses: e.target.files?.[0] }))} /></label><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Kapak görseli<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={(e) => setPodcastDosyalari((d) => ({ ...d, kapak: e.target.files?.[0] }))} /></label><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Transkript<input type="file" accept=".pdf,.txt,.doc,.docx" className="mt-2 block w-full text-xs" onChange={(e) => setPodcastDosyalari((d) => ({ ...d, transkript: e.target.files?.[0] }))} /></label><button type="button" onClick={() => void podcastYukle()} disabled={islem || !podcastDosyalari.ses || !podcastDosyalari.kapak || !podcastDosyalari.transkript} className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "gorsel" && <div className="flex flex-col gap-3 border-t border-gray-100 pt-4"><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Nihai görsel<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" onChange={(e) => setGorselDosyasi(e.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void gorselYukle()} disabled={islem || !gorselDosyasi} className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div>}
            {iuTeslimEdebilir && gorev.asama === "video" && gorev.talep?.ogrenme_araci_turu === "flip_pdf" && <div className="flex flex-col gap-3 border-t border-gray-100 pt-4"><label className="rounded-lg border border-dashed border-gray-300 p-3 text-sm">Nihai Flip PDF<input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-xs" onChange={(e) => setFlipPdfDosyasi(e.target.files?.[0] ?? null)} /></label><button type="button" onClick={() => void flipPdfYukle()} disabled={islem || !flipPdfDosyasi} className="self-end rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div>}
            {iuTeslimEdebilir && gorev.asama === "soru_seti" && <div className="border-t border-gray-100 pt-4"><SoruIceAktar secenekSayisi={gorev.talep?.secenek_sayisi ?? 4} onDoldur={(yeni, mesaj) => { setTaslaklar(taslaklariBoyutla(yeni, gorev.talep?.soru_seti_buyuklugu ?? 25, gorev.talep?.secenek_sayisi ?? 4)); if (mesaj) uyari(mesaj); }} /><SoruSetiFormu taslaklar={taslaklar} onDegis={setTaslaklar} buyukluk={gorev.talep?.soru_seti_buyuklugu ?? 25} secenekSayisi={gorev.talep?.secenek_sayisi ?? 4} /><div className="mt-3 flex justify-end"><button type="button" onClick={soruSetiGonder} disabled={islem} className="rounded-lg border-0 bg-[#56aeff] px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">İncelemeye Gönder</button></div></div>}

            {ureticiKararVerebilir && <div className="border-t border-gray-100 pt-4">{revizyonAcik ? <div className="flex flex-col gap-2"><textarea value={revizyonNotu} onChange={(e) => setRevizyonNotu(e.target.value)} rows={3} placeholder="Revizyon notunu yazın..." className="rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none" /><div className="flex justify-end gap-2"><button type="button" onClick={() => { setRevizyonAcik(false); setRevizyonNotu(""); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">Vazgeç</button><button type="button" disabled={islem || !revizyonNotu.trim()} onClick={() => void kararVer("revizyon bekleniyor", revizyonNotu)} className="rounded-lg border-0 bg-amber-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Revizyon Gönder</button></div></div> : <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={islem} onClick={() => void kararVer("onaylandi")} className="rounded-lg border-0 bg-green-700 px-3 py-2 text-xs font-semibold text-white">Onayla</button>{gorev.revizyon_sayisi < 2 && <button type="button" disabled={islem} onClick={() => setRevizyonAcik(true)} className="rounded-lg border-0 bg-amber-500 px-3 py-2 text-xs font-semibold text-white">Revizyon İste</button>}<button type="button" disabled={islem} onClick={() => void kararVer("Iptal Edildi")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-[#bc2d0d]">İptal Et</button></div>}</div>}
          </div>
        </section>
      </div>
      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
