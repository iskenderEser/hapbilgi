// app/talepler/_components/UrunTeknikSecici.tsx
//
// Ürün ve teknik için seçim dropdown'ları + yeni ekleme akışları.
// Madde 4 Aşama 2B: kullaniciTakimId === null ise yeni ürün eklerken takım seçim dropdown'u görünür.
// Lokal UI state'ler bileşende; ekleme başarılı olunca temizlenir, hata olursa korunur.

"use client";

import { useState } from "react";
import { type TalepTuruKurali } from "@/lib/uretici/yetenekler";
import type { Urun, Teknik, Takim } from "../_types";

interface UrunTeknikSeciciProps {
  urunler: Urun[];
  teknikler: Teknik[];
  takimlar: Takim[];
  kullaniciTakimId: string | null;
  seciliUrunId: string;
  seciliTeknikId: string;
  urunGosterilsin: boolean;
  teknikGosterilsin: boolean;
  turKurali: TalepTuruKurali;
  onUrunSec: (id: string) => void;
  onTeknikSec: (id: string) => void;
  onUrunEkle: (urun_adi: string, takim_id: string | null) => Promise<void>;
  onTeknikEkle: (teknik_adi: string) => Promise<void>;
}

export function UrunTeknikSecici({
  urunler,
  teknikler,
  takimlar,
  kullaniciTakimId,
  seciliUrunId,
  seciliTeknikId,
  urunGosterilsin,
  teknikGosterilsin,
  turKurali,
  onUrunSec,
  onTeknikSec,
  onUrunEkle,
  onTeknikEkle,
}: UrunTeknikSeciciProps) {
  // İkisi de gösterilmiyorsa hiç render etme — parent koşullu sarmalamasın.
  if (!urunGosterilsin && !teknikGosterilsin) return null;

  // Yeni ürün ekleme — lokal UI durumları
  const [yeniUrunGoster, setYeniUrunGoster] = useState(false);
  const [yeniUrunAdi, setYeniUrunAdi] = useState("");
  const [urunEkleniyor, setUrunEkleniyor] = useState(false);
  const [seciliEkleTakimId, setSeciliEkleTakimId] = useState(""); // Madde 4 Aşama 2B

  // Yeni teknik ekleme — lokal UI durumları
  const [yeniTeknikGoster, setYeniTeknikGoster] = useState(false);
  const [yeniTeknikAdi, setYeniTeknikAdi] = useState("");
  const [teknikEkleniyor, setTeknikEkleniyor] = useState(false);

  const handleUrunSelectChange = (deger: string) => {
    if (deger === "yeni") {
      setYeniUrunGoster(true);
      onUrunSec("");
    } else {
      setYeniUrunGoster(false);
      setYeniUrunAdi("");
      onUrunSec(deger);
    }
  };

  const handleTeknikSelectChange = (deger: string) => {
    if (deger === "yeni") {
      setYeniTeknikGoster(true);
      onTeknikSec("");
    } else {
      setYeniTeknikGoster(false);
      setYeniTeknikAdi("");
      onTeknikSec(deger);
    }
  };

  // Takım seçimi: kullanıcının kendi takım_id'si varsa o kullanılır; yoksa ekleme formundaki dropdown.
  const takimZorunluAmaSecilmedi = kullaniciTakimId === null && !seciliEkleTakimId;

  const handleUrunEkleClick = async () => {
    if (!yeniUrunAdi.trim() || takimZorunluAmaSecilmedi) return;
    const efektifTakimId = kullaniciTakimId ?? seciliEkleTakimId;
    setUrunEkleniyor(true);
    try {
      await onUrunEkle(yeniUrunAdi.trim(), efektifTakimId);
      // Başarılıysa UI sıfırla. Hata fırlarsa state korunur — kullanıcı düzeltsin.
      setYeniUrunGoster(false);
      setYeniUrunAdi("");
      setSeciliEkleTakimId("");
    } finally {
      setUrunEkleniyor(false);
    }
  };

  const handleTeknikEkleClick = async () => {
    if (!yeniTeknikAdi.trim()) return;
    setTeknikEkleniyor(true);
    try {
      await onTeknikEkle(yeniTeknikAdi.trim());
      setYeniTeknikGoster(false);
      setYeniTeknikAdi("");
    } finally {
      setTeknikEkleniyor(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      {urunGosterilsin && (
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">
            Ürün Adı
            {turKurali.urun === "tercihli" && (
              <span className="text-gray-400 font-normal ml-1">(tercihli)</span>
            )}
          </label>
          <select
            value={yeniUrunGoster ? "yeni" : seciliUrunId}
            onChange={(e) => handleUrunSelectChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
            style={{
              fontFamily: "'Nunito', sans-serif",
              color: seciliUrunId || yeniUrunGoster ? "#111" : "#9ca3af",
            }}
          >
            <option value="">Ürün seçin...</option>
            {urunler.map((u) => (
              <option key={u.urun_id} value={u.urun_id}>{u.urun_adi}</option>
            ))}
            <option value="yeni">+ Yeni Ürün Ekle</option>
          </select>
          {yeniUrunGoster && (
            <div className="flex flex-col gap-1.5 mt-1.5">
              {kullaniciTakimId === null && (
                <select
                  value={seciliEkleTakimId}
                  onChange={(e) => setSeciliEkleTakimId(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white cursor-pointer box-border"
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    color: seciliEkleTakimId ? "#111" : "#9ca3af",
                    borderColor: "#56aeff",
                  }}
                >
                  <option value="" disabled>Takım seçin (ürün ekleme için)...</option>
                  {takimlar.map((t) => (
                    <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>
                  ))}
                </select>
              )}
              <div className="flex gap-1.5">
                <input
                  value={yeniUrunAdi}
                  onChange={(e) => setYeniUrunAdi(e.target.value)}
                  placeholder="Yeni ürün adı..."
                  className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  style={{ borderColor: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
                />
                <button
                  type="button"
                  onClick={handleUrunEkleClick}
                  disabled={!yeniUrunAdi.trim() || urunEkleniyor || takimZorunluAmaSecilmedi}
                  className="text-white border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  style={{
                    background: "#56aeff",
                    opacity:
                      !yeniUrunAdi.trim() || urunEkleniyor || takimZorunluAmaSecilmedi ? 0.6 : 1,
                    fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  {urunEkleniyor ? "..." : "Ekle"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYeniUrunGoster(false);
                    setYeniUrunAdi("");
                    setSeciliEkleTakimId("");
                  }}
                  className="bg-transparent border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 cursor-pointer"
                  style={{ fontFamily: "'Nunito', sans-serif" }}
                >
                  İptal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {teknikGosterilsin && (
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">
            Teknik Adı
            {turKurali.teknik === "tercihli" && (
              <span className="text-gray-400 font-normal ml-1">(tercihli)</span>
            )}
          </label>
          <select
            value={yeniTeknikGoster ? "yeni" : seciliTeknikId}
            onChange={(e) => handleTeknikSelectChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white cursor-pointer box-border"
            style={{
              fontFamily: "'Nunito', sans-serif",
              color: seciliTeknikId || yeniTeknikGoster ? "#111" : "#9ca3af",
            }}
          >
            <option value="">Teknik seçin...</option>
            {teknikler.map((t) => (
              <option key={t.teknik_id} value={t.teknik_id}>{t.teknik_adi}</option>
            ))}
            <option value="yeni">+ Yeni Teknik Ekle</option>
          </select>
          {yeniTeknikGoster && (
            <div className="flex gap-1.5 mt-1.5">
              <input
                value={yeniTeknikAdi}
                onChange={(e) => setYeniTeknikAdi(e.target.value)}
                placeholder="Yeni teknik adı..."
                className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
              />
              <button
                type="button"
                onClick={handleTeknikEkleClick}
                disabled={!yeniTeknikAdi.trim() || teknikEkleniyor}
                className="text-white border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap"
                style={{
                  background: "#56aeff",
                  opacity: !yeniTeknikAdi.trim() || teknikEkleniyor ? 0.6 : 1,
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                {teknikEkleniyor ? "..." : "Ekle"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setYeniTeknikGoster(false);
                  setYeniTeknikAdi("");
                }}
                className="bg-transparent border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 cursor-pointer"
                style={{ fontFamily: "'Nunito', sans-serif" }}
              >
                İptal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}