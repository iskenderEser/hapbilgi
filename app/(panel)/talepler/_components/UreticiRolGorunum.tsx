// app/talepler/_components/UreticiRolGorunum.tsx
//
// TALEP MERKEZLİ ÜRETİM GÖRÜNÜMÜ — üretici rolleri için (eski talepler-v2).
//
// Temel ilke: aşama ayrı bir YER değil, talebin içindeki ADIM. Kullanıcı talepten
// çıkmadan tüm üretim sürecini yönetir; Senaryolar / Videolar / Soru Setleri
// sayfalarına gitmez.
//
// /talepler route'u role göre bu görünümü veya IcerikUreticiGorunum'u render eder
// (page.tsx). Rol ayrımı orada yapıldığı için burada yönlendirme guard'ı yok.

"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTalepMerkezi } from "../_hooks/useTalepMerkezi";
import { IsListesi } from "./IsListesi";
import { TalepDetayi } from "./TalepDetayi";
import { YeniTalepAkordiyonu } from "./YeniTalepAkordiyonu";
import { IptalAkordiyonu } from "./IptalAkordiyonu";

export function UreticiRolGorunum() {
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const merkez = useTalepMerkezi();

  if (authYukleniyor || !kullanici || merkez.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#56aeff] rounded-full animate-spin" />
          <div className="h-2 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-5">
        <YeniTalepAkordiyonu onTalepOlusturuldu={merkez.talepOlusturuldu} />

        {/* İki kolon. lg (1024px) altında tek kolon — tablette liste tam genişliğe
            oturur ve tabloda taşma olmaz.
            Oran 1:1 (prototipteki 1fr/2fr değil): 1fr sol kolona 432px bırakıyordu,
            beş sütunluk tablonun ihtiyacı ~610px. Eşit bölmede sol kolon ~680px'e
            çıkıyor ve tablo kesilmeden sığıyor. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* SOL — iş listesi */}
          <div className="flex flex-col gap-5">
            <IsListesi
              talepler={merkez.devamEdenler}
              seciliTalepId={merkez.seciliTalepId}
              rol={kullanici.rol}
              onSec={merkez.setSeciliTalepId}
            />
            <IptalAkordiyonu
              talepler={merkez.iptalEdilenler}
              formatTarih={merkez.formatTarih}
            />
          </div>

          {/* SAĞ — talep künyesi + üretim şeridi (adım kutuları A-7, aksiyonlar A-8) */}
          <div>
            <TalepDetayi
              talep={merkez.seciliTalep}
              detay={merkez.detay}
              detayYukleniyor={merkez.detayYukleniyor}
              rol={kullanici.rol}
              kullaniciId={kullanici.id}
              kararYukleniyor={merkez.kararYukleniyor}
              videoYuzdesi={merkez.videoYuzdesi}
              formatTarih={merkez.formatTarih}
              onHata={merkez.hata}
              onKarar={merkez.kararVer}
              onVideoYukle={merkez.hazirVideoYukle}
            />
          </div>
        </div>
      </div>

      <HataMesajiContainer mesajlar={merkez.mesajlar} />
    </>
  );
}
