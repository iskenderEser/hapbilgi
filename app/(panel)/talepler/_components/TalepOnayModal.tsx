"use client";

import { useState } from "react";

export interface TalepOzet {
  hedefKitle: string;
  icerikTuru: string;
  urunAdi: string | null;
  teknikAdi: string | null;
  soruAdedi: number;
  secenekSayisi: number;
  videoBasiSoru: number;
}

interface TalepOnayModalProps {
  acik: boolean;
  sonrakiAdim: "icerik_ureticisi" | "yayin_yonetimi";
  ozet: TalepOzet;
  onEvet: (birDahaHatirlatma: boolean) => void;
  onHayir: () => void;
}

function OzetKarti({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#dfe8f3] bg-[#f8fbff] p-3">
      <h4 className="mb-1.5 text-xs font-extrabold text-[#263b58]">{baslik}</h4>
      <div className="space-y-1 text-xs text-[#526780]">{children}</div>
    </section>
  );
}

export function TalepOnayModal({ acik, sonrakiAdim, ozet, onEvet, onHayir }: TalepOnayModalProps) {
  const [birDahaHatirlatma, setBirDahaHatirlatma] = useState(false);
  if (!acik) return null;

  const iptalEt = () => {
    setBirDahaHatirlatma(false);
    onHayir();
  };
  const onayla = () => {
    onEvet(birDahaHatirlatma);
    setBirDahaHatirlatma(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/45 p-4">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <div>
          <h3 className="m-0 text-base font-extrabold text-gray-900">Talep Özeti</h3>
          <p className="mt-1 text-xs text-gray-500">Göndermeden önce seçimlerinizi kontrol edin.</p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <OzetKarti baslik="1. Hedef Kitle"><p>{ozet.hedefKitle}</p></OzetKarti>
          <OzetKarti baslik="2. İçerik Türü"><p>{ozet.icerikTuru}</p></OzetKarti>
          <OzetKarti baslik="3. Ürün ve Teknik">
            <p><strong>Ürün:</strong> {ozet.urunAdi ?? "Seçilmedi"}</p>
            <p><strong>Teknik:</strong> {ozet.teknikAdi ?? "Seçilmedi"}</p>
          </OzetKarti>
          <OzetKarti baslik="4. Sorular ve Seçenekler">
            <p><strong>Toplam soru:</strong> {ozet.soruAdedi}</p>
            <p><strong>Seçenek sayısı:</strong> {ozet.secenekSayisi}</p>
            <p><strong>Video başına soru:</strong> {ozet.videoBasiSoru}</p>
          </OzetKarti>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#526780]">
          <input type="checkbox" checked={birDahaHatirlatma} onChange={(e) => setBirDahaHatirlatma(e.target.checked)} className="h-4 w-4 accent-[#56aeff]" />
          Bir daha hatırlatma
        </label>

        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={iptalEt} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-5 py-2 text-xs font-bold text-gray-700">İptal</button>
          <button type="button" onClick={onayla} className="cursor-pointer rounded-lg border-none bg-[#56aeff] px-5 py-2 text-xs font-bold text-white">
            {sonrakiAdim === "yayin_yonetimi"
              ? "Onayla ve Yayın Yönetimine Gönder"
              : "Onayla ve İçerik Üreticisine Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
