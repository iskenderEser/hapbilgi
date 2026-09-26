// app/cc-ligi/page.tsx
//
// CC Ligi ana sayfası. BM + TM + üretici + yönetici + admin rolleri görür.
// UTT, KD_UTT, IU göremez.
//
// Üç blok:
//   1. CcLigiBanner — çeyrek + yıl lideri
//   2. CcLigiPeriyotSecici + CcLigiTablosu — ana sıralama
//   3. CcChallengeListesi — bu ayki challenge tablosu
//
// Periyot mantığı:
//   - Default: Aylık, içinde bulunulan ay/yıl
//   - Aylık → get_cc_ligi_aylik(yil, ay)
//   - Dönemlik → get_cc_ligi_donemlik(yil, ceyrek)
//   - Yıllık → get_cc_ligi_yillik(yil)
//
// Çeyrek lideri (banner) hangi çeyrek için: kullanıcının seçtiği periyota
// bakılmaz, içinde bulunulan çeyrek gösterilir (yıl seçili olabilir).
//
// Periyot hesabı tek kaynaktan: lib/zaman/kontrol.ts → aktifPeriyot().

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Gauge } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import HataMesaji, { useHataMesaji } from "@/components/HataMesaji";
import { CCLIGI_GORENLERLER, YONETICI_ROLLER, ADMIN_ROLLER, URETICI_ROLLER } from "@/lib/utils/roller";
import { aktifPeriyot } from "@/lib/zaman/kontrol";
import CcLigiBanner from "@/components/cc-ligi/CcLigiBanner";
import CcLigiSkeleton from "@/components/cc-ligi/CcLigiSkeleton";
import CcLigiPeriyotSecici, { type Periyot } from "@/components/cc-ligi/CcLigiPeriyotSecici";
import CcLigiTablosu, { type LigSatiri } from "@/components/cc-ligi/CcLigiTablosu";
import CcTakimLigAkordeonu from "@/components/cc-ligi/CcTakimLigAkordeonu";
import CcChallengeListesi from "@/components/cc-ligi/CcChallengeListesi";
import { YenileButonu } from "@/components/ui/yenile-butonu";
import SayfaRehberi from "@/components/rehber/SayfaRehberi";
import type { AuthKullanici } from "@/types/auth";

const GRI_METIN = "#737373";
const KOYU_METIN = "#111827";
const GRI_ZEMIN = "#f9fafb";
const CC_LIG_ONBELLEK_SURESI = 60_000;
const CC_LIG_OTURUM_PREFIXI = "hb_cc_lig_cache_";
const ccLigOnbellegi = new Map<string, { veri: LigSatiri[]; zaman: number }>();
const devamEdenCcLigIstekleri = new Map<string, { promise: Promise<LigSatiri[]>; controller: AbortController }>();

function ccLigOnbelleginiOku(anahtar: string): { veri: LigSatiri[]; zaman: number } | null {
  const bellekKaydi = ccLigOnbellegi.get(anahtar);
  if (bellekKaydi && Date.now() - bellekKaydi.zaman < CC_LIG_ONBELLEK_SURESI) return bellekKaydi;
  if (typeof window === "undefined") return null;
  try {
    const ham = sessionStorage.getItem(`${CC_LIG_OTURUM_PREFIXI}${anahtar}`);
    if (!ham) return null;
    const kayit = JSON.parse(ham) as { veri?: LigSatiri[]; zaman?: number };
    if (Array.isArray(kayit.veri) && typeof kayit.zaman === "number" && Date.now() - kayit.zaman < CC_LIG_ONBELLEK_SURESI) {
      const gecerliKayit = { veri: kayit.veri, zaman: kayit.zaman };
      ccLigOnbellegi.set(anahtar, gecerliKayit);
      return gecerliKayit;
    }
    sessionStorage.removeItem(`${CC_LIG_OTURUM_PREFIXI}${anahtar}`);
  } catch {
    // Oturum depolaması kullanılamıyorsa bellek önbelleği kullanılmaya devam eder.
  }
  return null;
}

