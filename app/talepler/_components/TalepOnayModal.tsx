// app/talepler/_components/TalepOnayModal.tsx
//
// Talep gönderim onay modalı (F-01/4 — İskender kararı, fiziksel test bulgusu).
// "Talep Oluştur" → validasyon geçerse bu modal açılır; gönderim ancak Evet'le başlar.
// Hayır → modal kapanır, form aynen kalır. Dosya adlarının burada görünmesi,
// yüklenmemiş/unutulmuş dosyanın gönderim ÖNCESİ fark edilmesini sağlar (emniyet ağı).

"use client";

// Uzun açıklamayı özetler: ilk 4 cümle + " ..." (cümle bulunamayan uzun metinde 300 karakter).
export function aciklamaOzetle(metin: string): string {
  const kirpik = metin.trim();
  if (!kirpik) return "—";
  const cumleler = kirpik.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (cumleler && cumleler.length > 4) {
    return cumleler.slice(0, 4).join("").trim() + " ...";
  }
  if (!cumleler && kirpik.length > 300) return kirpik.slice(0, 300).trim() + " ...";
  return kirpik;
}

export interface TalepOzet {
  urunAdi: string | null;
  teknikAdi: string | null; // teknik-siz hedeflerde null — satır hiç gösterilmez
  soruAdedi: number;
  videoBasiSoru: number;
  aciklama: string;
  dosyaAdlari: string[];
  videoAdi: string | null;
}

interface TalepOnayModalProps {
  acik: boolean;
  ozet: TalepOzet;
  /** V1-4: hazır video kolu — soru seti İU'dan istenecek (hazır video var, hazır set yok).
   *  Modal içeriği açıklama/dosya durumuna göre çeşitlenir. */
  iuSoruSeti?: boolean;
  onEvet: () => void;
  onHayir: () => void;
}

function Satir({ etiket, deger }: { etiket: string; deger: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 w-36 flex-shrink-0">{etiket}</span>
      <span className="text-gray-900 font-semibold min-w-0">{deger}</span>
    </div>
  );
}

export function TalepOnayModal({ acik, ozet, iuSoruSeti = false, onEvet, onHayir }: TalepOnayModalProps) {
  if (!acik) return null;

  // V1-4 çeşitleme (İskender talimatı, 21.07): soru seti İU'dan istenirken açıklama
  // ve/veya ek dosya eksikse gönderim öncesi ayrıca teyit alınır. Video, ek dosya
  // sayılmaz — İU'ya yol gösterecek olan açıklama ve ek dosyalardır.
  const aciklamaVar = ozet.aciklama.trim() !== "";
  const dosyaVar = ozet.dosyaAdlari.length > 0;
  const varyant: "normal" | "ikisiYok" | "biriEksik" | "ikisiVar" = !iuSoruSeti
    ? "normal"
    : !aciklamaVar && !dosyaVar
    ? "ikisiYok"
    : aciklamaVar && dosyaVar
    ? "ikisiVar"
    : "biriEksik";
  const eksikAdi = aciklamaVar ? "dosya eklemeden" : "açıklama yazmadan";

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 flex flex-col gap-4"
        style={{ fontFamily: "'Nunito', sans-serif" }}
      >
        <h3 className="text-base font-bold text-gray-900 m-0">Talep Özeti</h3>

        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl bg-gray-50 p-3.5">
          {ozet.urunAdi && <Satir etiket="Ürün" deger={ozet.urunAdi} />}
          {ozet.teknikAdi && <Satir etiket="Teknik" deger={ozet.teknikAdi} />}
          <Satir etiket="Soru adedi" deger={ozet.soruAdedi} />
          <Satir etiket="Video başı soru" deger={ozet.videoBasiSoru} />
          <Satir
            etiket="Açıklama"
            deger={<span className="font-normal whitespace-pre-wrap break-words">{aciklamaOzetle(ozet.aciklama)}</span>}
          />
          <Satir
            etiket="Ekli dosyalar"
            deger={
              ozet.dosyaAdlari.length === 0 && !ozet.videoAdi ? (
                <span className="font-normal text-gray-400">Dosya eklenmedi</span>
              ) : (
                <span className="font-normal break-words">
                  {[...(ozet.videoAdi ? [`${ozet.videoAdi} (video)`] : []), ...ozet.dosyaAdlari].join(", ")}
                </span>
              )
            }
          />
        </div>

        {iuSoruSeti && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0 leading-relaxed">
            Soru setinin hazırlanması için talebiniz içerik üreticisine yönlendirilecek.
          </p>
        )}

        <p className="text-sm text-gray-800 font-semibold m-0">
          {varyant === "ikisiYok" && "Açıklama yazmak ve/veya dosya eklemek ister misiniz?"}
          {varyant === "biriEksik" && `Talebinizin ${eksikAdi} içerik üreticisine gönderilmesini onaylıyor musunuz?`}
          {(varyant === "normal" || varyant === "ikisiVar") && "Talebi göndermeyi onaylıyor musunuz?"}
        </p>

        <div className="flex justify-end gap-2.5">
          {/* ikisiYok: Evet = forma dön (ekleme yapılacak), Hayır = böyle gönder.
              Diğer varyantlar: Evet = gönder, Hayır = forma dön. */}
          <button
            type="button"
            onClick={varyant === "ikisiYok" ? onEvet : onHayir}
            className="border border-gray-200 bg-white text-gray-700 rounded-lg px-5 py-2 text-xs font-semibold cursor-pointer"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            {varyant === "ikisiYok" ? "Hayır, Böyle Gönder" : "Hayır"}
          </button>
          <button
            type="button"
            onClick={varyant === "ikisiYok" ? onHayir : onEvet}
            className="text-white border-none rounded-lg px-5 py-2 text-xs font-semibold cursor-pointer"
            style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
          >
            {varyant === "ikisiYok" ? "Evet, Ekleyeceğim" : "Evet, Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}
