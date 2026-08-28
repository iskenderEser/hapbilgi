// app/talepler/_components/YeniTalepFormV2.tsx
//
// Yeni Talep formunun v2 yerleşimi — dört karar bölümü:
//   1) Hedef kitle            2) İçerik türü
//   3) Ürün + teknik          4) Ölçme ayarları
// Altında açıklama tam genişlikte, en altta dosya ekle ve gönder.
//
// KURAL KOPYALANMIYOR: bu dosya yalnız YERLEŞİMDİR. Hedef rol kapısı, tür-ürün-
// teknik zorunlulukları, Eczanem dörtlü kilidi, hazır set parametre kilidi,
// doğrulama sırası ve onay modalının dört varyantı useTalepFormu'da kalır;
// bu bileşen yalnız Talep Merkezi'nin form yerleşimini taşır.

"use client";

import type { useTalepFormu } from "@/app/(panel)/talepler/_hooks/useTalepFormu";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import { ECLUB_HEDEF_ROLLER, hedefRolIkUreticisineAcikMi, TUM_HEDEF_ROLLER } from "@/lib/utils/roller";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
import { TALEP_TURU_ALT_ACIKLAMA, TUM_TURLER } from "@/app/(panel)/talepler/_types";
import { UrunTeknikSecici } from "@/app/(panel)/talepler/_components/UrunTeknikSecici";
import { SoruSetiAyarlari } from "@/app/(panel)/talepler/_components/SoruSetiAyarlari";
import { HazirSoruSetiBlogu } from "@/app/(panel)/talepler/_components/HazirSoruSetiBlogu";
import { VideoYukleme } from "@/app/(panel)/talepler/_components/VideoYukleme";
import { EkDosyaYukleme } from "@/app/(panel)/talepler/_components/EkDosyaYukleme";
import { TalepOnayModal } from "@/app/(panel)/talepler/_components/TalepOnayModal";
import { PodcastTalepAlanlari } from "@/app/(panel)/talepler/_components/PodcastTalepAlanlari";
import { GorselTalepAlanlari } from "@/app/(panel)/talepler/_components/GorselTalepAlanlari";
import { FlipPdfTalepAlanlari } from "@/app/(panel)/talepler/_components/FlipPdfTalepAlanlari";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

interface Props {
  formu: ReturnType<typeof useTalepFormu>;
}

const secimKutusu = (secili: boolean, renk?: string) => ({
  background: secili ? (renk ? `${renk}14` : "#f0f7ff") : "#fff",
  borderColor: secili ? (renk ?? "#56aeff") : "#e5e7eb",
  color: secili ? (renk ?? "#56aeff") : "#374151",
});

