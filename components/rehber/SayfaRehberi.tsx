// components/rehber/SayfaRehberi.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Lightbulb, Compass, ChevronLeft } from "lucide-react";
import { getSayfaRehberi, type SayfaRehberBilgisi, type AltModalBilgisi, type RehberMadde } from "@/lib/rehber/sayfaRehberi";

interface Props {
  anahtar: string;
  etiket?: string;
  boyut?: "sm" | "md" | "lg";
  hizalama?: "sol" | "sag";
  className?: string;
}

export default function SayfaRehberi({
  anahtar,
  etiket,
  boyut = "md",
  hizalama = "sol",
  className = "",
}: Props) {
  const [acik, setAcik] = useState(false);
  const [aktifAltModal, setAktifAltModal] = useState<AltModalBilgisi | null>(null);
  const [konum, setKonum] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const rehber: SayfaRehberBilgisi | null = getSayfaRehberi(anahtar);

  // Portal pozisyonunu hesaplama (overflow-hidden engeline takılmaması için fixed portal)
  useEffect(() => {
    if (!acik || !containerRef.current) return;

    const guncelleKonum = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const kartGenislik = Math.min(420, window.innerWidth - 32);

      let left = rect.left;
      if (hizalama === "sag" || left + kartGenislik > window.innerWidth - 16) {
        left = rect.right - kartGenislik;
      }
      // Ekran kenarlarına taşmayı engelle
      left = Math.max(16, Math.min(left, window.innerWidth - kartGenislik - 16));

      // Dikey konum: altta yer yoksa üste aç
      let top = rect.bottom + 8;
      const tahminiYukseklik = 380;
      if (top + tahminiYukseklik > window.innerHeight && rect.top > tahminiYukseklik) {
        top = Math.max(16, rect.top - tahminiYukseklik - 8);
      }

      setKonum({
        top,
        left,
        width: kartGenislik,
      });
    };

    guncelleKonum();
    window.addEventListener("scroll", guncelleKonum, true);
    window.addEventListener("resize", guncelleKonum);

    return () => {
      window.removeEventListener("scroll", guncelleKonum, true);
      window.removeEventListener("resize", guncelleKonum);
    };
  }, [acik, hizalama, aktifAltModal]);

  // Dışarı tıklama (Outside Click) veya Escape ile kapatma
  useEffect(() => {
    if (!acik) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const tiklamaButonda = containerRef.current?.contains(target);
      const tiklamaKartta = popoverRef.current?.contains(target);

      if (!tiklamaButonda && !tiklamaKartta) {
        setAcik(false);
        setAktifAltModal(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (aktifAltModal) {
          setAktifAltModal(null);
        } else {
          setAcik(false);
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [acik, aktifAltModal]);

  if (!rehber) return null;

  // Buton boyutu (16px kompakt standart)
  const boyutSiniflari = {
    sm: "w-3.5 h-3.5 text-[8px]",
    md: "w-4 h-4 text-[10px]",
    lg: "w-[19px] h-[19px] text-[11px]",
  };

  const handleKapat = () => {
    setAcik(false);
    setAktifAltModal(null);
  };

  // Açıklama içindeki link kelimeyi tıklanabilir hale getiren yardımcı
  const aciklamaFormatla = (m: RehberMadde): ReactNode => {
    if (!m.linkKelime || !m.altModal || !m.aciklama.includes(m.linkKelime)) {
      return m.aciklama;
    }

    const parcalar = m.aciklama.split(m.linkKelime);
    return (
      <>
        {parcalar[0]}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAktifAltModal(m.altModal!);
          }}
          className="font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2 inline cursor-pointer"
        >
          {m.linkKelime}
        </button>
        {parcalar.slice(1).join(m.linkKelime)}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Tek Daire İçinde Tipografik (i) Bilgi Butonu */}
      <button
        type="button"
        onClick={() => {
          if (acik) {
            handleKapat();
          } else {
            setAcik(true);
          }
        }}
        aria-label={`${rehber.baslik} rehberini ${acik ? "kapat" : "göster"}`}
        aria-expanded={acik}
        title="Bu ekran ne işe yarar?"
        className={`inline-flex items-center justify-center font-serif font-bold italic select-none rounded-full transition-all duration-150 cursor-pointer ${
          acik
            ? "bg-blue-600 text-white shadow-md scale-105"
            : "bg-blue-50 text-[#bc2d0d] hover:bg-blue-100 hover:text-[#991b1b] hover:scale-105 active:scale-95 border border-blue-200/90 shadow-sm"
        } ${boyutSiniflari[boyut]}`}
        style={{ fontFamily: "'Georgia', 'Cambria', 'Times New Roman', serif" }}
      >
        <span className="leading-none transform -translate-y-[0.5px]">i</span>
        {etiket && <span className="font-sans not-italic font-bold text-xs ml-1 pr-1">{etiket}</span>}
      </button>

      {/* Kalıcı Açılır Bilgi Kartı (Portal ile Body'ye Eklenir - Overflow Clipping Olmaz) */}
      {acik &&
        konum &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-modal="false"
            aria-label={aktifAltModal ? aktifAltModal.baslik : rehber.baslik}
            className="fixed bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 animate-in fade-in zoom-in-95 duration-150 text-left"
            style={{
              top: `${konum.top}px`,
              left: `${konum.left}px`,
              width: `${konum.width}px`,
              zIndex: 99999,
              fontFamily: "'Nunito', sans-serif",
              boxShadow: "0 20px 35px -10px rgba(0, 0, 0, 0.22), 0 2px 8px rgba(0, 0, 0, 0.08)",
            }}
          >
            {aktifAltModal ? (
              /* --- ALT MODAL (Örn: ÜRETİM VARYANTLARI) GÖRÜNÜMÜ --- */
              <div>
                {/* Başlık ve Geri / Kapat */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setAktifAltModal(null)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={15} strokeWidth={2.5} />
                    Geri Dön
                  </button>
                  <button
                    type="button"
                    onClick={handleKapat}
                    aria-label="Kapat"
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Alt Modal Başlığı */}
                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    Detay Rehberi
                  </span>
                  <h3 className="text-sm font-extrabold text-gray-900 leading-tight mt-1">
                    {aktifAltModal.baslik}
                  </h3>
                  {aktifAltModal.altBaslik && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      {aktifAltModal.altBaslik}
                    </p>
                  )}
                </div>

                {/* Varyant Kartları Listesi */}
                <div className="mt-3.5 space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {aktifAltModal.kartlar.map((k) => (
                    <div
                      key={k.kod}
                      className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-extrabold text-gray-900">
                          {k.baslik}
                        </span>
                        {k.rozet && (
                          <span className="text-[10px] font-semibold bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap shadow-2xs">
                            {k.rozet}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed m-0">
                        {k.aciklama}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Alt Kapatma Çubuğu */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <button
                    type="button"
                    onClick={() => setAktifAltModal(null)}
                    className="text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                  >
                    ← Ana Rehbere Dön
                  </button>
                  <button
                    type="button"
                    onClick={handleKapat}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Anladım
                  </button>
                </div>
              </div>
            ) : (
              /* --- ANA REHBER GÖRÜNÜMÜ --- */
              <div>
                {/* Başlık ve Kapat [X] Butonu */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Compass size={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                        Sayfa Rehberi
                      </span>
                      <h3 className="text-sm font-extrabold text-gray-900 leading-tight mt-0.5">
                        {rehber.baslik}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleKapat}
                    aria-label="Rehberi Kapat"
                    className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Özet Açıklama */}
                <p className="text-xs sm:text-[13px] text-gray-600 leading-relaxed mt-3">
                  {rehber.ozet}
                </p>

                {/* Maddeler / Ne Nerede Yapılır? */}
                {rehber.maddeler.length > 0 && (
                  <div className="mt-4 space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                      Neler Yapabilirsiniz?
                    </div>
                    {rehber.maddeler.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2 rounded-xl bg-gray-50/80 hover:bg-gray-50 transition-colors border border-gray-100/80"
                      >
                        <span className="text-sm flex-shrink-0 leading-tight mt-0.5">
                          {m.ikon ?? "📌"}
                        </span>
                        <div className="text-xs leading-normal">
                          <strong className="text-gray-900 font-bold block mb-0.5">
                            {m.baslik}
                          </strong>
                          <span className="text-gray-600">
                            {aciklamaFormatla(m)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* İpucu / Püf Noktası Kutusu */}
                {rehber.ipucu && (
                  <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2 text-xs text-amber-900">
                    <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong className="font-bold text-amber-950">İpucu: </strong>
                      <span>{rehber.ipucu}</span>
                    </div>
                  </div>
                )}

                {/* Alt Kapatma Çubuğu */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>[✕] ile veya dışarı tıklayarak kapatabilirsiniz</span>
                  <button
                    type="button"
                    onClick={handleKapat}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    Anladım
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
