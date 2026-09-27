// components/raporlar/BegeniFavoriListesi.tsx
'use client';

import { Heart } from 'lucide-react';

const BEGENI_RENGI = '#ef4444';
const FAVORI_RENGI = '#2563eb';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';

interface VideoItem {
  yayin_id: string;
  talep_no?: number | null;
  urun_adi: string;
  teknik_adi: string;
  begeni_sayisi?: number;
  favori_sayisi?: number;
  benim_begenim?: boolean;
  benim_favorim?: boolean;
}

interface Props {
  begeniListesi: VideoItem[];
  favoriListesi: VideoItem[];
  isUtt?: boolean;
  modern?: boolean;
  basligiGizle?: boolean;
  birlesik?: boolean;
}

export default function BegeniFavoriListesi({
  begeniListesi,
  favoriListesi,
  isUtt = false,
  modern = false,
  basligiGizle = false,
  birlesik = false,
}: Props) {
  if (!birlesik && begeniListesi.length === 0 && favoriListesi.length === 0) return null;

  return (
    <div className={birlesik
      ? "flex h-full flex-col justify-center rounded-2xl border border-[#e8edf3] bg-white p-4 shadow-[0_8px_26px_rgba(36,64,98,0.05)]"
      : "mb-5"}
    >
      {birlesik && (
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-extrabold text-[#20324c]">
            Ayın Beğenilenleri ve Favorilenleri
          </h2>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf6ff] text-[#237ac8]">
            <Heart className="h-4 w-4" />
          </div>
        </div>
      )}
      {!basligiGizle && (
        <div className={`mb-2 text-xs font-bold uppercase tracking-wider ${modern ? "text-[#66809f]" : ""}`} style={modern ? undefined : { color: GRI_METIN }}>
          beğeni & favori sıralaması
        </div>
      )}
      <div className={`grid gap-4 ${birlesik ? "flex-1 grid-cols-2 items-center" : "grid-cols-1 md:grid-cols-2"}`}>

        {/* En Çok Beğenilen */}
        <div className={birlesik
          ? "min-w-0"
          : `${modern ? "rounded-2xl border border-[#e8edf3] bg-white shadow-[0_8px_26px_rgba(36,64,98,0.05)]" : "rounded-xl border"} p-4`}
          style={modern || birlesik ? undefined : { borderColor: '#e5e7eb' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={BEGENI_RENGI} stroke={BEGENI_RENGI} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: BEGENI_RENGI }}>En Çok Beğenilenler</span>
          </div>
          {begeniListesi.length === 0 ? (
            <div className="text-xs" style={{ color: GRI_METIN }}>Henüz beğeni yok.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {begeniListesi.map((v, i) => (
                <div key={v.yayin_id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: GRI_METIN, width: 16 }}>{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: KOYU_METIN }}>{v.urun_adi}</div>
                      <div className="text-xs truncate" style={{ color: GRI_METIN }}>
                        {[v.teknik_adi, v.talep_no ? `#${v.talep_no}` : null].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isUtt && v.benim_begenim && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: BEGENI_RENGI }}>senin</span>
                    )}
                    <span className="text-xs font-medium" style={{ color: BEGENI_RENGI }}>{v.begeni_sayisi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* En Çok Favoriye Eklenen */}
        <div className={birlesik
          ? "min-w-0 border-l border-[#e8edf3] pl-4"
          : `${modern ? "rounded-2xl border border-[#e8edf3] bg-white shadow-[0_8px_26px_rgba(36,64,98,0.05)]" : "rounded-xl border"} p-4`}
          style={modern || birlesik ? undefined : { borderColor: '#e5e7eb' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={FAVORI_RENGI} stroke={FAVORI_RENGI} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: FAVORI_RENGI }}>En Çok Favorilenenler</span>
          </div>
          {favoriListesi.length === 0 ? (
            <div className="text-xs" style={{ color: GRI_METIN }}>Henüz favori yok.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {favoriListesi.map((v, i) => (
                <div key={v.yayin_id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium flex-shrink-0" style={{ color: GRI_METIN, width: 16 }}>{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: KOYU_METIN }}>{v.urun_adi}</div>
                      <div className="text-xs truncate" style={{ color: GRI_METIN }}>
                        {[v.teknik_adi, v.talep_no ? `#${v.talep_no}` : null].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isUtt && v.benim_favorim && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: '#DBEAFE', color: FAVORI_RENGI }}>senin</span>
                    )}
                    <span className="text-xs font-medium" style={{ color: FAVORI_RENGI }}>{v.favori_sayisi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
