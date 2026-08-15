"use client";

import type { HedefRol } from "@/app/(panel)/talepler/_types";
import { HEDEF_ROL_TASARIM } from "@/app/(panel)/talepler/_types";
import type { AltSekme, BekleyenHedefSayilari } from "../_types";
import { ANA_SEKMELER, ANA_SEKME_ETIKETLERI } from "../_types";

interface Props {
  aktifHedef: HedefRol;
  aktifDurum: AltSekme;
  bekleyen: number;
  bekleyenHedefSayilari: BekleyenHedefSayilari;
  canli: number;
  planli: number;
  durdurulan: number;
  onHedefDegistir: (hedef: HedefRol) => void;
  onDurumDegistir: (durum: AltSekme) => void;
}

export function YayinKumandaPaneli({
  aktifHedef,
  aktifDurum,
  bekleyen,
  bekleyenHedefSayilari,
  canli,
  planli,
  durdurulan,
  onHedefDegistir,
  onDurumDegistir,
}: Props) {
  const hedefTasarimi = HEDEF_ROL_TASARIM[aktifHedef];
  const durumlar: {
    anahtar: AltSekme;
    etiket: string;
    deger: number;
    aciklama: string;
    altBilgi?: string;
    renk: string;
    zemin: string;
  }[] = [
    {
      anahtar: "bekleyen",
      etiket: "Yayına Hazır",
      deger: bekleyen,
      aciklama: "Puanlama ve yayın kararı bekliyor",
      renk: "#c2410c",
      zemin: "#fff7ed",
    },
    {
      anahtar: "yayinda",
      etiket: "Yayında",
      deger: canli + planli,
      aciklama: "Hedef kitlenin erişebildiği içerikler",
      altBilgi: `${canli} canlı · ${planli} planlı`,
      renk: "#167453",
      zemin: "#ecfdf5",
    },
    {
      anahtar: "durdurulan",
      etiket: "Durdurulan",
      deger: durdurulan,
      aciklama: "Yeniden başlatılabilir yayınlar",
      renk: "#a33f32",
      zemin: "#fff1f0",
    },
  ];

  return (
    <section aria-labelledby="yayin-merkezi-baslik" className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#4f7fb7]">
          İçerik yaşam döngüsü
        </p>
        <h1 id="yayin-merkezi-baslik" className="mt-1 text-2xl font-extrabold tracking-[-0.025em] text-[#172b4d] md:text-[28px]">
          Yayın Merkezi
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-[#6b7f9b]">
          Hazır içerikleri puanlayın, doğru zamanda yayınlayın ve yayın yaşam döngüsünü tek yerden yönetin.
        </p>
      </div>

      <div className="rounded-2xl border border-[#dfe8f3] bg-white p-3 shadow-[0_8px_24px_rgba(31,55,90,0.045)] md:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#7a8da8]">Yayın kitlesi</p>
            <p className="mt-0.5 text-xs text-[#8090a7]">Rozetler yayına hazır içerik sayısını gösterir.</p>
          </div>
          <span
            className="hidden rounded-full px-2.5 py-1 text-[10px] font-extrabold sm:inline"
            style={{ color: hedefTasarimi.renk, backgroundColor: hedefTasarimi.bg }}
          >
            {ANA_SEKME_ETIKETLERI[aktifHedef]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {ANA_SEKMELER.map((hedef) => {
            const tasarim = HEDEF_ROL_TASARIM[hedef];
            const aktif = hedef === aktifHedef;
            const bekleyenSayi = bekleyenHedefSayilari[hedef];
            return (
              <button
                type="button"
                key={hedef}
                aria-pressed={aktif}
                onClick={() => onHedefDegistir(hedef)}
                className="min-h-11 rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff] focus-visible:ring-offset-1"
                style={{
                  color: aktif ? tasarim.renk : "#566b87",
                  backgroundColor: aktif ? tasarim.bg : "#ffffff",
                  borderColor: aktif ? tasarim.renk : "#dfe7f1",
                  boxShadow: aktif ? `inset 0 0 0 1px ${tasarim.renk}20` : undefined,
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>{ANA_SEKME_ETIKETLERI[hedef]}</span>
                  {bekleyenSayi > 0 && (
                    <span
                      aria-label={`${bekleyenSayi} yayına hazır içerik`}
                      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#bc2d0d] px-[5px] text-[10px] font-bold leading-none text-white"
                    >
                      {bekleyenSayi}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div aria-label="Yayın durumu" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {durumlar.map((durum) => {
          const aktif = durum.anahtar === aktifDurum;
          return (
            <button
              type="button"
              key={durum.anahtar}
              aria-pressed={aktif}
              onClick={() => onDurumDegistir(durum.anahtar)}
              className="group rounded-2xl border bg-white px-3.5 py-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#56aeff]"
              style={{
                borderColor: aktif ? durum.renk : "#e1e8f1",
                boxShadow: aktif ? `0 8px 22px ${durum.renk}18` : "0 6px 18px rgba(31,55,90,0.035)",
              }}
            >
              <span className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold"
                  style={{ color: durum.renk, backgroundColor: durum.zemin }}
                >
                  {durum.deger}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#243957]">{durum.etiket}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-[#7b8ca5]">{durum.aciklama}</span>
                  {durum.altBilgi && <span className="mt-1 block text-[10px] font-extrabold" style={{ color: durum.renk }}>{durum.altBilgi}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
