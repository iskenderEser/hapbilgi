// app/eczanem/page.tsx
// Müşteri paneli: hoş geldin + videolarım (izleme/soru akışı, U7) + profil.
// Bakiye/fişler Faz 4'te (U8) bu iskelete oturur. Bekçi /eczanem'i korur;
// sayfa yine de kimlik_turu doğrular.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import EczanemVideoOynatici from "./_components/EczanemVideoOynatici";
import { talepIdGoster } from "@/lib/utils/talepId";
import EczanemKasa from "./_components/EczanemKasa";
import { MUSTERI_ROLU } from "@/lib/utils/roller";

interface VideoSatiri {
  gonderim_id: string;
  yayin_id: string;
  talep_no?: number | null;
  firma_adi?: string | null;
  urun_adi: string;
  teknik_adi: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  gelis_tarihi: string;
  izlendi: boolean;
  cevaplandi: boolean;
}

export default function EczanemPanelPage() {
  const router = useRouter();
  const { kullanici, yukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const musteri = !!kullanici && kullanici.kimlik_turu === MUSTERI_ROLU;

  // Videolar + oynatıcı
  const [videolar, setVideolar] = useState<VideoSatiri[]>([]);
  const [videoYukleniyor, setVideoYukleniyor] = useState(true);
  const [seciliVideo, setSeciliVideo] = useState<VideoSatiri | null>(null);

  const videolariCek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/api/videolar");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Videolar yüklenemedi.", "videolar"); return; }
      setVideolar(data.videolar ?? []);
    } catch {
      hata("Videolar yüklenemedi.", "videolar");
    } finally {
      setVideoYukleniyor(false);
    }
  }, [hata]);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!musteri) { router.replace("/ana-sayfa"); return; }
    videolariCek();
  }, [kullanici, yukleniyor, musteri, router, videolariCek]);

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
      <HataMesajiContainer mesajlar={mesajlar} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hoş geldiniz{kullanici.ad ? `, ${kullanici.ad}` : ""}</h1>
            <div className="text-xs text-gray-500 mt-1">HapBilgi Eczanem — eczanenizin size gönderdiği videolar ve puanlarınız.</div>
          </div>
          <button
            type="button"
            onClick={() => cikisYap()}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Çıkış
          </button>
        </div>

        {/* Videolarım — izleme + soru akışı (U7). Bakiye/indirim U8'de eklenir. */}
        {seciliVideo ? (
          <div className="mb-4">
            <EczanemVideoOynatici
              video={seciliVideo}
              onKapat={() => { setSeciliVideo(null); videolariCek(); }}
              onTamamlandi={videolariCek}
              hata={hata}
              basari={basari}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Videolarım</div>
            {videoYukleniyor ? (
              <div className="text-sm text-gray-400">Yükleniyor…</div>
            ) : videolar.length === 0 ? (
              <div className="text-sm text-gray-400">Eczanenizin gönderdiği videolar burada görünecek.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {videolar.map((v) => (
                  <button
                    key={v.gonderim_id}
                    onClick={() => setSeciliVideo(v)}
                    className="text-left rounded-lg border border-gray-200 hover:bg-gray-50 px-3 py-3 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{v.urun_adi}</div>
                      {v.teknik_adi && <div className="text-xs text-gray-400 truncate">{v.teknik_adi}</div>}
                      {v.talep_no != null && (
                        <div className="text-[10px] text-gray-400 font-mono">{talepIdGoster(v.firma_adi, v.talep_no)}</div>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {v.izlendi && v.cevaplandi ? (
                        <span className="text-xs font-semibold text-green-700">Tamamlandı ✓</span>
                      ) : v.izlendi ? (
                        <span className="text-xs font-semibold" style={{ color: "#b45309" }}>Soru bekliyor</span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: "#b45309" }}>İzle →</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* İndirim kullan + siparişler/fişler (İP-§8) */}
        {!seciliVideo && <EczanemKasa hata={hata} basari={basari} />}

        {/* Profil */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-700 mb-2">Profil</div>
          <div className="text-xs text-gray-500">
            Telefon: {kullanici.telefon ? `••• ••• ${kullanici.telefon.slice(-4)}` : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
