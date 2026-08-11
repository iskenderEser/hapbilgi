// app/analiz/_components/FiltreBari.tsx
//
// Periyot seçici + 5 filtre dropdown (Takım, Bölge, UTT, Ürün, Eğitim Türü).
// Yönetici sayfası için tasarlandı — tüm filtreler aktif.
// TM/BM gibi scope'u sabit roller için opsiyonel prop'larla dropdown'lar sabitlenebilir.
//
// Savunma: kapsam alanları (bolgeler, utt_listesi, urunler, takimlar,
// egitim_turleri) RPC'den gelir. Veri yokken bazı alanlar null dönebildiği için
// (örn. talep yoksa egitim_turleri) her listede `?? []` ile null'a karşı korunur —
// hiçbir koşulda null'a .map/.filter yapılmaz.

"use client";

import { CalendarDays, SlidersHorizontal } from "lucide-react";
import type { Periyot } from "@/lib/utils/raporUtils";
import type { Kapsam } from "@/lib/analiz/yonetici/getYoneticiAnalizData";

export type Filtreler = {
  takim_id?: string | null;
  bolge_id?: string | null;
  urun_id?: string | null;
  utt_id?: string | null;
  egitim_turu?: string | null;
};

type Props = {
  periyot: Periyot;
  filtreler: Filtreler;
  kapsam: Kapsam;
  onPeriyotDegisti: (p: Periyot) => void;
  onFiltreDegisti: (f: Filtreler) => void;
  /** TM/BM gibi takımı sabit roller için: dropdown disable, sabit metin gösterilir. */
  sabitTakim?: { takim_id: string; takim_adi: string } | null;
  /** BM için: bölge dropdown'u disable, sabit metin gösterilir. */
  sabitBolge?: { bolge_id: string; bolge_adi: string } | null;
};

const PERIYOT_SECENEKLERI: { deger: Periyot; etiket: string }[] = [
  { deger: "bu_gun", etiket: "Günlük" },
  { deger: "bu_hafta", etiket: "Haftalık" },
  { deger: "bu_ay", etiket: "Aylık" },
  { deger: "bu_donem", etiket: "Dönemlik" },
  { deger: "bu_yil", etiket: "Yıllık" },
];

