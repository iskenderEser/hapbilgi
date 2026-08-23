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

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Play, Send, Swords, Ticket, Video, type LucideIcon } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import ChallengeGonderModal from "@/components/challenge-club/ChallengeGonderModal";
import { thumbnailUrlUret } from "@/lib/video/thumbnail";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

type Tab = "izlenecek" | "bekleyen" | "gonderdiklerim";

interface Video {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  video_url: string | null;
  thumbnail_url: string | null;
  video_puani: number;
  yayin_tarihi: string;
  tamamlandi_mi: boolean;
  sonraki_tur_tarihi?: string | null;
}

interface Challenge {
  challenge_id: string;
  yayin_id: string;
  son_tarih: string;
  created_at: string;
  izlendi_mi: boolean;
  durum: "bekliyor" | "izlendi" | "suresi_doldu";
  gonderen?: { ad: string; soyad: string };
  alan?: { ad: string; soyad: string };
  urun_adi?: string;
  teknik_adi?: string;
  video_url?: string | null;
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
  const [loading, setLoading] = useState(true);
  const [aktifTab, setAktifTab] = useState<Tab>("izlenecek");

  const [videolar, setVideolar] = useState<Video[]>([]);
  const [bekleyenler, setBekleyenler] = useState<Challenge[]>([]);
  const [gonderdiklerim, setGonderdiklerim] = useState<Challenge[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

  const [modalAcik, setModalAcik] = useState(false);

  const { mesajlar, hata, basari } = useHataMesaji();
  const { kullanici, yukleniyor: kimlikYukleniyor } = useAuth();

  // Auth + rol kontrolü — kimlik kaynağı useAuth/v_auth_kimlik (B-04);
  // user_metadata bayatlayabildiği için okunmaz (rolCozucu dersi).
  useEffect(() => {
    if (kimlikYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
    setUser(kullanici);
    const r = (kullanici.rol ?? "").toLowerCase();
    setRol(r);
    if (r !== "bm") {
      router.push("/ana-sayfa");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, kimlikYukleniyor]);

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

  // Hero + stat türevleri
  const ad = (user?.adSoyad ?? "").split(" ")[0] || "";
  const bekleyenSayisi = bekleyenler.filter((c) => c.durum === "bekliyor").length;

  return (
    <div
      className="min-h-screen pb-20 md:pb-0"
      style={{ background: GRI_ZEMIN, fontFamily: "'Nunito', sans-serif" }}
    >

      {/* Hata/başarı mesajları */}
      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {mesajlar.map((m, i) => (
          <HataMesaji key={i} {...m} />
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-3 py-4 pb-20 md:px-6 md:py-6">
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

        {/* Hero başlık + Challenge Gönder butonu */}
        <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div
              className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em]"
              style={{ color: BORDO }}
            >
              <Swords size={14} /> Challenge Club
            </div>
            <h1
              className="m-0 text-2xl font-extrabold tracking-[-0.03em]"
              style={{ color: "#203653" }}
            >
              Merhaba {ad}
            </h1>
            <p className="mt-1 max-w-2xl text-xs font-semibold leading-5" style={{ color: "#8190a3" }}>
              {"BM · Diğer BM'lere video önerin, size gelen challenge'ları izleyin ve puan kazanın."}
            </p>
          </div>
          <button
            onClick={() => setModalAcik(true)}
            disabled={butonDevreDisi}
            className="inline-flex items-center gap-2 rounded-xl border-none px-4 py-2.5 text-xs font-extrabold text-white shadow-sm"
            style={{
              background: BORDO,
              opacity: butonDevreDisi ? 0.5 : 1,
              fontFamily: "'Nunito', sans-serif",
              cursor: butonDevreDisi ? "not-allowed" : "pointer",
            }}
          >
            <Send size={15} />
            <span>Challenge Gönder</span>
            {quota && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.25)", fontWeight: 600 }}
              >
                {butonRozetMetni}
              </span>
            )}
          </button>
        </header>

        {/* Stat kartlar */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatKart ikon={Video} etiket="İzlenecek Video" deger={videolar.length} detay="Yayındaki CC videosu" renk={BORDO} zemin="#fdece8" />
          <StatKart ikon={Inbox} etiket="Gelen Challenge" deger={bekleyenSayisi} detay="Süresi devam eden" renk="#d78022" zemin="#fff6e8" />
          <StatKart ikon={Send} etiket="Gönderdiğim" deger={gonderdiklerim.length} detay="Bu ay" renk="#16865f" zemin="#ebf8f2" />
          <StatKart ikon={Ticket} etiket="Kalan Hak" deger={quota?.kalan ?? 0} detay="Aylık gönderim kotası" renk="#237ac8" zemin="#edf6fd" />
        </section>

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
            rozet={bekleyenler.filter((challenge) => challenge.durum === "bekliyor").length || undefined}
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

function StatKart({
  ikon: Icon,
  etiket,
  deger,
  detay,
  renk,
  zemin,
}: {
  ikon: LucideIcon;
  etiket: string;
  deger: string | number;
  detay?: string;
  renk: string;
  zemin: string;
}) {
  return (
    <article className="rounded-2xl border border-[#dfe7f1] bg-white p-3.5 shadow-[0_5px_16px_rgba(31,55,90,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[#8190a3]">{etiket}</div>
          <div className="mt-1 text-2xl font-black tabular-nums" style={{ color: renk }}>
            {typeof deger === "number" ? deger.toLocaleString("tr-TR") : deger}
          </div>
          {detay && <div className="mt-0.5 truncate text-[10px] font-semibold text-[#8796a8]">{detay}</div>}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, background: zemin }}>
          <Icon size={16} />
        </span>
      </div>
    </article>
  );
}

function BosDurum({ ikon: Icon, metin }: { ikon: LucideIcon; metin: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8e2ec] bg-white px-5 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f1f6fa] text-[#8ba0b5]">
        <Icon size={20} />
      </span>
      <h2 className="mt-3 text-sm font-extrabold text-[#40556d]">{metin}</h2>
    </div>
  );
}

function CcRaf({ children }: { children: ReactNode }) {
  const raf = useRef<HTMLDivElement>(null);
  const kaydir = (yon: number) => raf.current?.scrollBy({ left: yon * raf.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <div className="group relative">
      <button type="button" aria-label="Sola kaydır" onClick={() => kaydir(-1)} className="absolute inset-y-0 left-0 z-10 flex w-16 cursor-pointer items-center justify-start bg-gradient-to-r from-[#f9fafb] via-[#f9fafb]/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <div ref={raf} className="flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      <button type="button" aria-label="Sağa kaydır" onClick={() => kaydir(1)} className="absolute inset-y-0 right-0 z-10 flex w-16 cursor-pointer items-center justify-end bg-gradient-to-l from-[#f9fafb] via-[#f9fafb]/70 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <svg className="h-7 w-7 text-gray-800 drop-shadow-sm" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

function CcVideoKarti({
  thumbnail,
  baslik,
  altBaslik,
  rozet,
  altSerit,
  onClick,
}: {
  thumbnail: string | null;
  baslik: string;
  altBaslik?: string;
  rozet?: string;
  altSerit?: ReactNode;
  onClick?: () => void;
}) {
  const tiklanabilir = !!onClick;
  return (
    <article
      className={`group w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition sm:w-44 md:w-52 ${tiklanabilir ? "hover:-translate-y-0.5 hover:border-[#e6b3a6] hover:shadow-[0_10px_24px_rgba(188,45,13,0.10)]" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!tiklanabilir}
        className={`w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#bc2d0d] ${tiklanabilir ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="relative aspect-video overflow-hidden bg-[#f1f1f1]">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
          ) : (
            <span className="flex h-full items-center justify-center text-gray-400"><Video size={26} /></span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#10233a]/45 via-transparent to-transparent" />
          {tiklanabilir && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-[#10233a]/65 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-105"><Play size={14} fill="currentColor" /></span>
            </span>
          )}
          {rozet && (
            <span className="absolute right-2 top-2 rounded-full border border-white/30 bg-[#10233a]/70 px-2 py-1 text-[9px] font-extrabold text-white backdrop-blur-sm">{rozet}</span>
          )}
        </div>
        <div className="px-3 pt-3">
          <div className="truncate text-sm font-extrabold text-[#243957]">{baslik}</div>
          {altBaslik && <div className="mt-1 truncate text-[10px] font-bold text-[#7b8ca5]">{altBaslik}</div>}
        </div>
      </button>
      {altSerit && <div className="m-3 mt-2 rounded-lg bg-[#f7f9fc] px-2 py-1.5 text-[10px] text-[#70849d]">{altSerit}</div>}
    </article>
  );
}

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
      className="px-4 py-2 rounded-full text-xs font-bold cursor-pointer border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0"
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
          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
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
    return <BosDurum ikon={Video} metin="Henüz yayında olan CC videosu yok." />;
  }

  return (
    <CcRaf>
      {videolar.map((v) => (
        <CcVideoKarti
          key={v.yayin_id}
          thumbnail={v.thumbnail_url || thumbnailUrlUret(v.video_url)}
          baslik={v.urun_adi}
          altBaslik={v.teknik_adi}
          rozet={v.tamamlandi_mi ? "✓ İzlendi" : undefined}
          onClick={() => onIzle(v.yayin_id)}
          altSerit={
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-yellow-600">★ {v.video_puani} puan</span>
              {v.tamamlandi_mi && v.sonraki_tur_tarihi && (
                <span className="text-[#237ac8]">
                  {Math.max(0, Math.ceil((new Date(v.sonraki_tur_tarihi).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} gün sonra puanlı
                </span>
              )}
            </div>
          }
        />
      ))}
    </CcRaf>
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
    return <BosDurum ikon={Inbox} metin="Bekleyen challenge yok." />;
  }

  return (
    <CcRaf>
      {bekleyenler.map((c) => {
        const bekliyor = c.durum === "bekliyor";
        const rozet = bekliyor
          ? kalanGun(c.son_tarih)
          : c.durum === "izlendi"
            ? "✓ İzlendi"
            : "Süresi Doldu";
        return (
          <CcVideoKarti
            key={c.challenge_id}
            thumbnail={c.thumbnail_url || thumbnailUrlUret(c.video_url)}
            baslik={c.urun_adi ?? "Video"}
            altBaslik={c.teknik_adi}
            rozet={rozet}
            onClick={bekliyor ? () => onIzle(c.yayin_id, c.challenge_id) : undefined}
            altSerit={
              <span className="font-bold" style={{ color: BORDO }}>
                {c.gonderen?.ad} {c.gonderen?.soyad}
              </span>
            }
          />
        );
      })}
    </CcRaf>
  );
}

function GonderdiklerimListesi({
  gonderdiklerim,
}: {
  gonderdiklerim: Challenge[];
}) {
  if (gonderdiklerim.length === 0) {
    return <BosDurum ikon={Send} metin="Bu ay challenge göndermediniz." />;
  }

  return (
    <CcRaf>
      {gonderdiklerim.map((c) => {
        const rozet = c.durum === "izlendi"
          ? "✓ İzlendi"
          : c.durum === "suresi_doldu"
            ? "Süresi Doldu"
            : "Bekliyor";
        return (
          <CcVideoKarti
            key={c.challenge_id}
            thumbnail={c.thumbnail_url || thumbnailUrlUret(c.video_url)}
            baslik={c.urun_adi ?? "Video"}
            altBaslik={c.teknik_adi}
            rozet={rozet}
            altSerit={
              <span>
                Alıcı: <b className="text-[#314a68]">{c.alan?.ad} {c.alan?.soyad}</b>
              </span>
            }
          />
        );
      })}
    </CcRaf>
  );
}
