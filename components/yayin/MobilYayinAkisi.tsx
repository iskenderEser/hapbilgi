// components/yayin/MobilYayinAkisi.tsx
//
// HapBilgi platformunda tüm roller ve tüm sayfalar için TEK KANONİK mobil yayın akışı bileşeni.
//
// Sorumluluklar:
//   • Tek sütunlu dikey yerleşim (grid grid-cols-1 gap-4).
//   • Başlangıçta 2 kayıt gösterilmesi (varsayılan baslangicSayisi = 2).
//   • Beşer kayıt açılması (varsayılan adimSayisi = 5).
//   • Bölüm başlığı, sayaç ve "Daha Fazla Göster (+X) (Y içerik kaldı)" düğmesi.
//   • Yalnızca DOM'a açılan kartların basılması (dilimleme / slice; gizli DOM düğümü üretilmez).
//   • Kararlı sıfırlama anahtarı (sifirlamaAnahtari): Arama/kategori değiştiğinde 2'ye döner;
//     aynı kapsamda veri yenilenmesi veya beğeni/favori güncellemelerinde açık kayıtlar KORUNUR.
//   • Rol-bağımsızdır: Veri çekme, yetki veya puan mantığı içermez; saf sunum omurgasıdır.

"use client";

import { useState, type ReactNode } from "react";

export interface MobilYayinHesaplama {
  gorunenSayisi: number;
  kalanSayisi: number;
  acilacakSayi: number;
  devamDugmesiGoster: boolean;
}

/**
 * Mobil yayın akışı sayfalama ve sınır matematiğini hesaplayan saf yardımcı fonksiyon.
 */
export function hesaplaMobilYayinGorunumu(
  toplamKayit: number,
  gorunenSayisi: number,
  adimSayisi = 5,
): MobilYayinHesaplama {
  const guvenliToplam = Math.max(0, toplamKayit);
  const efektifGorunen = Math.max(0, Math.min(gorunenSayisi, guvenliToplam));
  const kalanSayisi = Math.max(0, guvenliToplam - efektifGorunen);
  const acilacakSayi = Math.max(0, Math.min(adimSayisi, kalanSayisi));
  const devamDugmesiGoster = kalanSayisi > 0;

  return {
    gorunenSayisi: efektifGorunen,
    kalanSayisi,
    acilacakSayi,
    devamDugmesiGoster,
  };
}

export interface MobilYayinAkisiProps<T> {
  /** Görüntülenecek generic kayıt listesi */
  kayitlar: T[];
  /** Her kaydın kararlı ve tekil anahtarı (yayin_id, oneri_id vb.) */
  kayitAnahtari: (kayit: T, index: number) => string;
  /** Her kayıt için kart render slot'u */
  renderKart: (kayit: T, index: number) => ReactNode;
  /** Bölüm başlığı (string veya ReactNode) */
  baslik?: ReactNode;
  /** Başlık altı veya yanı açıklama */
  aciklama?: ReactNode;
  /** Bölüm DOM kimliği (id / aria-labelledby için) */
  bolumId?: string;
  /** Toplam kayıt sayacı rozetini göster/gizle (varsayılan: true) */
  sayacGoster?: boolean;
  /**
   * Filtre, arama veya kategori değişimini bildiren anahtar.
   * Bu değer değiştiğinde liste başlangıç sayısına (2) döner.
   * Aynı kapsamda veri yenilenmesinde açık kartlar kapanmaz.
   */
  sifirlamaAnahtari?: string | number;
  /** Başlangıçta gösterilecek kayıt sayısı (varsayılan: 2) */
  baslangicSayisi?: number;
  /** Her tıklamada açılacak kayıt sayısı (varsayılan: 5) */
  adimSayisi?: number;
  /** Kayıt listesi boşken gösterilecek özel içerik veya mesaj */
  bosDurum?: ReactNode;
  /** Yüklenme durumu bayrağı */
  yukleniyor?: boolean;
  /** Yüklenme durumunda gösterilecek iskelet / spinner */
  yukleniyorIcerik?: ReactNode;
  /** Hata mesajı */
  hataMesaji?: string | null;
  /** Bölüm başlığının sağında gösterilecek özel aksiyonlar */
  aksiyonlar?: ReactNode;
  /** Ana kapsayıcı CSS sınıfı */
  className?: string;
  /** Kart grid'i CSS sınıfı (varsayılan: grid grid-cols-1 gap-4) */
  izgaraClassName?: string;
  /**
   * İsteğe bağlı tablet/masaüstü (sm: >= 640px) görünümü.
   * Sağlandığında mobil akış sm:hidden, masaüstü görünümü hidden sm:block olur.
   */
  masaustuIcerik?: ReactNode;
}

