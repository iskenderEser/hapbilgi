// app/talepler/_components/TalepDetayi.tsx
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
import { ureticiDurumMesaji } from "@/lib/utils/durum/mesaj";
import { useBunnyIslemeDurumu } from "@/hooks/useBunnyIslemeDurumu";
import { TeknikPill, VaryantPill, HedefRolPilleri } from "@/components/pill";
import { UretimSeridi } from "./UretimSeridi";
import { AdimIcerigi } from "./AdimIcerigi";
import { AksiyonSeridi } from "./AksiyonSeridi";
import type { ToastAsama } from "@/lib/uretim/toastMesaj";
import type { KararDurumu } from "../_hooks/useTalepMerkezi";
import type { TalepDetay, TalepSatiri } from "../_ureticiRolTypes";

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
      <div className="overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white shadow-[0_10px_28px_rgba(31,55,90,0.045)]">
        <div className="border-b border-[#e8eef5] px-5 py-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#7390b3]">Üretim görünümü</p>
          <h2 className="mt-0.5 text-base font-extrabold text-[#203653]">Talep Takibi</h2>
        </div>
        <div className="px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef6ff] text-[#4b91d8]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M4 5h16v14H4zM8 9h8M8 13h5" /><path d="m15 16 2 2 4-4" /></svg>
          </span>
          <p className="mt-3 text-sm font-extrabold text-[#425672]">Takip etmek istediğiniz talebi seçin</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#8292a8]">Talep takip listesinden bir talep seçtiğinizde tüm üretim adımları burada açılır.</p>
        </div>
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
  const aktifDurum = aktif?.durum_kodu
    ? ureticiDurumMesaji(aktif.durum_kodu, aktif.tarih)
    : null;
  const sorumlu = aktifDurum?.top === "uretici"
    ? "Siz"
    : aktifDurum?.top === "icerik_ureticisi"
    ? "İçerik üreticiniz"
    : aktifDurum?.top === "sistem"
    ? "Sistem"
    : "Tamamlandı";
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
    <section aria-labelledby="talep-takip-baslik" className="overflow-hidden rounded-2xl border border-[#dfe7f2] bg-white shadow-[0_10px_28px_rgba(31,55,90,0.045)]">
      <div className="border-b border-[#e8eef5] px-4 py-4 md:px-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#7390b3]">Üretim görünümü</p>
        <h2 id="talep-takip-baslik" className="mt-0.5 text-base font-extrabold text-[#203653]">Talep Takibi</h2>
      </div>
      {/* Künye */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8eef5] px-4 py-4 md:px-5">
        <div className="min-w-0">
          <span className="block text-lg font-extrabold tracking-[-0.015em] text-[#1f3552]">{baslik}</span>
          <span className="mt-1 block text-xs font-semibold text-[#8292a8]">
            {talepIdGoster(talep.firma_adi, talep.talep_no)} · {formatTarih(talep.created_at)}
          </span>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <TeknikPill teknikAdi={talep.teknik_adi} />
            <HedefRolPilleri hedefRoller={talep.hedef_roller} />
            <VaryantPill
              hazirVideo={talep.hazir_video}
              hazirSoruSeti={talep.hazir_soru_seti}
              kendiSatirinda={false}
            />
          </div>
        </div>

        <div className="min-w-[220px] flex-1 rounded-2xl border border-[#dce8f5] bg-[#f6faff] px-3.5 py-3 sm:max-w-[290px]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#6f8daf]">Şu anda</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <span className="block text-[10px] font-bold text-[#8a99ad]">Aktif aşama</span>
              <span className="mt-0.5 block text-sm font-extrabold text-[#29415f]">{aktif?.etiket ?? "—"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-[#8a99ad]">Sorumlu</span>
              <span className="mt-0.5 block text-sm font-extrabold text-[#29415f]">{sorumlu}</span>
            </div>
          </div>
          {aktifDurum && <p className="mt-2 border-t border-[#dfebf7] pt-2 text-xs font-bold text-[#507094]">{aktifDurum.metin}</p>}
        </div>
      </div>

      {/* Üretim şeridi */}
      <div className="px-4 py-4 md:px-5">
        <div className="mb-3.5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#7390b3]">Talep → Yayın</p>
            <h3 className="mt-0.5 text-sm font-extrabold text-[#2b405c]">Üretim Akışı</h3>
          </div>
          <span className="text-[10px] font-semibold text-[#8a99ad]">5 adım</span>
        </div>
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
        <button
          type="button"
          onClick={() => router.push("/yayin-yonetimi")}
          className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[#e8eef5] pt-3 text-left text-xs font-semibold text-[#647994] transition-colors hover:text-[#287fce]"
        >
          <span>Soru seti onaylandıktan sonra iş Yayın Yönetimi&apos;ne geçer.</span>
          <span aria-hidden="true" className="text-lg">›</span>
        </button>
      </div>
    </section>
  );
}
