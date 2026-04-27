// components/raporlar/BegeniFavoriListesi.tsx
'use client';

const BORDO = '#bc2d0d';
const GRI_METIN = '#737373';
const KOYU_METIN = '#111827';
const GRI_ZEMIN = '#f9fafb';

interface VideoItem {
  yayin_id: string;
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
}

export default function BegeniFavoriListesi({ begeniListesi, favoriListesi, isUtt = false }: Props) {
  if (begeniListesi.length === 0 && favoriListesi.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: GRI_METIN }}>
        beğeni & favori sıralaması
      </div>
      <div className="grid grid-cols-2 gap-3">

        {/* En Çok Beğenilen */}
        <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BORDO} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>En Çok Beğenilen</span>
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
                      <div className="text-xs truncate" style={{ color: GRI_METIN }}>{v.teknik_adi}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isUtt && v.benim_begenim && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FAECE7', color: BORDO }}>senin</span>
                    )}
                    <span className="text-xs font-medium" style={{ color: BORDO }}>{v.begeni_sayisi}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* En Çok Favoriye Eklenen */}
        <div className="border rounded-xl p-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-2 mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BORDO} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: KOYU_METIN }}>En Çok Favoriye Eklenen</span>
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
                      <div className="text-xs truncate" style={{ color: GRI_METIN }}>{v.teknik_adi}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isUtt && v.benim_favorim && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#FAECE7', color: BORDO }}>senin</span>
                    )}
                    <span className="text-xs font-medium" style={{ color: BORDO }}>{v.favori_sayisi}</span>
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