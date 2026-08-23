// app/challenge-club/page.tsx
//
// Challenge Club ana sayfası (BM). Stat kartları + iki sekme:
//   - Challenge Gönder   → Gönderilecek Videolar yapısı (ChallengeGonderPaneli):
//                          tamamlanan CC videoları + çok BM'ye gönderim (atla-raporla).
//   - Gelen Challenge'lar → BM'e gelen challenge'lar; kart düzeni İzlenecek ile aynı,
//                          tıkla → /challenge-club/izle/[yayin_id]?challenge_id=X.

"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Send, Swords, Ticket, Video, type LucideIcon } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import ChallengeGonderPaneli, { type GonderSonuc } from "@/components/challenge-club/ChallengeGonderPaneli";
import { UttVideoKarti, type UttVideo } from "@/components/video/UttVideoKarti";

const BORDO = "#bc2d0d";
const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";

type Tab = "gonder" | "bekleyen";

// UTT kartıyla ortak alt bilgiler (extra, izlenme, beğeni/favori, talep, içerik türü).
interface KartMetrik {
  extra_puan?: number;
  izlenme_sayisi?: number;
  begeni_sayisi?: number;
  favori_sayisi?: number;
  begeni_mi?: boolean;
  favori_mi?: boolean;
  daha_once_izledi?: boolean;
  talep_no?: number | null;
  firma_adi?: string | null;
  icerik_turu?: string | null;
}

interface Video extends KartMetrik {
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

interface Challenge extends KartMetrik {
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
  video_puani?: number | null;
  yayin_tarihi?: string;
}

// CC verisini UTT kartının beklediği şekle eşler (doku birebir aynı olsun diye).
function metrikTaban(x: KartMetrik) {
  return {
    talep_no: x.talep_no ?? null,
    firma_adi: x.firma_adi ?? null,
    extra_puan: x.extra_puan ?? 0,
    izlenme_sayisi: x.izlenme_sayisi ?? 0,
    begeni_sayisi: x.begeni_sayisi ?? 0,
    favori_sayisi: x.favori_sayisi ?? 0,
    begeni_mi: x.begeni_mi ?? false,
    favori_mi: x.favori_mi ?? false,
    daha_once_izledi: x.daha_once_izledi ?? false,
    icerik_turu: (x.icerik_turu ?? null) as UttVideo["icerik_turu"],
    ileri_sarma_acik: false,
  };
}

function challengeyiUttKarta(c: Challenge): UttVideo {
  return {
    ...metrikTaban(c),
    yayin_id: c.yayin_id,
    urun_adi: c.urun_adi ?? "Video",
    teknik_adi: c.teknik_adi ?? "-",
    video_url: c.video_url ?? null,
    thumbnail_url: c.thumbnail_url ?? null,
    video_puani: c.video_puani ?? null,
    yayin_tarihi: c.yayin_tarihi ?? c.created_at,
    sonraki_tur_tarihi: null,
    durum: c.izlendi_mi ? "tamamlanan" : "yeni",
  };
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
  const [aktifTab, setAktifTab] = useState<Tab>("gonder");

  const [videolar, setVideolar] = useState<Video[]>([]);
  const [bekleyenler, setBekleyenler] = useState<Challenge[]>([]);
  const [gonderdiklerim, setGonderdiklerim] = useState<Challenge[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);

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

  const handleChallengeIzle = (yayin_id: string, challenge_id: string) => {
    router.push(`/challenge-club/izle/${yayin_id}?challenge_id=${challenge_id}`);
  };

  // Çoklu alıcıya challenge gönder (atla-raporla). Sonrasında veriyi yeniler.
  const handleCokluGonder = async (yayin_id: string, alan_idler: string[]): Promise<GonderSonuc | null> => {
    try {
      const res = await fetch("/challenge-club/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id, alan_idler }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Challenge gönderilemedi.", d.adim, d.detay); return null; }
      if ((d.gonderilen_sayisi ?? 0) > 0) basari(`${d.gonderilen_sayisi} challenge gönderildi.`);
      await verileriCek();
      return { gonderilen_sayisi: d.gonderilen_sayisi ?? 0, atlanan: d.atlanan ?? [] };
    } catch (err) {
      hata("Gönderim sırasında hata oluştu.", "fetch", String(err));
      return null;
    }
  };

