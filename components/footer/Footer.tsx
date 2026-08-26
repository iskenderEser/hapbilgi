// components/footer/Footer.tsx
//
// HapBilgi kurumsal genel altbilgi (Footer) bileşeni.
// Zemin: #f3f4f7 (Login açık gri), Yükseklik: Navbar'dan %20 daha yüksek,
// Sol: Dikey 3D logo + ETBİS barkodu, Orta: Sözleşmeler (Modal), Sağ: İletişim, Alt: Telif satırı.

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { SOZLESMELER_DATA, type SozlesmeDetay } from "./sozlesmelerData";
import SozlesmeModal from "./SozlesmeModal";

export default function Footer() {
  const [aktifSozlesme, setAktifSozlesme] = useState<SozlesmeDetay | null>(null);

  const handleModalAc = (key: "gizlilik" | "kvkk" | "cerez" | "mesafeli_satis") => {
    setAktifSozlesme(SOZLESMELER_DATA[key] ?? null);
  };

  return (
    <>
      <footer
        className="w-full border-t border-gray-200/80 px-6 py-8 md:px-12 md:py-10 min-h-[92px] text-gray-700 select-none"
        style={{
          background: "#f3f4f7",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col gap-8">
          {/* Üst Kısım: 3 Kolonlu Ana Yerleşim */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 items-start">
            
            {/* 1. SOL KOLON: Dikey Gri Logo & ETBİS Kare Barkod */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-acik-zemin.png?v=4"
                  alt="HapBilgi"
                  className="h-14 w-auto object-contain drop-shadow-sm hover:scale-105 transition-transform duration-200"
                />
              </div>

              {/* ETBİS Kare Barkodu */}
              <div className="mt-1 flex flex-col items-center md:items-start">
                <img
                  src="/etbis-karekod.png"
                  alt="ETBİS Kayıtlı Site - Elektronik Ticaret Bilgi Sistemi"
                  className="h-14 w-auto object-contain rounded-md shadow-xs border border-gray-200/60 bg-white p-1 hover:shadow-sm transition-shadow"
                />
                <span className="text-[10px] font-semibold text-gray-400 mt-1">
                  T.C. Ticaret Bakanlığı ETBİS Kayıtlı
                </span>
              </div>
            </div>

            {/* 2. ORTA KOLON: Yasal Sözleşmeler (Modal Açan Butonlar) */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <h4 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3.5">
                Yasal Bilgiler & Sözleşmeler
              </h4>
              <ul className="flex flex-col gap-2 p-0 m-0 list-none text-xs font-bold text-gray-600">
                <li>
                  <button
                    type="button"
                    onClick={() => handleModalAc("gizlilik")}
                    className="p-0 border-none bg-transparent text-gray-600 hover:text-[#bc2d0d] transition-colors cursor-pointer text-xs font-bold"
                  >
                    Gizlilik Politikası
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleModalAc("kvkk")}
                    className="p-0 border-none bg-transparent text-gray-600 hover:text-[#bc2d0d] transition-colors cursor-pointer text-xs font-bold"
                  >
                    KVKK Aydınlatma Metni
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleModalAc("cerez")}
                    className="p-0 border-none bg-transparent text-gray-600 hover:text-[#bc2d0d] transition-colors cursor-pointer text-xs font-bold"
                  >
                    Çerez Politikası
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleModalAc("mesafeli_satis")}
                    className="p-0 border-none bg-transparent text-gray-600 hover:text-[#bc2d0d] transition-colors cursor-pointer text-xs font-bold"
                  >
                    Mesafeli Satış Sözleşmesi
                  </button>
                </li>
              </ul>
            </div>

            {/* 3. SAĞ KOLON: Şirket Adı, Adres, Tel ve E-posta */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left text-xs text-gray-600 leading-relaxed">
              <h4 className="text-xs font-black text-gray-900 tracking-wider uppercase mb-3.5">
                İletişim & Künye
              </h4>
              <div className="font-extrabold text-sm text-gray-900 mb-1">
                Mill Danışmanlık
              </div>
              <div className="text-gray-500 max-w-xs mb-2">
                Göktürk Merkez Mahallesi, İstanbul Caddesi, No:52, Göktürk / İstanbul
              </div>
              <div className="flex flex-col gap-1 text-gray-600 font-semibold">
                <div>
                  <span className="text-gray-400">Telefon: </span>
                  <a
                    href="tel:05324333145"
                    className="text-gray-700 hover:text-[#bc2d0d] transition-colors no-underline font-bold"
                  >
                    0532 433 3145
                  </a>
                </div>
                <div>
                  <span className="text-gray-400">E-posta: </span>
                  <a
                    href="mailto:info@mill.tr"
                    className="text-gray-700 hover:text-[#bc2d0d] transition-colors no-underline font-bold"
                  >
                    info@mill.tr
                  </a>
                </div>
              </div>
            </div>

          </div>

          {/* 4. EN ALT ORTA SATIR: Tek Satır Telif Hakkı */}
          <div className="pt-5 border-t border-gray-200/60 text-center">
            <p className="text-xs font-bold text-gray-400 m-0">
              ©2026 Mill Danışmanlık Her Hakkı Saklıdır.
            </p>
          </div>
        </div>
      </footer>

      {/* Sözleşme Görüntüleme Modalı */}
      <SozlesmeModal
        sozlesme={aktifSozlesme}
        onKapat={() => setAktifSozlesme(null)}
      />
    </>
  );
}