function ccLigOnbellegineYaz(anahtar: string, veri: LigSatiri[]) {
  const kayit = { veri, zaman: Date.now() };
  ccLigOnbellegi.set(anahtar, kayit);
  try {
    sessionStorage.setItem(`${CC_LIG_OTURUM_PREFIXI}${anahtar}`, JSON.stringify(kayit));
  } catch {
    // Depolama kotası doluysa bellek önbelleği yeterlidir.
  }
}

function ccLigVerisiniIste(anahtar: string, url: string, zorla = false) {
  const devamEden = devamEdenCcLigIstekleri.get(anahtar);
  if (devamEden && !devamEden.controller.signal.aborted && !zorla) return devamEden;
  if (devamEden) {
    devamEden.controller.abort();
    devamEdenCcLigIstekleri.delete(anahtar);
  }

  const controller = new AbortController();
  const promise = fetch(url, { cache: "no-store", signal: controller.signal })
    .then(async (res) => {
      const payload = await res.json();
      if (!res.ok) {
        const istekHatasi = new Error(payload.hata ?? "Lig verisi çekilemedi.") as Error & { adim?: string; detay?: string };
        istekHatasi.adim = payload.adim;
        istekHatasi.detay = payload.detay;
        throw istekHatasi;
      }
      return (payload.lig ?? []) as LigSatiri[];
    })
    .finally(() => {
      if (devamEdenCcLigIstekleri.get(anahtar)?.controller === controller) {
        devamEdenCcLigIstekleri.delete(anahtar);
      }
    });

  const istek = { promise, controller };
  devamEdenCcLigIstekleri.set(anahtar, istek);
  return istek;
}

