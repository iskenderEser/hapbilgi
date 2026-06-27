// app/challenge-club/page.tsx
//
// Challenge Club ana sayfası. BM rolündeki kullanıcı buraya geldiğinde üç kolu
// da görür:
//   - İzlenecek Videolar (Kol 1) → /challenge-club/izle/[yayin_id]
//   - Gelen Challenge'lar  (Kol 3) → /challenge-club/izle/[yayin_id]?challenge_id=X
//   - Gönderdiklerim       (Kol 2) → durum: Bekliyor / İzlendi
//
// Sağ üstte "Challenge Gönder" butonu: ChallengeGonderModal'ı açar.
// Buton içinde kompakt kota rozeti ("Challenge Gönder · 2 hak kaldı").

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import ChallengeGonderModal from "@/components/challenge-club/ChallengeGonderModal";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const YESIL = "#16a34a";
const SARI_TEXT = "#854d0e";

type Tab = "izlenecek" | "bekleyen" | "gonderdiklerim";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  thumbnail_url: string | null;
  video_puani: number;
  yayin_tarihi: string;
  tamamlandi_mi: boolean;
}

interface Challenge {
  challenge_id: string;
  yayin_id: string;
  son_tarih: string;
  created_at: string;
  izlendi_mi: boolean;
  gonderen?: { ad: string; soyad: string };
  alan?: { ad: string; soyad: string };
  urun_adi?: string;
  teknik_adi?: string;
  thumbnail_url?: string | null;
}

interface Quota {
  kullanildi: number;
  limit: number;
  kalan: number;
  dolu_mu: boolean;
}

