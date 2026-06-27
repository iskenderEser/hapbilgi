// app/talepler/_components/YeniTalepForm.tsx
//
// "Yeni Talep" form kartı: 7 alt bileşeni hook ile bağlar.
// Hook'un return değerini tek `formu` prop'u olarak alır; içeride destrüktüre eder.
// isUretici/yetenek kontrolü içeride — parent koşullu sarmalama yapmaz.
//
// Form akışı: önce hedef rol (UTT/BM) seçilir, sonra diğer alanlar aktifleşir.

"use client";

import type { useTalepFormu } from "../_hooks/useTalepFormu";
import { HEDEF_ROL_TASARIM, type HedefRol } from "../_types";
import { TalepTuruTablari } from "./TalepTuruTablari";
import { UrunTeknikSecici } from "./UrunTeknikSecici";
import { SoruSetiAyarlari } from "./SoruSetiAyarlari";
import { HazirSoruSetiBlogu } from "./HazirSoruSetiBlogu";
import { VideoYukleme } from "./VideoYukleme";
import { EkDosyaYukleme } from "./EkDosyaYukleme";

interface YeniTalepFormProps {
  formu: ReturnType<typeof useTalepFormu>;
}

export function YeniTalepForm({ formu }: YeniTalepFormProps) {
  if (!formu.isUretici || !formu.yetenek) return null;

  const formAktif = formu.hedefRol !== null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-900 m-0">Yeni Talep</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={formu.toggleHazirVideo}
              className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
              style={{
                width: 32,
                height: 18,
                background: formu.hazirVideo ? "#56aeff" : "#e5e7eb",
              }}
            >
              <div
                className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
                style={{
                  left: formu.hazirVideo ? 16 : 2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">Hazır Videom Var</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={formu.toggleHazirSoruSeti}
              className="relative cursor-pointer flex-shrink-0 rounded-full transition-colors duration-200"
              style={{
                width: 32,
                height: 18,
                background: formu.hazirSoruSeti ? "#56aeff" : "#e5e7eb",
              }}
            >
              <div
                className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all duration-200"
                style={{
                  left: formu.hazirSoruSeti ? 16 : 2,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">Hazır Soru Setim Var</span>
          </label>
        </div>
      </div>

      {/* Hedef Rol Seçimi — formun ilk karar noktası */}
      <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-500 mb-2">Bu talep kimin için? <span className="text-red-500">*</span></div>
        <div className="flex flex-wrap gap-3">
          {(["utt", "bm"] as const).map((rolKey: HedefRol) => {
            const tasarim = HEDEF_ROL_TASARIM[rolKey];
            const secili = formu.hedefRol === rolKey;
            return (
              <label
                key={rolKey}
                className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-md border transition-all"
                style={{
                  background: secili ? tasarim.bg : "white",
                  borderColor: secili ? tasarim.renk : "#e5e7eb",
                }}
              >
                <input
                  type="radio"
                  name="hedef_rol"
                  value={rolKey}
                  checked={secili}
                  onChange={() => formu.setHedefRol(rolKey)}
                  className="cursor-pointer"
                  style={{ accentColor: tasarim.renk }}
                />
                <span
                  className="text-xs font-semibold"
                  style={{ color: secili ? tasarim.renk : "#374151" }}
                >
                  {tasarim.tamEtiket}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <form onSubmit={formu.handleSubmit} className="flex flex-col gap-3">
        {/* Hedef rol seçilmediyse alt form pasif görünür ve etkileşime kapalı */}
        <div
          style={{
            opacity: formAktif ? 1 : 0.4,
            pointerEvents: formAktif ? "auto" : "none",
          }}
          className="flex flex-col gap-3"
        >
          <TalepTuruTablari
            egitimTuru={formu.egitimTuru}
            yetenek={formu.yetenek}
            onChange={formu.handleEgitimTuruDegis}
          />

          {(formu.hazirVideo || formu.hazirSoruSeti) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
              {formu.hazirVideo && formu.hazirSoruSeti &&
                "Hazır video ve soru seti talebi oluşturuyorsunuz. Senaryo aşaması atlanacak — IU videoyu Bunny.net'e yükleyecek, ardından sizin yüklediğiniz soru setini sisteme işleyecektir."}
              {formu.hazirVideo && !formu.hazirSoruSeti &&
                "Hazır video talebi oluşturuyorsunuz. Senaryo aşaması atlanacak — IU videoyu Bunny.net'e yükleyip URL iletecek, ardından soru seti yazım sürecine geçilecektir."}
              {!formu.hazirVideo && formu.hazirSoruSeti &&
                "Hazır soru seti talebi oluşturuyorsunuz. Normal senaryo ve video akışı işleyecek — IU soru seti yazma aşamasında sizin yüklediğiniz soru setini sisteme işleyecektir."}
            </div>
          )}

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

          <SoruSetiAyarlari
            buyukluk={formu.soruSetiBuyuklugu}
            videoBasi={formu.videoBasiSoruSayisi}
            onBuyuklukChange={formu.setSoruSetiBuyuklugu}
            onVideoBasiChange={formu.setVideoBasiSoruSayisi}
          />

          <div>
            <label className="text-xs text-gray-500 block mb-1">Açıklama</label>
            <textarea
              value={formu.aciklama}
              onChange={(e) => formu.setAciklama(e.target.value)}
              placeholder="Talep açıklamasını girin"
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white resize-y box-border"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            />
          </div>

          {formu.hazirVideo && (
            <VideoYukleme
              bekleyen={formu.bekleyenVideo}
              onSec={formu.handleVideoSec}
              onSil={formu.handleBekleyenVideoSil}
            />
          )}

          {formu.hazirSoruSeti && (
            <HazirSoruSetiBlogu
              buyukluk={formu.soruSetiBuyuklugu}
              metin={formu.soruSetiMetni}
              onMetinChange={formu.setSoruSetiMetni}
              onizleme={formu.soruSetiOnizleme}
              hata={formu.soruSetiHata}
              onOnizle={formu.handleSoruSetiOnizle}
            />
          )}

          <EkDosyaYukleme
            bekleyenler={formu.bekleyenDosyalar}
            hazirVideo={formu.hazirVideo}
            onSec={formu.handleDosyaSec}
            onSil={formu.handleBekleyenDosyaSil}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!formAktif || formu.formLoading || formu.dosyaYukleniyor}
            className="text-white border-none rounded-lg px-5 py-2.5 text-xs font-semibold cursor-pointer"
            style={{
              background: "#56aeff",
              opacity: !formAktif || formu.formLoading || formu.dosyaYukleniyor ? 0.6 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {formu.dosyaYukleniyor
              ? "Dosyalar yükleniyor..."
              : formu.formLoading
              ? "Gönderiliyor..."
              : "Talep Oluştur"}
          </button>
        </div>
      </form>
    </div>
  );
}