// app/admin/store/_components/UrunModal.tsx
//
// Ürün ekle/düzenle modalı. Görsel upload akışı dahil.
//
// Mod:
//   - Ekle: mevcutUrun=null
//   - Düzenle: mevcutUrun dolu (görseli varsa preview gösterilir)
//
// Görsel upload akışı:
//   1. Kullanıcı dosya seçer (input click veya sürükle-bırak)
//   2. Dosya boyut/format ön kontrolü
//   3. POST /admin/store/api/upload (FormData) → public URL döner
//   4. URL form state'e kaydedilir, preview gösterilir
//   5. "Kaydet" → POST/PATCH /admin/store/api/urun (URL ile birlikte)

"use client";

import { useEffect, useState, useRef } from "react";
import type { Urun, Kategori } from "@/lib/store/tipler";

interface UrunGosterim extends Urun {
  store_kategoriler?: { ad: string } | null;
}

interface Props {
  acik: boolean;
  mevcutUrun: UrunGosterim | null;
  kategoriler: Kategori[];
  onKapat: () => void;
  onKaydedildi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
  basari: (mesaj: string) => void;
}

interface FormState {
  kategori_id: string;
  ad: string;
  aciklama: string;
  gorsel_url: string | null;
  puan_fiyati: number;
  stok: number;
  aktif_mi: boolean;
}

const BOS_FORM: FormState = {
  kategori_id: "",
  ad: "",
  aciklama: "",
  gorsel_url: null,
  puan_fiyati: 1,
  stok: 0,
  aktif_mi: true,
};

const MAKS_BOYUT_MB = 2;
const IZINLI_FORMATLAR = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const MAVI = "#56aeff";
const BORDO = "#bc2d0d";
const KOYU_METIN = "#374151";
const GRI_METIN = "#737373";

