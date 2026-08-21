// app/talepler/_components/UreticiRolGorunum.tsx
//
// TALEP MERKEZLİ ÜRETİM GÖRÜNÜMÜ — üretici rolleri için (eski talepler-v2).
//
// Temel ilke: aşama ayrı bir YER değil, talebin içindeki ADIM. Kullanıcı talepten
// çıkmadan tüm üretim sürecini yönetir; Senaryolar / Videolar / Soru Setleri
// sayfalarına gitmez.
//
// /talepler route'u yalnız üretici rollerde bu görünümü render eder. IU üretim
// görevlerini Senaryolar / Videolar / Soru Setleri sayfalarında yürütür.

"use client";

import { HataMesajiContainer } from "@/components/HataMesaji";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import { useAuth } from "@/app/providers/AuthProvider";
import { ureticiDurumMesaji } from "@/lib/utils/durum/mesaj";
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

  const operasyonOzeti = merkez.devamEdenler.reduce(
    (ozet, talep) => {
      const top = ureticiDurumMesaji(talep.durum_kodu, talep.created_at).top;
      if (top === "uretici") ozet.aksiyonBekleyen += 1;
      if (top === "icerik_ureticisi") ozet.uretimde += 1;
      if (top === "sistem") ozet.planlanan += 1;
      return ozet;
    },
    { aksiyonBekleyen: 0, uretimde: 0, planlanan: 0 },
  );

  const ozetKartlari = [
    {
      etiket: "Devam eden",
      deger: merkez.devamEdenler.length,
      aciklama: "Aktif üretim akışı",
      vurgu: "#2563eb",
      zemin: "#eff6ff",
    },
    {
      etiket: "Sizi bekleyen",
      deger: operasyonOzeti.aksiyonBekleyen,
      aciklama: "Karar veya içerik gerekli",
      vurgu: "#c2410c",
      zemin: "#fff7ed",
    },
    {
      etiket: "Üreticide",
      deger: operasyonOzeti.uretimde,
      aciklama: "İçerik üretimi sürüyor",
      vurgu: "#7c3aed",
      zemin: "#f5f3ff",
    },
    {
      etiket: "Planlanan",
      deger: operasyonOzeti.planlanan,
      aciklama: "Sistem zamanını bekliyor",
      vurgu: "#047857",
      zemin: "#ecfdf5",
    },
  ];

  return (
    <>
      <div className="min-h-full bg-[#f5f8fc]">
      <div className="max-w-[1480px] mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7 flex flex-col gap-5">
        <section aria-labelledby="talep-merkezi-baslik" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">
                İçerik operasyon merkezi
              </p>
              <h1 id="talep-merkezi-baslik" className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
                Talep Merkezi
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-[#6b7f9b]">
                İçerik taleplerinizi oluşturun, üretim akışını izleyin ve sizden beklenen kararları tek yerden yönetin.
              </p>
            </div>
            <YenileButonu yenileniyor={merkez.yenileniyor} onYenile={() => merkez.veriCek()} disabled={merkez.kararYukleniyor || merkez.videoYuzdesi !== null} />
          </div>

          <div aria-label="Talep operasyon özeti" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
            {ozetKartlari.map((kart) => (
              <div
                key={kart.etiket}
                className="min-w-0 rounded-2xl border border-[#e2e9f2] bg-white px-3.5 py-3 shadow-[0_8px_24px_rgba(31,55,90,0.045)] md:px-4 md:py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold"
                    style={{ color: kart.vurgu, backgroundColor: kart.zemin }}
                  >
                    {kart.deger}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-[#243957]">{kart.etiket}</span>
                    <span className="mt-0.5 block truncate text-xs text-[#7b8ca5]">{kart.aciklama}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <YeniTalepAkordiyonu onTalepOlusturuldu={merkez.talepOlusturuldu} />

        {/* İki kolon yalnız geniş masaüstünde açılır. Daha dar pencerelerde iş
            kuyruğu ile takip paneli tam genişlikte üst üste kalır. */}
        <div className="grid grid-cols-1 gap-5 items-start xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
      </div>

      <HataMesajiContainer mesajlar={merkez.mesajlar} />
    </>
  );
}
