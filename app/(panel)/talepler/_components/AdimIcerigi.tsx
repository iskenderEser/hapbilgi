// app/talepler/_components/AdimIcerigi.tsx
//
// Bir adımın açılınca görünen içeriği. Senaryo metni, video önizlemesi ve soru
// listesi artık ayrı sayfalarda değil — talebin içindeki adımın kutusunda.
//
// Bu dosya DAĞITICIDIR: hangi adımsa onun kutusunu çizer, veri getirmez, durum
// yorumlamaz. Metinler ve bileşenler mevcut ortak katmandan gelir
// (SenaryoMetniGoster, VideoCercevesi, DosyaGoruntuleListesi) — hiçbiri kopyalanmaz.

"use client";

import { DosyaGoruntuleListesi, type DosyaItem } from "@/components/DosyaGoruntuleListesi";
import { SenaryoMetniGoster } from "@/components/SenaryoMetniGoster";
import { Pill, type PillRenk } from "@/components/pill";
import VideoCercevesi from "@/components/video/VideoCercevesi";
import type { IslemeDurumu } from "@/lib/video/islemeDurumu";
import type { AdimAnahtari } from "@/lib/utils/uretimSeridi";
import { HazirVideoYukleme } from "./HazirVideoYukleme";
import type { RevizyonNotu, TalepDetay, TalepSatiri } from "../_ureticiRolTypes";

interface Props {
  anahtar: AdimAnahtari;
  talep: TalepSatiri;
  detay: TalepDetay | null;
  detayYukleniyor: boolean;
  bunnyIslemeDurumu: IslemeDurumu;
  /** Hazır video yükleme alanı görünsün mü (V2/V4, video yok, sıra üreticide). */
  videoYuklenebilir: boolean;
  videoYuzdesi: number | null;
  formatTarih: (tarih: string | null) => string;
  onHata: (mesaj: string, adim?: string, detay?: string) => void;
  onVideoYukle: (dosya: File) => void;
}

const Bos = ({ metin }: { metin: string }) => (
  <p className="text-sm text-gray-400 m-0">{metin}</p>
);

// Şık rozetinin iki hâli. Pill ÖLÇÜYÜ sahiplenir, renk buradan gelir — sözlükte
// "doğru şık" diye bir kavram yok, bu yüzden renk merkezden değil buradan verilir.
const SIK_DOGRU: PillRenk = { bg: "#e6f1fb", metin: "#56aeff", kenar: "#56aeff" };
const SIK_NORMAL: PillRenk = { bg: "#ffffff", metin: "#737373", kenar: "#e5e7eb" };

