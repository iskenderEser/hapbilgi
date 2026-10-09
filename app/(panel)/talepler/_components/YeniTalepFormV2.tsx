// app/talepler/_components/YeniTalepFormV2.tsx
//
// Kompakt yayın kartı: ürün/konu ve kitle yan yana; altında yayın tipi,
// araç ve soru seti üretimi. Hazır içerik editörleri tam genişlikte korunur.
//
// KURAL KOPYALANMIYOR: bu dosya yalnız YERLEŞİMDİR. Hedef rol kapısı, tür-ürün-
// teknik zorunlulukları, Eczanem dörtlü kilidi, hazır set parametre kilidi,
// doğrulama sırası ve onay modalının dört varyantı useTalepFormu'da kalır;
// bu bileşen yalnız Talep Merkezi'nin form yerleşimini taşır.

"use client";

import { SadeFormSecimi, SadeIslemButonu, SadeKontrolButonu, SadeKontrolGrubu } from "@/components/kontrol/SadeKontroller";

import { EkDosyaYukleme } from "@/app/(panel)/talepler/_components/EkDosyaYukleme";
import { HazirSoruSetiBlogu } from "@/app/(panel)/talepler/_components/HazirSoruSetiBlogu";
import { PodcastTalepAlanlari } from "@/app/(panel)/talepler/_components/PodcastTalepAlanlari";
import { SoruSetiAyarlari } from "@/app/(panel)/talepler/_components/SoruSetiAyarlari";
import { TalepOnayModal } from "@/app/(panel)/talepler/_components/TalepOnayModal";
import { UrunTeknikSecici } from "@/app/(panel)/talepler/_components/UrunTeknikSecici";
import { VideoYukleme } from "@/app/(panel)/talepler/_components/VideoYukleme";
import type { useTalepFormu } from "@/app/(panel)/talepler/_hooks/useTalepFormu";
import { HEDEF_ROL_TASARIM, TUM_TURLER } from "@/app/(panel)/talepler/_types";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { OGRENME_ARACI_METINLERI } from "@/lib/ogrenmeAraci/etiketler";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
import { ECLUB_HEDEF_ROLLER, hedefRolIkUreticisineAcikMi, TUM_HEDEF_ROLLER } from "@/lib/utils/roller";

interface Props {
  formu: ReturnType<typeof useTalepFormu>;
}

const OGRENME_ARACI_SECENEKLERI = {
  video: { etiket: OGRENME_ARACI_METINLERI.video.ad, formatlar: "MP4, MOV, AVI, MKV, WEBM" },
  podcast: { etiket: OGRENME_ARACI_METINLERI.podcast.ad, formatlar: "MP3, M4A, AAC" },
  gorsel: { etiket: OGRENME_ARACI_METINLERI.gorsel.ad, formatlar: "JPG, JPEG, PNG, WEBP" },
  flip_pdf: { etiket: OGRENME_ARACI_METINLERI.flip_pdf.ad, formatlar: "PDF" },
} as const;

interface IkiliUretimSecimiProps {
  baslik: string;
  hazir: boolean;
  hazirEtiketi: string;
  onDegistir: () => void;
  kapsulClassName?: string;
}

function IkiliUretimSecimi({ baslik, hazir, hazirEtiketi, onDegistir, kapsulClassName }: IkiliUretimSecimiProps) {
  const secenekler = [
    { hazir: false, etiket: "Üretilmesini istiyorum" },
    { hazir: true, etiket: hazirEtiketi },
  ];

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7a8da8]">{baslik}</p>
      <SadeKontrolGrubu
        role="radiogroup"
        aria-label={`${baslik} üretim yöntemi`}
        className={kapsulClassName ?? "w-fit max-w-full"}
      >
        {secenekler.map((secenek) => {
          const secili = hazir === secenek.hazir;
          return (
            <SadeKontrolButonu
              key={secenek.etiket}
              role="radio"
              aria-checked={secili}
              tabIndex={secili ? 0 : -1}
              onClick={() => { if (!secili) onDegistir(); }}

            >
              {secenek.etiket}
            </SadeKontrolButonu>
          );
        })}
      </SadeKontrolGrubu>
    </div>
  );
}