export function YeniTalepFormV2({ formu }: Props) {
  const yetenek = formu.yetenek;
  if (!formu.isUretici || !yetenek) return null;

  const formAktif = formu.hedefRoller.length > 0;
  const ucuncuAdimAktif = formAktif && formu.egitimTuruSecildiMi;
  const eclubHedef = formu.hedefRoller.some((hedef) => ECLUB_HEDEF_ROLLER.includes(hedef));
  const urunAdimiTamam = (formu.turKurali.urun !== "zorunlu" && !formu.eczanemHedef) || !!formu.seciliUrunId;
  const teknikAdimiTamam = eclubHedef || formu.eczanemHedef || formu.turKurali.teknik !== "zorunlu" || !!formu.seciliTeknikId;
  const serbestAdTamam = !formu.serbestAdGoster || !!formu.serbestAd.trim();
  const dorduncuAdimAktif = ucuncuAdimAktif && urunAdimiTamam && teknikAdimiTamam && serbestAdTamam;
  const ikiliHazir = formu.hazirVideo && formu.hazirSoruSeti;
  const videoIslemModalAcik = formu.videoYuklemeYuzdesi !== null || formu.videoIslemeBekleniyor;

  // Eczanem hedefi yalnız ürün müdürü ailesine sunulur (İP-§4.1).
  const hedefRoller = TUM_HEDEF_ROLLER.filter(
    (r) => (r !== "eczanem" || formu.eczanemSecilebilir) && hedefRolIkUreticisineAcikMi(formu.rol, r),
  );

  return (
    <div>
      {/* Başlık + hazır içerik anahtarları */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="m-0 text-base font-extrabold text-[#203653]">Talebinizi yapılandırın</h2>
          <p className="mt-1 text-xs leading-4 text-[#7b8ca5]">
            Önce hedef kitleyi seçin; içerik ve üretim seçenekleri buna göre açılır.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-[#e2e9f2] bg-white px-3 py-2.5">
          <div className="flex flex-wrap gap-2" aria-label="Öğrenme aracı seçimi">
            {(["video", "podcast", "gorsel", "flip_pdf"] as const).filter((tur) => formu.ogrenmeAraciBayraklari[tur]).map((tur) => (
              <button
                key={tur}
                type="button"
                aria-pressed={formu.ogrenmeAraciTuru === tur}
                onClick={() => formu.handleOgrenmeAraciTuruDegis(tur)}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-extrabold"
                style={secimKutusu(formu.ogrenmeAraciTuru === tur)}
              >
                {tur === "video" ? "Video" : tur === "podcast" ? "Podcast" : tur === "gorsel" ? "Görsel" : "Flip PDF"}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7a8da8]">
            Elimde hazır içerik var
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {[
            { etiket: formu.ogrenmeAraciTuru === "podcast" ? "Hazır podcast" : formu.ogrenmeAraciTuru === "gorsel" ? "Hazır görsel" : formu.ogrenmeAraciTuru === "flip_pdf" ? "Hazır PDF" : "Hazır video", acik: formu.hazirVideo, degistir: formu.toggleHazirVideo },
            { etiket: "Hazır soru seti", acik: formu.hazirSoruSeti, degistir: formu.toggleHazirSoruSeti },
          ].map((a) => (
            <div key={a.etiket} className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={a.acik}
                aria-label={a.etiket}
                onClick={a.degistir}
                className="relative shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] focus-visible:ring-offset-2"
                style={{ width: 34, height: 20, background: a.acik ? "#56aeff" : "#d9e1eb" }}
              >
                <span
                  aria-hidden="true"
                  className="absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-all duration-200"
                  style={{ left: a.acik ? 17 : 3, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                />
              </button>
              <span className="text-xs font-bold text-[#425672]">{a.etiket}</span>
            </div>
          ))}
          </div>
        </div>
      </div>

      <form onSubmit={formu.handleSubmit} className="flex flex-col gap-4">
        {/* Hazır kol bilgisi — sütunların üstünde, tam genişlik */}
        {(formu.hazirVideo || formu.hazirSoruSeti) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-900">
            {formu.hazirVideo && formu.hazirSoruSeti &&
              `Hazır ${formu.ogrenmeAraciTuru === "podcast" ? "podcast" : formu.ogrenmeAraciTuru === "gorsel" ? "görsel" : formu.ogrenmeAraciTuru === "flip_pdf" ? "PDF" : "video"} ve soru seti talebi oluşturuyorsunuz. Dosyalarınızı yükledikten sonra yayın yönetimi aşamasındaki işlemler sonrası yayına açabilirsiniz.`}
            {formu.hazirVideo && !formu.hazirSoruSeti &&
              `Hazır ${formu.ogrenmeAraciTuru === "podcast" ? "podcast'inizi" : formu.ogrenmeAraciTuru === "gorsel" ? "görselinizi" : formu.ogrenmeAraciTuru === "flip_pdf" ? "PDF'nizi" : "videonuzu"} yükledikten sonra soru seti İçerik Üreticisinden talep edilecektir.`}
            {!formu.hazirVideo && formu.hazirSoruSeti &&
              `Hazır soru seti ile talep oluşturuyorsunuz. ${formu.ogrenmeAraciTuru === "podcast" ? "Podcast konuşma metni ve ses üretimini" : formu.ogrenmeAraciTuru === "gorsel" ? "Görsel üretimini" : formu.ogrenmeAraciTuru === "flip_pdf" ? "Flip PDF üretimini" : "Video için senaryo ve video üretimini"} içerik üreticiniz yapacaktır.`}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
          {/* 1 — Hedef rol. Formun ilk karar noktası; seçilmeden alt alanlar pasif. */}
          <section className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]">
            <div className="mb-3">
              <span className="inline-flex h-7 items-center justify-center rounded-lg bg-[#eaf4ff] px-2.5 text-xs font-extrabold text-[#2483e2]">1. Adım</span>
              <h3 className="mt-2 text-sm font-extrabold text-[#263b58]">
                Hedef Kitle <span className="text-red-500">*</span>
              </h3>
              <p className="mt-0.5 text-xs text-[#7a8ca5]">Bu içerik kimin gelişimi için hazırlanacak?</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {hedefRoller.map((rolKey) => {
                const tasarim = HEDEF_ROL_TASARIM[rolKey];
                const eclubSecenegi = ECLUB_HEDEF_ROLLER.includes(rolKey);
                const secili = formu.hedefRoller.includes(rolKey);
                return (
                  <label
                    key={rolKey}
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-all"
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
          </section>

          {/* Hedef rol seçilmeden kalan üç sütun pasif görünür ve tıklanamaz.
              Pasiflik sütun sütun verilir: grid çocuğunu saran bir kapsayıcı
              sütun düzenini bozardı. */}
          <>
            {/* 2 — Yayın içeriği (talep türü). Rolün açamadıkları soluk ve tıklanamaz. */}
            <fieldset
              disabled={!formAktif}
              aria-disabled={!formAktif}
              className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-opacity"
              style={{ opacity: formAktif ? 1 : 0.58, pointerEvents: formAktif ? "auto" : "none" }}
            >
              <legend className="sr-only">İçerik Türü</legend>
              <div className="mb-3">
                <span className="inline-flex h-7 items-center justify-center rounded-lg bg-[#f0edff] px-2.5 text-xs font-extrabold text-[#7557d5]">2. Adım</span>
                <h3 className="mt-2 text-sm font-extrabold text-[#263b58]">İçerik Türü</h3>
                <p className="mt-0.5 text-xs text-[#7a8ca5]">Talebin eğitim odağını belirleyin.</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {TUM_TURLER.map((tur: TalepTuru) => {
                  const secili = formu.egitimTuruSecildiMi && formu.egitimTuru === tur;
                  const secilebilir = yetenek.acabilecegiTalepTurleri.includes(tur);
                  return (
                    <button
                      type="button"
                      key={tur}
                      disabled={!secilebilir}
                      onClick={() => formu.handleEgitimTuruDegis(tur)}
                      aria-pressed={secili}
                      className="min-h-[58px] rounded-xl border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] focus-visible:ring-offset-1"
                      style={{
                        ...secimKutusu(secili),
                        cursor: secilebilir ? "pointer" : "not-allowed",
                        opacity: secilebilir ? 1 : 0.42,
                      }}
                      title={TALEP_TURU_ALT_ACIKLAMA[tur]}
                    >
                      <span className="block text-xs font-extrabold">{TALEP_TURU_KURALLARI[tur].ad}</span>
                      <span className="mt-0.5 block text-[10px] leading-3.5 text-[#8493a9]">
                        {TALEP_TURU_ALT_ACIKLAMA[tur]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 3 — Ürün + teknik. Ürünsüz+tekniksiz türlerde yeri serbest ada geçer. */}
            <fieldset
              disabled={!ucuncuAdimAktif}
              aria-disabled={!ucuncuAdimAktif}
              className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-opacity"
              style={{ opacity: ucuncuAdimAktif ? 1 : 0.58, pointerEvents: ucuncuAdimAktif ? "auto" : "none" }}
            >
              <legend className="sr-only">Ürün ve Teknik</legend>
              <div className="mb-3">
                <span className="inline-flex h-7 items-center justify-center rounded-lg bg-[#e9f8f1] px-2.5 text-xs font-extrabold text-[#159463]">3. Adım</span>
                <h3 className="mt-2 text-sm font-extrabold text-[#263b58]">Ürün ve Teknik</h3>
                <p className="mt-0.5 text-xs text-[#7a8ca5]">İçeriğin ticari ve davranışsal bağlamını seçin.</p>
              </div>
              {/* UrunTeknikSecici kendi içinde md+ ekranda ürün ve tekniği YAN YANA
                  diziyor (flex-row). Burada sütun dar olduğu için ikisi alt alta
                  olmalı — yön zorla değiştirilir, ortak bileşene dokunulmaz. */}
              <div className="flex flex-col gap-3 [&>div]:!flex-col">
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

            {/* 4 — Soru ayarları. ORTAK BİLEŞEN (28.07 düzeltmesi): üç select bir
                süre burada elle yazılıydı; seçenek listeleri ikinci kez kopyalanmış
                oluyordu. Artık /talepler ile aynı bileşen çağrılıyor — adlar
                (İskender, A-10b) etiket parametreleriyle geçiriliyor.
                Bileşen kendi içinde md+ ekranda üçünü YAN YANA diziyor; bu sütun
                dar olduğu için yön sarmalayıcıda `!flex-col` ile zorlanır —
                UrunTeknikSecici'de olduğu gibi, ortak bileşene dokunulmaz. */}
            <fieldset
              disabled={!dorduncuAdimAktif}
              aria-disabled={!dorduncuAdimAktif}
              className="min-w-0 rounded-2xl border border-[#dfe8f3] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)] transition-opacity [&>div:last-child]:!flex-col"
              style={{ opacity: dorduncuAdimAktif ? 1 : 0.58, pointerEvents: dorduncuAdimAktif ? "auto" : "none" }}
            >
              <legend className="sr-only">Sorular ve Seçenekler</legend>
              <div className="mb-3">
                <span className="inline-flex h-7 items-center justify-center rounded-lg bg-[#fff3e8] px-2.5 text-xs font-extrabold text-[#d66b16]">4. Adım</span>
                <h3 className="mt-2 text-sm font-extrabold text-[#263b58]">Sorular ve Seçenekler</h3>
                <p className="mt-0.5 text-xs text-[#7a8ca5]">Soru setinin kapsamını ve yoğunluğunu belirleyin.</p>
              </div>
              <SoruSetiAyarlari
                buyukluk={formu.soruSetiBuyuklugu}
                videoBasi={formu.videoBasiSoruSayisi}
                secenek={formu.secenekSayisi}
                onBuyuklukChange={formu.setSoruSetiBuyuklugu}
                onVideoBasiChange={formu.setVideoBasiSoruSayisi}
                onSecenekChange={formu.setSecenekSayisi}
                buyuklukEtiketi="Soru sayısı"
                videoBasiEtiketi={`${formu.ogrenmeAraciTuru === "podcast" ? "Podcast" : formu.ogrenmeAraciTuru === "gorsel" ? "Görsel" : formu.ogrenmeAraciTuru === "flip_pdf" ? "Flip PDF" : "Video"} başına soru adedi`}
              />
            </fieldset>
          </>
        </div>

        {formu.ogrenmeAraciTuru === "podcast" && (
          <PodcastTalepAlanlari
            anlatimTuru={formu.podcastAnlatimTuru}
            onAnlatimTuruDegis={formu.setPodcastAnlatimTuru}
            hazir={formu.hazirVideo}
            ses={formu.bekleyenPodcast}
            kapak={formu.bekleyenPodcastKapak}
            transkript={formu.bekleyenPodcastTranskript}
            onSesSec={formu.handlePodcastSec}
            onKapakSec={formu.handlePodcastKapakSec}
            onTranskriptSec={formu.handlePodcastTranskriptSec}
            onSesSil={formu.handleBekleyenPodcastSil}
            onKapakSil={formu.handleBekleyenPodcastKapakSil}
            onTranskriptSil={formu.handleBekleyenPodcastTranskriptSil}
          />
        )}
        {formu.ogrenmeAraciTuru === "gorsel" && <GorselTalepAlanlari hazir={formu.hazirVideo} gorsel={formu.bekleyenGorsel} onSec={formu.handleGorselSec} onSil={formu.handleBekleyenGorselSil} />}
        {formu.ogrenmeAraciTuru === "flip_pdf" && <FlipPdfTalepAlanlari hazir={formu.hazirVideo} pdf={formu.bekleyenFlipPdf} onSec={formu.handleFlipPdfSec} onSil={formu.handleBekleyenFlipPdfSil} />}

        {/* Açıklama — dört sütunun altında, tam genişlik */}
        <div className="rounded-2xl border border-[#dfe8f3] bg-white p-4" style={{ opacity: formAktif ? 1 : 0.58, pointerEvents: formAktif ? "auto" : "none" }}>
          <label className="mb-1.5 block text-xs font-extrabold text-[#425672]">Talep Açıklaması</label>
          <textarea
            value={formu.aciklama}
            onChange={(e) => formu.setAciklama(e.target.value)}
            placeholder="Açıklama yazınız"
            rows={3}
            disabled={!formAktif || ikiliHazir}
            className="box-border w-full resize-y rounded-xl border border-[#dce5f0] bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#56aeff] focus:ring-2 focus:ring-[#56aeff]/15 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          />
        </div>

        {/* Hazır kol blokları — tam genişlik; soru kartları 25'e kadar çıkabiliyor */}
        <div
          className="flex flex-col gap-3"
          style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}
        >
          {formu.hazirVideo && formu.ogrenmeAraciTuru === "video" && (
            <VideoYukleme
              bekleyen={formu.bekleyenVideo}
              onSec={formu.handleVideoSec}
              onSil={formu.handleBekleyenVideoSil}
              yuklemeYuzdesi={formu.videoYuklemeYuzdesi}
            />
          )}
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

        {/* En alt: solda dosya ekle, sağda gönder */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[#dfe8f3] bg-white p-4">
          <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>
            <EkDosyaYukleme
              bekleyenler={formu.bekleyenDosyalar}
              hazirVideo={formu.hazirVideo}
              disabled={!formAktif || ikiliHazir}
              onSec={formu.handleDosyaSec}
              onSil={formu.handleBekleyenDosyaSil}
            />
          </div>
          <button
            type="submit"
            disabled={!formAktif || formu.formLoading || formu.dosyaYukleniyor}
            className="min-w-[150px] cursor-pointer whitespace-nowrap rounded-xl border-none px-5 py-3 text-xs font-extrabold text-white shadow-[0_8px_18px_rgba(37,131,226,0.2)] transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed"
            style={{
              background: "#56aeff",
              opacity: !formAktif || formu.formLoading || formu.dosyaYukleniyor ? 0.6 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {formu.dosyaYukleniyor
              ? formu.hazirVideo
                ? "Gönderiliyor..."
                : "Dosyalar yükleniyor..."
              : formu.formLoading
              ? "Gönderiliyor..."
              : formu.hazirVideo || formu.hazirSoruSeti
              ? "Gönderiniz"
              : "Talep Oluştur"}
          </button>
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
            İptal Et
          </button>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
