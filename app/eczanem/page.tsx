// app/eczanem/page.tsx
// Müşteri paneli — U3 iskeleti: hoş geldin + içerik placeholder'ları +
// profil/silme bölümü. Videolar U7'de, bakiye/fişler Faz 3-4'te bu iskelete
// oturur. Bekçi /eczanem'i korur; sayfa yine de kimlik_turu doğrular.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";

export default function EczanemPanelPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();

  const musteri = !!kullanici && kullanici.kimlik_turu === "musteri";

  // Silme akışı durumu: kapali → kod-istendi → (API) → silindi
  const [silmeAdimi, setSilmeAdimi] = useState<"kapali" | "kod" | "silindi">("kapali");
  const [silmeOtp, setSilmeOtp] = useState("");
  const [silmeMesaji, setSilmeMesaji] = useState<string | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/eczanem/giris"); return; }
    if (!musteri) { router.replace("/ana-sayfa"); return; }
  }, [kullanici, yukleniyor, musteri, router]);

  const silmeKoduIste = async () => {
    setSilmeMesaji(null);
    setIsleniyor(true);
    try {
      const res = await fetch("/eczanem/api/silme-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSilmeMesaji(data.hata ?? "Kod gönderilemedi."); return; }
      setSilmeAdimi("kod");
    } catch {
      setSilmeMesaji("Kod gönderilemedi; yeniden deneyin.");
    } finally {
      setIsleniyor(false);
    }
  };

  const uyeligiSil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSilmeMesaji(null);
    setIsleniyor(true);
    try {
      const res = await fetch("/eczanem/api/sil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: silmeOtp }),
      });
      const data = await res.json();
      if (!res.ok) { setSilmeMesaji(data.hata ?? "Silme tamamlanamadı."); return; }
      setSilmeAdimi("silindi");
    } catch {
      setSilmeMesaji("Silme tamamlanamadı; yeniden deneyin.");
    } finally {
      setIsleniyor(false);
    }
  };

  if (silmeAdimi === "silindi") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-sm text-center">
          <div className="text-3xl mb-3">👋</div>
          <div className="text-lg font-bold text-gray-900 mb-2">Üyeliğiniz silindi</div>
          <div className="text-sm text-gray-500">
            Kişisel verileriniz kalıcı olarak silindi. Dilerseniz eczanenizden
            yeni bir davetle tekrar üye olabilirsiniz.
          </div>
        </div>
      </div>
    );
  }

  if (yukleniyor || !kullanici || !musteri) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Hoş geldiniz{kullanici.ad ? `, ${kullanici.ad}` : ""}</h1>
          <div className="text-xs text-gray-500 mt-1">HapBilgi Eczanem — eczanenizin size gönderdiği videolar ve puanlarınız.</div>
        </div>

        {/* Faz 3-4 placeholder'ları: videolar (U7), bakiye + indirim (U8) bu bölümlere oturur */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Videolarım</div>
          <div className="text-sm text-gray-400">Eczanenizin gönderdiği videolar yakında burada görünecek.</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Puanlarım</div>
          <div className="text-sm text-gray-400">Video izleyip soru cevapladıkça puanlarınız burada birikecek.</div>
        </div>

        {/* Profil / KVKK silme (İP-§3.6) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-700 mb-2">Profil</div>
          <div className="text-xs text-gray-500 mb-4">
            Telefon: {kullanici.telefon ? `••• ••• ${kullanici.telefon.slice(-4)}` : "-"}
          </div>

          {silmeMesaji && (
            <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {silmeMesaji}
            </div>
          )}

          {silmeAdimi === "kapali" ? (
            <button
              onClick={silmeKoduIste}
              disabled={isleniyor}
              className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              {isleniyor ? "Bekleyin…" : "Üyeliğimi kalıcı olarak silmek istiyorum"}
            </button>
          ) : (
            <form onSubmit={uyeligiSil} className="border border-red-200 bg-red-50 rounded-lg p-3">
              <div className="text-xs text-red-700 mb-2">
                Bu işlem geri alınamaz: puanlarınız dahil tüm kişisel verileriniz silinir.
                Telefonunuza gönderilen teyit kodunu girerek onaylayın.
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={silmeOtp}
                  onChange={(e) => setSilmeOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm tracking-widest"
                  required
                />
                <button
                  type="submit"
                  disabled={isleniyor}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 disabled:opacity-50"
                >
                  {isleniyor ? "Siliniyor…" : "Kalıcı Olarak Sil"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSilmeAdimi("kapali"); setSilmeOtp(""); setSilmeMesaji(null); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-600 border border-gray-300"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