export default function CcLigiPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthKullanici | null>(null);
  const [yetkiKontrolEdildi, setYetkiKontrolEdildi] = useState(false);

  // Periyot state
  const buPeriyot = aktifPeriyot();
  const [periyot, setPeriyot] = useState<Periyot>("ay");
  const { yil, ay, ceyrek, hafta } = buPeriyot;

  // Lig tablosu state
  const [ligSatirlari, setLigSatirlari] = useState<LigSatiri[]>([]);
  const [ligYukleniyor, setLigYukleniyor] = useState(true);
  const [yenileniyor, setYenileniyor] = useState(false);
  const [yenilemeAnahtari, setYenilemeAnahtari] = useState(0);
  const aktifLigIstegi = useRef<{ anahtar: string; controller: AbortController } | null>(null);
  const sonLigIstegi = useRef(0);
  const ilkLigYuklemesiTamamlandi = useRef(false);

  const { mesajlar, hata } = useHataMesaji();
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

    if (!CCLIGI_GORENLERLER.includes(r)) {
      router.push("/ana-sayfa");
      return;
    }

    setYetkiKontrolEdildi(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kullanici, kimlikYukleniyor]);

  // Lig verisini çek (periyot/yil/ay/ceyrek değiştiğinde)
  const ligiYukle = useCallback(async (
    hedefPeriyot: Periyot,
    manuelYenileme = false,
    periyoduUygula = false,
  ) => {
    if (!user) return;
    let url = `/cc-ligi/api?tip=lig&periyot=${hedefPeriyot}&yil=${yil}`;
    if (hedefPeriyot === "ay") url += `&ay=${ay}`;
    if (hedefPeriyot === "donem") url += `&ceyrek=${ceyrek}`;
    if (hedefPeriyot === "hafta") url += `&hafta=${hafta}`;

    const onbellekAnahtari = `${user.id}:${url}`;
    const istekNo = ++sonLigIstegi.current;
    const aktif = aktifLigIstegi.current;
    if (aktif && (aktif.anahtar !== onbellekAnahtari || manuelYenileme)) aktif.controller.abort();

    const onbellekKaydi = ccLigOnbelleginiOku(onbellekAnahtari);
    if (!manuelYenileme && onbellekKaydi) {
      setLigSatirlari(onbellekKaydi.veri);
      if (periyoduUygula) setPeriyot(hedefPeriyot);
      ilkLigYuklemesiTamamlandi.current = true;
      setLigYukleniyor(false);
      setYenileniyor(false);
      return;
    }

    if (manuelYenileme) setYenileniyor(true);
    else if (!ilkLigYuklemesiTamamlandi.current) setLigYukleniyor(true);
    try {
      const istek = ccLigVerisiniIste(onbellekAnahtari, url, manuelYenileme);
      aktifLigIstegi.current = { anahtar: onbellekAnahtari, controller: istek.controller };
      const satirlar = await istek.promise;
      if (istekNo !== sonLigIstegi.current) return;
      setLigSatirlari(satirlar);
      if (periyoduUygula) setPeriyot(hedefPeriyot);
      ilkLigYuklemesiTamamlandi.current = true;
      ccLigOnbellegineYaz(onbellekAnahtari, satirlar);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (istekNo === sonLigIstegi.current) {
        const istekHatasi = err as Error & { adim?: string; detay?: string };
        hata(istekHatasi.message || "Lig verisi yüklenemedi.", istekHatasi.adim ?? "fetch", istekHatasi.detay);
      }
    } finally {
      if (istekNo === sonLigIstegi.current) {
        aktifLigIstegi.current = null;
        setLigYukleniyor(false);
        setYenileniyor(false);
      }
    }
  }, [user, yil, ay, ceyrek, hafta, hata]);

  useEffect(() => {
    if (!yetkiKontrolEdildi) return;
    void ligiYukle("ay");
  }, [yetkiKontrolEdildi, ligiYukle]);

  useEffect(() => () => aktifLigIstegi.current?.controller.abort(), []);

  // Loading
  if (!user || !yetkiKontrolEdildi || (ligYukleniyor && ligSatirlari.length === 0)) {
    return <CcLigiSkeleton />;
  }

  // Challenge listesi: her zaman içinde bulunulan ay
  const cListYil = buPeriyot.yil;
  const cListAy = buPeriyot.ay;
  const ureticiMi = URETICI_ROLLER.includes((user.rol ?? "").toLowerCase());

  const tumunuYenile = async () => {
    setYenilemeAnahtari((deger) => deger + 1);
    await ligiYukle(periyot, true);
  };

  const firmaKazanilanPuani = ligSatirlari.reduce((toplam, satir) => toplam
    + Number(satir.izleme_puani ?? 0)
    + Number(satir.cevaplama_puani ?? 0)
    + Number(satir.extra_puani ?? 0)
    + Number(satir.cc_gonderme_puani ?? 0)
    + Number(satir.cc_referral_puani ?? 0), 0);
  const firmaKaybedilenPuani = ligSatirlari.reduce((toplam, satir) => toplam
    + Number(satir.ileri_sarma_kaybi ?? 0)
    + Number(satir.yanlis_cevap_kaybi ?? 0)
    + Number(satir.challenge_kaybi ?? 0), 0);
  const firmaNetPuani = ligSatirlari.reduce(
    (toplam, satir) => toplam + Number(satir.toplam_net_puan ?? 0),
    0,
  );
  const puanYaz = (puan: number) => puan.toLocaleString("tr-TR");

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

      <div className="max-w-5xl mx-auto px-3 py-3 md:px-4 md:py-6">
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

        {/* Başlık */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1
              className="text-xl font-bold inline-flex items-center flex-wrap"
              style={{ color: KOYU_METIN, margin: 0 }}
            >
              <span>C-Club Ligi</span>
              <SayfaRehberi anahtar="cclub-ligi" className="ml-1.5 -translate-y-1" />
            </h1>
            <div className="text-xs mt-1" style={{ color: GRI_METIN }}>
              Challenge Club bölge müdürlerinin öğrenme yarışı.
            </div>
          </div>
          <YenileButonu yenileniyor={yenileniyor} onYenile={tumunuYenile} />
        </div>

        {/* Banner */}
        <CcLigiBanner />

        {/* Periyot seçici */}
        <div className="mb-3">
          <CcLigiPeriyotSecici
            periyot={periyot}
            onPeriyotChange={(yeniPeriyot) => void ligiYukle(yeniPeriyot, false, true)}
          />
        </div>

        <div className={`mb-3 grid gap-3 sm:grid-cols-3 ${ureticiMi ? "grid-cols-2" : "grid-cols-1"}`}>
          <article className={`${ureticiMi ? "col-span-2 sm:col-span-1" : ""} flex min-h-[104px] items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-blue-700`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm"><Gauge className="h-4 w-4" /></span>
            <div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">Firma C-Club Net Puanı</div><div className="mt-0.5 text-2xl font-black tabular-nums text-[#10213d]">{ligYukleniyor ? "—" : puanYaz(firmaNetPuani)}</div><div className="mt-1 text-[10px] font-bold leading-4 text-[#718198]">Kazanılan ve kaybedilen C-Club puanlarının farkı</div></div>
          </article>
          <article className={`${ureticiMi ? "min-h-[148px] flex-col items-start gap-2 p-3" : "min-h-[104px] items-center gap-3 p-4"} flex rounded-2xl border border-emerald-100 bg-emerald-50/70 text-emerald-700 sm:min-h-[104px] sm:flex-row sm:items-center sm:gap-3 sm:p-4`}>
            <span className={`grid shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm ${ureticiMi ? "h-9 w-9 sm:h-10 sm:w-10" : "h-10 w-10"}`}><ArrowUpRight className="h-4 w-4" /></span>
            <div className="min-w-0"><div className={`${ureticiMi ? "text-[8px] tracking-[0.1em] sm:text-[9px] sm:tracking-[0.12em]" : "text-[9px] tracking-[0.12em]"} font-black uppercase opacity-70`}>Firma C-Club Kazanılan Puanı</div><div className={`${ureticiMi ? "text-xl sm:text-2xl" : "text-2xl"} mt-0.5 font-black tabular-nums text-[#10213d]`}>{ligYukleniyor ? "—" : `+${puanYaz(firmaKazanilanPuani)}`}</div><div className={`${ureticiMi ? "text-[9px] leading-[13px] sm:text-[10px] sm:leading-4" : "text-[10px] leading-4"} mt-1 font-bold text-[#718198]`}>İzleme, cevaplama, extra, gönderme ve referral puanlarının toplamı</div></div>
          </article>
          <article className={`${ureticiMi ? "min-h-[148px] flex-col items-start gap-2 p-3" : "min-h-[104px] items-center gap-3 p-4"} flex rounded-2xl border border-rose-100 bg-rose-50/70 text-rose-700 sm:min-h-[104px] sm:flex-row sm:items-center sm:gap-3 sm:p-4`}>
            <span className={`grid shrink-0 place-items-center rounded-xl bg-white/80 shadow-sm ${ureticiMi ? "h-9 w-9 sm:h-10 sm:w-10" : "h-10 w-10"}`}><ArrowDownRight className="h-4 w-4" /></span>
            <div className="min-w-0"><div className={`${ureticiMi ? "text-[8px] tracking-[0.1em] sm:text-[9px] sm:tracking-[0.12em]" : "text-[9px] tracking-[0.12em]"} font-black uppercase opacity-70`}>Firma C-Club Kaybedilen Puanı</div><div className={`${ureticiMi ? "text-xl sm:text-2xl" : "text-2xl"} mt-0.5 font-black tabular-nums text-[#10213d]`}>{ligYukleniyor ? "—" : firmaKaybedilenPuani ? `−${puanYaz(firmaKaybedilenPuani)}` : "0"}</div><div className={`${ureticiMi ? "text-[9px] leading-[13px] sm:text-[10px] sm:leading-4" : "text-[10px] leading-4"} mt-1 font-bold text-[#718198]`}>İleri sarma, yanlış cevaplama ve challenge kaybı puanlarının toplamı</div></div>
          </article>
        </div>

        {/* Lig tablosu veya Takımlar Akordiyonu */}
        {user && (YONETICI_ROLLER.includes((user.rol ?? "").toLowerCase()) || ADMIN_ROLLER.includes((user.rol ?? "").toLowerCase())) ? (
          <CcTakimLigAkordeonu satirlar={ligSatirlari} yukleniyor={ligYukleniyor} />
        ) : (
          <CcLigiTablosu satirlar={ligSatirlari} yukleniyor={ligYukleniyor} />
        )}

        {/* Challenge listesi (her zaman bu ay) */}
        <CcChallengeListesi key={`challenge-${yenilemeAnahtari}`} yil={cListYil} ay={cListAy} hata={hata} />
      </div>
    </div>
  );
}
