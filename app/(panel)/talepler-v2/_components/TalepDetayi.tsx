// app/talepler-v2/_components/TalepDetayi.tsx
//
// Sağ kolon — seçili talebin künyesi ve üretim şeridi.
//
// Sayfanın temel ilkesi burada görünür hâle gelir: kullanıcı talepten çıkmadan
// üretimin tamamını görür. Senaryo, video ve soru seti ayrı sayfalar değil, bu
// şeridin adımlarıdır; içerikleri adım kutularında açılır.
//
// Açıklama künye satırının altında DEĞİL, Talep adımının kutusunda durur (D-6):
// ek dosyalar ve künye parametreleriyle birlikte, ait olduğu adımın içinde.

"use client";

import { useRouter } from "next/navigation";
import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { talepIdGoster } from "@/lib/utils/talepId";
import { adimlariCoz } from "@/lib/utils/uretimSeridi";
import { useBunnyIslemeDurumu } from "@/hooks/useBunnyIslemeDurumu";
import { TeknikPill, VaryantPill, HedefRolPill } from "@/components/pill";
import { UretimSeridi } from "./UretimSeridi";
import { AdimIcerigi } from "./AdimIcerigi";
import { AksiyonSeridi } from "./AksiyonSeridi";
import type { ToastAsama } from "@/lib/uretim/toastMesaj";
import type { KararDurumu } from "../_hooks/useTalepMerkezi";
import type { TalepDetay, TalepSatiri } from "../_types";

interface Props {
  talep: TalepSatiri | null;
  detay: TalepDetay | null;
  detayYukleniyor: boolean;
  rol: string;
  kullaniciId: string;
  kararYukleniyor: boolean;
  videoYuzdesi: number | null;
  formatTarih: (tarih: string | null) => string;
  onHata: (mesaj: string, adim?: string, detay?: string) => void;
  onKarar: (
    hedef: { asama: ToastAsama; id: string; revizyonSayisi: number },
    durum: KararDurumu,
    notlar?: string,
  ) => void;
  onVideoYukle: (dosya: File) => void;
}

export function TalepDetayi({
  talep, detay, detayYukleniyor, rol, kullaniciId, kararYukleniyor, videoYuzdesi,
  formatTarih, onHata, onKarar, onVideoYukle,
}: Props) {
  const router = useRouter();

  // Hook koşullu çağrılamaz, döngü içinden hiç çağrılamaz: seçili talebin video
  // adresi için burada bir kez çağrılır, sonuç adım kutusuna geçirilir.
  const bunnyIslemeDurumu = useBunnyIslemeDurumu(
    detay?.video?.video_url,
    { video_id: detay?.video?.id },
  );

  if (!talep) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-900">Talep Detayı</span>
        </div>
        <div className="p-10 text-center text-sm text-gray-400">Soldan bir talep seçin.</div>
      </div>
    );
  }

  const baslik =
    talep.urun_adi !== "-" ? talep.urun_adi : (TALEP_TURU_KURALLARI[talep.egitim_turu]?.ad ?? talep.egitim_turu);
  const adimlar = adimlariCoz(talep, talep.zincir);

  // Karar hedefi: aktif adım gerçekten onay bekliyorsa ve talebi açan sensen.
  // Top içerik üreticisindeyken (Üreticinize İletildi / Hazırlıyor / Düzenliyor)
  // onaylanacak bir şey yoktur — düğme hiç çizilmez.
  const aktif = adimlar.find((a) => a.hal === "aktif");
  const blok =
    aktif?.anahtar === "senaryo" ? detay?.senaryo
    : aktif?.anahtar === "video" ? detay?.video
    : aktif?.anahtar === "soru_seti" ? detay?.soru_seti
    : null;

  // V2/V4'te video henüz yokken sıra üreticidedir: yükleme alanı Video adımının
  // kutusunda açılır. Dört şart birden aranır — hazır video kolu, video yok,
  // durum "Videonuzu İletiniz", ve talebi açan üretici sensin.
  const videoYuklenebilir =
    talep.hazir_video &&
    !detay?.video?.video_url &&
    adimlar.find((a) => a.anahtar === "video")?.durum_kodu === "video_bekleniyor" &&
    talep.uretici_id === kullaniciId;

  const kararHedefi =
    aktif && blok && aktif.durum_kodu === "onay_bekleniyor" && talep.uretici_id === kullaniciId
      ? { asama: aktif.anahtar as ToastAsama, id: blok.id, revizyonSayisi: blok.revizyon_sayisi }
      : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 md:px-5 py-3.5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">Talep Takip</span>
      </div>
      {/* Künye */}
      <div className="px-4 md:px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-base font-semibold text-gray-900">{baslik}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <TeknikPill teknikAdi={talep.teknik_adi} />
            <HedefRolPill hedefRol={talep.hedef_rol} />
            <VaryantPill
              hazirVideo={talep.hazir_video}
              hazirSoruSeti={talep.hazir_soru_seti}
              kendiSatirinda={false}
            />
          </div>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {talepIdGoster(talep.firma_adi, talep.talep_no)} · {formatTarih(talep.created_at)}
        </span>
      </div>

      {/* Üretim şeridi */}
      <div className="px-4 md:px-5 py-4">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3.5">Üretim Akışı</div>
        <UretimSeridi
          adimlar={adimlar}
          rol={rol}
          formatTarih={formatTarih}
          talepId={talep.talep_id}
          icerikCiz={(anahtar) => (
            <AdimIcerigi
              anahtar={anahtar}
              talep={talep}
              detay={detay}
              detayYukleniyor={detayYukleniyor}
              bunnyIslemeDurumu={bunnyIslemeDurumu}
              videoYuklenebilir={videoYuklenebilir}
              videoYuzdesi={videoYuzdesi}
              formatTarih={formatTarih}
              onHata={onHata}
              onVideoYukle={onVideoYukle}
            />
          )}
        />

        <AksiyonSeridi
          hedef={kararHedefi}
          yukleniyor={kararYukleniyor}
          onKarar={(durum, notlar) => kararHedefi && onKarar(kararHedefi, durum, notlar)}
        />

        {/* Soru seti onaylandığı an talep bu listeden düşüyor (D-4), dolayısıyla
            Yayın adımı burada hiçbir zaman "aktif" görünmüyor. Bu satır kullanıcıya
            sürecin nerede devam ettiğini söyler (İskender kararı 28.07). */}
        <div
          onClick={() => router.push("/yayin-yonetimi")}
          className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 cursor-pointer hover:text-gray-700 transition-colors"
        >
          Soru seti onaylandıktan sonra iş Yayın Yönetimi&apos;ne geçer.
        </div>
      </div>
    </div>
  );
}