export default function MobilYayinAkisi<T>({
  kayitlar,
  kayitAnahtari,
  renderKart,
  baslik,
  aciklama,
  bolumId,
  sayacGoster = true,
  sifirlamaAnahtari,
  baslangicSayisi = 2,
  adimSayisi = 5,
  bosDurum,
  yukleniyor = false,
  yukleniyorIcerik,
  hataMesaji,
  aksiyonlar,
  className = "",
  izgaraClassName = "grid grid-cols-1 gap-4",
  masaustuIcerik,
}: MobilYayinAkisiProps<T>) {
  const [oncekiSifirlama, setOncekiSifirlama] = useState(sifirlamaAnahtari);
  const [ekstraSayisi, setEkstraSayisi] = useState(0);

  // React 19 / Next.js uyumlu: Prop (sifirlamaAnahtari) degistiginde render aninda sifirla.
  // useEffect icinde setState cagrilmaz; boylece cascading render onlenir.
  if (sifirlamaAnahtari !== oncekiSifirlama) {
    setOncekiSifirlama(sifirlamaAnahtari);
    setEkstraSayisi(0);
  }

  const gorunenSayisi = baslangicSayisi + ekstraSayisi;

  const toplamKayit = kayitlar.length;
  const hesaplama = hesaplaMobilYayinGorunumu(toplamKayit, gorunenSayisi, adimSayisi);
  const mobildeGorunenler = kayitlar.slice(0, gorunenSayisi);

  // Yükleniyor durumu
  if (yukleniyor) {
    return (
      <div className={`w-full ${className}`}>
        {yukleniyorIcerik ?? (
          <div className="flex items-center justify-center py-10">
            <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Hata durumu
  if (hataMesaji) {
    return (
      <div className={`w-full ${className}`}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs font-bold text-red-700">
          {hataMesaji}
        </div>
      </div>
    );
  }

  // Başlık bölümü
  const baslikJSX = (baslik || aksiyonlar || (sayacGoster && toplamKayit > 0)) ? (
    <div className="mb-2.5 flex items-center justify-between gap-2 select-none">
      <div className="flex items-center gap-2 min-w-0">
        {baslik && (
          <div className="truncate">
            {typeof baslik === "string" ? (
              <h2 id={bolumId} className="text-base font-bold text-gray-900 md:text-lg truncate">
                {baslik}
              </h2>
            ) : (
              baslik
            )}
          </div>
        )}
        {sayacGoster && toplamKayit > 0 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
            {toplamKayit}
          </span>
        )}
      </div>
      {aksiyonlar && <div className="shrink-0 flex items-center gap-2">{aksiyonlar}</div>}
    </div>
  ) : null;

  // Mobil Akış Gövdesi
  const mobilGövde = (
    <div className={`flex flex-col gap-3 ${masaustuIcerik ? "sm:hidden" : ""} w-full`}>
      {baslikJSX}
      {aciklama && <div className="text-xs text-gray-500 mb-1">{aciklama}</div>}

      {toplamKayit === 0 ? (
        bosDurum ?? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-xs text-gray-400">
            Görüntülenecek içerik bulunmuyor.
          </div>
        )
      ) : (
        <>
          <div className={izgaraClassName}>
            {mobildeGorunenler.map((kayit, index) => {
              const key = kayitAnahtari(kayit, index);
              return (
                <div key={key} className="w-full min-w-0">
                  {renderKart(kayit, index)}
                </div>
              );
            })}
          </div>

          {hesaplama.devamDugmesiGoster && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEkstraSayisi((onceki) => onceki + adimSayisi);
              }}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-extrabold text-gray-700 shadow-xs transition-colors hover:bg-gray-50 hover:text-gray-900 active:scale-[0.99] cursor-pointer"
            >
              <span>Daha Fazla Göster (+{hesaplama.acilacakSayi})</span>
              <span className="text-[10px] font-medium text-gray-400">
                ({hesaplama.kalanSayisi} içerik kaldı)
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`w-full ${className}`} id={bolumId}>
      {mobilGövde}
      {masaustuIcerik && <div className="hidden sm:block w-full">{masaustuIcerik}</div>}
    </div>
  );
}
