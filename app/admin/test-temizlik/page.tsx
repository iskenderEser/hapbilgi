// app/admin/test-temizlik/page.tsx
"use client";

import { useState } from "react";

interface TabloSonucu {
  tablo: string;
  durum: "ok" | "hata";
  detay?: string;
}

interface Sonuc {
  tip: "basari" | "hata";
  mesaj: string;
  hatalar?: TabloSonucu[];
}

export default function TestTemizlikPage() {
  const [loading, setLoading] = useState(false);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);

  const handleSil = async () => {
    if (!confirm("Test verilerini silmek istediğinize emin misiniz?")) return;

    setLoading(true);
    setSonuc(null);

    try {
      const res = await fetch("/admin/api/test-verileri-sil", { method: "POST" });
      const d = await res.json();

      if (!res.ok) {
        setSonuc({ tip: "hata", mesaj: d.hata ?? "Test verileri silinemedi." });
      } else {
        const hatalar = (d.detay ?? []).filter((t: TabloSonucu) => t.durum === "hata");
        setSonuc({
          tip: "basari",
          mesaj: d.mesaj ?? "Test verileri silindi.",
          hatalar: hatalar.length > 0 ? hatalar : undefined,
        });
      }
    } catch (err) {
      setSonuc({ tip: "hata", mesaj: "Beklenmeyen bir hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#f9fafb" }}>
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md w-full" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>

        <h1 className="text-lg font-bold text-gray-900 mb-2">Test Temizlik</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Bu sayfa test ortamına özeldir. Buton, üretim/izleme/etkileşim kayıtlarını siler. Firmalar, takımlar, bölgeler, kullanıcılar, ürünler, teknikler ve kategoriler korunur.
        </p>

        <button
          onClick={handleSil}
          disabled={loading}
          className="w-full text-white border-none rounded-lg px-6 py-3 text-sm font-semibold cursor-pointer transition-opacity"
          style={{
            background: "#bc2d0d",
            fontFamily: "'Nunito', sans-serif",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Siliniyor..." : "Test Verilerini Sil"}
        </button>

        {sonuc && (
          <div
            className="mt-5 px-4 py-3 rounded-lg border text-sm"
            style={{
              background: sonuc.tip === "basari" ? "#f0fdf4" : "#fef2f2",
              borderColor: sonuc.tip === "basari" ? "#bbf7d0" : "#fecaca",
              color: sonuc.tip === "basari" ? "#166534" : "#bc2d0d",
            }}
          >
            <div className="font-semibold">{sonuc.mesaj}</div>

            {sonuc.hatalar && sonuc.hatalar.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "#fecaca" }}>
                <div className="text-xs font-bold mb-2" style={{ color: "#bc2d0d" }}>
                  Hata oluşan tablolar:
                </div>
                <ul className="flex flex-col gap-1.5">
                  {sonuc.hatalar.map((h) => (
                    <li key={h.tablo} className="text-xs" style={{ color: "#bc2d0d" }}>
                      <span className="font-semibold">{h.tablo}</span>
                      {h.detay && <span className="text-gray-600"> — {h.detay}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}