  // Beğeni/favori — UTT ile aynı uçlar (/izle/api/begeni|favori); BM'e açıldı.
  const etkilesim = async (
    tur: "begeni" | "favori",
    e: MouseEvent,
    yayin_id: string
  ) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/izle/api/${tur}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id }),
      });
      const d = await res.json();
      if (!res.ok) return;
      const aktif = tur === "begeni" ? d.begeni_mi === true : d.favori_mi === true;
      const guncelle = <T extends KartMetrik & { yayin_id: string }>(liste: T[]): T[] =>
        liste.map((x) => {
          if (x.yayin_id !== yayin_id) return x;
          if (tur === "begeni") {
            return { ...x, begeni_mi: aktif, begeni_sayisi: (x.begeni_sayisi ?? 0) + (aktif ? 1 : -1) };
          }
          return { ...x, favori_mi: aktif, favori_sayisi: (x.favori_sayisi ?? 0) + (aktif ? 1 : -1) };
        });
      setVideolar((prev) => guncelle(prev));
      setBekleyenler((prev) => guncelle(prev));
      setGonderdiklerim((prev) => guncelle(prev));
    } catch {
      hata(`${tur === "begeni" ? "Beğeni" : "Favori"} işlemi başarısız.`);
    }
  };
  const handleBegeni = (e: MouseEvent, yayin_id: string) => etkilesim("begeni", e, yayin_id);
  const handleFavori = (e: MouseEvent, yayin_id: string) => etkilesim("favori", e, yayin_id);

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

        {/* Hero başlık */}
        <header className="mb-5">
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
            aktif={aktifTab === "gonder"}
            onClick={() => setAktifTab("gonder")}
            etiket="Challenge Gönder"
          />
          <TabButton
            aktif={aktifTab === "bekleyen"}
            onClick={() => setAktifTab("bekleyen")}
            etiket="Gelen Challenge'lar"
            rozet={bekleyenler.filter((challenge) => challenge.durum === "bekliyor").length || undefined}
          />
        </div>

        {/* Tab içerikleri */}
        {aktifTab === "gonder" && (
          <ChallengeGonderPaneli
            videolar={videolar}
            kalanKota={quota?.kalan ?? 0}
            hata={hata}
            onGonder={handleCokluGonder}
          />
        )}

        {aktifTab === "bekleyen" && (
          <BekleyenListesi
            bekleyenler={bekleyenler}
            onIzle={handleChallengeIzle}
            kalanGun={kalanGun}
            onBegeni={handleBegeni}
            onFavori={handleFavori}
          />
        )}
      </div>
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

type EtkilesimHandler = (e: MouseEvent, yayin_id: string) => void;

// UTT kartını CC rafında UTT ile aynı ölçüde saran kapsayıcı.
function KartSarici({ children }: { children: ReactNode }) {
  return <div className="flex w-40 flex-shrink-0 snap-start flex-col gap-1 sm:w-44 md:w-52">{children}</div>;
}

// Kart altı challenge meta şeridi (gönderen/alıcı + durum).
function KartMeta({ children, renk }: { children: ReactNode; renk?: string }) {
  return (
    <span
      className="truncate rounded-lg px-2 py-1 text-center text-[10px] font-semibold"
      style={{ background: "#f7f9fc", color: renk ?? "#70849d", border: "0.5px solid #e5e7eb" }}
    >
      {children}
    </span>
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

function BekleyenListesi({
  bekleyenler,
  onIzle,
  kalanGun,
  onBegeni,
  onFavori,
}: {
  bekleyenler: Challenge[];
  onIzle: (yayin_id: string, challenge_id: string) => void;
  kalanGun: (son_tarih: string) => string;
  onBegeni: EtkilesimHandler;
  onFavori: EtkilesimHandler;
}) {
  if (bekleyenler.length === 0) {
    return <BosDurum ikon={Inbox} metin="Bekleyen challenge yok." />;
  }

  return (
    <CcRaf>
      {bekleyenler.map((c) => {
        const bekliyor = c.durum === "bekliyor";
        const durumMetni = c.durum === "izlendi"
          ? "İzlendi"
          : c.durum === "suresi_doldu"
            ? "Süresi doldu"
            : kalanGun(c.son_tarih);
        return (
          <KartSarici key={c.challenge_id}>
            <UttVideoKarti
              video={challengeyiUttKarta(c)}
              onVideoClick={() => { if (bekliyor) onIzle(c.yayin_id, c.challenge_id); }}
              onBegeni={onBegeni}
              onFavori={onFavori}
            />
            <KartMeta renk={BORDO}>
              {c.gonderen?.ad} {c.gonderen?.soyad} · {durumMetni}
            </KartMeta>
          </KartSarici>
        );
      })}
    </CcRaf>
  );
}

