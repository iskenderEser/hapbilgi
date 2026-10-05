"use client";

import { YayinKarti } from "@/components/yayin/YayinKarti";
import { talepIdGoster } from "@/lib/utils/talepId";
import type { OneriGecmisKaydi, OneriYayin } from "../../oneriler/_types";
import { EclubGonderimDetayKarti } from "./EclubGonderimDetayKarti";

interface Props {
  yayin: OneriYayin;
  yeni: boolean;
  secili: boolean;
  secilebilir: boolean;
  gonderilenSayisi: number;
  hedefKisiSayisi: number;
  gonderilecekGoster: boolean;
  gonderimDetayiGoster: boolean;
  gonderimDetayiAcik: boolean;
  gonderimKayitlari: readonly OneriGecmisKaydi[];
  simdi: number;
  onSecim: () => void;
  onOnizle?: () => void;
  onGonderimDetayiAc: () => void;
  onGonderimDetayiKapat: () => void;
  secimGoster?: boolean;
}

const bilgi = "max-w-full rounded-md border border-[#e1e9f3] bg-[#f5f8fc] px-1.5 py-0.5 text-[10px] font-normal leading-tight text-[#405976] sm:text-[8px]";
const satisSartiBilgi = "max-w-full rounded-md border border-[#e1e9f3] bg-[#f5f8fc] px-1.5 py-0.5 text-[9px] font-normal leading-tight text-[#405976] sm:text-[7px]";

export function EclubYayinGonderimKarti({ yayin, yeni, secili, secilebilir, gonderilenSayisi, hedefKisiSayisi, gonderilecekGoster, gonderimDetayiGoster, gonderimDetayiAcik, gonderimKayitlari, simdi, onSecim, onOnizle, onGonderimDetayiAc, onGonderimDetayiKapat, secimGoster = true }: Props) {
  const cekli = yayin.cek_karsiligi_var_mi === true;
  const incelemeTamamlandi = yayin.gonderim_incelemesi_tamamlandi;

  return (
    <div className={`relative isolate h-full ${gonderimDetayiGoster ? "pb-4" : ""}`}>
      <div className={`relative h-full transition-[transform,opacity] duration-300 motion-reduce:transition-none ${gonderimDetayiAcik ? "pointer-events-none z-0 translate-x-1.5 translate-y-1.5 opacity-100" : "z-10 translate-x-0 translate-y-0 opacity-100"}`} aria-hidden={gonderimDetayiAcik}>
      <YayinKarti
      yayin={yayin}
      onClick={onOnizle ? () => onOnizle() : undefined}
      ariaLabel={`${yayin.urun_adi} öğrenme içeriğini önizle`}
      className={`h-full ${secili ? "border-[#237ac8] ring-2 ring-[#237ac8]/20" : ""}`}
      durumGoster={yeni}
      solUstRozet={yeni ? <span className="font-extrabold text-blue-600">Yeni</span> : undefined}
      etkilesimGoster={false}
      tarihGoster
      izlenmeGoster={false}
      puanGoster
      extraPuanGoster={false}
      talepNoGoster={false}
      baslikSagAksiyon={yayin.talep_no != null ? <span className="shrink-0 font-mono text-xs text-[#bc2d0d] sm:text-[10px]">{talepIdGoster(yayin.firma_adi, yayin.talep_no)}</span> : undefined}
      donguGoster={false}
      thumbnailAltBant={!incelemeTamamlandi ? <span className="block w-full rounded-md bg-[#fff3f1] px-1.5 py-0.5 text-center text-[9px] font-medium leading-3 text-[#ad625c]">Göndermek için yayını tamamlayın</span> : undefined}
      tarihSatiriSagAksiyon={secimGoster && (secilebilir || gonderilecekGoster) ? (
        <label onClick={(event) => event.stopPropagation()} className={`inline-flex shrink-0 items-center gap-1 text-xs font-normal sm:text-[10px] ${secili ? "text-[#1d65aa]" : "text-[#526780]"} ${secilebilir ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
          <input type="checkbox" checked={secili} disabled={!secilebilir} onChange={onSecim} aria-label={`${yayin.urun_adi} yayınını gönderim için seç`} className="size-3 accent-[#237ac8]" />
          Göndermek için seçin
        </label>
      ) : undefined}
      puanSatiriSagAksiyon={<span className="inline-flex shrink-0 rounded-md border border-[#dce7f2] bg-[#f2f7fc] px-1.5 py-0.5 text-[10px] font-normal leading-tight text-[#405976] sm:text-[9px]">{gonderilecekGoster ? hedefKisiSayisi - gonderilenSayisi : gonderilenSayisi}/{hedefKisiSayisi} {gonderilecekGoster ? "Gönderilecek" : "Gönderilen"}</span>}
      altEkIcerik={
        <div className="mt-2 border-t border-[#e8eef5] pt-2" aria-label="Yayın bilgileri ve koşulları">
          <div className="flex flex-wrap items-start justify-between gap-1">
            {yayin.cek_karsiligi_var_mi === false ? (
              <span className={bilgi}>Çeksiz Puan · Yalnız lig</span>
            ) : cekli ? (
              <>
                <span className={bilgi}>Çekli Puan</span>
                {yayin.satis_sarti_tipi === "satis_sartli" ? <span className={bilgi}>Sipariş zorunlu</span> : yayin.satis_sarti_tipi === "serbest_siparis" ? <span className={bilgi}>Siparişle çek tutarı artar</span> : yayin.satis_sarti_tipi === "siparissiz_cek" ? <span className={bilgi}>Sipariş yok</span> : <span className={bilgi}>Sipariş koşulu belirtilmemiş</span>}
                {yayin.satis_sarti_tipi === "serbest_siparis" && yayin.gizli_sart_katlama_orani != null && <span className={bilgi}>Siparişle çek tutarı +%{yayin.gizli_sart_katlama_orani}</span>}
              </>
            ) : <span className={bilgi}>Puan türü belirtilmemiş</span>}
          </div>
          {cekli && Array.isArray(yayin.barem_tablosu) && yayin.barem_tablosu.length > 0 && (
            <div className="mt-1 grid grid-cols-3 gap-1">
              {yayin.barem_tablosu.map((barem, index) => (
                <span key={index} className={`${satisSartiBilgi} flex min-w-0 flex-col items-center text-center`} title={`${barem.min_puan.toLocaleString("tr-TR")}–${barem.max_puan.toLocaleString("tr-TR")} puan${yayin.satis_sarti_tipi === "siparissiz_cek" ? "" : `: ${barem.adet}+${barem.mal_fazlasi}`}`}>
                  <span>{barem.min_puan.toLocaleString("tr-TR")}–{barem.max_puan.toLocaleString("tr-TR")}p</span>
                  {yayin.satis_sarti_tipi !== "siparissiz_cek" && <span>{barem.adet}+{barem.mal_fazlasi}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      }
    />
      </div>
      {gonderimDetayiGoster && <EclubGonderimDetayKarti
        yayinId={yayin.yayin_id}
        urunAdi={yayin.urun_adi}
        aracTuru={yayin.arac_turu}
        kayitlar={gonderimKayitlari}
        simdi={simdi}
        acik={gonderimDetayiAcik}
        onAc={onGonderimDetayiAc}
        onKapat={onGonderimDetayiKapat}
      />}
    </div>
  );
}
