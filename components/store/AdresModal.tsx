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
import { MapPin, X } from "lucide-react";
import type { Adres, AdresInput } from "@/lib/tclub/store/tipler";

interface Props {
  acik: boolean;
  mevcutAdres: Adres | null;
  onKapat: () => void;
  onKaydedildi: () => void | Promise<void>;
  hata: (mesaj: string, adim?: string, detay?: string) => void;
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
    const zorunlular: (keyof AdresInput)[] = [
      "baslik", "alici_adi", "telefon", "il", "ilce", "adres_detay",
    ];
    for (const alan of zorunlular) {
      const deger = form[alan];
      if (!deger || typeof deger !== "string" || deger.trim() === "") {
        hata(`${alan} alanı zorunludur.`, "validasyon");
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

      basari(mevcutAdres ? "Adres güncellendi." : "Adres başarıyla eklendi.");
      setKaydediliyor(false);
      await onKaydedildi();
      onKapat();
    } catch (err) {
      hata("Kaydederken hata oluştu.", "fetch", String(err));
      setKaydediliyor(false);
    }
  };

  if (!acik) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl border border-[#dfe7f1] bg-white shadow-2xl"
        style={{ maxHeight: "90vh", fontFamily: "'Nunito', sans-serif" }}
      >
        {/* Başlık */}
        <div className="flex items-center justify-between border-b border-[#edf1f5] px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#edf6fd] text-[#237ac8]">
              <MapPin size={16} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#1a2d42]">
                {mevcutAdres ? "Adresi Düzenle" : "Yeni Teslimat Adresi Ekle"}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onKapat}
            disabled={kaydediliyor}
            className="flex size-8 items-center justify-center rounded-lg text-[#7b8da5] hover:bg-[#f0f4f9] disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Alanı */}
        <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-4">
          <FormAlani label="Adres Başlığı (örn. Evim, Eczane, Ofis)">
            <input
              type="text"
              value={form.baslik}
              onChange={(e) => handleChange("baslik", e.target.value)}
              disabled={kaydediliyor}
              className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
              placeholder="Örn: Ev Adresim"
            />
          </FormAlani>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormAlani label="Alıcı Adı Soyadı">
              <input
                type="text"
                value={form.alici_adi}
                onChange={(e) => handleChange("alici_adi", e.target.value)}
                disabled={kaydediliyor}
                className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
                placeholder="Ad Soyad"
              />
            </FormAlani>

            <FormAlani label="İletişim Telefonu">
              <input
                type="tel"
                value={form.telefon}
                onChange={(e) => handleChange("telefon", e.target.value)}
                disabled={kaydediliyor}
                className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
                placeholder="05XX XXX XX XX"
              />
            </FormAlani>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormAlani label="İl">
              <input
                type="text"
                value={form.il}
                onChange={(e) => handleChange("il", e.target.value)}
                disabled={kaydediliyor}
                className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
                placeholder="İstanbul"
              />
            </FormAlani>

            <FormAlani label="İlçe">
              <input
                type="text"
                value={form.ilce}
                onChange={(e) => handleChange("ilce", e.target.value)}
                disabled={kaydediliyor}
                className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
                placeholder="Kadıköy"
              />
            </FormAlani>
          </div>

          <FormAlani label="Açık Adres (Mahalle, cadde, sokak, bina ve daire no)">
            <textarea
              value={form.adres_detay}
              onChange={(e) => handleChange("adres_detay", e.target.value)}
              disabled={kaydediliyor}
              rows={3}
              className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
              placeholder="Mahalle, sokak, bina no, daire no..."
            />
          </FormAlani>

          <FormAlani label="Posta Kodu (Opsiyonel)">
            <input
              type="text"
              value={form.posta_kodu ?? ""}
              onChange={(e) => handleChange("posta_kodu", e.target.value)}
              disabled={kaydediliyor}
              className="w-full rounded-xl border border-[#dce5ee] bg-[#f8fafc] px-3.5 py-2 text-xs font-bold text-[#1f334d] placeholder-[#95a6bb] focus:border-[#237ac8] focus:bg-white focus:outline-none"
              placeholder="34000"
            />
          </FormAlani>

          <label className="mt-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(form.varsayilan_mi)}
              onChange={(e) => handleChange("varsayilan_mi", e.target.checked)}
              disabled={kaydediliyor}
              className="size-4 rounded text-[#237ac8] focus:ring-[#237ac8]"
            />
            <span className="text-xs font-extrabold text-[#3a516b]">
              Bu adresi varsayılan teslimat adresi olarak ayarla
            </span>
          </label>
        </div>

        {/* Aksiyon Butonları */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#edf1f5] px-6 py-4">
          <button
            type="button"
            onClick={onKapat}
            disabled={kaydediliyor}
            className="rounded-xl border border-[#dce5ee] bg-white px-4 py-2.5 text-xs font-extrabold text-[#5f738c] hover:bg-[#f8fafc]"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleKaydet}
            disabled={kaydediliyor}
            className="rounded-xl bg-[#237ac8] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-[#1d69aa] disabled:opacity-50"
          >
            {kaydediliyor ? "Kaydediliyor..." : "Adresi Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormAlani({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#7a8da5]">
        {label}
      </label>
      {children}
    </div>
  );
}