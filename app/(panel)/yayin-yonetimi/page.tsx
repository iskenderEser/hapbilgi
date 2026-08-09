// app/yayin-yonetimi/page.tsx
//
// Yayın yönetimi sayfası — orchestrator.
// Auth + sekme/modal state + useYayinYonetimi hook'unu bağlar; satır ve modal
// bileşenlerini render eder. Veri ve iş mantığı hook'ta, sunum _components'te.
//
// Ana sekmeler hedef role göre (şu an UTT / BM). Alt sekmeler durum filtresi
// (bekleyen / yayında / durdurulan).

"use client";

import { useState } from "react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import type { HedefRol } from "@/app/(panel)/talepler/_types";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import type { Bekleyen, AltSekme } from "./_types";
import { ANA_SEKMELER, ANA_SEKME_ETIKETLERI } from "./_types";
import { useYayinYonetimi } from "./_hooks/useYayinYonetimi";
import { BekleyenSatir } from "./_components/BekleyenSatir";
import { YayinSatir } from "./_components/YayinSatir";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import { VideoOnizlemeModal, YayinOnayModal } from "./_components/Modallar";

export default function YayinYonetimiPage() {
  const { kullanici } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [aktifAnaSekme, setAktifAnaSekme] = useState<HedefRol>("utt");
  const [aktifSekme, setAktifSekme] = useState<AltSekme>("bekleyen");

  // Saf UI state (modallar + akordiyon + video önizleme) — sayfada kalır.
  const [acikAkordiyon, setAcikAkordiyon] = useState<string | null>(null);
  const [acikVideo, setAcikVideo] = useState<string | null>(null);
  const [onayModal, setOnayModal] = useState<Bekleyen | null>(null);

  const yy = useYayinYonetimi({
    kullaniciVar: !!kullanici,
    aktifAnaSekme,
    hata,
    basari,
  });

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Yayınla onayı: modaldaki içeriği yayınlar, modalı kapatır.
  const handleYayinlaOnayla = async () => {
    if (!onayModal) return;
    const b = onayModal;
    setOnayModal(null);
    await yy.handleYayinla(b);
  };

  // Yayınları hedef_rol'e göre filtrele (client-side)
  const yayinlarFiltreli = yy.yayinlar.filter(y => y.hedef_rol === aktifAnaSekme);
  // Planlanmış yayınlar "Yayında" sekmesinde listelenir (Planlandı rozetiyle);
  // tarihi gelince cron aktive eder, rozet kendiliğinden "Yayında"ya döner.
  const yayindakiler = yayinlarFiltreli.filter(y => y.durum === "yayinda" || y.durum === "planlandi");
  const durdurulular = yayinlarFiltreli.filter(y => y.durum === "Durduruldu");

  // Arama + kademeli listeleme merkezden (components/liste). Üç sekme üç ayrı
  // liste olduğu için üç kanca var; React kancaları koşulsuz çağrılmalı, bu yüzden
  // aktif sekmeye göre tek kanca kurulamaz — üçü de kurulur, biri kullanılır.
  const ARAMA_ALANLARI = [
    { anahtar: "no", etiket: "Talep No", deger: (r: { talep_no: number }) => r.talep_no },
    { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (r: { urun_adi: string }) => r.urun_adi },
  ];
  const bekleyenListe = useListe({ veri: yy.bekleyenler, aramaAlanlari: ARAMA_ALANLARI });
  const yayindaListe = useListe({ veri: yayindakiler, aramaAlanlari: ARAMA_ALANLARI });
  const durdurulanListe = useListe({ veri: durdurulular, aramaAlanlari: ARAMA_ALANLARI });

  // Auth guard layout'ta; burada yalnız veri yükleme spinner'ı.
  if (yy.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">

        {/* Ana sekmeler: hedef role göre — UTT / BM / Eczacı / Eczane Teknisyeni */}
        <div className="flex flex-wrap gap-1 mb-4">
          {ANA_SEKMELER.map((sekme) => {
            const tasarim = HEDEF_ROL_TASARIM[sekme];
            const aktif = aktifAnaSekme === sekme;
            return (
              <button key={sekme} onClick={() => setAktifAnaSekme(sekme)}
                className="px-5 py-2 rounded-lg border cursor-pointer text-sm font-semibold"
                style={{
                  background: aktif ? tasarim.renk : "white",
                  color: aktif ? "white" : "#737373",
                  borderColor: aktif ? tasarim.renk : "#e5e7eb",
                  fontFamily: "'Nunito', sans-serif",
                }}>
                {ANA_SEKME_ETIKETLERI[sekme]}
              </button>
            );
          })}
        </div>

        {/* Alt sekmeler: Bekleyen / Yayında / Durdurulan */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-5 overflow-x-auto">
          {(["bekleyen", "yayinda", "durdurulan"] as const).map((sekme) => (
            <button key={sekme} onClick={() => setAktifSekme(sekme)}
              className="px-4 py-1.5 rounded-lg border-none cursor-pointer text-xs font-semibold whitespace-nowrap"
              style={{ background: aktifSekme === sekme ? HEDEF_ROL_TASARIM[aktifAnaSekme].renk : "transparent", color: aktifSekme === sekme ? "white" : "#737373", fontFamily: "'Nunito', sans-serif" }}>
              {sekme === "bekleyen" ? `Bekleyen (${yy.bekleyenler.length})` : sekme === "yayinda" ? `Yayında (${yayindakiler.length})` : `Durdurulan (${durdurulular.length})`}
            </button>
          ))}
        </div>

        {aktifSekme === "bekleyen" && (
          <div className="mb-3 flex justify-end"><ListeArama arama={bekleyenListe.arama} /></div>
        )}
        {aktifSekme === "bekleyen" && (
          bekleyenListe.toplam === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">{yy.bekleyenler.length === 0 ? "Bekleyen video yok." : "Aramanıza uyan kayıt bulunamadı."}</div>
            : bekleyenListe.gorunen.map(b => (
              <BekleyenSatir key={b.soru_seti_durum_id} b={b}
                islemLoading={yy.islemLoading}
                acikAkordiyon={acikAkordiyon} setAcikAkordiyon={setAcikAkordiyon}
                videoPuanlari={yy.videoPuanlari} setVideoPuanlari={yy.setVideoPuanlari}
                extraPuanlar={yy.extraPuanlar} setExtraPuanlar={yy.setExtraPuanlar}
                barkodlar={yy.barkodlar} setBarkodlar={yy.setBarkodlar}
                karsilikPuanlar={yy.karsilikPuanlar} setKarsilikPuanlar={yy.setKarsilikPuanlar}
                karsilikTllar={yy.karsilikTllar} setKarsilikTllar={yy.setKarsilikTllar}
                tekrarPeriyotlari={yy.tekrarPeriyotlari} setTekrarPeriyotlari={yy.setTekrarPeriyotlari}
                tekrarSecenekleri={yy.tekrarSecenekleri}
                yayinGunleri={yy.yayinGunleri} setYayinGunleri={yy.setYayinGunleri}
                tumPuanlarAtandiMi={yy.tumPuanlarAtandiMi}
                getSoruPuani={yy.getSoruPuani} setSoruPuani={yy.setSoruPuani} hepsineAyniPuanAta={yy.hepsineAyniPuanAta}
                onVideoAc={setAcikVideo}
                onYayinlaClick={setOnayModal}
              />
            ))
        )}

        {aktifSekme === "bekleyen" && (
          <DahaFazlaGoster
            dahaVar={bekleyenListe.dahaVar}
            gorunenSayi={bekleyenListe.gorunen.length}
            toplam={bekleyenListe.toplam}
            onGoster={bekleyenListe.dahaFazlaGoster}
          />
        )}

        {aktifSekme === "yayinda" && (
          <div className="mb-3 flex justify-end"><ListeArama arama={yayindaListe.arama} /></div>
        )}
        {aktifSekme === "yayinda" && (
          yayindaListe.toplam === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">{yayindakiler.length === 0 ? "Yayında video yok." : "Aramanıza uyan kayıt bulunamadı."}</div>
            : yayindaListe.gorunen.map(y => (
              <YayinSatir key={y.yayin_id} y={y}
                islemLoading={yy.islemLoading}
                acikAkordiyon={acikAkordiyon} setAcikAkordiyon={setAcikAkordiyon}
                formatTarih={formatTarih}
                tekrarBilgi={yy.tekrarBilgi[y.yayin_id]}
                getSoruPuani={yy.getSoruPuani} setSoruPuani={yy.setSoruPuani} hepsineAyniPuanAta={yy.hepsineAyniPuanAta}
                onVideoAc={setAcikVideo}
                onDurumDegistir={yy.handleDurumDegistir}
                onPlanIslem={yy.handlePlanIslem}
              />
            ))
        )}

        {aktifSekme === "yayinda" && (
          <DahaFazlaGoster
            dahaVar={yayindaListe.dahaVar}
            gorunenSayi={yayindaListe.gorunen.length}
            toplam={yayindaListe.toplam}
            onGoster={yayindaListe.dahaFazlaGoster}
          />
        )}

        {aktifSekme === "durdurulan" && (
          <div className="mb-3 flex justify-end"><ListeArama arama={durdurulanListe.arama} /></div>
        )}
        {aktifSekme === "durdurulan" && (
          durdurulanListe.toplam === 0
            ? <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">{durdurulular.length === 0 ? "Durdurulan video yok." : "Aramanıza uyan kayıt bulunamadı."}</div>
            : durdurulanListe.gorunen.map(y => (
              <YayinSatir key={y.yayin_id} y={y}
                islemLoading={yy.islemLoading}
                acikAkordiyon={acikAkordiyon} setAcikAkordiyon={setAcikAkordiyon}
                formatTarih={formatTarih}
                tekrarBilgi={yy.tekrarBilgi[y.yayin_id]}
                getSoruPuani={yy.getSoruPuani} setSoruPuani={yy.setSoruPuani} hepsineAyniPuanAta={yy.hepsineAyniPuanAta}
                onVideoAc={setAcikVideo}
                onDurumDegistir={yy.handleDurumDegistir}
              />
            ))
        )}

        {aktifSekme === "durdurulan" && (
          <DahaFazlaGoster
            dahaVar={durdurulanListe.dahaVar}
            gorunenSayi={durdurulanListe.gorunen.length}
            toplam={durdurulanListe.toplam}
            onGoster={durdurulanListe.dahaFazlaGoster}
          />
        )}
      </div>

      {acikVideo && <VideoOnizlemeModal url={acikVideo} onKapat={() => setAcikVideo(null)} />}

      {onayModal && (
        <YayinOnayModal bekleyen={onayModal} onIptal={() => setOnayModal(null)} onYayinla={handleYayinlaOnayla} />
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}