export default function ChallengeClubPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [loading, setLoading] = useState(true);
  const [aktifTab, setAktifTab] = useState<Tab>("izlenecek");

  const [videolar, setVideolar] = useState<Video[]>([]);
  const [bekleyenler, setBekleyenler] = useState<Challenge[]>([]);
  const [gonderdiklerim, setGonderdiklerim] = useState<Challenge[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  const [modalAcik, setModalAcik] = useState(false);

  const { mesajlar, hata, basari } = useHataMesaji();

  // Auth + rol kontrolü
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      const r = (data.user.user_metadata?.rol ?? "").toLowerCase();
      setRol(r);
      const ad = data.user.user_metadata?.ad ?? "";
      const soyad = data.user.user_metadata?.soyad ?? "";
      setAdSoyad(`${ad} ${soyad}`.trim());
      if (r !== "bm") {
        router.push("/ana-sayfa");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Veri çekme
  useEffect(() => {
    if (!rol || rol !== "bm") return;
    verileriCek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol]);

  const verileriCek = async () => {
    setLoading(true);
    try {
      const [videoRes, bekRes, gondRes, quotaRes] = await Promise.all([
        fetch("/challenge-club/api?tip=izlenecek-videolar"),
        fetch("/challenge-club/api?tip=bekleyen"),
        fetch("/challenge-club/api?tip=gonderdiklerim"),
        fetch("/challenge-club/api?tip=quota"),
      ]);

      if (videoRes.ok) {
        const d = await videoRes.json();
        setVideolar(d.videolar ?? []);
      } else {
        const d = await videoRes.json();
        hata(d.hata ?? "Videolar yüklenemedi.", d.adim, d.detay);
      }

      if (bekRes.ok) {
        const d = await bekRes.json();
        setBekleyenler(d.challengeler ?? []);
      } else {
        const d = await bekRes.json();
        hata(d.hata ?? "Bekleyenler yüklenemedi.", d.adim, d.detay);
      }

      if (gondRes.ok) {
        const d = await gondRes.json();
        setGonderdiklerim(d.challengeler ?? []);
      } else {
        const d = await gondRes.json();
        hata(d.hata ?? "Gönderilenler yüklenemedi.", d.adim, d.detay);
      }

      if (quotaRes.ok) {
        const d = await quotaRes.json();
        setQuota({
          kullanildi: d.kullanildi ?? 0,
          limit: d.limit ?? 0,
          kalan: d.kalan ?? 0,
          dolu_mu: d.dolu_mu ?? false,
        });
      }
    } catch (err) {
      hata("Veri çekilirken hata oluştu.", "fetch", String(err));
    }
    setLoading(false);
  };

  const handleCikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleVideoIzle = (yayin_id: string) => {
    router.push(`/challenge-club/izle/${yayin_id}`);
  };

  const handleChallengeIzle = (yayin_id: string, challenge_id: string) => {
    router.push(`/challenge-club/izle/${yayin_id}?challenge_id=${challenge_id}`);
  };

  const handleGonderildi = async () => {
    await verileriCek();
    setAktifTab("gonderdiklerim");
  };

  const kalanGun = (son_tarih: string) => {
    const fark = new Date(son_tarih).getTime() - new Date().getTime();
    const gun = Math.ceil(fark / (1000 * 60 * 60 * 24));
    if (gun <= 0) return "Süresi doldu";
    return `${gun} gün kaldı`;
  };

  // Loading
  if (loading || !user) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: GRI_ZEMIN }}
      >
        <svg
          className="animate-spin w-6 h-6"
          style={{ color: GRI_METIN }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  // Buton rengi/durumu
  const butonDevreDisi = !quota || quota.dolu_mu;
  const butonRozetMetni = quota
    ? quota.dolu_mu
      ? "Kota dolu"
      : `${quota.kalan} hak kaldı`
    : "";

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >
      <Navbar
        email={user?.email ?? ""}
        rol={rol}
        adSoyad={adSoyad}
        onCikis={handleCikis}
      />

      {/* Hata/başarı mesajları */}
      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 md:px-4 md:py-6">
        {/* Geri linki */}
        <button
          onClick={() => router.push("/ana-sayfa")}
          className="flex items-center gap-1.5 text-xs mb-4 bg-transparent border-none cursor-pointer"
          style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
        >
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Ana Sayfa
        </button>

        {/* Başlık + Challenge Gönder butonu */}
        <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: KOYU_METIN, margin: 0 }}
            >
              Challenge Club
            </h1>
            <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
              Diğer BM'lere video önerin, kendinize gelenleri izleyin.
            </div>
          </div>
          <button
            onClick={() => setModalAcik(true)}
            disabled={butonDevreDisi}
            className="px-4 py-2 rounded-lg border-none text-white text-xs cursor-pointer flex items-center gap-2"
            style={{
              background: BORDO,
              opacity: butonDevreDisi ? 0.5 : 1,
              fontFamily: "'Nunito', sans-serif",
              cursor: butonDevreDisi ? "not-allowed" : "pointer",
            }}
          >
            <span className="font-semibold">Challenge Gönder</span>
            {quota && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.25)",
                  fontWeight: 500,
                }}
              >
                {butonRozetMetni}
              </span>
            )}
          </button>
        </div>

        {/* Tab — yatay scroll mobile */}
        <div
          className="flex gap-2 mb-4 overflow-x-auto pb-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <TabButton
            aktif={aktifTab === "izlenecek"}
            onClick={() => setAktifTab("izlenecek")}
            etiket="İzlenecek Videolar"
          />
          <TabButton
            aktif={aktifTab === "bekleyen"}
            onClick={() => setAktifTab("bekleyen")}
            etiket="Gelen Challenge'lar"
            rozet={bekleyenler.length > 0 ? bekleyenler.length : undefined}
          />
          <TabButton
            aktif={aktifTab === "gonderdiklerim"}
            onClick={() => setAktifTab("gonderdiklerim")}
            etiket="Gönderdiklerim"
          />
        </div>

        {/* Tab içerikleri */}
        {aktifTab === "izlenecek" && (
          <VideoListesi videolar={videolar} onIzle={handleVideoIzle} />
        )}

        {aktifTab === "bekleyen" && (
          <BekleyenListesi
            bekleyenler={bekleyenler}
            onIzle={handleChallengeIzle}
            kalanGun={kalanGun}
          />
        )}

        {aktifTab === "gonderdiklerim" && (
          <GonderdiklerimListesi gonderdiklerim={gonderdiklerim} />
        )}
      </div>

      {/* Challenge gönder modalı */}
      <ChallengeGonderModal
        acik={modalAcik}
        onKapat={() => setModalAcik(false)}
        onGonderildi={handleGonderildi}
        hata={hata}
        basari={basari}
      />
    </div>
  );
}

// ─── Alt bileşenler ──────────────────────────────────────────────────────────

function TabButton({
  aktif,
  onClick,
  etiket,
  rozet,
}: {
  aktif: boolean;
  onClick: () => void;
  etiket: string;
  rozet?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-xs cursor-pointer border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: aktif ? BORDO : "white",
        color: aktif ? "white" : KOYU_METIN,
        borderColor: aktif ? BORDO : "#e5e7eb",
      }}
    >
      {etiket}
      {rozet !== undefined && (
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
          style={{
            background: aktif ? "rgba(255,255,255,0.25)" : BORDO,
            color: aktif ? "white" : "white",
            minWidth: "18px",
            textAlign: "center",
          }}
        >
          {rozet}
        </span>
      )}
    </button>
  );
}

