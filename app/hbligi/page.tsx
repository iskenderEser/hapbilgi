// app/hbligi/page.tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/app/providers/AuthProvider";
import { aktifDonem } from "@/lib/zaman/kontrol";
import HbLigiPeriyotSecici, { type Periyot } from "@/components/hbligi/HbLigiPeriyotSecici";

interface UttSatiri {
  sira: number;
  kullanici_id: string;
  ad: string;
  rol: string;
  bolge: string;
  takim?: string;
  izleme_puani: number;
  cevaplama_puani: number;
  oneri_puani: number;
  extra_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  toplam_puan: number;
  benim?: boolean;
}

interface BolgeSatiri {
  sira: number;
  bolge_id: string;
  bolge_adi: string;
  toplam_puan: number;
}

interface TakimSatiri {
  sira: number;
  takim_id: string;
  takim_adi: string;
  toplam_puan: number;
}

interface GenelSatiri extends UttSatiri {
  bolge_sirasi: number;
  takim_sirasi: number;
  firma: string;
}

interface Filtreler {
  bolgeler: { bolge_id: string; bolge_adi: string }[];
  takimlar: { takim_id: string; takim_adi: string }[];
  firmalar: { firma_id: string; firma_adi: string }[];
}

type HBLigiVeri =
  | { tip: "utt"; lig: UttSatiri[] }
  | { tip: "bm"; bolge_utt: UttSatiri[]; takim_bolge_siralaması: BolgeSatiri[] }
  | { tip: "tm"; takim_utt: UttSatiri[]; takim_siralamasi: TakimSatiri[] }
  | { tip: "genel"; lig: GenelSatiri[]; filtreler: Filtreler };

