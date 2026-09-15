"use client";

import { useRef, useState } from "react";
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
      <label className="mb-1 flex h-5 items-center text-xs font-bold text-[#425672]">
        {etiket} {zorunlu && !yukluGoster && <span className="ml-1 text-red-500">*</span>}
      </label>
      <div>
        <label className="cursor-pointer rounded-lg border border-[#56aeff] bg-white px-3 py-1.5 text-xs font-semibold text-[#2483e2] hover:bg-[#f0f7ff] w-full flex items-center justify-center text-center">
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
          <span className="mt-1.5 inline-flex w-full items-center justify-between gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
            <span className="truncate">{bekleyen.preview.dosya_adi}</span>
            <button type="button" onClick={onSil} aria-label={`${etiket} dosyasını kaldır`} className="cursor-pointer text-gray-400 hover:text-gray-600 font-bold">×</button>
          </span>
        )}
        {yukluGoster && (
          <span className="mt-1.5 inline-flex w-full items-center justify-between gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
            <span className="truncate"><span className="font-semibold text-emerald-600">Sunucuda Yüklü: </span>{yuklenenDosyaAdi || (etiket === "Podcast" ? "podcast.mp3" : "kapak.jpg")}</span>
            <button type="button" onClick={onSil} aria-label={`${etiket} dosyasını kaldır`} className="cursor-pointer text-emerald-600 hover:text-emerald-800 font-bold">×</button>
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
  iuTranskriptIstendi?: boolean | null;
  onIuTranskriptIstendiDegisti?: (istendi: boolean) => void;
}

export function PodcastTalepAlanlari(props: PodcastTalepAlanlariProps) {
  const [transkriptAcik, setTranskriptAcik] = useState<boolean>(
    Boolean(
      props.transkript ||
      props.transkriptMetni ||
      props.aiIstendi ||
      (props.islemDurumu && props.islemDurumu !== "bosta")
    )
  );
  const [transkriptSekme, setTranskriptSekme] = useState<"ai" | "dosya" | "metin">(
    props.aiIstendi || (props.islemDurumu && props.islemDurumu !== "bosta") ? "ai" : "dosya"
  );

  return (
    <section className="rounded-2xl border border-[#dfe8f3] bg-white p-4">
      <h3 className="text-sm font-extrabold text-[#263b58]">Podcast Yapısı</h3>
      {!props.hazir && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[#7a8ca5]">
            İçerik üreticisi podcast ses kaydını hazırlayacaktır.
          </p>

          <div className="rounded-xl border border-[#dfe8f3] bg-[#f8fafc] p-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#263b58]">
                Transkript Tercihi <span className="text-[#e53e3e]">*</span>
              </label>
              <p className="text-xs text-[#5a7184]">
                Üretilecek podcast için transkript hazırlanmasını istiyor musunuz?
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => props.onIuTranskriptIstendiDegisti?.(true)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                  props.iuTranskriptIstendi === true
                    ? "border-2 border-[#287fce] bg-[#ebf5ff] text-[#287fce] shadow-sm"
                    : "border border-[#dfe8f3] bg-white text-[#4a5568] hover:border-[#b0c7de]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    props.iuTranskriptIstendi === true
                      ? "border-[#287fce] bg-[#287fce]"
                      : "border-[#a0aec0] bg-white"
                  }`}
                >
                  {props.iuTranskriptIstendi === true && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                Transkript istiyorum
              </button>

              <button
                type="button"
                onClick={() => props.onIuTranskriptIstendiDegisti?.(false)}
                className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                  props.iuTranskriptIstendi === false
                    ? "border-2 border-[#287fce] bg-[#ebf5ff] text-[#287fce] shadow-sm"
                    : "border border-[#dfe8f3] bg-white text-[#4a5568] hover:border-[#b0c7de]"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    props.iuTranskriptIstendi === false
                      ? "border-[#287fce] bg-[#287fce]"
                      : "border-[#a0aec0] bg-white"
                  }`}
                >
                  {props.iuTranskriptIstendi === false && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                Transkript istemiyorum
              </button>
            </div>

            {props.iuTranskriptIstendi === true && (
              <div className="mt-3 rounded-lg border border-[#cce5ff] bg-[#f0f7ff] p-2.5 text-xs text-[#004085]">
                <strong>Bilgi:</strong> Transkript talep edildiğinde, İçerik Üreticisi tarafından podcast sesinden AI ile oluşturulacaktır.
              </div>
            )}

            {props.iuTranskriptIstendi === false && (
              <div className="mt-3 rounded-lg border border-[#e2e8f0] bg-[#edf2f7] p-2.5 text-xs text-[#4a5568]">
                <strong>Bilgi:</strong> Transkript talep edilmedi; podcast yalnızca ses kaydı olarak yayınlanacaktır.
              </div>
            )}

            {props.iuTranskriptIstendi === null && (
              <p className="mt-2 text-[11px] font-medium text-[#e53e3e]">
                * Talebi oluşturabilmek için lütfen transkript tercihinizi belirleyin.
              </p>
            )}
          </div>
        </div>
      )}
      {props.hazir && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
            {/* 1. Podcast */}
            <DosyaAlani
              etiket="Podcast"
              accept={PODCAST_FORMATLAR}
              bekleyen={props.ses}
              sunucudaYuklu={props.sesYuklendi}
              yuklenenDosyaAdi={props.sesDosyaAdi}
              onSec={props.onSesSec}
              onSil={props.onSesSil}
            />

            {/* 2. Yayın Görseli */}
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

            {/* 3. Manuel Transkript */}
            <div>
              <label className="mb-1 flex h-5 items-center text-xs font-bold text-[#425672] truncate">
                Manuel Transkript <span className="ml-1 text-[11px] font-normal text-gray-400">(İsteğe bağlı)</span>
              </label>
              <div>
                {props.transkript ? (
                  <span className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
                    <span className="truncate">{props.transkript.preview.dosya_adi}</span>
                    <button
                      type="button"
                      onClick={props.onTranskriptSil}
                      aria-label="Transkript dosyasını kaldır"
                      className="cursor-pointer text-gray-400 hover:text-gray-600 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTranskriptSekme("dosya");
                      props.onAiIstendiDegisti?.(false);
                      setTranskriptAcik(true);
                    }}
                    className="cursor-pointer rounded-lg border border-[#56aeff] bg-white px-3 py-1.5 text-xs font-semibold text-[#2483e2] hover:bg-[#f0f7ff] w-full flex items-center justify-center text-center"
                  >
                    + Manuel Transkript Ekle
                  </button>
                )}
              </div>
            </div>

            {/* 4. AI ile Transkript */}
            <div>
              <label className="mb-1 flex h-5 items-center text-xs font-bold text-[#425672] truncate">
                AI ile Transkript <span className="ml-1 text-[11px] font-normal text-gray-400">(Gemini 3.5)</span>
              </label>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setTranskriptSekme("ai");
                    props.onAiIstendiDegisti?.(true);
                    setTranskriptAcik(true);
                    if (props.onAiBaslat) {
                      void props.onAiBaslat();
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-[#2483e2] bg-[#2483e2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a6ec7] w-full flex items-center justify-center text-center"
                >
                  ✨ AI ile Transkript Oluştur
                </button>
              </div>
            </div>
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
            acik={transkriptAcik}
            onAcikDegisti={setTranskriptAcik}
            sekme={transkriptSekme}
            onSekmeDegisti={setTranskriptSekme}
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
              setTranskriptAcik(false);
            }}
          />
        </div>
      )}
    </section>
  );
}