function VideoListesi({
  videolar,
  onIzle,
}: {
  videolar: Video[];
  onIzle: (yayin_id: string) => void;
}) {
  if (videolar.length === 0) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
        style={{ color: GRI_METIN }}
      >
        Henüz yayında olan CC videosu yok.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {videolar.map((v) => (
        <div
          key={v.yayin_id}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="text-sm font-semibold"
                style={{ color: KOYU_METIN }}
              >
                {v.urun_adi}
              </div>
              {v.tamamlandi_mi && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    color: YESIL,
                    background: "#f0fdf4",
                    border: "0.5px solid #bbf7d0",
                  }}
                >
                  Tamamlandı
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>
              {v.teknik_adi}
            </div>
          </div>
          <button
            onClick={() => onIzle(v.yayin_id)}
            className="px-4 py-1.5 rounded-lg border-none text-xs font-medium cursor-pointer flex-shrink-0 text-white"
            style={{ background: BORDO, fontFamily: "'Nunito', sans-serif" }}
          >
            {v.tamamlandi_mi ? "Tekrar İzle" : "İzle"}
          </button>
        </div>
      ))}
    </div>
  );
}

function BekleyenListesi({
  bekleyenler,
  onIzle,
  kalanGun,
}: {
  bekleyenler: Challenge[];
  onIzle: (yayin_id: string, challenge_id: string) => void;
  kalanGun: (son_tarih: string) => string;
}) {
  if (bekleyenler.length === 0) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
        style={{ color: GRI_METIN }}
      >
        Bekleyen challenge yok.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {bekleyenler.map((c) => (
        <div
          key={c.challenge_id}
          className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ border: `0.5px solid ${BORDO}` }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: KOYU_METIN }}>
              {c.urun_adi ?? "Video"}
            </div>
            <div className="text-xs" style={{ color: GRI_METIN }}>
              {c.teknik_adi}
            </div>
            <div className="text-xs mt-1" style={{ color: BORDO }}>
              {c.gonderen?.ad} {c.gonderen?.soyad} · {kalanGun(c.son_tarih)}
            </div>
          </div>
          <button
            onClick={() => onIzle(c.yayin_id, c.challenge_id)}
            className="px-4 py-1.5 rounded-lg border-none text-xs font-medium cursor-pointer flex-shrink-0 text-white"
            style={{ background: BORDO, fontFamily: "'Nunito', sans-serif" }}
          >
            İzle
          </button>
        </div>
      ))}
    </div>
  );
}

function GonderdiklerimListesi({
  gonderdiklerim,
}: {
  gonderdiklerim: Challenge[];
}) {
  if (gonderdiklerim.length === 0) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
        style={{ color: GRI_METIN }}
      >
        Bu ay challenge göndermediniz.
      </div>
    );
  }

  const durumBilgisi = (c: Challenge) => {
    if (c.izlendi_mi) {
      return { metin: "İzlendi", arka: "#f0fdf4", renk: YESIL, kenar: "#bbf7d0" };
    }
    const suresi = new Date(c.son_tarih).getTime() < Date.now();
    if (suresi) {
      return {
        metin: "Süresi Doldu",
        arka: "#fef2f2",
        renk: BORDO,
        kenar: "#fecaca",
      };
    }
    return {
      metin: "Bekliyor",
      arka: "#fefce8",
      renk: SARI_TEXT,
      kenar: "#fde68a",
    };
  };

  return (
    <div className="flex flex-col gap-2.5">
      {gonderdiklerim.map((c) => {
        const d = durumBilgisi(c);
        return (
          <div
            key={c.challenge_id}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-semibold"
                style={{ color: KOYU_METIN }}
              >
                {c.urun_adi ?? "Video"}
              </div>
              <div className="text-xs" style={{ color: GRI_METIN }}>
                {c.teknik_adi}
              </div>
              <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
                {c.alan?.ad} {c.alan?.soyad}
              </div>
            </div>
            <div
              className="px-3 py-1 rounded-full text-xs font-medium flex-shrink-0 border"
              style={{
                background: d.arka,
                color: d.renk,
                borderColor: d.kenar,
              }}
            >
              {d.metin}
            </div>
          </div>
        );
      })}
    </div>
  );
}