export function YeniTalepFormV2({ formu }: Props) {
  const yetenek = formu.yetenek;
  if (!formu.isUretici || !yetenek) return null;

  const urunTeknikAktif = formu.egitimTuruSecildiMi;
  const eclubHedef = formu.hedefRoller.some((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef));
  const urunAdimiTamam = (formu.turKurali.urun !== "zorunlu" && !formu.eczanemHedef) || !!formu.seciliUrunId;
  const teknikAdimiTamam = eclubHedef || formu.eczanemHedef || formu.turKurali.teknik !== "zorunlu" || !!formu.seciliTeknikId;
  const serbestAdTamam = !formu.serbestAdGoster || !!formu.serbestAd.trim();
  const yayinKitlesiAktif = urunTeknikAktif && urunAdimiTamam && teknikAdimiTamam && serbestAdTamam;
  const formAktif = yayinKitlesiAktif && formu.hedefRoller.length > 0;
  const dorduncuAdimAktif = formAktif;
  const ikiliHazir = formu.hazirVideo && formu.hazirSoruSeti;
  const videoIslemModalAcik = formu.videoYuklemeYuzdesi !== null || formu.videoIslemeBekleniyor;
  const icerikTuruSecimiGerekli = yetenek.acabilecegiTalepTurleri.length > 1;

  // Eczanem hedefi yalnız ürün müdürü ailesine sunulur (İP-§4.1).
  const hedefRoller = TUM_HEDEF_ROLLER.filter(
    (r) => (r !== "eczanem" || formu.eczanemSecilebilir) && hedefRolIkUreticisineAcikMi(formu.rol, r),
  );

  const podcastAlanlari = formu.ogrenmeAraciTuru === "podcast" ? (
    <PodcastTalepAlanlari
      hazir={formu.hazirVideo}
      iuTranskriptIstendi={formu.podcastIuTranskriptIstendi}
      onIuTranskriptIstendiDegisti={formu.setPodcastIuTranskriptIstendi}
      ses={formu.bekleyenPodcast}
      kapak={formu.bekleyenPodcastKapak}
      transkript={formu.bekleyenPodcastTranskript}
      sesYuklendi={formu.podcastSesYuklendi}
      sesDosyaAdi={formu.podcastYuklenenDosyaAdi}
      kapakYuklendi={formu.podcastKapakYuklendi}
      kapakDosyaAdi={formu.podcastYuklenenKapakAdi}
      transkriptMetni={formu.podcastTranskriptMetni}
      transkriptOnaylandi={formu.podcastTranskriptOnaylandi}
      aiIstendi={formu.podcastAiTranskriptIstendi}
      aracId={formu.podcastAracId ?? undefined}
      islemDurumu={formu.podcastAiAsamasi}
      yuklemeYuzdesi={formu.podcastAiYuklemeYuzdesi}
      onAiBaslat={formu.handlePodcastAiTranskriptBaslat}
      aiYukleniyor={formu.podcastAiYukleniyor}
      aiHatasi={formu.podcastAiHatasi}
      onAiIstendiDegisti={formu.handlePodcastAiTranskriptIstendiDegisti}
      onSesSec={formu.handlePodcastSec}
      onKapakSec={formu.handlePodcastKapakSec}
      onTranskriptSec={formu.handlePodcastTranskriptSec}
      onSesSil={formu.handleBekleyenPodcastSil}
      onKapakSil={formu.handleBekleyenPodcastKapakSil}
      onTranskriptSil={formu.handleBekleyenPodcastTranskriptSil}
      onTranskriptMetinDegisti={formu.handlePodcastTranskriptMetinDegisti}
      onTranskriptOnayla={formu.handlePodcastTranskriptOnayla}
      onTranskriptIptal={formu.handlePodcastTranskriptIptal}
      onSunucuOnayla={formu.handlePodcastTranskriptSunucuOnayla}
      onSunucuIptal={formu.handlePodcastTranskriptSunucuIptal}
      onTranskriptDosyaSecildi={formu.handlePodcastTranskriptDosyaSecildi}
    />
  ) : null;

  return (
    <div className="@container">
      <form onSubmit={formu.handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 @[780px]:grid-cols-2">
          <section className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white px-4 py-3.5">
            <h3 className="mb-3 text-sm font-extrabold text-[#263b58]">Ürün / Konu ve Teknik</h3>
            <div className="grid grid-cols-1 gap-3 @[1000px]:grid-cols-3">
              <fieldset className="min-w-0">
                <legend className="sr-only">İçerik Türü</legend>
                <SadeFormSecimi
                  etiket="İçerik Türü"
                  aria-label="İçerik Türü"
                  value={formu.egitimTuruSecildiMi ? formu.egitimTuru : ""}
                  disabled={!icerikTuruSecimiGerekli}
                  onChange={(event) => {
                    const tur = TUM_TURLER.find((t) => t === event.target.value);
                    if (tur) formu.handleEgitimTuruDegis(tur);
                  }}
                >
                  <option value="" disabled>İçerik türünü seçiniz</option>
                  {TUM_TURLER.filter((tur) => yetenek.acabilecegiTalepTurleri.includes(tur)).map((tur: TalepTuru) => (
                    <option key={tur} value={tur}>{TALEP_TURU_KURALLARI[tur].ad}</option>
                  ))}
                </SadeFormSecimi>
              </fieldset>
              <fieldset disabled={!urunTeknikAktif} className="min-w-0 @[1000px]:col-span-2" style={{ opacity: urunTeknikAktif ? 1 : 0.58 }}>
                <legend className="sr-only">Ürün ve Teknik</legend>
                <div className="flex min-w-0 flex-col gap-3 [&>div>div]:min-w-0">
                  <UrunTeknikSecici
                    urunler={formu.urunler}
                    teknikler={formu.teknikler}
                    takimlar={formu.takimlar}
                    kullaniciTakimId={formu.kullaniciTakimId}
                    seciliUrunId={formu.seciliUrunId}
                    seciliTeknikId={formu.seciliTeknikId}
                    urunGosterilsin={formu.urunGosterilsin}
                    teknikGosterilsin={formu.teknikGosterilsin}
                    turKurali={formu.turKurali}
                    onUrunSec={formu.setSeciliUrunId}
                    onTeknikSec={formu.setSeciliTeknikId}
                    onUrunEkle={formu.handleYeniUrunEkle}
                    onTeknikEkle={formu.handleYeniTeknikEkle}
                  />
                  {formu.serbestAdGoster && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">
                        Eğitim/İçerik Adı <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={formu.serbestAd}
                        onChange={(e) => formu.setSerbestAd(e.target.value)}
                        placeholder="İzleyicinin göreceği ad"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white box-border"
                        style={{ fontFamily: "'Nunito', sans-serif" }}
                      />
                    </div>
                  )}
                </div>
              </fieldset>
            </div>
          </section>
          <fieldset
            disabled={!yayinKitlesiAktif}
            aria-disabled={!yayinKitlesiAktif}
            className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white px-4 py-3.5"
            style={{ opacity: yayinKitlesiAktif ? 1 : 0.58 }}
          >
            <legend className="sr-only">Yayın Kitlesi</legend>
            <h3 className="mb-3 text-sm font-extrabold text-[#263b58]">Yayın Kitlesi</h3>
            <div className={`grid grid-cols-1 gap-2 @[384px]:grid-cols-2 ${hedefRoller.length === 5 ? "@[780px]:grid-cols-6" : ""}`}>
              {hedefRoller.map((rolKey, index) => {
                const tasarim = HEDEF_ROL_TASARIM[rolKey];
                const eclubSecenegi = ECLUB_HEDEF_ROLLER.includes(rolKey);
                const secili = formu.hedefRoller.includes(rolKey);
                return (
                  <label
                    key={rolKey}
                    className={`flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-all ${hedefRoller.length === 5 ? (index < 2 ? "@[780px]:col-span-3" : "@[780px]:col-span-2") : ""}`}
                    style={{
                      background: secili ? tasarim.bg : "#fff",
                      borderColor: secili ? tasarim.renk : "#e5e7eb",
                    }}
                  >
                    <input
                      type={eclubSecenegi ? "checkbox" : "radio"}
                      name="hedef_roller_v2"
                      value={rolKey}
                      checked={secili}
                      onChange={() => eclubSecenegi ? formu.eclubHedefDegistir(rolKey) : formu.setHedefRol(rolKey)}
                      className="cursor-pointer"
                      style={{ accentColor: tasarim.renk }}
                    />
                    <span className="text-xs font-bold" style={{ color: secili ? tasarim.renk : "#425672" }}>
                      {tasarim.tamEtiket}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-4 text-[#7b8ca5]">Sadece Eczacı ve Eczane Teknisyenlerini birlikte tercih edebilirsiniz.</p>
          </fieldset>
        </div>

        <fieldset
          disabled={!formAktif}
          aria-disabled={!formAktif}
          className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white px-4 py-3.5"
          style={{ opacity: formAktif ? 1 : 0.58 }}
        >
          <legend className="sr-only">Yayın ve Üretim Yönetimi</legend>
          <h3 className="mb-3 text-sm font-extrabold text-[#263b58]">Yayın ve Üretim Yönetimi</h3>
          <div className="grid grid-cols-1 items-start gap-3 @[650px]:grid-cols-2 @[936px]:grid-cols-[minmax(301px,1fr)_minmax(264px,1fr)_minmax(312px,1fr)]">
            <div className="min-w-0 @[650px]:col-span-2 @[936px]:col-span-1">
              <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7a8da8]">Yayın Tipi</p>
              <SadeKontrolGrubu aria-label="Öğrenme aracı seçimi" tur="kapsul" className="w-fit max-w-full">
                {(["video", "podcast", "gorsel", "flip_pdf"] as const).filter((tur) => formu.ogrenmeAraciBayraklari[tur]).map((tur) => {
                  const secenek = OGRENME_ARACI_SECENEKLERI[tur];
                  return <SadeKontrolButonu key={tur} type="button" aria-pressed={formu.ogrenmeAraciTuru === tur} title={secenek.formatlar} onClick={() => formu.handleOgrenmeAraciTuruDegis(tur)}>{secenek.etiket}</SadeKontrolButonu>;
                })}
              </SadeKontrolGrubu>
            </div>
            <div className="min-w-0">
              <IkiliUretimSecimi baslik={OGRENME_ARACI_METINLERI[formu.ogrenmeAraciTuru].ad} hazir={formu.hazirVideo} hazirEtiketi="Hazır içeriğim var" onDegistir={formu.toggleHazirVideo} />
              {!formu.hazirVideo && <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>{podcastAlanlari}</div>}
            </div>
            <div className="min-w-0">
              <IkiliUretimSecimi baslik="Soru Seti" hazir={formu.hazirSoruSeti} hazirEtiketi="Hazır soru setim var" onDegistir={formu.toggleHazirSoruSeti} kapsulClassName="w-[312px] max-w-full [&>button]:flex-1" />
              <fieldset disabled={!dorduncuAdimAktif} className="mt-3 min-w-0 [&>div]:grid [&>div]:grid-cols-[repeat(auto-fit,96px)] [&>div>div]:grid [&>div>div]:grid-rows-[1fr_auto] [&>div>div]:min-w-0" style={{ opacity: dorduncuAdimAktif ? 1 : 0.58 }}>
                <legend className="sr-only">Sorular ve Seçenekler</legend>
                <SoruSetiAyarlari
                  buyukluk={formu.soruSetiBuyuklugu}
                  videoBasi={formu.videoBasiSoruSayisi}
                  secenek={formu.secenekSayisi}
                  onBuyuklukChange={formu.setSoruSetiBuyuklugu}
                  onVideoBasiChange={formu.setVideoBasiSoruSayisi}
                  onSecenekChange={formu.setSecenekSayisi}
                  buyuklukEtiketi="Soru sayısı"
                  videoBasiEtiketi="Soru / Yayın"
                />
              </fieldset>
            </div>
          </div>
        </fieldset>
        {(formu.hazirVideo || formu.hazirSoruSeti) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
            {formu.hazirVideo && formu.hazirSoruSeti &&
              `Hazır ${formu.ogrenmeAraciTuru === "podcast" ? "podcast" : formu.ogrenmeAraciTuru === "gorsel" ? "dijital broşür" : formu.ogrenmeAraciTuru === "flip_pdf" ? "literatür" : "video"} ve soru seti talebi oluşturuyorsunuz. Dosyalarınızı yükledikten sonra yayın yönetimi aşamasındaki işlemler sonrası yayına açabilirsiniz.`}
            {formu.hazirVideo && !formu.hazirSoruSeti &&
              `Hazır ${formu.ogrenmeAraciTuru === "podcast" ? "podcast'inizi" : formu.ogrenmeAraciTuru === "gorsel" ? "dijital broşürünüzü" : formu.ogrenmeAraciTuru === "flip_pdf" ? "literatürünüzü" : "videonuzu"} yükledikten sonra soru seti İçerik Üreticisinden talep edilecektir.`}
            {!formu.hazirVideo && formu.hazirSoruSeti &&
              `Hazır soru seti ile talep oluşturuyorsunuz. ${formu.ogrenmeAraciTuru === "podcast" ? "Podcast konuşma metni ve ses üretimini" : formu.ogrenmeAraciTuru === "gorsel" ? "Dijital broşür üretimini" : formu.ogrenmeAraciTuru === "flip_pdf" ? "Literatür üretimini" : "Video için senaryo ve video üretimini"} içerik üreticiniz yapacaktır.`}
          </div>
        )}

        {/* Açıklama ve ek dosyalar: mobilde alt alta, geniş ekranda yan yana. */}
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[#dfe8f3] bg-white px-4 py-3.5 @[650px]:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0" style={{ opacity: formAktif ? 1 : 0.58, pointerEvents: formAktif ? "auto" : "none" }}>
            <label className="mb-1.5 block text-xs font-extrabold text-[#425672]">Talep Açıklaması</label>
            <textarea
              value={formu.aciklama}
              onChange={(e) => formu.setAciklama(e.target.value)}
              placeholder="Açıklama yazınız"
              rows={2}
              disabled={!formAktif || ikiliHazir}
              className="box-border w-full resize-y rounded-xl border border-[#dce5f0] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#56aeff] focus:ring-2 focus:ring-[#56aeff]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            />
          </div>
          <div
            className="min-w-0"
            style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}
          >
            <EkDosyaYukleme
              bekleyenler={formu.bekleyenDosyalar}
              hazirVideo={formu.hazirVideo}
              disabled={!formAktif || ikiliHazir}
              onSec={formu.handleDosyaSec}
              onSil={formu.handleBekleyenDosyaSil}
            />
          </div>
        </section>

        {/* Hazır kol blokları — tam genişlik; soru kartları 25'e kadar çıkabiliyor */}
        <div
          className="flex flex-col gap-3 empty:hidden"
          style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}
        >
          {formu.hazirVideo && formu.ogrenmeAraciTuru === "video" && (
            <VideoYukleme
              bekleyen={formu.bekleyenVideo}
              onSec={formu.handleVideoSec}
              onSil={formu.handleBekleyenVideoSil}
              yuklemeYuzdesi={formu.videoYuklemeYuzdesi}
              ogrenmeAraciTuru={formu.ogrenmeAraciTuru}
            />
          )}
          {formu.hazirVideo && formu.ogrenmeAraciTuru === "gorsel" && (
            <VideoYukleme
              bekleyen={formu.bekleyenGorsel}
              onSec={formu.handleGorselSec}
              onSil={formu.handleBekleyenGorselSil}
              ogrenmeAraciTuru={formu.ogrenmeAraciTuru}
            />
          )}
          {formu.hazirVideo && formu.ogrenmeAraciTuru === "flip_pdf" && (
            <div className="flex flex-col gap-2">
              <VideoYukleme
                bekleyen={formu.bekleyenFlipPdf}
                onSec={formu.handleFlipPdfSec}
                onSil={formu.handleBekleyenFlipPdfSil}
                ogrenmeAraciTuru={formu.ogrenmeAraciTuru}
              />
              <VideoYukleme
                bekleyen={formu.bekleyenFlipPdfKapak}
                onSec={formu.handleFlipPdfKapakSec}
                onSil={formu.handleBekleyenFlipPdfKapakSil}
                ogrenmeAraciTuru={formu.ogrenmeAraciTuru}
                butonMetni="Yayın Görseli (isteğe bağlı)"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                aciklama="JPEG, PNG ve WEBP; en fazla 20 MB."
              />
            </div>
          )}
          {formu.hazirVideo && podcastAlanlari}
          {formu.hazirSoruSeti && (
            <HazirSoruSetiBlogu
              buyukluk={formu.soruSetiBuyuklugu}
              secenekSayisi={formu.secenekSayisi}
              taslaklar={formu.soruTaslaklari}
              onDegis={formu.setSoruTaslaklari}
              onIceAktar={formu.handleSoruIceAktar}
            />
          )}
        </div>

        {/* En alt: gönderim durumu ve işlem */}
        <div className="-mt-2 flex justify-end">
          <div className="flex flex-col items-end gap-1.5">
            {!formu.gonderButonuEtkin && formu.gonderButonuPasifNedeni && (
              <span className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-right text-xs font-semibold text-amber-800">
                {formu.gonderButonuPasifNedeni}
              </span>
            )}
            <SadeIslemButonu
              type="submit"
              disabled={!formAktif || formu.formLoading || formu.dosyaYukleniyor || !formu.gonderButonuEtkin}
            >
              {formu.dosyaYukleniyor
                ? formu.hazirVideo
                  ? "Gönderiliyor..."
                  : "Dosyalar yükleniyor..."
                : formu.formLoading
                ? "Gönderiliyor..."
                : formu.hazirVideo || formu.hazirSoruSeti
                ? "Gönderiniz"
                : "Yayın Oluştur"}
            </SadeIslemButonu>
          </div>
        </div>
      </form>

      {/* Gönderim ancak modaldaki Evet ile başlar (F-01/4) — modal ortak. */}
      <TalepOnayModal
        acik={formu.onayModalAcik}
        sonrakiAdim={ikiliHazir ? "yayin_yonetimi" : "icerik_ureticisi"}
        ozet={{
          hedefKitle: formu.hedefRoller.map((rol) => HEDEF_ROL_TASARIM[rol].tamEtiket).join(", "),
          icerikTuru: TALEP_TURU_KURALLARI[formu.egitimTuru].ad,
          urunAdi: formu.serbestAdGoster
            ? (formu.serbestAd.trim() || null)
            : formu.urunler.find((u) => u.urun_id === formu.seciliUrunId)?.urun_adi ?? null,
          teknikAdi: formu.teknikGosterilsin
            ? formu.teknikler.find((t) => t.teknik_id === formu.seciliTeknikId)?.teknik_adi ?? null
            : null,
          soruAdedi: formu.soruSetiBuyuklugu,
          secenekSayisi: formu.secenekSayisi,
          videoBasiSoru: formu.videoBasiSoruSayisi,
          aracAdi: OGRENME_ARACI_SECENEKLERI[formu.ogrenmeAraciTuru].etiket,
          videoBasiEtiketi: `${OGRENME_ARACI_SECENEKLERI[formu.ogrenmeAraciTuru].etiket} başına soru:`,
        }}
        onEvet={formu.handleOnayEvet}
        onHayir={formu.handleOnayHayir}
      />

      <AlertDialog open={videoIslemModalAcik}>
        <AlertDialogContent
          className="max-w-sm border-[#dbe5ef] bg-white text-center"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <span
              aria-hidden="true"
              className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#dcecff] border-t-[#56aeff]"
            />
            <AlertDialogTitle className="text-[#203653]">
              {formu.videoIslemeBekleniyor ? "Video işleniyor" : "Video yükleniyor"}
            </AlertDialogTitle>
            <AlertDialogDescription className={formu.videoIslemeBekleniyor ? "sr-only" : "text-[#687b90]"}>
              {formu.videoIslemeBekleniyor
                ? "Video işleniyor"
                : `%${formu.videoYuklemeYuzdesi ?? 0}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!formu.videoIslemeBekleniyor && (
            <Progress value={formu.videoYuklemeYuzdesi ?? 0} className="bg-[#dcecff] [&>div]:bg-[#56aeff]" />
          )}
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={formu.aracYuklemeBilgisi !== null}>
        <AlertDialogContent
          className="max-w-sm border-[#dbe5ef] bg-white text-center"
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <AlertDialogTitle className="text-[#203653]">Öğrenme aracı hazırlanıyor</AlertDialogTitle>
            <AlertDialogDescription className="text-[#687b90]">
              {formu.aracYuklemeBilgisi?.asama === "checksum"
                ? "Dosya doğrulanıyor"
                : formu.aracYuklemeBilgisi?.asama === "dogrulama"
                  ? "Yükleme doğrulanıyor"
                  : formu.aracYuklemeBilgisi?.asama === "hazirlama"
                    ? "Dosya hazırlanıyor"
                    : `${formu.aracYuklemeBilgisi?.dosyaRolu ?? "Dosya"} yükleniyor`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Progress value={formu.aracYuklemeBilgisi?.yuzde ?? 0} className="bg-[#dcecff] [&>div]:bg-[#56aeff]" />
          <button
            type="button"
            onClick={formu.ogrenmeAraciYuklemeyiIptalEt}
            className="mx-auto rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Durdur
          </button>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