export default function HBLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const [veri, setVeri] = useState<HBLigiVeri | null>(null);
  const [loading, setLoading] = useState(true);
  const [secilenBolge, setSecilenBolge] = useState("");
  const [secilenTakim, setSecilenTakim] = useState("");
  const [secilenFirma, setSecilenFirma] = useState("");
  const [bmBolgeId, setBmBolgeId] = useState<string | null>(null);

  // Periyot state (varsayılan: içinde bulunulan çeyrek)
  const buAn = new Date();
  const buDonem = aktifDonem(buAn);
  const [periyot, setPeriyot] = useState<Periyot>("donem");
  const [yil, setYil] = useState<number>(buDonem.yil);
  const [ay, setAy] = useState<number>(buAn.getMonth() + 1);
  const [ceyrek, setCeyrek] = useState<number>(buDonem.ceyrek);
  // Bu haftanın no'su — Pazartesi bazlı, seçici/DB ile aynı (1 Ocak'ı içeren hafta = 1).
  const buHaftaNo = (d: Date): number => {
    const ocak1 = new Date(d.getFullYear(), 0, 1);
    const dow = (ocak1.getDay() + 6) % 7;
    const h1 = new Date(d.getFullYear(), 0, 1 - dow);
    return Math.floor((d.getTime() - h1.getTime()) / 604800000) + 1;
  };
  const [hafta, setHafta] = useState<number>(buHaftaNo(buAn));

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) {
      router.push("/login");
      return;
    }
  }, [kullanici, authYukleniyor, router]);

  const handleCikis = async () => {
    await cikisYap();
    router.push("/login");
  };

  // BM rolündeki kullanıcı için bolge_id'yi kullanicilar tablosundan çek.
  // Bu sayfada bm bölge highlight'ı için gereklidir.
  useEffect(() => {
    if (!kullanici) return;
    if (kullanici.rol.toLowerCase() !== "bm") {
      setBmBolgeId(null);
      return;
    }
    const supabase = createClient();
    supabase
      .from("kullanicilar")
      .select("bolge_id")
      .eq("kullanici_id", kullanici.id)
      .single()
      .then(({ data }) => {
        setBmBolgeId(data?.bolge_id ?? null);
      });
  }, [kullanici]);

  const veriCek = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (secilenBolge) params.set("bolge_id", secilenBolge);
    if (secilenTakim) params.set("takim_id", secilenTakim);
    if (secilenFirma) params.set("firma_id", secilenFirma);
    params.set("periyot", periyot);
    params.set("yil", String(yil));
    if (periyot === "ay") params.set("ay", String(ay));
    if (periyot === "donem") params.set("ceyrek", String(ceyrek));
    if (periyot === "hafta") params.set("hafta", String(hafta));
    const res = await fetch(`/hbligi/api?${params.toString()}`);
    const data = await res.json();
    setVeri(data);
    setLoading(false);
  };

  useEffect(() => { if (kullanici) veriCek(); }, [kullanici, secilenBolge, secilenTakim, secilenFirma, periyot, yil, ay, ceyrek, hafta]);

  const siraRenk = (sira: number) => {
    if (sira === 1) return "#f59e0b";
    if (sira === 2) return "#9ca3af";
    if (sira === 3) return "#b45309";
    return "#e5e7eb";
  };

  const siraYazi = (sira: number) => sira <= 3 ? "white" : "#737373";

  const periyotSecici = (
    <HbLigiPeriyotSecici
      periyot={periyot}
      yil={yil}
      ay={ay}
      ceyrek={ceyrek}
      hafta={hafta}
      onPeriyotChange={setPeriyot}
      onYilChange={setYil}
      onAyChange={setAy}
      onCeyrekChange={setCeyrek}
      onHaftaChange={setHafta}
    />
  );

  if (authYukleniyor || !kullanici || loading || !veri) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // ─── UTT görünümü ──────────────────────────────────────────────────────────
  if (veri.tip === "utt") {
    const { lig } = veri;
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
        <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 m-0">HBLigi</h1>
            <span className="text-xs text-gray-500">{lig.length} kişi — Bölge Sıralaması</span>
          </div>
          {periyotSecici}
          <UttTablosu satirlar={lig} userId={kullanici.id} siraRenk={siraRenk} siraYazi={siraYazi} />
        </div>
      </div>
    );
  }

  // ─── BM görünümü ───────────────────────────────────────────────────────────
  if (veri.tip === "bm") {
    const { bolge_utt, takim_bolge_siralaması } = veri;
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
        <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
          <h1 className="text-xl font-bold text-gray-900 m-0">HBLigi</h1>
          {periyotSecici}

          {/* Takım bölge sıralaması */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 m-0">Takım Bölge Sıralaması</h2>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-center px-3 py-2.5 text-gray-400 font-medium" style={{ width: 40 }}>#</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Bölge</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Toplam Puan</th>
                </tr>
              </thead>
              <tbody>
                {takim_bolge_siralaması.map((b) => (
                  <tr key={b.bolge_id} className="border-b border-gray-50"
                    style={{ background: b.bolge_id === bmBolgeId ? "#f0f9ff" : "white" }}>
                    <td className="px-3 py-3 text-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                        style={{ background: siraRenk(b.sira) }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: siraYazi(b.sira) }}>{b.sira}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-900 font-medium">{b.bolge_adi}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{b.toplam_puan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kendi bölgesindeki UTT'ler */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gray-700 m-0 px-1">Bölgem — UTT Sıralaması</h2>
            <UttTablosu satirlar={bolge_utt} userId={kullanici.id} siraRenk={siraRenk} siraYazi={siraYazi} gostTakim={false} />
          </div>
        </div>
      </div>
    );
  }

  // ─── TM görünümü ───────────────────────────────────────────────────────────
  if (veri.tip === "tm") {
    const { takim_utt, takim_siralamasi } = veri;
    return (
      <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
        <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
        <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
          <h1 className="text-xl font-bold text-gray-900 m-0">HBLigi</h1>
          {periyotSecici}

          {/* Takım sıralaması */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 m-0">Takım Sıralaması</h2>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-center px-3 py-2.5 text-gray-400 font-medium" style={{ width: 40 }}>#</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium">Takım</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-medium">Toplam Puan</th>
                </tr>
              </thead>
              <tbody>
                {takim_siralamasi.map((t) => (
                  <tr key={t.takim_id} className="border-b border-gray-50">
                    <td className="px-3 py-3 text-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                        style={{ background: siraRenk(t.sira) }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: siraYazi(t.sira) }}>{t.sira}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-900 font-medium">{t.takim_adi}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{t.toplam_puan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kendi takımındaki UTT'ler */}
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-gray-700 m-0 px-1">Takımım — UTT Sıralaması</h2>
            <UttTablosu satirlar={takim_utt} userId={kullanici.id} siraRenk={siraRenk} siraYazi={siraYazi} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Genel görünüm (PM, GM, IU vb.) ───────────────────────────────────────
  const { lig, filtreler } = veri;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />
      <div className="max-w-4xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 m-0">HBLigi</h1>
          <span className="text-xs text-gray-500">{lig.length} kişi</span>
        </div>
        {periyotSecici}

        {/* Filtreler */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 md:px-5 py-3.5 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Firma</label>
            <select value={secilenFirma} onChange={(e) => { setSecilenFirma(e.target.value); setSecilenTakim(""); setSecilenBolge(""); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.firmalar.map(f => <option key={f.firma_id} value={f.firma_id}>{f.firma_adi}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Takım</label>
            <select value={secilenTakim} onChange={(e) => { setSecilenTakim(e.target.value); setSecilenBolge(""); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.takimlar.map(t => <option key={t.takim_id} value={t.takim_id}>{t.takim_adi}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Bölge</label>
            <select value={secilenBolge} onChange={(e) => setSecilenBolge(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-900 bg-white"
              style={{ fontFamily: "'Nunito', sans-serif", minWidth: 140 }}>
              <option value="">Tümü</option>
              {filtreler.bolgeler.map(b => <option key={b.bolge_id} value={b.bolge_id}>{b.bolge_adi}</option>)}
            </select>
          </div>
          {(secilenBolge || secilenTakim || secilenFirma) && (
            <button onClick={() => { setSecilenBolge(""); setSecilenTakim(""); setSecilenFirma(""); }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 text-xs cursor-pointer"
              style={{ fontFamily: "'Nunito', sans-serif" }}>
              Filtreyi Temizle
            </button>
          )}
        </div>

        <UttTablosu satirlar={lig} userId={kullanici.id} siraRenk={siraRenk} siraYazi={siraYazi} gostFirma gostTakim />
      </div>
    </div>
  );
}

// ─── Ortak UTT tablo bileşeni ─────────────────────────────────────────────────

interface UttTablosuProps {
  satirlar: UttSatiri[];
  userId: string;
  siraRenk: (sira: number) => string;
  siraYazi: (sira: number) => string;
  gostTakim?: boolean;
  gostFirma?: boolean;
}

const MADALYA_ZEMIN: Record<number, string> = { 1: "#e6f1fb", 2: "#f8fafc", 3: "#f8fafc" };
const MADALYA_KENAR: Record<number, string> = { 1: "#bfdbfe", 2: "#e5e7eb", 3: "#e5e7eb" };
const PEDESTAL_YUK: Record<number, number> = { 1: 72, 2: 46, 3: 32 };

function UttTablosu({ satirlar, userId, siraRenk, siraYazi, gostTakim = true, gostFirma = false }: UttTablosuProps) {
  const [acik, setAcik] = useState<Set<string>>(new Set());

  if (satirlar.length === 0) {
    return <div className="p-10 text-center text-sm text-gray-400">Henüz lig verisi bulunmuyor.</div>;
  }

  const sirali = [...satirlar]
    .sort((a, b) => b.toplam_puan - a.toplam_puan)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const maxKazanim = Math.max(
    1,
    ...sirali.map((r) => r.izleme_puani + r.cevaplama_puani + r.oneri_puani + r.extra_puani),
  );
  const ben = sirali.find((r) => r.benim || r.kullanici_id === userId);
  const top3 = sirali.slice(0, 3);
  const podyum = [top3[1], top3[0], top3[2]].filter(Boolean) as typeof top3;

  const cevir = (id: string) =>
    setAcik((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(id)) yeni.delete(id); else yeni.add(id);
      return yeni;
    });

  const chip = (metin: string) => (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f1f5f9", color: "#64748b" }}>{metin}</span>
  );

  return (
    <div className="flex flex-col gap-5" style={{ fontFamily: "'Nunito', sans-serif" }}>

      {/* Podyum */}
      <div className="flex items-end justify-center gap-3 md:gap-4 pt-1">
        {podyum.map((r) => {
          const lider = r.rank === 1;
          return (
            <div key={r.kullanici_id} className="flex flex-col items-center" style={{ width: 118 }}>
              <div style={{ height: 22 }}>
                {lider && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true">
                    <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5z" />
                  </svg>
                )}
              </div>
              <div className="rounded-full flex items-center justify-center"
                style={{ width: 48, height: 48, background: siraRenk(r.rank), color: siraYazi(r.rank), fontSize: 18, fontWeight: 700 }}>
                {r.rank}
              </div>
              <div className="text-sm text-gray-900 mt-1.5 text-center truncate" style={{ maxWidth: 112 }}>{r.ad}</div>
              <div style={{ fontSize: lider ? 22 : 18, fontWeight: 700, color: "#56aeff", marginBottom: 6 }}>{r.toplam_puan}</div>
              <div style={{ width: "100%", height: PEDESTAL_YUK[r.rank], borderRadius: "12px 12px 0 0", background: MADALYA_ZEMIN[r.rank], border: `1px solid ${MADALYA_KENAR[r.rank]}`, borderBottom: "none" }} />
            </div>
          );
        })}
      </div>

      {/* Senin sıran */}
      {ben && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "#f0f9ff" }}>
          <span className="text-xs" style={{ color: "#56aeff" }}>Senin sıran</span>
          <span className="text-base font-bold" style={{ color: "#56aeff" }}>{ben.rank} / {sirali.length}</span>
          <div className="flex-1" />
          <span className="text-xs" style={{ color: "#56aeff" }}>Net puanın</span>
          <span className="text-lg font-bold" style={{ color: "#56aeff" }}>{ben.toplam_puan}</span>
        </div>
      )}

      {/* Sıralı liste */}
      <div className="flex flex-col gap-2">
        {sirali.map((l) => {
          const kayip = l.ileri_sarma_kaybi + l.yanlis_cevap_kaybi + l.oneri_kaybi;
          const yesil = (Math.max(0, l.toplam_puan) / maxKazanim) * 100;
          const kirmizi = (kayip / maxKazanim) * 100;
          const benim = l.benim || l.kullanici_id === userId;
          const acikMi = acik.has(l.kullanici_id);
          const kalemler = [
            { label: "İzleme", val: l.izleme_puani, kayip: false },
            { label: "Cevaplama", val: l.cevaplama_puani, kayip: false },
            { label: "Öneri", val: l.oneri_puani, kayip: false },
            { label: "Extra", val: l.extra_puani, kayip: false },
            { label: "İleri Sarma Kaybı", val: l.ileri_sarma_kaybi, kayip: true },
            { label: "Yanlış Cevap Kaybı", val: l.yanlis_cevap_kaybi, kayip: true },
            { label: "Öneri Kaybı", val: l.oneri_kaybi, kayip: true },
          ];
          return (
            <div key={l.kullanici_id} className="bg-white rounded-xl"
              style={{ border: benim ? "2px solid #56aeff" : "0.5px solid #e5e7eb" }}>
              <button onClick={() => cevir(l.kullanici_id)}
                className="w-full flex items-center gap-3 px-3 md:px-4 py-3 bg-transparent cursor-pointer text-left">
                <span className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: 28, height: 28, background: siraRenk(l.rank), color: siraYazi(l.rank), fontSize: 12, fontWeight: 700 }}>{l.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate" style={{ fontWeight: benim ? 700 : 500 }}>
                    {l.ad}{benim && <span className="text-xs ml-1" style={{ color: "#56aeff" }}>sen</span>}
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {chip(l.bolge)}
                    {gostTakim && l.takim && chip(l.takim)}
                    {gostFirma && (l as any).firma && chip((l as any).firma)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#56aeff", lineHeight: 1.1 }}>{l.toplam_puan}</div>
                  <div className="text-xs text-gray-400">net puan</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2}
                  className="flex-shrink-0" style={{ transform: acikMi ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div className="px-3 md:px-4 pb-3">
                <div className="flex rounded-full overflow-hidden" style={{ height: 10, background: "#f1f5f9" }}>
                  <div style={{ width: `${yesil}%`, background: "#639922" }} />
                  <div style={{ width: `${kirmizi}%`, background: "#e24b4a" }} />
                </div>
              </div>

              {acikMi && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2.5 px-3 md:px-4 pb-4 pt-3"
                  style={{ borderTop: "0.5px solid #e5e7eb" }}>
                  {kalemler.map(({ label, val, kayip }) => (
                    <div key={label}>
                      <div className="text-xs" style={{ color: kayip ? "#dc2626" : "#9ca3af" }}>{label}</div>
                      <div className="text-sm font-medium" style={{ color: kayip ? "#dc2626" : "#374151" }}>
                        {kayip && val > 0 ? "− " : ""}{val}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}