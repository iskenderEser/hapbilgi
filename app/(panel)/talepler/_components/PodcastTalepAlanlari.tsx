"use client";

import { useRef } from "react";
import {
  type BekleyenDosya,
  PODCAST_FORMATLAR,
  PODCAST_KAPAK_FORMATLARI,
} from "../_types";

import { PodcastTranskriptEditoru } from "./PodcastTranskriptEditoru";

interface DosyaAlaniProps {
  etiket: string;
  accept: string;
  bekleyen: BekleyenDosya | null;
  onSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSil: () => void;
  zorunlu?: boolean;
  sunucudaYuklu?: boolean;
  yuklenenDosyaAdi?: string | null;
}

function DosyaAlani({
  etiket,
  accept,
  bekleyen,
  onSec,
  onSil,
  zorunlu = true,
  sunucudaYuklu = false,
  yuklenenDosyaAdi = null,
}: DosyaAlaniProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const yukluGoster = sunucudaYuklu && !bekleyen;

  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-[#425672]">
        {etiket} {zorunlu && !yukluGoster && <span className="text-red-500">*</span>}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-[#56aeff] bg-white px-3 py-1.5 text-xs font-semibold text-[#2483e2] hover:bg-[#f0f7ff]">
          {yukluGoster ? "Dosyayı Değiştir" : "Dosya Seç"}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              onSec(event);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>
        {bekleyen && (
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
            <span className="max-w-52 truncate">{bekleyen.preview.dosya_adi}</span>
            <button type="button" onClick={onSil} aria-label={`${etiket} dosyasını kaldır`} className="cursor-pointer text-gray-400 hover:text-gray-600">×</button>
          </span>
        )}
        {yukluGoster && (
          <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
            <span className="font-semibold text-emerald-600">Sunucuda Yüklü:</span>
            <span className="max-w-52 truncate">{yuklenenDosyaAdi || (etiket === "Podcast" ? "podcast.mp3" : "kapak.jpg")}</span>
            <button type="button" onClick={onSil} aria-label={`${etiket} dosyasını kaldır`} className="cursor-pointer text-emerald-600 hover:text-emerald-800">×</button>
          </span>
        )}
      </div>
    </div>
  );
}

interface PodcastTalepAlanlariProps {
  hazir: boolean;
  ses: BekleyenDosya | null;
  kapak: BekleyenDosya | null;
  transkript: BekleyenDosya | null;
  sesYuklendi?: boolean;
  sesDosyaAdi?: string | null;
  kapakYuklendi?: boolean;
  kapakDosyaAdi?: string | null;
  transkriptMetni?: string;
  transkriptOnaylandi?: boolean;
  aiIstendi?: boolean;
  aracId?: string;
  islemDurumu?: "bosta" | "taslak_hazirlaniyor" | "podcast_yukleniyor" | "podcast_dogrulaniyor" | "ai_kuyrukta" | "ai_isleniyor" | "transkript_hazir" | "hata";
  yuklemeYuzdesi?: number;
  onAiBaslat?: () => void | Promise<void>;
  aiYukleniyor?: boolean;
  aiHatasi?: string | null;
  onSesSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKapakSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTranskriptSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSesSil: () => void;
  onKapakSil: () => void;
  onTranskriptSil: () => void;
  onTranskriptMetinDegisti?: (metin: string) => void;
  onTranskriptOnayla?: () => void;
  onTranskriptIptal?: () => void;
  onSunucuOnayla?: (metin: string) => Promise<{ ok: boolean; hata?: string }>;
  onSunucuIptal?: () => Promise<{ ok: boolean; hata?: string }>;
  onAiIstendiDegisti?: (istendi: boolean) => void;
  onTranskriptDosyaSecildi?: (dosya: File, cikarilanMetin?: string) => void;
}

export function PodcastTalepAlanlari(props: PodcastTalepAlanlariProps) {
  return (
    <section className="rounded-2xl border border-[#dfe8f3] bg-white p-4">
      <h3 className="text-sm font-extrabold text-[#263b58]">Podcast Yapısı</h3>
      {!props.hazir && (
        <p className="mt-1 text-xs text-[#7a8ca5]">İçerik üreticisi ses ve transkript dosyalarını hazırlayacaktır.</p>
      )}
      {props.hazir && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DosyaAlani
              etiket="Podcast"
              accept={PODCAST_FORMATLAR}
              bekleyen={props.ses}
              sunucudaYuklu={props.sesYuklendi}
              yuklenenDosyaAdi={props.sesDosyaAdi}
              onSec={props.onSesSec}
              onSil={props.onSesSil}
            />
            <DosyaAlani
              etiket="Yayın Görseli"
              accept={PODCAST_KAPAK_FORMATLARI}
              bekleyen={props.kapak}
              sunucudaYuklu={props.kapakYuklendi}
              yuklenenDosyaAdi={props.kapakDosyaAdi}
              onSec={props.onKapakSec}
              onSil={props.onKapakSil}
              zorunlu={false}
            />
          </div>

          <PodcastTranskriptEditoru
            bekleyenDosya={props.transkript}
            metin={props.transkriptMetni ?? ""}
            onaylandi={props.transkriptOnaylandi ?? false}
            aiIstendi={props.aiIstendi}
            aracId={props.aracId}
            islemDurumu={props.islemDurumu}
            yuklemeYuzdesi={props.yuklemeYuzdesi}
            onAiBaslat={props.onAiBaslat}
            aiYukleniyor={props.aiYukleniyor}
            hataMesaji={props.aiHatasi}
            onAiIstendiDegisti={props.onAiIstendiDegisti}
            onSunucuOnayla={props.onSunucuOnayla}
            onSunucuIptal={props.onSunucuIptal}
            onDosyaSec={(dosya, cikarilanMetin) => {
              if (props.onTranskriptDosyaSecildi) {
                props.onTranskriptDosyaSecildi(dosya, cikarilanMetin);
              } else {
                const fakeEvent = {
                  target: { files: [dosya] },
                } as unknown as React.ChangeEvent<HTMLInputElement>;
                props.onTranskriptSec(fakeEvent);
              }
            }}
            onMetinDegisti={(yeniMetin) => {
              props.onTranskriptMetinDegisti?.(yeniMetin);
            }}
            onOnayla={() => {
              props.onTranskriptOnayla?.();
            }}
            onIptalEt={() => {
              props.onTranskriptSil();
              props.onTranskriptIptal?.();
            }}
          />
        </div>
      )}
    </section>
  );
}
