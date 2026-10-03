"use client";

import { useState, type ReactNode } from "react";
import { Popover } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  mutabakatRolSonucEtiketi,
  type UttMutabakatEczaneIslemleri,
  type UttMutabakatKarari,
  type UttMutabakatKaydi,
} from "@/lib/eczanem/uttMutabakat";
import { YAYIN_TURU_SUNUMU } from "@/lib/ogrenmeAraci/turSunumu";
import styles from "./MutabakatIslemTablosu.module.css";

export type MutabakatTabloRolu = "utt" | "bm" | "tm";
export type MutabakatDuzKaydi = UttMutabakatKaydi & { bm_adi?: string; utt_adi?: string };

const KARARLAR: { deger: UttMutabakatKarari; etiket: string }[] = [
  { deger: "onay", etiket: "Onayla" },
  { deger: "beklet", etiket: "Beklet" },
  { deger: "ret", etiket: "Reddet" },
];

function tarih(deger: string): string {
  const zaman = new Date(deger);
  return Number.isNaN(zaman.getTime()) ? "—" : zaman.toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul",
  });
}

function sayi(deger: number): string { return deger.toLocaleString("tr-TR"); }
function para(deger: number): string { return `${deger.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`; }

function rolKarari(kayit: UttMutabakatKaydi, rol: MutabakatTabloRolu): UttMutabakatKarari | null {
  if (rol === "utt") return kayit.utt_karar;
  if (rol === "bm") return kayit.bm_karar;
  return kayit.tm_karar;
}

function kararVerilebilir(kayit: UttMutabakatKaydi, rol: MutabakatTabloRolu, kararPenceresiAcik: boolean): boolean {
  if (rol === "utt") return kararPenceresiAcik && kayit.onay_durumu === "utt_hazirliginda";
  if (rol === "bm") return kayit.onay_durumu === "bm_onayinda";
  return kayit.onay_durumu === "tm_onayinda";
}

function sonuc(kayit: UttMutabakatKaydi, rol: MutabakatTabloRolu): string {
  return mutabakatRolSonucEtiketi(kayit, rol);
}

function gondermeEylemi(kayit: UttMutabakatKaydi, rol: MutabakatTabloRolu): string | null {
  if (rol === "utt" && kayit.onay_durumu === "utt_hazirliginda" && kayit.utt_karar === "onay") return "BM Onayına Gönder";
  if (rol === "bm" && kayit.onay_durumu === "bm_onayinda" && kayit.bm_karar === "onay") return "TM Onayına Gönder";
  return null;
}

