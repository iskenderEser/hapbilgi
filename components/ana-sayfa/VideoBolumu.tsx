// components/ana-sayfa/VideoBolumu.tsx
// Tekrar kullanılabilir video KART LİSTESİ — yalnız-izleme rolleri için (TM/BM/Yönetici/PM/Eğitim).
// Oynatma TAM SAYFA olur ve UTT ile AYNI desende ANA SAYFA BİLEŞENİNDE yapılır:
//   - ana sayfa bileşeni `aktifVideo` state'i tutar,
//   - karta tıklanınca `onVideoSec(video)` çağrılır,
//   - `aktifVideo` varsa bileşen dashboard yerine <VideoOynatici> döndürür (tam sayfa; navbar üstteki sarmalayıcıdan kalır).
// Bu yüzden oynatıcı burada DEĞİL; burada yalnızca kartlar + seçim var.

"use client";

import { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { yayinThumbnailIstemciCoz } from "@/lib/ogrenmeAraci/thumbnailIstemci";
import { talepIdGoster } from "@/lib/utils/talepId";
import { AracVarsayilanKapak } from "@/components/ogrenme-araci/AracVarsayilanKapak";

import MobilYayinAkisi from "@/components/yayin/MobilYayinAkisi";
import { YayinKarti } from "@/components/yayin/YayinKarti";

interface Props {
  videolar: AnaSayfaVideo[];
  onVideoSec: (video: AnaSayfaVideo) => void;
  baslik?: string;
}

export default function VideoBolumu({ videolar, onVideoSec, baslik = "Videolar" }: Props) {
  if (videolar.length === 0) return null;

  const formatTarih = (tarih: string) =>
    new Date(tarih).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });

  const masaustuIcerik = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {videolar.map((v) => {
        const thumb = yayinThumbnailIstemciCoz(v);
        return (
          <div
            key={v.yayin_id}
            onClick={() => onVideoSec(v)}
            className="bg-white rounded-xl overflow-hidden cursor-pointer transition-shadow duration-150"
            style={{ border: "0.5px solid #e5e7eb" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.boxShadow = "none")}
          >
            {/* Thumbnail */}
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="thumbnail" className="w-full h-full object-cover" />
              ) : (
                <AracVarsayilanKapak aracTuru={v.arac_turu} urunAdi={v.urun_adi} />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                  <svg width="9" height="11" viewBox="0 0 10 12" fill="white"><path d="M0 0l10 6-10 6z" /></svg>
                </div>
              </div>
            </div>

            {/* Bilgi */}
            <div className="px-2.5 py-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-gray-900 truncate">{v.urun_adi}</div>
                <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">{v.teknik_adi}</div>
              </div>
              {v.talep_no != null && (
                <div className="text-[10px] text-gray-400 font-mono">{talepIdGoster(v.firma_adi, v.talep_no)}</div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {v.video_puani !== null && (
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-gray-500">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#56aeff" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Video <span className="font-semibold text-gray-900 ml-0.5">{v.video_puani}</span>
                    </div>
                  )}
                  {!!v.extra_puan && v.extra_puan > 0 && (
                    <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      +{v.extra_puan} Extra
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">{formatTarih(v.yayin_tarihi)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <MobilYayinAkisi<AnaSayfaVideo>
      kayitlar={videolar}
      kayitAnahtari={(v) => v.yayin_id}
      renderKart={(v) => (
        <YayinKarti
          yayin={v}
          onClick={() => onVideoSec(v)}
          etkilesimAktif={false}
          etkilesimGoster={false}
          izlenmeGoster={false}
          durumGoster={false}
          donguGoster={false}
          talepNoGoster={true}
          puanGoster={true}
          tarihGoster={true}
          hoverOverlay={
            <span className="absolute inset-0 flex items-center justify-center bg-black/5 transition-colors group-hover:bg-black/15">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-transform group-hover:scale-105">
                <svg aria-hidden="true" width="9" height="11" viewBox="0 0 10 12" fill="currentColor"><path d="M0 0l10 6-10 6z" /></svg>
              </span>
            </span>
          }
        />
      )}
      baslik={<span className="text-sm font-bold text-gray-900">{baslik}</span>}
      sayacGoster={true}
      className="mb-6"
      masaustuIcerik={masaustuIcerik}
    />
  );
}
