// components/store/AdresModal.tsx
//
// Adres ekleme/düzenleme modalı. Tek bileşen iki mod destekler:
//   - Ekle: mevcutAdres=null
//   - Düzenle: mevcutAdres dolu
//
// Onay düğmesine basınca POST /store/api/adres (ekle) veya
// PATCH /store/api/adres (düzenle) çağrılır.

"use client";

import { useEffect, useState } from "react";
import type { Adres, AdresInput } from "@/lib/store/tipler";

interface Props {
  acik: boolean;
  mevcutAdres: Adres | null;  // null → ekleme modu; dolu → düzenleme modu
  onKapat: () => void;
  onKaydedildi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
  basari: (mesaj: string) => void;
}

const BOS_INPUT: AdresInput = {
  baslik: "",
  alici_adi: "",
  telefon: "",
  il: "",
  ilce: "",
  adres_detay: "",
  posta_kodu: "",
  varsayilan_mi: false,
};

export default function AdresModal({
  acik,
  mevcutAdres,
  onKapat,
  onKaydedildi,
  hata,
  basari,
}: Props) {
  const [form, setForm] = useState<AdresInput>(BOS_INPUT);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  // Modal her açılışta state'i sıfırla / dolu hale getir
  useEffect(() => {
    if (!acik) return;
    if (mevcutAdres) {
      setForm({
        baslik: mevcutAdres.baslik,
        alici_adi: mevcutAdres.alici_adi,
        telefon: mevcutAdres.telefon,
        il: mevcutAdres.il,
        ilce: mevcutAdres.ilce,
        adres_detay: mevcutAdres.adres_detay,
        posta_kodu: mevcutAdres.posta_kodu ?? "",
        varsayilan_mi: mevcutAdres.varsayilan_mi,
      });
    } else {
      setForm(BOS_INPUT);
    }
  }, [acik, mevcutAdres]);

  const handleChange = (alan: keyof AdresInput, deger: string | boolean) => {
    setForm((prev) => ({ ...prev, [alan]: deger }));
  };

  const handleKaydet = async () => {
    // Basit validasyon
    const zorunlular: (keyof AdresInput)[] = [
      "baslik", "alici_adi", "telefon", "il", "ilce", "adres_detay",
    ];
    for (const alan of zorunlular) {
      const deger = form[alan];
      if (!deger || typeof deger !== "string" || deger.trim() === "") {
        hata(`${alan} alanı zorunludur.`, "validasyon", null);
        return;
      }
    }

    setKaydediliyor(true);
    try {
      const yontem = mevcutAdres ? "PATCH" : "POST";
      const body = mevcutAdres
        ? { adres_id: mevcutAdres.adres_id, ...form }
        : form;

      const res = await fetch("/store/api/adres", {
        method: yontem,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "Adres kaydedilemedi.", d.adim, d.detay);
        setKaydediliyor(false);
        return;
      }

      basari(mevcutAdres ? "Adres güncellendi." : "Adres eklendi.");
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
    color: "#374151",
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Başlık */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-base font-semibold text-gray-900">
            {mevcutAdres ? "Adres Düzenle" : "Yeni Adres Ekle"}
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
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          <FormAlani label="Başlık (örn. Ev, Ofis)">
            <input
              type="text"
              value={form.baslik}
              onChange={(e) => handleChange("baslik", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="Ev"
            />
          </FormAlani>

          <FormAlani label="Alıcı Adı Soyadı">
            <input
              type="text"
              value={form.alici_adi}
              onChange={(e) => handleChange("alici_adi", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="Ad Soyad"
            />
          </FormAlani>

          <FormAlani label="Telefon">
            <input
              type="tel"
              value={form.telefon}
              onChange={(e) => handleChange("telefon", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="05XX XXX XX XX"
            />
          </FormAlani>

          <div className="grid grid-cols-2 gap-3">
            <FormAlani label="İl">
              <input
                type="text"
                value={form.il}
                onChange={(e) => handleChange("il", e.target.value)}
                disabled={kaydediliyor}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white"
                style={inputStili}
                placeholder="İstanbul"
              />
            </FormAlani>

            <FormAlani label="İlçe">
              <input
                type="text"
                value={form.ilce}
                onChange={(e) => handleChange("ilce", e.target.value)}
                disabled={kaydediliyor}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white"
                style={inputStili}
                placeholder="Kadıköy"
              />
            </FormAlani>
          </div>

          <FormAlani label="Açık Adres">
            <textarea
              value={form.adres_detay}
              onChange={(e) => handleChange("adres_detay", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white resize-none"
              style={{ ...inputStili, minHeight: "70px" }}
              placeholder="Mahalle, sokak, bina no, daire..."
            />
          </FormAlani>

          <FormAlani label="Posta Kodu (opsiyonel)">
            <input
              type="text"
              value={form.posta_kodu ?? ""}
              onChange={(e) => handleChange("posta_kodu", e.target.value)}
              disabled={kaydediliyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="34000"
            />
          </FormAlani>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={Boolean(form.varsayilan_mi)}
              onChange={(e) => handleChange("varsayilan_mi", e.target.checked)}
              disabled={kaydediliyor}
            />
            <span className="text-xs" style={{ color: "#374151" }}>
              Varsayılan adres olarak ayarla
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
              background: "#56aeff",
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

// ─── Yardımcı: form alanı + label ────────────────────────────────────────────

function FormAlani({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-700 block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}