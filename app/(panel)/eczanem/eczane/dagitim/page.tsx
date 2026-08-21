"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Film, Play, Search, Send, UsersRound } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import VideoOnizleme from "@/components/video/VideoOnizleme";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";
import { EczanemBosDurum, EczanemEczaneBaslik, EczanemEczaneSayfa, EczanemOzetKarti, EczanemPanel, EczanemYukleniyor } from "../_components/EczanemEczaneArayuz";

interface GelenVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  gelis_tarihi: string;
}

interface Uye {
  musteri_id: string;
  ad_soyad: string;
  telefon_maskeli: string;
  gonderildi_mi: boolean;
}

interface DagitimVerisi {
  videolar: GelenVideo[];
  uyeler: Uye[];
  ozet: { video_sayisi: number; aktif_uye_sayisi: number; gonderilen_uye_sayisi: number; gonderilebilir_uye_sayisi: number };
}

const BOS_VERI: DagitimVerisi = { videolar: [], uyeler: [], ozet: { video_sayisi: 0, aktif_uye_sayisi: 0, gonderilen_uye_sayisi: 0, gonderilebilir_uye_sayisi: 0 } };

const tarihYaz = (deger: string) => new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(deger));

export default function EczanemDagitimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();
  const [veri, setVeri] = useState<DagitimVerisi>(BOS_VERI);
  const [seciliVideoId, setSeciliVideoId] = useState<string | null>(null);
  const [aktifVideo, setAktifVideo] = useState<GelenVideo | null>(null);
  const [seciliUyeler, setSeciliUyeler] = useState<Set<string>>(new Set());
  const [arama, setArama] = useState("");
  const [ilkYukleme, setIlkYukleme] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [dagitiliyor, setDagitiliyor] = useState(false);
  const [onayAcik, setOnayAcik] = useState(false);
  const istekRef = useRef<AbortController | null>(null);

  const dagitimCek = useCallback(async (elle = false, yayinId?: string | null) => {
    istekRef.current?.abort();
    const controller = new AbortController();
    istekRef.current = controller;
    if (elle) setYenileniyor(true);
    const params = new URLSearchParams();
    if (yayinId) params.set("yayin_id", yayinId);
    try {
      const res = await fetch(`/eczanem/eczane/api/gonderim${params.size ? `?${params}` : ""}`, { cache: "no-store", signal: controller.signal });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Gönderim verisi yüklenemedi.", "video dağıtımı"); return; }
      setVeri(data);
      setSeciliUyeler((onceki) => {
        const uygun = new Set((data.uyeler as Uye[]).filter((uye) => !uye.gonderildi_mi).map((uye) => uye.musteri_id));
        return new Set([...onceki].filter((id) => uygun.has(id)));
      });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) hata("Gönderim verisi yüklenemedi.", "video dağıtımı");
    } finally {
      if (istekRef.current === controller) { setIlkYukleme(false); setYenileniyor(false); }
    }
  }, [hata]);

  useEffect(() => {
    void dagitimCek(false, seciliVideoId);
    return () => istekRef.current?.abort();
  }, [dagitimCek, seciliVideoId]);

  const seciliVideo = veri.videolar.find((video) => video.yayin_id === seciliVideoId) ?? null;
  const gorunenUyeler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    if (!q) return veri.uyeler;
    return veri.uyeler.filter((uye) => `${uye.ad_soyad} ${uye.telefon_maskeli}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [arama, veri.uyeler]);
  const gorunenUygunler = gorunenUyeler.filter((uye) => !uye.gonderildi_mi);

  const videoSec = (video: GelenVideo) => {
    setSeciliVideoId(video.yayin_id);
    setSeciliUyeler(new Set());
    if (video.video_url) setAktifVideo(video);
  };

  const uyeToggle = (uye: Uye) => {
    if (uye.gonderildi_mi) return;
    setSeciliUyeler((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(uye.musteri_id)) yeni.delete(uye.musteri_id); else if (yeni.size < 100) yeni.add(uye.musteri_id);
      return yeni;
    });
  };

  const gorunenleriSec = () => {
    const gorunenIdler = gorunenUygunler.map((uye) => uye.musteri_id).slice(0, 100);
    const hepsiSecili = gorunenIdler.length > 0 && gorunenIdler.every((id) => seciliUyeler.has(id));
    setSeciliUyeler((onceki) => {
      const yeni = new Set(onceki);
      if (hepsiSecili) gorunenIdler.forEach((id) => yeni.delete(id));
      else gorunenIdler.forEach((id) => { if (yeni.size < 100) yeni.add(id); });
      return yeni;
    });
  };

  const videoDagit = async () => {
    if (!seciliVideoId || seciliUyeler.size === 0) return;
    setDagitiliyor(true); setOnayAcik(false);
    try {
      const res = await fetch("/eczanem/eczane/api/gonderim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yayin_id: seciliVideoId, musteri_idler: [...seciliUyeler] }) });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Video gönderilemedi.", "video dağıtımı"); return; }
      basari(data.mesaj ?? "Video müşterilere gönderildi."); setSeciliUyeler(new Set());
      await dagitimCek(true, seciliVideoId);
    } catch { hata("Video gönderilemedi.", "video dağıtımı"); }
    finally { setDagitiliyor(false); }
  };

  if (aktifVideo?.video_url) {
    return (
      <EczanemEczaneSayfa>
        <Button type="button" variant="ghost" onClick={() => setAktifVideo(null)} className="w-fit px-0 text-sm font-bold text-[#60758c] hover:bg-transparent hover:text-[#30475f]"><ChevronLeft /> Video dağıtımına dön</Button>
        <EczanemPanel baslik={aktifVideo.urun_adi} aciklama={aktifVideo.teknik_adi || "Eczanem ürün videosu"}>
          <VideoOnizleme key={aktifVideo.yayin_id} videoUrl={aktifVideo.video_url} ariaLabel={`${aktifVideo.urun_adi} önizlemesini oynat`} yalnizPlayButonu onBitti={() => setAktifVideo(null)} bitisGecikmesiMs={1500} />
        </EczanemPanel>
        <HataMesajiContainer mesajlar={mesajlar} />
      </EczanemEczaneSayfa>
    );
  }

  return (
    <EczanemEczaneSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EczanemEczaneBaslik ikon={Send} baslik="Video Dağıtımı" aciklama="Eczanenize gelen videoyu seçin, önizleyin ve uygun müşterilerinize tek işlemle gönderin." aksiyon={<YenileButonu yenileniyor={yenileniyor} onYenile={() => dagitimCek(true, seciliVideoId)} disabled={dagitiliyor} />} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EczanemOzetKarti ikon={Film} etiket="Gelen video" deger={veri.ozet.video_sayisi} detay="Dağıtıma açık" />
        <EczanemOzetKarti ikon={UsersRound} etiket="Aktif müşteri" deger={veri.ozet.aktif_uye_sayisi} detay="Eczane listenizde" renk="#6550b9" zemin="#f2effc" />
        <EczanemOzetKarti ikon={CheckCircle2} etiket="Gönderildi" deger={seciliVideoId ? veri.ozet.gonderilen_uye_sayisi : "—"} detay={seciliVideoId ? "Seçili video" : "Önce video seçin"} renk="#16865f" zemin="#edf9f4" />
        <EczanemOzetKarti ikon={Send} etiket="Gönderilebilir" deger={seciliVideoId ? veri.ozet.gonderilebilir_uye_sayisi : "—"} detay={seciliVideoId ? "Seçili video" : "Önce video seçin"} renk="#b7791f" zemin="#fff7e8" />
      </section>

      {ilkYukleme ? <EczanemPanel><EczanemYukleniyor metin="Videolar ve müşteriler yükleniyor…" /></EczanemPanel> : veri.videolar.length === 0 ? <EczanemPanel><EczanemBosDurum ikon={Film} baslik="Henüz gelen video yok" aciklama="UTT tarafından eczanenize gönderilen videolar burada listelenecek." /></EczanemPanel> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <EczanemPanel baslik="Eczanenize Gelen Videolar" aciklama="Thumbnail videoyu seçer ve önizleme alanına taşır; oynatma yalnız Play tuşuyla başlar.">
          <div className="divide-y divide-[#e7edf4]">{veri.videolar.map((video) => {
            const secili = video.yayin_id === seciliVideoId;
            const thumbnail = video.thumbnail_url ?? thumbnailUrlUret(video.video_url);
            return <article key={video.yayin_id} className={`grid gap-3 p-3 transition md:grid-cols-[128px_minmax(0,1fr)_auto] md:items-center md:p-4 ${secili ? "bg-[#f2f8fd]" : "hover:bg-[#fbfdff]"}`}>
              <button type="button" onClick={() => videoSec(video)} disabled={!video.video_url} className="group relative flex h-[72px] w-32 items-center justify-center overflow-hidden rounded-xl border-0 bg-gradient-to-br from-[#dcecf9] to-[#edf5fb] p-0 text-[#237ac8] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#237ac8] disabled:cursor-not-allowed disabled:opacity-50" aria-label={video.video_url ? `${video.urun_adi} videosunu sayfaya yerleştir` : `${video.urun_adi} videosu hazır değil`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumbnail ? <img src={thumbnail} alt="" className="h-full w-full object-cover" /> : <Film className="size-6" />}<span className="absolute inset-0 flex items-center justify-center bg-[#10233a]/0 text-white opacity-0 transition group-hover:bg-[#10233a]/25 group-hover:opacity-100"><Play className="size-7 fill-current" /></span>
              </button>
              <div className="min-w-0"><strong className="block truncate text-sm text-[#263e5b]">{video.urun_adi}</strong><span className="mt-1 block truncate text-xs font-semibold text-[#71859d]">{video.teknik_adi || "Eczanem ürün videosu"}</span><span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-[#96a3b2]">Geliş: {tarihYaz(video.gelis_tarihi)}</span></div>
              <Badge variant="outline" className={secili ? "border-[#bcd8ee] bg-white font-bold text-[#286d9f]" : "border-[#d9e2eb] bg-white font-bold text-[#71859d]"}>{secili ? "Seçildi" : video.video_url ? "Önizle ve seç" : "Video hazır değil"}</Badge>
            </article>;
          })}</div>
        </EczanemPanel>

        <EczanemPanel baslik={seciliVideo ? "Gönderilecek Müşteriler" : "Video seçimi bekleniyor"} aciklama={seciliVideo ? `${seciliVideo.urun_adi} için gönderim durumları` : "Dağıtım için soldaki video görseline tıklayın."}>
          {!seciliVideo ? <EczanemBosDurum ikon={Send} baslik="Önce bir video seçin" aciklama="Video seçildiğinde müşterilerin gönderim durumları burada açılır." /> : <>
            <div className="flex flex-col gap-3 border-b border-[#e7edf4] p-4 md:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a99aa]" /><Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Müşteri ara" className="border-[#d7e1eb] pl-9" /></div><Button type="button" variant="outline" onClick={gorunenleriSec} disabled={gorunenUygunler.length === 0} className="border-[#d7e1eb] text-xs font-bold">Görünen uygunları seç</Button></div>
            {gorunenUyeler.length === 0 ? <EczanemBosDurum ikon={UsersRound} baslik="Müşteri bulunamadı" aciklama={arama ? "Arama ifadenizi değiştirin." : "Video gönderilebilecek aktif müşteriniz bulunmuyor."} /> : <div className="max-h-[430px] divide-y divide-[#edf1f5] overflow-y-auto">{gorunenUyeler.map((uye) => <label key={uye.musteri_id} className={`flex items-center gap-3 px-4 py-3 md:px-5 ${uye.gonderildi_mi ? "cursor-default bg-[#fbfcfd]" : "cursor-pointer hover:bg-[#fbfdff]"}`}><input type="checkbox" checked={seciliUyeler.has(uye.musteri_id)} disabled={uye.gonderildi_mi} onChange={() => uyeToggle(uye)} className="size-4 accent-[#237ac8]" /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#30475f]">{uye.ad_soyad}</strong><span className="text-[11px] font-semibold text-[#8796a8]">{uye.telefon_maskeli}</span></div>{uye.gonderildi_mi ? <Badge className="border border-[#bde5d5] bg-[#edf9f4] font-bold text-[#157254]"><CheckCircle2 /> Gönderildi</Badge> : <Badge variant="outline" className="border-[#d5e0eb] bg-white font-bold text-[#60758c]">Uygun</Badge>}</label>)}</div>}
            <div className="border-t border-[#e7edf4] p-4 md:p-5"><Button type="button" onClick={() => setOnayAcik(true)} disabled={dagitiliyor || seciliUyeler.size === 0} className="w-full bg-[#237ac8] font-extrabold hover:bg-[#1d69ad]"><Send /> {dagitiliyor ? "Gönderiliyor…" : `${seciliUyeler.size} müşteriye gönder`}</Button><p className="mt-2 text-center text-[10px] font-semibold text-[#8a99aa]">Tek işlemde en fazla 100 müşteri seçilebilir.</p></div>
          </>}
        </EczanemPanel>
      </div>}

      <AlertDialog open={onayAcik} onOpenChange={setOnayAcik}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Videoyu göndermek istediğinize emin misiniz?</AlertDialogTitle><AlertDialogDescription>{seciliVideo?.urun_adi ?? "Seçili video"}, seçtiğiniz {seciliUyeler.size} müşterinin Eczanem video listesine eklenecek. Daha önce gönderilmiş kayıtlar tekrar oluşturulmaz.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void videoDagit(); }} className="bg-[#237ac8] hover:bg-[#1d69ad]"><Send /> Gönder</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </EczanemEczaneSayfa>
  );
}
