// app/eclub/panel/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubPanel, type PanelOneri } from "./_hooks/useEclubPanel";
import EclubVideoOynatici from "./_components/EclubVideoOynatici";

const KISI_ROL_ETIKETLERI: Record<string, string> = {
  eczaci: "Eczacı",
  eczane_teknisyeni: "Eczane Teknisyeni",
};

export default function EclubPanelPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";
  const hazir = !authYukleniyor && eclubKisi;

  const { kisi, oneriler, loading, veriCek } = useEclubPanel({ hazir, hata });

  const [seciliOneri, setSeciliOneri] = useState<PanelOneri | null>(null);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
  }, [kullanici, authYukleniyor, eclubKisi, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  if (authYukleniyor || !kullanici || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const gunKalan = (bitis: string): number => {
    const fark = new Date(bitis).getTime() - Date.now();
    return Math.max(0, Math.ceil(fark / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-3xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        {seciliOneri ? (
          <EclubVideoOynatici
            oneri={{
              oneri_id: seciliOneri.oneri_id,
              yayin_id: seciliOneri.yayin_id,
              urun_adi: seciliOneri.urun_adi,
              teknik_adi: seciliOneri.teknik_adi,
              video_url: seciliOneri.video_url,
            }}
            onKapat={() => { setSeciliOneri(null); veriCek(); }}
            onTamamlandi={veriCek}
            hata={hata}
            basari={basari}
          />
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-gray-900 m-0">
                Merhaba{kisi ? `, ${kisi.ad}` : ""}
              </h1>
              <p className="text-sm text-gray-500 m-0">
                {kisi ? KISI_ROL_ETIKETLERI[kisi.rol] ?? kisi.rol : ""} · Size önerilen videolar
              </p>
            </div>

            {oneriler.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
                <p className="text-sm text-gray-400 m-0">Şu anda size önerilen aktif video yok.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {oneriler.map((o) => (
                  <div key={o.oneri_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col sm:flex-row">
                    <div className="sm:w-48 flex-shrink-0 bg-gray-100 flex items-center justify-center" style={{ minHeight: "120px" }}>
                      {o.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.thumbnail_url} alt={o.urun_adi} className="w-full h-full object-cover" style={{ maxHeight: "160px" }} />
                      ) : (
                        <span className="text-xs text-gray-400">Görsel yok</span>
                      )}
                    </div>

                    <div className="flex-1 p-4 flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-gray-900">{o.urun_adi}</span>
                        {o.teknik_adi && <span className="text-xs text-gray-500">{o.teknik_adi}</span>}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mt-auto">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8", border: "0.5px solid #93c5fd" }}>
                          {gunKalan(o.oneri_bitis)} gün kaldı
                        </span>
                        {o.izlendi_mi && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#eaf7e4", color: "#166534", border: "0.5px solid #7ed957" }}>
                            İzlendi
                          </span>
                        )}
                      </div>

                      <div>
                        <button
                          onClick={() => setSeciliOneri(o)}
                          className="text-xs px-4 py-2 rounded-lg border-none text-white font-semibold cursor-pointer"
                          style={{ background: "#56aeff", fontFamily: "'Nunito', sans-serif" }}
                        >
                          İzle
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}