export default function FiltreBari({
  periyot,
  filtreler,
  kapsam,
  onPeriyotDegisti,
  onFiltreDegisti,
  sabitTakim = null,
  sabitBolge = null,
}: Props) {
  // Kapsam listeleri — RPC veri yokken null dönebilir; null'a karşı boş diziye düş.
  const kapsamBolgeler = kapsam.bolgeler ?? [];
  const kapsamUttListesi = kapsam.utt_listesi ?? [];
  const kapsamUrunler = kapsam.urunler ?? [];
  const kapsamTakimlar = kapsam.takimlar ?? [];
  const kapsamEgitimTurleri = kapsam.egitim_turleri ?? [];

  // Etkin takım seçimi: sabitTakim varsa onu kullan, yoksa filtreler.takim_id
  const etkinTakimId = sabitTakim?.takim_id ?? filtreler.takim_id ?? null;
  const etkinBolgeId = sabitBolge?.bolge_id ?? filtreler.bolge_id ?? null;

  // Takım seçilmişse (sabit veya kullanıcı tarafından) bölgeleri buna göre filtrele
  const seciliTakimBolgeleri = etkinTakimId
    ? kapsamBolgeler.filter((b) => b.takim_id === etkinTakimId)
    : kapsamBolgeler;

  // Takım veya bölge seçilmişse UTT listesini buna göre daralt
  const seciliKapsamUttleri = kapsamUttListesi.filter((u) => {
    if (etkinBolgeId && u.bolge_id !== etkinBolgeId) return false;
    if (etkinTakimId && u.takim_id !== etkinTakimId) return false;
    return true;
  });

  // Takım seçilmişse ürünleri buna göre daralt
  const seciliTakimUrunleri = etkinTakimId
    ? kapsamUrunler.filter((u) => u.takim_id === etkinTakimId || u.takim_id === null)
    : kapsamUrunler;

  const dropdownGuncelle = (alan: keyof Filtreler, deger: string) => {
    const yeni: Filtreler = { ...filtreler, [alan]: deger === "" ? null : deger };

    if (alan === "takim_id") {
      yeni.bolge_id = null;
      yeni.utt_id = null;
    }
    if (alan === "bolge_id") {
      yeni.utt_id = null;
    }

    onFiltreDegisti(yeni);
  };

  return (
    <section className="rounded-[20px] border border-[#dfe8f1] bg-white/95 p-4 shadow-[0_8px_24px_rgba(35,68,105,0.045)]">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#71859d]"><SlidersHorizontal className="h-3.5 w-3.5" /> Analiz kapsamı</div>
          <div className="mt-1 text-xs font-extrabold text-[#263b55]">Dönemi ve inceleme alanını belirle</div>
        </div>
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-[13px] border border-[#dfe7f0] bg-[#f6f9fc] p-1" aria-label="Analiz dönemi">
          <CalendarDays className="ml-1.5 h-3.5 w-3.5 shrink-0 text-[#7a8da4]" />
          {PERIYOT_SECENEKLERI.map((p) => <button key={p.deger} type="button" onClick={() => onPeriyotDegisti(p.deger)} className={`shrink-0 rounded-[9px] border-0 px-3 py-1.5 text-[10px] font-extrabold transition-colors ${periyot === p.deger ? "bg-[#2c84cf] text-white shadow-[0_4px_10px_rgba(35,122,200,0.18)]" : "bg-transparent text-[#71839a] hover:bg-[#eaf3fb] hover:text-[#237ac8]"}`}>{p.etiket}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#8190a3]">Takım</label>
          {sabitTakim ? (
            <div className="w-full rounded-xl border border-[#e3eaf1] bg-[#f5f8fb] px-3 py-2 text-[11px] font-bold text-[#52677f]">
              {sabitTakim.takim_adi}
            </div>
          ) : (
            <select
              value={filtreler.takim_id ?? ""}
              onChange={(e) => dropdownGuncelle("takim_id", e.target.value)}
              className="w-full rounded-xl border border-[#dce5ee] bg-white px-3 py-2 text-[11px] font-bold text-[#52677f] outline-none transition-colors focus:border-[#56aeff]"
            >
              <option value="">Tümü</option>
              {kapsamTakimlar.map((t) => (
                <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#8190a3]">Bölge</label>
          {sabitBolge ? (
            <div className="w-full rounded-xl border border-[#e3eaf1] bg-[#f5f8fb] px-3 py-2 text-[11px] font-bold text-[#52677f]">
              {sabitBolge.bolge_adi}
            </div>
          ) : (
            <select
              value={filtreler.bolge_id ?? ""}
              onChange={(e) => dropdownGuncelle("bolge_id", e.target.value)}
              className="w-full rounded-xl border border-[#dce5ee] bg-white px-3 py-2 text-[11px] font-bold text-[#52677f] outline-none transition-colors focus:border-[#56aeff]"
            >
              <option value="">Tümü</option>
              {seciliTakimBolgeleri.map((b) => (
                <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#8190a3]">UTT</label>
          <select
            value={filtreler.utt_id ?? ""}
            onChange={(e) => dropdownGuncelle("utt_id", e.target.value)}
            className="w-full rounded-xl border border-[#dce5ee] bg-white px-3 py-2 text-[11px] font-bold text-[#52677f] outline-none transition-colors focus:border-[#56aeff]"
          >
            <option value="">Tümü</option>
            {seciliKapsamUttleri.map((u) => (
              <option key={u.kullanici_id} value={u.kullanici_id}>
                {u.ad} {u.soyad}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#8190a3]">Ürün</label>
          <select
            value={filtreler.urun_id ?? ""}
            onChange={(e) => dropdownGuncelle("urun_id", e.target.value)}
            className="w-full rounded-xl border border-[#dce5ee] bg-white px-3 py-2 text-[11px] font-bold text-[#52677f] outline-none transition-colors focus:border-[#56aeff]"
          >
            <option value="">Tümü</option>
            {seciliTakimUrunleri.map((u) => (
              <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[9px] font-extrabold uppercase tracking-[0.04em] text-[#8190a3]">Eğitim Türü</label>
          <select
            value={filtreler.egitim_turu ?? ""}
            onChange={(e) => dropdownGuncelle("egitim_turu", e.target.value)}
            className="w-full rounded-xl border border-[#dce5ee] bg-white px-3 py-2 text-[11px] font-bold text-[#52677f] outline-none transition-colors focus:border-[#56aeff]"
          >
            <option value="">Tümü</option>
            {kapsamEgitimTurleri.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
