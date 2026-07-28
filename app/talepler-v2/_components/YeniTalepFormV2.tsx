// app/talepler-v2/_components/YeniTalepFormV2.tsx
//
// Yeni Talep formunun v2 yerleşimi — DÖRT SÜTUN (İskender tasarımı, 28.07):
//   1) Bu talep kimin için   2) Yayın içeriği
//   3) Ürün + teknik         4) Soru sayısı + seçenek + video başına adet
// Altında açıklama tam genişlikte, en altta dosya ekle ve gönder.
//
// KURAL KOPYALANMIYOR: bu dosya yalnız YERLEŞİMDİR. Hedef rol kapısı, tür-ürün-
// teknik zorunlulukları, Eczanem dörtlü kilidi, hazır set parametre kilidi,
// doğrulama sırası ve onay modalının dört varyantı useTalepFormu'da kalır —
// oraya dokunulmadı. Ortak YeniTalepForm da olduğu gibi duruyor; /talepler
// sayfası onu kullanmaya devam ediyor (S-5'ten sapma, İskender onayı 28.07: "b").

"use client";

import type { useTalepFormu } from "@/app/talepler/_hooks/useTalepFormu";
import { HEDEF_ROL_TASARIM, type HedefRol } from "@/app/talepler/_types";
import { TALEP_TURU_KURALLARI, type TalepTuru } from "@/lib/uretici/yetenekler";
import { TALEP_TURU_ALT_ACIKLAMA, TUM_TURLER } from "@/app/talepler/_types";
import { UrunTeknikSecici } from "@/app/talepler/_components/UrunTeknikSecici";
import { SoruSetiAyarlari } from "@/app/talepler/_components/SoruSetiAyarlari";
import { HazirSoruSetiBlogu } from "@/app/talepler/_components/HazirSoruSetiBlogu";
import { VideoYukleme } from "@/app/talepler/_components/VideoYukleme";
import { EkDosyaYukleme } from "@/app/talepler/_components/EkDosyaYukleme";
import { TalepOnayModal } from "@/app/talepler/_components/TalepOnayModal";

interface Props {
  formu: ReturnType<typeof useTalepFormu>;
}

const secimKutusu = (secili: boolean, renk?: string) => ({
  background: secili ? (renk ? `${renk}14` : "#f0f7ff") : "#fff",
  borderColor: secili ? (renk ?? "#56aeff") : "#e5e7eb",
  color: secili ? (renk ?? "#56aeff") : "#374151",
});

