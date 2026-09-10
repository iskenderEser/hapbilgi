// components/hapbi/HapbiChatModal.tsx
//
// bi platform rehberi ve basit veri soruları için sohbet paneli.

"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Minus, RotateCcw, X } from "lucide-react";
import { useHapbi } from "./HapbiProvider";

function isMobilCihaz(): boolean {
  if (typeof window === "undefined") return false;
  // 1. Standart mobil / tablet genişlik eşiği (iPhone 11 portrait 414px, landscape 896px, Safari masaüstü sitesi modu 980px dahil)
  if (window.innerWidth <= 1024) return true;
  // 2. CSS medya sorgusu
  if (window.matchMedia && window.matchMedia("(max-width: 1024px)").matches) return true;
  // 3. UserAgent (iPhone, iPad, iPod, Android, Mobile)
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)) return true;
  // 4. Dokunmatik ekran ve dar/orta ekran
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0) return true;
  return false;
}

function renderHapbiMetin(metin: string, isUser = false, onLinkClick?: (url: string) => void): React.ReactNode {
  // Regex to match:
  // 1. Bold: \*\*([^*]+)\*\*
  // 2. Italic: \*([^*]+)\*
  // 3. Markdown Link: \[([^\]]+)\]\(([^)]+)\)
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  while ((match = regex.exec(metin)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(metin.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      // Bold
      nodes.push(
        <strong key={`b-${keyIndex++}`} className={`font-bold ${isUser ? "text-white" : "text-gray-900"}`}>
          {renderHapbiMetin(match[2], isUser, onLinkClick)}
        </strong>
      );
    } else if (match[3] !== undefined) {
      // Italic
      nodes.push(
        <em key={`i-${keyIndex++}`} className="italic">
          {renderHapbiMetin(match[3], isUser, onLinkClick)}
        </em>
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      // Markdown Link
      const linkText = match[4];
      let linkUrl = match[5];
      // Eğer kendi domainimizse göreceli URL'e çevir
      try {
        if (linkUrl.startsWith("http")) {
          const u = new URL(linkUrl);
          if (u.hostname.includes("hapbilgi") || u.hostname === "localhost") {
            linkUrl = u.pathname + u.search + u.hash;
          }
        }
      } catch {}

      const isExternal = linkUrl.startsWith("http");

      nodes.push(
        isExternal ? (
          <a
            key={`l-${keyIndex++}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLinkClick?.(linkUrl)}
            className={`${
              isUser
                ? "text-white underline font-bold hover:opacity-80"
                : "text-[#185fa5] font-bold underline underline-offset-2 hover:text-[#0c447c]"
            } transition-colors cursor-pointer`}
          >
            {linkText}
          </a>
        ) : (
          <button
            key={`l-${keyIndex++}`}
            type="button"
            onClick={() => onLinkClick?.(linkUrl)}
            className={`${
              isUser
                ? "text-white underline font-bold hover:opacity-80"
                : "text-[#185fa5] font-bold underline underline-offset-2 hover:text-[#0c447c]"
            } transition-colors cursor-pointer text-left inline p-0 bg-transparent border-none align-baseline`}
          >
            {linkText}
          </button>
        )
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < metin.length) {
    nodes.push(metin.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : metin;
}

export default function HapbiChatModal() {
  const { chatAcik, setChatAcik, mesajlar, yukleniyor, soruSor, temizle } = useHapbi();
  const router = useRouter();
  const pathname = usePathname();
  const oncekiPathRef = useRef(pathname);
  const [girdi, setGirdi] = useState("");
  const mesajlarSonRef = useRef<HTMLDivElement>(null);

  // Otomatik aşağı kaydırma
  useEffect(() => {
    if (chatAcik) {
      mesajlarSonRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mesajlar, chatAcik]);

  // Sayfa değiştiği an (linke tıklandı veya sayfa değişti): Mobilde chat alanını kesin olarak kapat/aşağı indir
  useEffect(() => {
    if (oncekiPathRef.current !== pathname) {
      oncekiPathRef.current = pathname;
      if (isMobilCihaz()) {
        setChatAcik(false);
      }
    }
  }, [pathname, setChatAcik]);

  if (!chatAcik) return null;

  const handleLinkTikla = (url?: string) => {
    // Mobilde linke tıklanınca hedef sayfanın görünmesi için chat modalı küçültülür/indirilir
    if (isMobilCihaz()) {
      setChatAcik(false);
    }
    if (url) {
      router.push(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!girdi.trim() || yukleniyor) return;
    const soru = girdi;
    setGirdi("");
    soruSor(soru);
  };

  return (
    <div
      role="dialog"
      aria-label="bi sohbeti"
      className="hapbi-modal-container fixed z-50 flex flex-col overflow-hidden bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-orange-100 transition-all duration-300"
      style={{
        boxShadow: "0 20px 40px -15px rgba(249, 115, 22, 0.25), 0 0 0 1px rgba(0,0,0,0.06)",
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {/* iPhone 11 ve tüm mobil cihazlarda belirgin, derli toplu ve sayfayı kapatmayan boyutlar */}
      <style jsx>{`
        .hapbi-modal-container {
          bottom: 12px;
          left: 12px;
          right: 12px;
          margin-left: auto;
          margin-right: auto;
          max-width: 360px;
          width: calc(100% - 24px);
          height: 380px;
          max-height: 48vh;
          max-height: 48dvh;
        }
        @media (min-width: 768px) {
          .hapbi-modal-container {
            bottom: 24px;
            right: 24px;
            left: auto;
            margin-left: 0;
            margin-right: 0;
            max-width: none;
            width: 380px;
            height: 530px;
            max-height: 80vh;
          }
        }
      `}</style>
      {/* Üst Başlık (Header) */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white select-none flex-shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md flex-shrink-0">
            <span className="text-orange-600 font-black text-base tracking-tighter lowercase select-none">
              bi
            </span>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 rounded-full border border-white" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white font-extrabold tracking-wide leading-none select-none">
            <span>Sor</span>
            <span className="w-1 h-1 rounded-full bg-white/75 flex-shrink-0" />
            <span>Öğren</span>
            <span className="w-1 h-1 rounded-full bg-white/75 flex-shrink-0" />
            <span>Değiştir</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setChatAcik(false)}
          title="Sohbeti küçült"
          aria-label="Sohbeti küçült"
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={temizle} title="Yeni sohbet" aria-label="Yeni sohbet" className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer border-none transition-colors"><RotateCcw className="w-4 h-4" aria-hidden="true" /></button>
        <button
          type="button"
          onClick={() => setChatAcik(false)}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer border-none transition-colors"
          title="Kapat"
          aria-label="Sohbeti kapat"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        </div>
      </div>

      {/* Mesaj Akış Alanı */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 bg-gradient-to-b from-orange-50/30 to-white">
        {mesajlar.map((m) => {
          const isUser = m.rol === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"} gap-1`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ${
                  isUser
                    ? "bg-[#237ac8] text-white rounded-br-none"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-orange-500/5"
                }`}
              >
                {m.hata && <span className="block text-[10px] font-bold text-amber-700 mb-1">Yanıt alınamadı</span>}
                <div className="whitespace-pre-line font-medium leading-relaxed">
                  {renderHapbiMetin(m.metin, isUser, handleLinkTikla)}
                </div>
                {!!m.yonlendirmeler?.length && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.yonlendirmeler.map((link) => (
                      <button
                        key={link.url}
                        type="button"
                        onClick={() => handleLinkTikla(link.url)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50/90 hover:bg-blue-100 active:bg-blue-200 border border-blue-200/80 px-3 py-1.5 text-xs font-bold text-[#185fa5] shadow-sm hover:text-[#0c447c] active:scale-95 transition-all cursor-pointer select-none"
                      >
                        <span>{link.etiket}</span>
                        <span className="text-[11px] text-blue-400 font-normal">↗</span>
                      </button>
                    ))}
                  </div>
                )}
                {!!m.kaynaklar?.length && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-gray-100 pt-2">
                    <span className="text-[10px] font-semibold text-gray-400">Başvurulan kaynaklar</span>
                    {m.kaynaklar.map((k) =>
                      k.url ? (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => handleLinkTikla(k.url)}
                          title={`Okuma zamanı: ${new Date(k.zaman).toLocaleString("tr-TR")}. Sayfada aynı dönemi seçin.`}
                          className="text-[10px] text-[#185fa5] hover:underline cursor-pointer text-left p-0 bg-transparent border-none"
                        >
                          {k.baslik}
                          {k.donem ? ` · ${k.donem}` : ""}
                        </button>
                      ) : (
                        <span
                          key={k.id}
                          title={`Okuma zamanı: ${new Date(k.zaman).toLocaleString("tr-TR")}`}
                          className="text-[10px] text-gray-500"
                        >
                          {k.baslik}
                          {k.donem ? ` · ${k.donem}` : ""}
                        </span>
                      )
                    )}
                  </div>
                )}

                {/* Eğer mesajda yönlendirici aksiyon varsa */}
                {m.aksiyon && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        if (m.aksiyon?.url) {
                          handleLinkTikla(m.aksiyon.url);
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer border-none transition-all duration-200 hover:scale-[1.02]"
                    >
                      <span>{m.aksiyon.etiket}</span>
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-gray-400 px-1 font-semibold">{m.zaman}</span>
            </div>
          );
        })}

        {yukleniyor && (
          <div className="flex items-center gap-2 text-xs text-orange-600 font-bold bg-orange-50 px-3 py-2 rounded-xl self-start border border-orange-100 animate-pulse">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
            <span>bi kontrol ediyor...</span>
          </div>
        )}

        <div ref={mesajlarSonRef} />
      </div>

      {/* Soru Giriş Alanı */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-2 flex-shrink-0"
      >
        <input
          type="text"
          value={girdi}
          maxLength={2000}
          aria-label="bi'ye sorunuz"
          onChange={(e) => setGirdi(e.target.value)}
          placeholder="Değişimi başlatmak için bi' soru sorun..."
          disabled={yukleniyor}
          className="flex-1 bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white rounded-xl px-3 py-2 text-xs font-medium text-gray-800 placeholder-gray-400 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!girdi.trim() || yukleniyor}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 text-white font-bold text-xs px-3 py-2 rounded-xl cursor-pointer border-none shadow-sm transition-all flex items-center justify-center"
        >
          Gönder
        </button>
      </form>
    </div>
  );
}
