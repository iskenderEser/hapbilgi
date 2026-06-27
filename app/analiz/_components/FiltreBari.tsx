// app/analiz/_components/FiltreBari.tsx
//
// Periyot seçici + 5 filtre dropdown (Takım, Bölge, UTT, Ürün, Eğitim Türü).
// Yönetici sayfası için tasarlandı — tüm filtreler aktif.
// TM/BM gibi scope'u sabit roller için opsiyonel prop'larla dropdown'lar sabitlenebilir.

"use client";

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
  // Etkin takım seçimi: sabitTakim varsa onu kullan, yoksa filtreler.takim_id
  const etkinTakimId = sabitTakim?.takim_id ?? filtreler.takim_id ?? null;
  const etkinBolgeId = sabitBolge?.bolge_id ?? filtreler.bolge_id ?? null;

  // Takım seçilmişse (sabit veya kullanıcı tarafından) bölgeleri buna göre filtrele
  const seciliTakimBolgeleri = etkinTakimId
    ? kapsam.bolgeler.filter((b) => b.takim_id === etkinTakimId)
    : kapsam.bolgeler;

  // Takım veya bölge seçilmişse UTT listesini buna göre daralt
  const seciliKapsamUttleri = kapsam.utt_listesi.filter((u) => {
    if (etkinBolgeId && u.bolge_id !== etkinBolgeId) return false;
    if (etkinTakimId && u.takim_id !== etkinTakimId) return false;
    return true;
  });

  // Takım seçilmişse ürünleri buna göre daralt
  const seciliTakimUrunleri = etkinTakimId
    ? kapsam.urunler.filter((u) => u.takim_id === etkinTakimId || u.takim_id === null)
    : kapsam.urunler;

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
    <section className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Periyot butonları */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PERIYOT_SECENEKLERI.map((p) => {
          const aktif = periyot === p.deger;
          return (
            <button
              key={p.deger}
              type="button"
              onClick={() => onPeriyotDegisti(p.deger)}
              className={
                "px-4 py-2 rounded-md text-sm font-medium border transition-colors " +
                (aktif
                  ? "bg-bordo text-white border-bordo"
                  : "bg-white text-koyu-metin border-gray-300 hover:border-bordo hover:text-bordo")
              }
            >
              {p.etiket}
            </button>
          );
        })}
      </div>

      {/* Dropdown grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gri-metin mb-1">Takım</label>
          {sabitTakim ? (
            <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-koyu-metin">
              {sabitTakim.takim_adi}
            </div>
          ) : (
            <select
              value={filtreler.takim_id ?? ""}
              onChange={(e) => dropdownGuncelle("takim_id", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-koyu-metin focus:outline-none focus:border-bordo"
            >
              <option value="">Tümü</option>
              {kapsam.takimlar.map((t) => (
                <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gri-metin mb-1">Bölge</label>
          {sabitBolge ? (
            <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-koyu-metin">
              {sabitBolge.bolge_adi}
            </div>
          ) : (
            <select
              value={filtreler.bolge_id ?? ""}
              onChange={(e) => dropdownGuncelle("bolge_id", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-koyu-metin focus:outline-none focus:border-bordo"
            >
              <option value="">Tümü</option>
              {seciliTakimBolgeleri.map((b) => (
                <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gri-metin mb-1">UTT</label>
          <select
            value={filtreler.utt_id ?? ""}
            onChange={(e) => dropdownGuncelle("utt_id", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-koyu-metin focus:outline-none focus:border-bordo"
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
          <label className="block text-xs font-medium text-gri-metin mb-1">Ürün</label>
          <select
            value={filtreler.urun_id ?? ""}
            onChange={(e) => dropdownGuncelle("urun_id", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-koyu-metin focus:outline-none focus:border-bordo"
          >
            <option value="">Tümü</option>
            {seciliTakimUrunleri.map((u) => (
              <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gri-metin mb-1">Eğitim Türü</label>
          <select
            value={filtreler.egitim_turu ?? ""}
            onChange={(e) => dropdownGuncelle("egitim_turu", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-koyu-metin focus:outline-none focus:border-bordo"
          >
            <option value="">Tümü</option>
            {kapsam.egitim_turleri.map((et) => (
              <option key={et} value={et}>{et}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}