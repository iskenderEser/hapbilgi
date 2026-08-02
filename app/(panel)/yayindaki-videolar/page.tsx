// app/yayindaki-videolar/page.tsx
// "Yayındaki Videolar" sayfası. Navbar pill'inden gelinir; yalnız
// YAYINDAKI_VIDEO_GORENLER görür (rol bekçisi proxy.ts + bu sayfada tekrar).
// Adım 2 (iskelet): mevcut VideoBolumu ile düz liste + VideoOynatici (izleme
// modu, tuketici=false → puan/soru yok). Klasör gruplaması + kart favori/beğeni
// sonraki adımlarda.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import KlasorGrid from "./_components/KlasorGrid";
import { useListe, ListeArama } from "@/components/liste";
import VideoOynatici from "@/components/izle/VideoOynatici";
import { AnaSayfaVideo } from "@/lib/video/anaSayfaVideolari";
import { YayindakiVideo } from "@/lib/video/yayindakiVideolar";
import { useAuth } from "@/app/providers/AuthProvider";
import { YAYINDAKI_VIDEO_GORENLER } from "@/lib/utils/roller";

export default function YayindakiVideolarPage() {
  const router = useRouter();
  const { kullanici, yukleniyor } = useAuth();
  const { mesajlar, hata } = useHataMesaji();
  const [videolar, setVideolar] = useState<YayindakiVideo[]>([]);

  // Yalnız ARAMA (İskender kararı 27.07): ekran klasör + kart ızgarası, satır
  // listesi değil; kademeli açma ızgarada ayrı bir iş. adim: Infinity → dilimleme yok.
  // Not: bu ekranın verisinde talep_no yok (yayın kaydından beslenir), bu yüzden
  // aranabilir alanlar ürün/eğitim adı ve teknik adıdır.
  const liste = useListe({
    veri: videolar,
    adim: Infinity,
    aramaAlanlari: [
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (v: YayindakiVideo) => v.urun_adi },
      { anahtar: "teknik", etiket: "Teknik", deger: (v: YayindakiVideo) => v.teknik_adi },
    ],
  });
  const [aktifVideo, setAktifVideo] = useState<AnaSayfaVideo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (yukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    const rol = kullanici.rol?.trim().toLowerCase();
    if (!rol || !YAYINDAKI_VIDEO_GORENLER.includes(rol)) { router.replace("/ana-sayfa"); return; }

    const veriCek = async () => {
      setLoading(true);
      const res = await fetch("/yayindaki-videolar/api");
      const data = await res.json();
      if (!res.ok) hata(data.hata ?? "Videolar yüklenemedi.", data.adim, data.detay);
      else setVideolar(data.videolar ?? []);
      setLoading(false);
    };
    veriCek();
  }, [kullanici, yukleniyor, router]);

  if (yukleniyor || !kullanici) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" style={{ width: 24, height: 24, color: "#737373" }} fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'Nunito', sans-serif" }}>
      {aktifVideo ? (
        <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <VideoOynatici
            key={aktifVideo.yayin_id}
            video={aktifVideo}
            tuketici={false}
            onKapat={() => setAktifVideo(null)}
            onVeriYenile={() => {}}
            hata={() => {}}
            basari={() => {}}
            uyari={() => {}}
          />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-3 py-4 md:px-6 md:py-5 lg:px-8 lg:py-7">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h1 className="text-lg font-bold text-gray-900 m-0">Yayındaki videolar</h1>
            <div className="flex items-center gap-2">
              <ListeArama arama={liste.arama} />
              <span className="text-xs font-semibold rounded-lg px-2.5 py-1" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                izleme modu
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-20">
              <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : liste.toplam === 0 ? (
            <div className="text-sm text-gray-500 py-16 text-center">
              {videolar.length === 0 ? "Görüntülenecek yayında video yok." : "Aramanıza uyan video bulunamadı."}
            </div>
          ) : (
            <KlasorGrid videolar={liste.gorunen} onVideoSec={setAktifVideo} />
          )}
        </div>
      )}

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}