function RevizyonNotlari({ notlar, formatTarih }: { notlar: RevizyonNotu[]; formatTarih: (t: string | null) => string }) {
  if (notlar.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500">Revizyon notları</span>
      {notlar.map((n, i) => (
        <div key={i} className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2">
          {n.notlar} <span className="text-gray-400">— {formatTarih(n.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

/** Talebin künye parametreleri — üretici bunları talep açarken seçiyor ama
 *  sonrasında hiçbir ekranda geriye dönük göremiyordu (D-6). */
function KunyeParametreleri({ talep }: { talep: TalepSatiri }) {
  const kutular = [
    { etiket: "Soru seti", deger: `${talep.soru_seti_buyuklugu} soru`, bg: "#eff6ff", renk: "#1d4ed8", kenar: "#bfdbfe" },
    { etiket: "Seçenek", deger: `${talep.secenek_sayisi} seçenek`, bg: "#fffbeb", renk: "#b45309", kenar: "#fde68a" },
    { etiket: "Video başı", deger: `${talep.video_basi_soru_sayisi} soru`, bg: "#f0fdf4", renk: "#15803d", kenar: "#bbf7d0" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {kutular.map((k) => (
        <span
          key={k.etiket}
          className="text-[10px] px-2.5 py-1 rounded-full"
          style={{ background: k.bg, color: k.renk, border: `0.5px solid ${k.kenar}` }}
        >
          {k.etiket}: <strong>{k.deger}</strong>
        </span>
      ))}
    </div>
  );
}

export function AdimIcerigi({
  anahtar, talep, detay, detayYukleniyor, bunnyIslemeDurumu,
  videoYuklenebilir, videoYuzdesi, formatTarih, onHata, onVideoYukle,
}: Props) {
  if (anahtar !== "talep" && detayYukleniyor) {
    return <Bos metin="Yükleniyor..." />;
  }

  switch (anahtar) {
    // ── Talep: açıklama + ek dosyalar + künye parametreleri (D-6) ──────────
    case "talep": {
      const dosyalar = (talep.dosya_urls ?? []) as DosyaItem[];
      return (
        <div className="flex flex-col gap-3">
          {talep.aciklama
            ? <p className="text-sm text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">{talep.aciklama}</p>
            : <Bos metin="Açıklama girilmedi." />}
          {dosyalar.length > 0 && <DosyaGoruntuleListesi dosyalar={dosyalar} onHata={onHata} />}
          <KunyeParametreleri talep={talep} />
        </div>
      );
    }

    // ── Senaryo: metin (önceki varsa farkıyla) + revizyon notları ──────────
    case "senaryo": {
      const s = detay?.senaryo;
      if (!s) return <Bos metin="Senaryonuz burada görünecek" />;
      return (
        <div>
          <SenaryoMetniGoster mevcut={s.metin} onceki={s.onceki_metin ?? undefined} />
          <RevizyonNotlari notlar={s.notlar} formatTarih={formatTarih} />
        </div>
      );
    }

    // ── Video: oynatıcı + Bunny işlenme rozeti + revizyon notu ─────────────
    case "video": {
      const v = detay?.video;
      // V2/V4: video henüz yokken sıra ÜRETİCİDEDİR — yükleme alanı burada açılır,
      // talep sayfasından çıkmaya gerek kalmaz.
      if (videoYuklenebilir) {
        return <HazirVideoYukleme yuzde={videoYuzdesi} onYukle={onVideoYukle} />;
      }
      if (!v || !v.video_url) return (
        <div className="aspect-video rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 text-gray-400">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M10 9.5 L15 12 L10 14.5 Z" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-sm">Videonuz burada gösterilecek</span>
        </div>
      );
      return (
        <div>
          {bunnyIslemeDurumu === "isleniyor" && (
            <div className="mb-2.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-800 m-0">
                Video işleniyor — kapak ve izleme kısa süre içinde hazır olur.
              </p>
            </div>
          )}
          {bunnyIslemeDurumu === "hatali" && (
            <div className="mb-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700 m-0">
                Video işlenemedi — dosya bozuk olabilir.
              </p>
            </div>
          )}
          <VideoCercevesi videoUrl={v.video_url} className="rounded-lg border border-gray-200">
            <iframe src={v.video_url} frameBorder="0" allowFullScreen />
          </VideoCercevesi>
          <RevizyonNotlari notlar={v.notlar} formatTarih={formatTarih} />
        </div>
      );
    }

    // ── Soru seti: soru listesi + revizyon notu ────────────────────────────
    case "soru_seti": {
      const ss = detay?.soru_seti;
      if (!ss || ss.sorular.length === 0) return <Bos metin="Henüz soru seti oluşturulmadı." />;
      return (
        <div>
          <div className="flex flex-col gap-2 max-h-80 overflow-auto">
            {ss.sorular.map((soru, i) => (
              <div key={i} className="px-3 py-2.5 bg-white rounded-lg border border-gray-200">
                <p className="text-xs text-gray-700 font-semibold m-0 mb-1.5">{i + 1}. {soru.soru_metni}</p>
                {/* Ölçü pill merkezinden (27.07 kararı): yazı boyu, dolgu, kenar
                    ve satır yüksekliği burada YAZILMAZ. sarabilir: şık metni uzun
                    olabilir, tek satırda kalıp taşmasın. */}
                <div className="flex flex-col gap-1">
                  {soru.secenekler?.map((sec, j) => (
                    <Pill key={j} renk={sec.dogru ? SIK_DOGRU : SIK_NORMAL} sarabilir className="w-fit">
                      {sec.harf}. {sec.metin}
                    </Pill>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <RevizyonNotlari notlar={ss.notlar} formatTarih={formatTarih} />
        </div>
      );
    }

    // Yayın adımının kutusu yoktur: durumu şeritte görünüyor, işlem kendi sayfasında (D-3).
    default:
      return null;
  }
}