function MutabakatIslemSatiri({ kayit, rol, gorunum, kararPenceresiAcik, islemde, urunSecenekleri, seciliUrunId, onUrunDegistir, onKarar, onOnayaGonder }: {
  kayit: UttMutabakatKaydi | MutabakatDuzKaydi;
  rol: MutabakatTabloRolu;
  gorunum: "akordiyon" | "duz";
  kararPenceresiAcik: boolean;
  islemde: boolean;
  urunSecenekleri: UttMutabakatEczaneIslemleri["urun_secenekleri"];
  seciliUrunId: string | null;
  onUrunDegistir: (urunId: string | null) => void;
  onKarar: (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => void;
  onOnayaGonder?: (kayit: UttMutabakatKaydi) => void;
}) {
  const [urunMenusuAcik, setUrunMenusuAcik] = useState(false);
  const mevcutKarar = rolKarari(kayit, rol);
  const kararAcik = kararVerilebilir(kayit, rol, kararPenceresiAcik);
  const gonderEtiketi = gondermeEylemi(kayit, rol);

  return <div className="border-t border-[#e8eef5] bg-white px-3 py-3 text-[#405976] md:px-4">
    <div className={styles.sutunlar}>
      {gorunum === "duz" && <>
        {rol === "tm" && <div className={styles.alan}><span className={styles.alanEtiketi}>BM</span><span>{(kayit as MutabakatDuzKaydi).bm_adi}</span></div>}
        {rol !== "utt" && <div className={styles.alan}><span className={styles.alanEtiketi}>UTT</span><span>{(kayit as MutabakatDuzKaydi).utt_adi}</span></div>}
        <div className={styles.alan}><span className={styles.alanEtiketi}>Eczane</span><span>{kayit.eczane_adi || "Eczane"}</span></div>
      </>}
      <div className={styles.alan}><span className={styles.alanEtiketi}>İndirim Onay Tarihi</span><span>{tarih(kayit.onay_tarihi)}</span></div>
      <div className={`${styles.alan} ${styles.urunAlani}`}><span className={styles.alanEtiketi}>Ürün Adı</span><div className="min-w-0">
        <Popover.Root open={urunMenusuAcik} onOpenChange={setUrunMenusuAcik}>
          <Popover.Trigger asChild><button type="button" aria-label={`${kayit.urun_adi}: ürün adına göre filtrele`} className="inline-flex max-w-full items-center gap-1 text-left font-bold text-[#203653] hover:text-[#237ac8]">
            <span className="min-w-0 break-words">{kayit.urun_adi}</span><ChevronDown className="size-3 shrink-0" aria-hidden="true" />
          </button></Popover.Trigger>
          <Popover.Portal><Popover.Content align="start" sideOffset={5} className="z-50 max-h-64 w-[min(280px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-[#dbe5ef] bg-white p-1 shadow-[0_12px_28px_rgba(31,74,111,.18)]">
            <button type="button" aria-pressed={seciliUrunId === null} onClick={() => { onUrunDegistir(null); setUrunMenusuAcik(false); }} className={`block w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f2f7fc] ${seciliUrunId === null ? "bg-[#eaf4fd] text-[#237ac8]" : "text-[#405976]"}`}>Tümü</button>
            {urunSecenekleri.map((urun) => <button key={urun.urun_id} type="button" aria-pressed={seciliUrunId === urun.urun_id} onClick={() => { onUrunDegistir(urun.urun_id); setUrunMenusuAcik(false); }} className={`block w-full rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-[#f2f7fc] ${seciliUrunId === urun.urun_id ? "bg-[#eaf4fd] text-[#237ac8]" : "text-[#405976]"}`}>{urun.urun_adi}{urun.gorunen_urun_id ? ` · ${urun.gorunen_urun_id}` : ""}</button>)}
          </Popover.Content></Popover.Portal>
        </Popover.Root>
        {kayit.gorunen_urun_id && <span className="block text-[10px] text-[#7b8da5]">{kayit.gorunen_urun_id}</span>}
      </div></div>
      <div className={`${styles.alan} ${styles.aracAlani}`}><span className={styles.alanEtiketi}>Öğrenme Aracı</span><div className="min-w-0">{kayit.kaynaklar.map((kaynak) => <div key={`${kaynak.yayin_id}-${kaynak.arac_id}`} className="leading-snug"><span>{YAYIN_TURU_SUNUMU[kaynak.arac_turu]?.etiket ?? "Öğrenme içeriği"}</span>{kaynak.gorunen_talep_id && <span className="block text-[10px] text-[#7b8da5]">Talep ID: {kaynak.gorunen_talep_id}</span>}</div>)}</div></div>
      <div className={`${styles.alan} ${styles.ortali}`}><span className={styles.alanEtiketi}>PSF</span><span>{kayit.satis_fiyati === null ? "—" : para(kayit.satis_fiyati)}</span></div>
      <div className={`${styles.alan} ${styles.ortali}`}><span className={styles.alanEtiketi}>İndirim Limiti</span><strong>{sayi(kayit.tarife_puan)} puan = {para(kayit.tarife_tl)}</strong></div>
      <div className={`${styles.alan} ${styles.ortali}`}><span className={styles.alanEtiketi}>İndirim ID</span><span className="break-all" title={kayit.gorunen_indirim_id ?? undefined}>{kayit.gorunen_indirim_id || "—"}</span></div>
      <div className={`${styles.alan} ${styles.ortali}`}><span className={styles.alanEtiketi}>Onaylanan İndirim Puanı</span><span>{sayi(kayit.kullanilan_puan)} puan</span></div>
      <div className={`${styles.alan} ${styles.ortali}`}><span className={styles.alanEtiketi}>İndirim Tutarı</span><span>{para(kayit.indirim_tl)}</span></div>
      <div className={styles.kararGrubu} aria-label={`${rol.toLocaleUpperCase("tr-TR")} kararı`}><span className={styles.alanEtiketi}>Karar</span>
        {KARARLAR.map(({ deger, etiket }) => {
          const secili = mevcutKarar === deger;
          return <Button key={deger} type="button" size="sm" variant="outline" aria-pressed={secili}
            disabled={!kararAcik || secili || islemde} onClick={() => onKarar(kayit, deger)}
            className={`font-bold ${secili
              ? "border-[#237ac8] bg-[#237ac8] text-white shadow-sm hover:bg-[#1d69ad] hover:text-white disabled:opacity-100"
              : "border-[#a9c9e5] bg-white text-[#237ac8] hover:border-[#237ac8] hover:bg-[#edf6fd] hover:text-[#1d69ad] disabled:opacity-50"}`}>{etiket}</Button>;
        })}
      </div>
      <div className={styles.sonucAlani}><span className={styles.alanEtiketi}>Sonuç</span>
        {gonderEtiketi && onOnayaGonder
          ? <Button type="button" size="sm" disabled={islemde} onClick={() => onOnayaGonder(kayit)} className={`${styles.sonucButonu} bg-[#237ac8] font-extrabold hover:bg-[#1d69ad] disabled:opacity-50`}>{gonderEtiketi}</Button>
          : <span className={`inline-flex rounded-full px-2 py-1 font-extrabold ${mevcutKarar || !kararAcik ? "bg-[#edf6fd] text-[#237ac8]" : "bg-[#f3f6f9] text-[#718198]"}`}>{sonuc(kayit, rol)}</span>}
      </div>
    </div>
  </div>;
}

export default function MutabakatIslemTablosu({ rol, gorunum = "akordiyon", kayitlar, kararPenceresiAcik = true, islemdeId, urunSecenekleri, seciliUrunId, onUrunDegistir, onKarar, onOnayaGonder, bosIcerik, altIcerik }: {
  rol: MutabakatTabloRolu;
  gorunum?: "akordiyon" | "duz";
  kayitlar: Array<UttMutabakatKaydi | MutabakatDuzKaydi>;
  kararPenceresiAcik?: boolean;
  islemdeId: string | null;
  urunSecenekleri: UttMutabakatEczaneIslemleri["urun_secenekleri"];
  seciliUrunId: string | null;
  onUrunDegistir: (urunId: string | null) => void;
  onKarar: (kayit: UttMutabakatKaydi, karar: UttMutabakatKarari) => void;
  onOnayaGonder?: (kayit: UttMutabakatKaydi) => void;
  bosIcerik: ReactNode;
  altIcerik?: ReactNode;
}) {
  const duzRolSinifi = rol === "tm" ? styles.duzTm : rol === "bm" ? styles.duzBm : styles.duzUtt;
  return <div className={`${styles.tablo} ${gorunum === "duz" ? `${styles.duzTablo} ${duzRolSinifi}` : ""} rounded-xl border border-[#dfe7f1] bg-white`}>
    <div className={`min-h-14 gap-2 bg-[#f2f7fc] px-4 py-2 font-extrabold uppercase leading-tight text-[#7b8da5] ${styles.sutunlar} ${styles.baslik}`}>
      {gorunum === "duz" && <>{rol === "tm" && <span>BM</span>}{rol !== "utt" && <span>UTT</span>}<span>Eczane</span></>}
      <span>İndirim Onay Tarihi</span><span>Ürün Adı</span><span>Öğrenme Aracı</span><span className="text-center" title="Perakende Satış Fiyatı">PSF</span><span className="text-center">İndirim Limiti</span><span className="text-center">İndirim ID</span><span className="text-center">Onaylanan İndirim Puanı</span><span className="text-center">İndirim Tutarı</span><span className="text-center">Karar</span><span className="text-center">Sonuç</span>
    </div>
    {kayitlar.length === 0 ? bosIcerik : kayitlar.map((kayit) => <MutabakatIslemSatiri key={kayit.mutabakat_id} kayit={kayit} rol={rol} gorunum={gorunum} kararPenceresiAcik={kararPenceresiAcik} islemde={islemdeId === kayit.mutabakat_id} urunSecenekleri={urunSecenekleri} seciliUrunId={seciliUrunId} onUrunDegistir={onUrunDegistir} onKarar={onKarar} onOnayaGonder={onOnayaGonder} />)}
    {altIcerik}
  </div>;
}
