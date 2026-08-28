"use client";

import { useRef } from "react";
import {
  type BekleyenDosya,
  PODCAST_FORMATLAR,
  PODCAST_KAPAK_FORMATLARI,
  TRANSKRIPT_FORMATLARI,
} from "../_types";

type PodcastAnlatimTuru = "monolog" | "diyalog";

interface DosyaAlaniProps {
  etiket: string;
  accept: string;
  bekleyen: BekleyenDosya | null;
  onSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSil: () => void;
}

function DosyaAlani({ etiket, accept, bekleyen, onSec, onSil }: DosyaAlaniProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-[#425672]">{etiket} <span className="text-red-500">*</span></label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-[#56aeff] bg-white px-3 py-1.5 text-xs font-semibold text-[#2483e2]">
          Dosya Seç
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
            <button type="button" onClick={onSil} aria-label={`${etiket} dosyasını kaldır`} className="cursor-pointer text-gray-400">×</button>
          </span>
        )}
      </div>
    </div>
  );
}

interface PodcastTalepAlanlariProps {
  anlatimTuru: PodcastAnlatimTuru;
  onAnlatimTuruDegis: (deger: PodcastAnlatimTuru) => void;
  hazir: boolean;
  ses: BekleyenDosya | null;
  kapak: BekleyenDosya | null;
  transkript: BekleyenDosya | null;
  onSesSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKapakSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTranskriptSec: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSesSil: () => void;
  onKapakSil: () => void;
  onTranskriptSil: () => void;
}

export function PodcastTalepAlanlari(props: PodcastTalepAlanlariProps) {
  return (
    <section className="rounded-2xl border border-[#dfe8f3] bg-white p-4">
      <h3 className="text-sm font-extrabold text-[#263b58]">Podcast Yapısı</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["monolog", "diyalog"] as const).map((tur) => (
          <button
            key={tur}
            type="button"
            aria-pressed={props.anlatimTuru === tur}
            onClick={() => props.onAnlatimTuruDegis(tur)}
            className="cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold capitalize"
            style={{
              borderColor: props.anlatimTuru === tur ? "#56aeff" : "#dfe8f3",
              color: props.anlatimTuru === tur ? "#2483e2" : "#526780",
              background: props.anlatimTuru === tur ? "#f0f7ff" : "#fff",
            }}
          >
            {tur}
          </button>
        ))}
      </div>
      {props.hazir && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DosyaAlani etiket="Nihai ses" accept={PODCAST_FORMATLAR} bekleyen={props.ses} onSec={props.onSesSec} onSil={props.onSesSil} />
          <DosyaAlani etiket="Kapak" accept={PODCAST_KAPAK_FORMATLARI} bekleyen={props.kapak} onSec={props.onKapakSec} onSil={props.onKapakSil} />
          <DosyaAlani etiket="Transkript" accept={TRANSKRIPT_FORMATLARI} bekleyen={props.transkript} onSec={props.onTranskriptSec} onSil={props.onTranskriptSil} />
        </div>
      )}
    </section>
  );
}
