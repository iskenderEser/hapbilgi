// app/admin/store/_components/KategoriModal.tsx
//
// Kategori ekle/düzenle modalı. AdresModal pattern'i ile aynı yapı.
//
// Mod:
//   - Ekle: mevcutKategori=null
//   - Düzenle: mevcutKategori dolu
//
// POST veya PATCH /admin/store/api/kategori çağrılır.

"use client";

import { useEffect, useState } from "react";
import type { Kategori } from "@/lib/store/tipler";
import { RENK_BORDO } from "../../_constants";

interface Props {
  acik: boolean;
  mevcutKategori: Kategori | null;
  onKapat: () => void;
  onKaydedildi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
  basari: (mesaj: string) => void;
}

interface FormState {
  ad: string;
  sira: number;
  aktif_mi: boolean;
}

const BOS_FORM: FormState = {
  ad: "",
  sira: 0,
  aktif_mi: true,
};

const KOYU_METIN = "#374151";
const GRI_METIN = "#737373";

export default function KategoriModal({
  acik,
  mevcutKategori,
  onKapat,
  onKaydedildi,
  hata,
  basari,
}: Props) {
  const [form, setForm] = useState<FormState>(BOS_FORM);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (!acik) return;
    if (mevcutKategori) {
      setForm({
        ad: mevcutKategori.ad,
        sira: mevcutKategori.sira,
        aktif_mi: mevcutKategori.aktif_mi,
      });
    } else {
      setForm(BOS_FORM);
    }
  }, [acik, mevcutKategori]);

  const handleChange = (alan: keyof FormState, deger: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [alan]: deger }));
  };

  const handleKaydet = async () => {
    if (!form.ad || form.ad.trim() === "") {
      hata("Kategori adı zorunludur.", "validasyon", undefined);
      return;
    }

    setKaydediliyor(true);
    try {
      const yontem = mevcutKategori ? "PATCH" : "POST";
      const body = mevcutKategori
        ? { kategori_id: mevcutKategori.kategori_id, ...form }
        : form;

      const res = await fetch("/admin/store/api/kategori", {
        method: yontem,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "Kategori kaydedilemedi.", d.adim, d.detay);
        setKaydediliyor(false);
        return;
      }

      basari(mevcutKategori ? "Kategori güncellendi." : "Kategori eklendi.");
      setKaydediliyor(false);
      await onKaydedildi();
      onKapat();
    } catch (err) {
      hata("Kaydederken hata oluştu.", "fetch", String(err));
      setKaydediliyor(false);
    }
  };

  if (!acik) return null;

  const inputStili: React.CSSProperties = {
    border: "0.5px solid #e5e7eb",
    fontFamily: "'Nunito', sans-serif",
    color: KOYU_METIN,
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm flex flex-col"
      >
        {/* Başlık */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-base font-semibold text-gray-900">
            {mevcutKategori ? "Kategoriyi Düzenle" : "Yeni Kategori"}
          </div>
          <button
            onClick={onKapat}
            disabled={kaydediliyor}
            className="text-gray-500 text-lg cursor-pointer border-none bg-transparent p-1"
            style={{ opacity: kaydediliyor ? 0.4 : 1 }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Kategori Adı
            </label>
            <input
              type="text"
              value={form.ad}
              onChange={(e) => handleChange("ad", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="Örn. Kitap, Elektronik, Aksesuar"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Görüntülenme Sırası
            </label>
            <input
              type="number"
              min={0}
              value={form.sira}
              onChange={(e) => handleChange("sira", Number(e.target.value))}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
            />
            <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
              Küçük sayı önce gösterilir (0 = en üst).
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.aktif_mi}
              onChange={(e) => handleChange("aktif_mi", e.target.checked)}
              disabled={kaydediliyor}
            />
            <span className="text-xs" style={{ color: KOYU_METIN }}>
              Aktif (mağazada görünsün)
            </span>
          </label>
        </div>

        {/* Aksiyon */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
          <button
            onClick={onKapat}
            disabled={kaydediliyor}
            className="px-4 py-2 rounded-lg border bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{
              border: "0.5px solid #e5e7eb",
              fontFamily: "'Nunito', sans-serif",
              opacity: kaydediliyor ? 0.4 : 1,
            }}
          >
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={kaydediliyor}
            className="px-5 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{
              background: RENK_BORDO,
              opacity: kaydediliyor ? 0.5 : 1,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}