export default function UrunModal({
  acik,
  mevcutUrun,
  kategoriler,
  onKapat,
  onKaydedildi,
  hata,
  basari,
}: Props) {
  const [form, setForm] = useState<FormState>(BOS_FORM);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [yukleniyorGorsel, setYukleniyorGorsel] = useState(false);
  const [surukleAktif, setSurukleAktif] = useState(false);
  const dosyaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!acik) return;
    if (mevcutUrun) {
      setForm({
        kategori_id: mevcutUrun.kategori_id,
        ad: mevcutUrun.ad,
        aciklama: mevcutUrun.aciklama ?? "",
        gorsel_url: mevcutUrun.gorsel_url,
        puan_fiyati: mevcutUrun.puan_fiyati,
        stok: mevcutUrun.stok,
        aktif_mi: mevcutUrun.aktif_mi,
      });
    } else {
      const ilkAktifKategori = kategoriler.find((k) => k.aktif_mi);
      setForm({
        ...BOS_FORM,
        kategori_id: ilkAktifKategori?.kategori_id ?? "",
      });
    }
  }, [acik, mevcutUrun, kategoriler]);

  const handleChange = (
    alan: keyof FormState,
    deger: string | number | boolean | null
  ) => {
    setForm((prev) => ({ ...prev, [alan]: deger }));
  };

  // ─── Görsel yükleme ────────────────────────────────────────────────────────

  const dosyaYukle = async (dosya: File) => {
    // Ön kontrol
    if (!IZINLI_FORMATLAR.includes(dosya.type)) {
      hata("Sadece JPEG, PNG veya WebP yükleyebilirsin.", "validasyon", undefined);
      return;
    }
    if (dosya.size > MAKS_BOYUT_MB * 1024 * 1024) {
      hata(`Dosya çok büyük. Maksimum ${MAKS_BOYUT_MB} MB.`, "validasyon", undefined);
      return;
    }

    setYukleniyorGorsel(true);
    try {
      const fd = new FormData();
      fd.append("dosya", dosya);
      const res = await fetch("/admin/store/api/upload", {
        method: "POST",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) {
        hata(d.hata ?? "Görsel yüklenemedi.", d.adim, d.detay);
        setYukleniyorGorsel(false);
        return;
      }
      handleChange("gorsel_url", d.url);
      basari("Görsel yüklendi.");
    } catch (err) {
      hata("Görsel yükleme hatası.", "fetch", String(err));
    }
    setYukleniyorGorsel(false);
  };

  const handleDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dosya = e.target.files?.[0];
    if (dosya) dosyaYukle(dosya);
    // Aynı dosyayı tekrar seçebilmek için input'u resetle
    if (dosyaInputRef.current) dosyaInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSurukleAktif(false);
    const dosya = e.dataTransfer.files?.[0];
    if (dosya) dosyaYukle(dosya);
  };

  const handleGorselSil = () => {
    handleChange("gorsel_url", null);
  };

  // ─── Kaydet ────────────────────────────────────────────────────────────────

  const handleKaydet = async () => {
    if (!form.kategori_id) {
      hata("Kategori seçilmedi.", "validasyon", undefined);
      return;
    }
    if (!form.ad || form.ad.trim() === "") {
      hata("Ürün adı zorunludur.", "validasyon", undefined);
      return;
    }
    if (form.puan_fiyati <= 0) {
      hata("Puan fiyatı 0'dan büyük olmalı.", "validasyon", undefined);
      return;
    }

    setKaydediliyor(true);
    try {
      const yontem = mevcutUrun ? "PATCH" : "POST";
      const body = mevcutUrun
        ? { urun_id: mevcutUrun.urun_id, ...form }
        : form;

      const res = await fetch("/admin/store/api/urun", {
        method: yontem,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();

      if (!res.ok) {
        hata(d.hata ?? "Ürün kaydedilemedi.", d.adim, d.detay);
        setKaydediliyor(false);
        return;
      }

      basari(mevcutUrun ? "Ürün güncellendi." : "Ürün eklendi.");
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

  const islemSuruyor = kaydediliyor || yukleniyorGorsel;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Başlık */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="text-base font-semibold text-gray-900">
            {mevcutUrun ? "Ürünü Düzenle" : "Yeni Ürün"}
          </div>
          <button
            onClick={onKapat}
            disabled={islemSuruyor}
            className="text-gray-500 text-lg cursor-pointer border-none bg-transparent p-1"
            style={{ opacity: islemSuruyor ? 0.4 : 1 }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
          {/* Görsel alanı */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Ürün Görseli (max {MAKS_BOYUT_MB} MB)
            </label>
            {form.gorsel_url ? (
              <div className="relative rounded-lg overflow-hidden border" style={{ borderColor: "#e5e7eb" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.gorsel_url}
                  alt="Önizleme"
                  className="w-full h-48 object-cover bg-gray-50"
                />
                <button
                  onClick={handleGorselSil}
                  disabled={islemSuruyor}
                  className="absolute top-2 right-2 px-2 py-1 rounded-lg text-white text-xs font-semibold cursor-pointer border-none"
                  style={{ background: BORDO, opacity: islemSuruyor ? 0.5 : 1 }}
                >
                  Kaldır
                </button>
              </div>
            ) : (
              <div
                onClick={() => dosyaInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSurukleAktif(true);
                }}
                onDragLeave={() => setSurukleAktif(false)}
                onDrop={handleDrop}
                className="rounded-lg flex flex-col items-center justify-center cursor-pointer"
                style={{
                  border: surukleAktif
                    ? `1px dashed ${MAVI}`
                    : "1px dashed #d1d5db",
                  background: surukleAktif ? "#f0f9ff" : "#f9fafb",
                  minHeight: "120px",
                  padding: "20px",
                }}
              >
                {yukleniyorGorsel ? (
                  <div className="text-sm" style={{ color: GRI_METIN }}>
                    Yükleniyor...
                  </div>
                ) : (
                  <>
                    <div className="text-2xl mb-1" style={{ color: GRI_METIN }}>
                      📷
                    </div>
                    <div className="text-xs font-semibold" style={{ color: KOYU_METIN }}>
                      Dosya seçmek için tıkla
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>
                      veya sürükle bırak
                    </div>
                    <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
                      JPG, PNG, WebP
                    </div>
                  </>
                )}
              </div>
            )}
            <input
              ref={dosyaInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleDosyaSec}
              className="hidden"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Kategori
            </label>
            <select
              value={form.kategori_id}
              onChange={(e) => handleChange("kategori_id", e.target.value)}
              disabled={islemSuruyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white cursor-pointer"
              style={inputStili}
            >
              <option value="">Seç...</option>
              {kategoriler.map((k) => (
                <option key={k.kategori_id} value={k.kategori_id}>
                  {k.ad}
                  {!k.aktif_mi ? " (pasif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Ad */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Ürün Adı
            </label>
            <input
              type="text"
              value={form.ad}
              onChange={(e) => handleChange("ad", e.target.value)}
              disabled={islemSuruyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white"
              style={inputStili}
              placeholder="Örn. Sapiens — Yuval Noah Harari"
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5">
              Açıklama (opsiyonel)
            </label>
            <textarea
              value={form.aciklama}
              onChange={(e) => handleChange("aciklama", e.target.value)}
              disabled={islemSuruyor}
              className="w-full px-3 py-2 text-sm rounded-lg bg-white resize-none"
              style={{ ...inputStili, minHeight: "70px" }}
              placeholder="Kitabın kısa açıklaması..."
            />
          </div>

          {/* Fiyat + Stok */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                HapPuan Fiyatı
              </label>
              <input
                type="number"
                min={1}
                value={form.puan_fiyati}
                onChange={(e) => handleChange("puan_fiyati", Number(e.target.value))}
                disabled={islemSuruyor}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white"
                style={inputStili}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                Stok
              </label>
              <input
                type="number"
                min={0}
                value={form.stok}
                onChange={(e) => handleChange("stok", Number(e.target.value))}
                disabled={islemSuruyor}
                className="w-full px-3 py-2 text-sm rounded-lg bg-white"
                style={inputStili}
              />
            </div>
          </div>

          {/* Aktif mi */}
          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.aktif_mi}
              onChange={(e) => handleChange("aktif_mi", e.target.checked)}
              disabled={islemSuruyor}
            />
            <span className="text-xs" style={{ color: KOYU_METIN }}>
              Aktif (mağaza vitrininde gösterilsin)
            </span>
          </label>
        </div>

        {/* Aksiyon */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2.5 justify-end">
          <button
            onClick={onKapat}
            disabled={islemSuruyor}
            className="px-4 py-2 rounded-lg border bg-transparent text-gray-500 text-xs cursor-pointer"
            style={{
              border: "0.5px solid #e5e7eb",
              fontFamily: "'Nunito', sans-serif",
              opacity: islemSuruyor ? 0.4 : 1,
            }}
          >
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={islemSuruyor}
            className="px-5 py-2 rounded-lg border-none text-white text-xs font-semibold cursor-pointer"
            style={{
              background: MAVI,
              opacity: islemSuruyor ? 0.5 : 1,
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