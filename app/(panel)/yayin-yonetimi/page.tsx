// app/yayin-yonetimi/page.tsx
//
// Yayın yönetimi sayfası — orchestrator.
// Auth + sekme/modal state + useYayinYonetimi hook'unu bağlar; satır ve modal
// bileşenlerini render eder. Veri ve iş mantığı hook'ta, sunum _components'te.
//
// Ana sekmeler hedef role göre (şu an UTT / BM). Alt sekmeler durum filtresi
// (bekleyen / yayında / durdurulan).

"use client";

import { useState, type ReactNode } from "react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { yayinHedefGrubuBelirle, type YayinHedefGrubu } from "@/lib/utils/roller";
import type { Bekleyen, AltSekme } from "./_types";
import { useYayinYonetimi } from "./_hooks/useYayinYonetimi";
import { BekleyenSatir } from "./_components/BekleyenSatir";
import { YayinSatir } from "./_components/YayinSatir";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import { VideoOnizlemeModal, YayinOnayModal } from "./_components/Modallar";
import { YayinKumandaPaneli } from "./_components/YayinKumandaPaneli";
import { YenileButonu } from "@/components/ui/yenile-butonu";

function ListeBasligi({ baslik, aciklama, sayi, arama }: { baslik: string; aciklama: string; sayi: number; arama: ReactNode }) {
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3.5 shadow-[0_6px_18px_rgba(31,55,90,0.035)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-extrabold text-[#203653]">{baslik}</h2>
        <p className="mt-0.5 text-xs text-[#7b8da5]">{aciklama}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="w-fit rounded-full bg-[#eef5fd] px-2.5 py-1 text-[10px] font-extrabold text-[#4479b7]">{sayi} kayıt</span>
        {arama}
      </div>
    </div>
  );
}

function BosListe({ mesaj }: { mesaj: string }) {
  return (
    <div className="rounded-2xl border border-[#dfe7f1] bg-white px-6 py-12 text-center shadow-[0_6px_18px_rgba(31,55,90,0.03)]">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0f5fb] text-[#7f96b3]">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /></svg>
      </span>
      <p className="mt-3 text-sm font-bold text-[#647994]">{mesaj}</p>
    </div>
  );
}

export default function YayinYonetimiPage() {
  const { kullanici } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const [aktifAnaSekme, setAktifAnaSekme] = useState<YayinHedefGrubu>("utt");
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

  const yayinlarFiltreli = yy.yayinlar.filter(
    (y) => yayinHedefGrubuBelirle(y.hedef_roller) === aktifAnaSekme,
  );
  // Planlanmış yayınlar "Yayında" sekmesinde listelenir (Planlandı rozetiyle);
  // tarihi gelince cron aktive eder, rozet kendiliğinden "Yayında"ya döner.
  const yayindakiler = yayinlarFiltreli.filter(y => y.durum === "yayinda" || y.durum === "planlandi");
  const canliSayisi = yayinlarFiltreli.filter(y => y.durum === "yayinda").length;
  const planliSayisi = yayinlarFiltreli.filter(y => y.durum === "planlandi").length;
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
      <div className="min-h-full bg-[#f5f8fc]">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
        <YayinKumandaPaneli
          aktifHedef={aktifAnaSekme}
          aktifDurum={aktifSekme}
          bekleyen={yy.bekleyenler.length}
          bekleyenHedefSayilari={yy.bekleyenHedefSayilari}
          canli={canliSayisi}
          planli={planliSayisi}
          durdurulan={durdurulular.length}
          onHedefDegistir={setAktifAnaSekme}
          onDurumDegistir={setAktifSekme}
          aksiyon={<YenileButonu yenileniyor={yy.yenileniyor} onYenile={() => yy.veriCek()} disabled={!!acikAkordiyon || !!yy.islemLoading} />}
        />

        {aktifSekme === "bekleyen" && (
          <ListeBasligi baslik="Yayına Hazır İçerikler" aciklama="Puanları tamamlayın ve yayın zamanını belirleyin." sayi={bekleyenListe.toplam} arama={<ListeArama arama={bekleyenListe.arama} />} />
        )}
        {aktifSekme === "bekleyen" && (
          bekleyenListe.toplam === 0
            ? <BosListe mesaj={yy.bekleyenler.length === 0 ? "Yayına hazırlanmayı bekleyen içerik yok." : "Aramanıza uyan kayıt bulunamadı."} />
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
          <ListeBasligi baslik="Aktif Yayınlar" aciklama="Canlı ve planlanmış içeriklerin yaşam döngüsünü yönetin." sayi={yayindaListe.toplam} arama={<ListeArama arama={yayindaListe.arama} />} />
        )}
        {aktifSekme === "yayinda" && (
          yayindaListe.toplam === 0
            ? <BosListe mesaj={yayindakiler.length === 0 ? "Bu hedef kitle için aktif yayın yok." : "Aramanıza uyan kayıt bulunamadı."} />
            : (
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {yayindaListe.gorunen.map(y => (
                  <YayinSatir key={y.yayin_id} y={y}
                    kartGorunumu
                    islemLoading={yy.islemLoading}
                    acikAkordiyon={acikAkordiyon} setAcikAkordiyon={setAcikAkordiyon}
                    formatTarih={formatTarih}
                    tekrarBilgi={yy.tekrarBilgi[y.yayin_id]}
                    getSoruPuani={yy.getSoruPuani} setSoruPuani={yy.setSoruPuani} hepsineAyniPuanAta={yy.hepsineAyniPuanAta}
                    onVideoAc={setAcikVideo}
                    onDurumDegistir={yy.handleDurumDegistir}
                    onPlanIslem={yy.handlePlanIslem}
                  />
                ))}
              </div>
            )
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
          <ListeBasligi baslik="Durdurulan Yayınlar" aciklama="Yayından kaldırılan içerikleri inceleyin veya yeniden başlatın." sayi={durdurulanListe.toplam} arama={<ListeArama arama={durdurulanListe.arama} />} />
        )}
        {aktifSekme === "durdurulan" && (
          durdurulanListe.toplam === 0
            ? <BosListe mesaj={durdurulular.length === 0 ? "Bu hedef kitle için durdurulan yayın yok." : "Aramanıza uyan kayıt bulunamadı."} />
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
      </div>

      {acikVideo && <VideoOnizlemeModal url={acikVideo} onKapat={() => setAcikVideo(null)} />}

      {onayModal && (
        <YayinOnayModal bekleyen={onayModal} onIptal={() => setOnayModal(null)} onYayinla={handleYayinlaOnayla} />
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </>
  );
}
