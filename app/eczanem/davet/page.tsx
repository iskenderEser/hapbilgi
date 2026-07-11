// app/eczanem/davet/page.tsx
// Müşteri davet kabul ekranı (girişsiz — İP-§3.2): KVKK onayı + telefon + kod.
// Başarıda üyelik doğar ve oturum açılır; müşteri paneli (U3) hazır olana dek
// yönlendirme yerine başarı ekranı gösterilir.
"use client";

import { useState } from "react";

// GEÇİCİ METİN — İskender'den gelecek gerçek KVKK aydınlatma/onay metniyle
// değiştirilecek (U2 açık ucu). Yapı hazır: metin tek yerde durur.
const KVKK_METNI =
  "HapBilgi Eczanem üyeliği kapsamında ad-soyad ve cep telefonu bilgileriniz, " +
  "yalnızca eczanenizin size video göndermesi ve puan/indirim işlemlerinizin " +
  "yürütülmesi amacıyla işlenir; üçüncü kişilerle paylaşılmaz. Dilediğiniz an " +
  "profilinizden silinme talebinde bulunabilirsiniz.";

export default function DavetKabulPage() {
  const [telefon, setTelefon] = useState("");
  const [otp, setOtp] = useState("");
  const [kvkkOnay, setKvkkOnay] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [tamamlandi, setTamamlandi] = useState(false);

  const kabulEt = async (e: React.FormEvent) => {
    e.preventDefault();
    setHataMesaji(null);
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/api/davet-kabul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefon, otp, kvkk_onay: kvkkOnay }),
      });
      const data = await res.json();
      if (!res.ok) { setHataMesaji(data.hata ?? "Üyelik tamamlanamadı."); return; }
      setTamamlandi(true);
    } catch {
      setHataMesaji("Üyelik tamamlanamadı; yeniden deneyin.");
    } finally {
      setGonderiliyor(false);
    }
  };

  if (tamamlandi) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm text-center">
          <div className="text-3xl mb-3">✅</div>
          <div className="text-lg font-bold text-gray-900 mb-2">Üyeliğiniz tamamlandı</div>
          <div className="text-sm text-gray-500">
            Eczanenizin gönderdiği videolar yakında burada, panelinizde görünecek.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={kabulEt} className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm">
        <div className="text-lg font-bold text-gray-900 mb-1">Eczanem Üyeliği</div>
        <div className="text-xs text-gray-500 mb-5">
          Eczanenizin gönderdiği SMS'teki 6 haneli kodu girin.
        </div>

        {hataMesaji && (
          <div className="mb-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {hataMesaji}
          </div>
        )}

        <label className="block text-xs text-gray-600 mb-1">Cep Telefonu</label>
        <input
          type="tel"
          value={telefon}
          onChange={(e) => setTelefon(e.target.value)}
          placeholder="05xx xxx xx xx"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
          required
        />

        <label className="block text-xs text-gray-600 mb-1">SMS Kodu</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="••••••"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm tracking-widest mb-4"
          required
        />

        <div className="border border-gray-200 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto text-[11px] text-gray-500 leading-relaxed">
          {KVKK_METNI}
        </div>
        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={kvkkOnay}
            onChange={(e) => setKvkkOnay(e.target.checked)}
            className="mt-0.5"
            required
          />
          <span className="text-xs text-gray-600">KVKK aydınlatma metnini okudum, onaylıyorum.</span>
        </label>

        <button
          type="submit"
          disabled={gonderiliyor || !kvkkOnay}
          className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#b45309" }}
        >
          {gonderiliyor ? "Doğrulanıyor…" : "Üyeliği Tamamla"}
        </button>
      </form>
    </div>
  );
}
