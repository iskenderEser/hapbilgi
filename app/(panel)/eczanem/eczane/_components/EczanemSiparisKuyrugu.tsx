// app/eczanem/eczane/_components/EczanemSiparisKuyrugu.tsx
// Eczacı sipariş onay kuyruğu (İP-§8.1.4): bekleyen siparişler (müşteri son-4-
// hane, ürün, adet, indirim) → Onayla (atomik FIFO düşüm) / Reddet (düşür).
// Onay sonrası fiş bilgisi (işlem kodu) müşteri panelinde de görünür.

"use client";

import { useCallback, useEffect, useState } from "react";

interface Siparis {
  siparis_id: string;
  musteri_maskeli: string;
  urun_adi: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  created_at: string;
}

interface Props {
  hata: (mesaj: string, adim?: string) => void;
  basari: (mesaj: string) => void;
}

const DURUM: Record<string, { etiket: string; renk: string }> = {
  onaylandi: { etiket: "Onaylandı", renk: "#15803d" },
  dustu: { etiket: "Düştü", renk: "#737373" },
};

export default function EczanemSiparisKuyrugu({ hata, basari }: Props) {
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [isliyor, setIsliyor] = useState<string | null>(null);

  const cek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/eczane/api/siparisler");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Siparişler yüklenemedi.", "sipariş"); return; }
      setSiparisler(d.siparisler ?? []);
    } catch { hata("Siparişler yüklenemedi.", "sipariş"); }
  }, [hata]);

  useEffect(() => { cek(); }, [cek]);

  const islem = async (siparis_id: string, aksiyon: "onayla" | "reddet") => {
    setIsliyor(siparis_id);
    try {
      const res = await fetch("/eczanem/eczane/api/siparisler", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siparis_id, aksiyon }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "İşlem başarısız.", "sipariş"); return; }
      basari(aksiyon === "onayla" ? `Onaylandı — indirim ${Number(d.indirim_tl).toFixed(2)} TL (${d.islem_kodu}).` : "Sipariş düşürüldü.");
      cek();
    } catch { hata("İşlem başarısız.", "sipariş"); }
    finally { setIsliyor(null); }
  };

  const bekleyen = siparisler.filter((s) => s.durum === "bekliyor");
  const gecmis = siparisler.filter((s) => s.durum !== "bekliyor");

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="text-sm font-semibold text-gray-700 mb-1">Sipariş Onay Kuyruğu</div>
      <div className="text-xs text-gray-500 mb-4">
        Müşteri barkod okutup sipariş gönderdiğinde burada belirir. Onayladığınızda puan
        o anda atomik olarak düşer ve fiş kesinleşir; reddederseniz sipariş düşer, puan düşmez.
      </div>

      {bekleyen.length === 0 ? (
        <div className="text-sm text-gray-400 mb-2">Onay bekleyen sipariş yok.</div>
      ) : (
        <div className="divide-y divide-gray-100 mb-3">
          {bekleyen.map((s) => (
            <div key={s.siparis_id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-800 truncate">{s.urun_adi} <span className="text-xs text-gray-400">×{s.adet}</span></div>
                <div className="text-xs text-gray-400">{s.musteri_maskeli} • {s.indirim_tl.toFixed(2)} TL indirim</div>
              </div>
              <div className="flex gap-2 whitespace-nowrap">
                <button
                  onClick={() => islem(s.siparis_id, "onayla")}
                  disabled={isliyor === s.siparis_id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: "#15803d" }}
                >
                  {isliyor === s.siparis_id ? "…" : "Onayla"}
                </button>
                <button
                  onClick={() => islem(s.siparis_id, "reddet")}
                  disabled={isliyor === s.siparis_id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-300 disabled:opacity-40"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {gecmis.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">Geçmiş</div>
          <div className="divide-y divide-gray-100">
            {gecmis.map((s) => {
              const d = DURUM[s.durum] ?? { etiket: s.durum, renk: "#737373" };
              return (
                <div key={s.siparis_id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-700 truncate">{s.urun_adi} <span className="text-xs text-gray-400">×{s.adet}</span></div>
                    <div className="text-xs text-gray-400 truncate">
                      {s.musteri_maskeli}
                      {s.durum === "onaylandi" && s.islem_kodu && ` • ${s.indirim_tl.toFixed(2)} TL • ${s.islem_kodu}`}
                    </div>
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: d.renk }}>{d.etiket}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