export function YeniTalepFormV2({ formu }: Props) {
  if (!formu.isUretici || !formu.yetenek) return null;

  const formAktif = formu.hedefRol !== null;
  const ikiliHazir = formu.hazirVideo && formu.hazirSoruSeti;

  // Eczanem hedefi yalnız ürün müdürü ailesine sunulur (İP-§4.1).
  const hedefRoller = ([
    "utt", "bm", "eczaci", "eczane_teknisyeni",
    ...(formu.eczanemSecilebilir ? (["eczanem"] as const) : []),
  ] as HedefRol[]);

  return (
    <div>
      {/* Başlık + iki anahtar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-semibold text-gray-900 m-0">Yeni Talep</h2>
        <div className="flex items-center gap-4">
          {[
            { etiket: "Hazır Videom Var", acik: formu.hazirVideo, degistir: formu.toggleHazirVideo },
            { etiket: "Hazır Soru Setim Var", acik: formu.hazirSoruSeti, degistir: formu.toggleHazirSoruSeti },
          ].map((a) => (
            <label key={a.etiket} className="flex items-center gap-1.5 cursor-pointer">
              <div
                onClick={a.degistir}
                className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
                style={{ width: 32, height: 18, background: a.acik ? "#56aeff" : "#e5e7eb" }}
              >
                <div
                  className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
                  style={{ left: a.acik ? 16 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700">{a.etiket}</span>
            </label>
          ))}
        </div>
      </div>

      <form onSubmit={formu.handleSubmit} className="flex flex-col gap-3">
        {/* Hazır kol bilgisi — sütunların üstünde, tam genişlik */}
        {(formu.hazirVideo || formu.hazirSoruSeti) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
            {formu.hazirVideo && formu.hazirSoruSeti &&
              "Hazır video ve soru seti talebi oluşturuyorsunuz. Video ve soru setinizi yükledikten sonra yayın yönetimi aşamasındaki işlemler sonrası yayına açabilirsiniz."}
            {formu.hazirVideo && !formu.hazirSoruSeti &&
              "Videonuzu yükledikten sonra hazır soru setinizle devam edebilir ya da içerik üreticisinden talep edebilirsiniz."}
            {!formu.hazirVideo && formu.hazirSoruSeti &&
              "Hazır soru seti ile talep oluşturuyorsunuz. Video için senaryo yazılmasını ve videonun oluşturulmasını içerik üreticiniz yapacaktır."}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {/* 1 — Hedef rol. Formun ilk karar noktası; seçilmeden alt alanlar pasif. */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">
              Bu talep kimin için? <span className="text-red-500">*</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {hedefRoller.map((rolKey) => {
                const tasarim = HEDEF_ROL_TASARIM[rolKey];
                const secili = formu.hedefRol === rolKey;
                return (
                  <label
                    key={rolKey}
                    className="flex items-center gap-2 cursor-pointer px-2.5 py-1.5 rounded-lg border transition-all"
                    style={{
                      background: secili ? tasarim.bg : "#fff",
                      borderColor: secili ? tasarim.renk : "#e5e7eb",
                    }}
                  >
                    <input
                      type="radio"
                      name="hedef_rol_v2"
                      value={rolKey}
                      checked={secili}
                      onChange={() => formu.setHedefRol(rolKey)}
                      className="cursor-pointer"
                      style={{ accentColor: tasarim.renk }}
                    />
                    <span className="text-xs font-semibold" style={{ color: secili ? tasarim.renk : "#374151" }}>
                      {tasarim.tamEtiket}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Hedef rol seçilmeden kalan üç sütun pasif görünür ve tıklanamaz.
              Pasiflik sütun sütun verilir: grid çocuğunu saran bir kapsayıcı
              sütun düzenini bozardı. */}
          <>
            {/* 2 — Yayın içeriği (talep türü). Rolün açamadıkları soluk ve tıklanamaz. */}
            <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>
              <div className="text-xs text-gray-500 mb-1.5">Yayın içeriği</div>
              <div className="flex flex-col gap-1.5">
                {TUM_TURLER.map((tur: TalepTuru) => {
                  const acabilir = formu.yetenek!.acabilecegiTalepTurleri.includes(tur);
                  const secili = formu.egitimTuru === tur;
                  return (
                    <div
                      key={tur}
                      onClick={() => acabilir && formu.handleEgitimTuruDegis(tur)}
                      className="px-2.5 py-1.5 rounded-lg border transition-all"
                      style={{
                        ...secimKutusu(secili),
                        cursor: acabilir ? "pointer" : "not-allowed",
                        opacity: acabilir ? 1 : 0.45,
                      }}
                      title={TALEP_TURU_ALT_ACIKLAMA[tur]}
                    >
                      <span className="text-xs font-semibold">{TALEP_TURU_KURALLARI[tur].ad}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3 — Ürün + teknik. Ürünsüz+tekniksiz türlerde yeri serbest ada geçer. */}
            <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>
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
            </div>

            {/* 4 — Soru ayarları. ORTAK BİLEŞEN (28.07 düzeltmesi): üç select bir
                süre burada elle yazılıydı; seçenek listeleri ikinci kez kopyalanmış
                oluyordu. Artık /talepler ile aynı bileşen çağrılıyor — adlar
                (İskender, A-10b) etiket parametreleriyle geçiriliyor.
                Bileşen kendi içinde md+ ekranda üçünü YAN YANA diziyor; bu sütun
                dar olduğu için yön sarmalayıcıda `!flex-col` ile zorlanır —
                UrunTeknikSecici'de olduğu gibi, ortak bileşene dokunulmaz. */}
            <div
              className="[&>div]:!flex-col"
              style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}
            >
              <SoruSetiAyarlari
                buyukluk={formu.soruSetiBuyuklugu}
                videoBasi={formu.videoBasiSoruSayisi}
                secenek={formu.secenekSayisi}
                onBuyuklukChange={formu.setSoruSetiBuyuklugu}
                onVideoBasiChange={formu.setVideoBasiSoruSayisi}
                onSecenekChange={formu.setSecenekSayisi}
                buyuklukEtiketi="Soru sayısı"
                videoBasiEtiketi="Video başına soru adedi"
              />
            </div>
          </>
        </div>

        {/* Açıklama — dört sütunun altında, tam genişlik */}
        <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>
          <label className="text-xs text-gray-500 block mb-1">Açıklama</label>
          <textarea
            value={formu.aciklama}
            onChange={(e) => formu.setAciklama(e.target.value)}
            placeholder="Açıklama yazınız"
            rows={3}
            disabled={ikiliHazir}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white resize-y box-border disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          />
        </div>

        {/* Hazır kol blokları — tam genişlik; soru kartları 25'e kadar çıkabiliyor */}
        <div
          className="flex flex-col gap-3"
          style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}
        >
          {formu.hazirVideo && (
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
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div style={{ opacity: formAktif ? 1 : 0.4, pointerEvents: formAktif ? "auto" : "none" }}>
            <EkDosyaYukleme
              bekleyenler={formu.bekleyenDosyalar}
              hazirVideo={formu.hazirVideo}
              disabled={ikiliHazir}
              onSec={formu.handleDosyaSec}
              onSil={formu.handleBekleyenDosyaSil}
            />
          </div>
          <button
            type="submit"
            disabled={!formAktif || formu.formLoading || formu.dosyaYukleniyor}
            className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
            style={{
              background: "#56aeff",
              opacity: !formAktif || formu.formLoading || formu.dosyaYukleniyor ? 0.6 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {formu.dosyaYukleniyor
              ? formu.videoYuklemeYuzdesi !== null
                ? `Video yükleniyor... %${formu.videoYuklemeYuzdesi}`
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
        iuSoruSeti={formu.hazirVideo && !formu.hazirSoruSeti}
        ozet={{
          urunAdi: formu.serbestAdGoster
            ? (formu.serbestAd.trim() || null)
            : formu.urunler.find((u) => u.urun_id === formu.seciliUrunId)?.urun_adi ?? null,
          teknikAdi: formu.teknikGosterilsin
            ? formu.teknikler.find((t) => t.teknik_id === formu.seciliTeknikId)?.teknik_adi ?? null
            : null,
          soruAdedi: formu.soruSetiBuyuklugu,
          videoBasiSoru: formu.videoBasiSoruSayisi,
          aciklama: formu.aciklama,
          dosyaAdlari: formu.bekleyenDosyalar.map((d) => d.preview.dosya_adi),
          videoAdi: formu.bekleyenVideo?.preview.dosya_adi ?? null,
        }}
        onEvet={formu.handleOnayEvet}
        onHayir={formu.handleOnayHayir}
      />
    </div>
  );
}
