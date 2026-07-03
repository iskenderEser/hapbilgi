// app/eclub/ligi/page.tsx
//
// E-Club Ligi sayfası — rol bazlı cascade akordiyon.
//   UTT: kendi takımı (LigDetayTablo) + diğer UTT'ler (akordiyon → detay)
//   BM:  UTT'ler (akordiyon → detay)
//   TM:  BM'ler (akordiyon → UTT'ler akordiyon → detay)
// Merkezi akordiyon state hook'ta. Excel export ayrı adımda eklenecek.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import { useEclubLigi, type UttSatir } from "./_hooks/useEclubLigi";
import LigAkordiyon from "@/components/eclub/LigAkordiyon";
import LigDetayTablo from "@/components/eclub/LigDetayTablo";

const PERIYOT_ETIKET: Record<string, string> = { ay: "Bu Ay", donem: "Bu Çeyrek", yil: "Bu Yıl" };

export default function EclubLigiPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor, cikisYap } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const {
    rol, satirlar, loading, periyot, setPeriyot,
    acikUtt, acikBm, uttTikla, bmTikla,
    detayCache, detayLoading, bmGruplar, veriCek,
  } = useEclubLigi({ hata });

  const [takimAdi, setTakimAdi] = useState<string>("");
  const [takimAdiDuzenle, setTakimAdiDuzenle] = useState(false);
  const [takimAdiTaslak, setTakimAdiTaslak] = useState("");

  const uttMu = rol === "utt" || rol === "kd_utt";

  useEffect(() => {
    if (!uttMu) return;
    fetch("/eclub/ligi/api/takim-adi")
      .then((r) => r.json())
      .then((d) => { setTakimAdi(d.takim_adi ?? ""); setTakimAdiTaslak(d.takim_adi ?? ""); })
      .catch(() => {});
  }, [uttMu]);

  const takimAdiKaydet = async () => {
    const ad = takimAdiTaslak.trim();
    if (!ad) return;
    const res = await fetch("/eclub/ligi/api/takim-adi", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ takim_adi: ad }),
    });
    const d = await res.json();
    if (!res.ok) { hata(d.hata ?? "Takım adı kaydedilemedi.", d.adim, d.detay); return; }
    setTakimAdi(ad);
    setTakimAdiDuzenle(false);
    basari("Takım adı kaydedildi.");
    veriCek();
  };

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
  }, [kullanici, authYukleniyor, router]);

  // UTT ise kendi takımının detayını otomatik aç (bir kez)
  useEffect(() => {
    if (loading || !kullanici) return;
    if (rol !== "utt" && rol !== "kd_utt") return;
    const benim = satirlar.find((s) => s.utt_id === kullanici.id);
    if (benim && !acikUtt.has(benim.utt_id)) uttTikla(benim.utt_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rol, satirlar, kullanici]);

  const handleCikis = async () => { await cikisYap(); router.push("/login"); };

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

  // UTT başlık satırı (akordiyon başlığında metrik gösterimi)
  const uttBaslik = (u: UttSatir) => (
    <div className="flex items-center justify-between gap-3 w-full">
      <span className="text-sm font-medium text-gray-900">
        {u.takim_adi ? u.takim_adi : `${u.ad} ${u.soyad}`}
        {u.takim_adi && <span className="text-xs text-gray-400 ml-1.5">{u.ad} {u.soyad}</span>}
      </span>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>İzleme <b className="text-gray-800">{u.izleme_puani}</b></span>
        <span>Cevap <b className="text-gray-800">{u.cevaplama_puani}</b></span>
        <span>GönderiP. <b style={{ color: "#7c3aed" }}>{u.gonderi_puani}</b></span>
        <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{u.toplam_puan}</span>
      </div>
    </div>
  );

  // Bir UTT'nin detay panelini render et (akordiyon içeriği)
  const uttDetay = (utt_id: string) => (
    <LigDetayTablo satirlar={detayCache[utt_id] ?? []} yukleniyor={detayLoading.has(utt_id)} />
  );

  // UTT akordiyon listesi (BM görünümü + TM'nin BM içi)
  const uttAkordiyonListesi = (uttler: UttSatir[], girinti: number) => (
    <>
      {uttler.map((u) => (
        <LigAkordiyon
          key={u.utt_id}
          baslik={uttBaslik(u)}
          acik={acikUtt.has(u.utt_id)}
          onTikla={() => uttTikla(u.utt_id)}
          girinti={girinti}
        >
          {uttDetay(u.utt_id)}
        </LigAkordiyon>
      ))}
    </>
  );

  const periyotQueryStr = () => {
    const sp = new URLSearchParams({ periyot });
    return sp.toString();
  };

  const excelIndir = () => {
    window.open(`/eclub/ligi/api/export?${periyotQueryStr()}`, "_blank");
  };

  const periyotSecici = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1.5">
        {(["ay", "donem", "yil"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriyot(p)}
            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              border: periyot === p ? "1px solid #56aeff" : "0.5px solid #e5e7eb",
              background: periyot === p ? "#e6f1fb" : "white",
              color: periyot === p ? "#1d4ed8" : "#6b7280",
              fontWeight: periyot === p ? 600 : 400,
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {PERIYOT_ETIKET[p]}
          </button>
        ))}
      </div>
      <button
        onClick={excelIndir}
        className="text-xs px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5 text-white border-none"
        style={{ background: "#16a34a", fontFamily: "'Nunito', sans-serif" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Excel
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <Navbar email={kullanici.email} rol={kullanici.rol} adSoyad={kullanici.adSoyad} onCikis={handleCikis} />

      <div className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 m-0">E-Club Ligi</h1>
            <p className="text-sm text-gray-500 m-0">
              {rol === "utt" || rol === "kd_utt" ? "Takımın ve bölgendeki takımlar" : rol === "bm" ? "Bölgendeki takımlar" : "Firmandaki takımlar"}
            </p>
          </div>
          {periyotSecici}
        </div>

        {satirlar.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center">
            <p className="text-sm text-gray-400 m-0">Bu dönemde lig verisi yok.</p>
          </div>
        ) : (rol === "utt" || rol === "kd_utt") ? (
          // UTT: kendi takımı düz detay + diğer UTT'ler akordiyon
          <div className="flex flex-col gap-4">
            {(() => {
              const benimSatir = satirlar.find((s) => s.utt_id === kullanici.id);
              const digerler = satirlar.filter((s) => s.utt_id !== kullanici.id);
              return (
                <>
                  {benimSatir && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
                        {takimAdiDuzenle ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={takimAdiTaslak}
                              onChange={(e) => setTakimAdiTaslak(e.target.value)}
                              maxLength={100}
                              placeholder="Takım adı (örn. Aslanlar)"
                              className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 outline-none"
                              style={{ fontFamily: "'Nunito', sans-serif" }}
                            />
                            <button onClick={takimAdiKaydet} className="text-xs px-3 py-1.5 rounded-lg border-none text-white cursor-pointer" style={{ background: "#16a34a" }}>Kaydet</button>
                            <button onClick={() => { setTakimAdiDuzenle(false); setTakimAdiTaslak(takimAdi); }} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-transparent text-gray-500 cursor-pointer">Vazgeç</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {takimAdi ? takimAdi : "Takımım"} — {benimSatir.ad} {benimSatir.soyad}
                            </span>
                            <button onClick={() => { setTakimAdiTaslak(takimAdi); setTakimAdiDuzenle(true); }} className="text-xs px-2 py-1 rounded-lg bg-transparent cursor-pointer" style={{ border: "0.5px solid #d1d5db", color: "#6b7280" }}>
                              {takimAdi ? "Adı düzenle" : "Takım adı ver"}
                            </button>
                          </div>
                        )}
                        <span className="text-xs" style={{ color: "#7c3aed" }}>GönderiPuanı: {benimSatir.gonderi_puani}</span>
                      </div>
                      <LigDetayTablo satirlar={detayCache[benimSatir.utt_id] ?? []} yukleniyor={detayLoading.has(benimSatir.utt_id)} />
                    </div>
                  )}

                  {digerler.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <span className="text-sm font-semibold text-gray-900">Bölgemdeki Diğer Takımlar</span>
                      </div>
                      {uttAkordiyonListesi(digerler, 0)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        ) : rol === "bm" ? (
          // BM: UTT'ler akordiyon
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-900">Bölgemdeki Takımlar (UTT)</span>
            </div>
            {uttAkordiyonListesi(satirlar, 0)}
          </div>
        ) : (
          // TM: BM'ler akordiyon → UTT'ler akordiyon → detay
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-semibold text-gray-900">Firmadaki Bölgeler</span>
            </div>
            {bmGruplar.map((g) => (
              <LigAkordiyon
                key={g.bolge_id ?? "yok"}
                acik={acikBm.has(g.bolge_id ?? "yok")}
                onTikla={() => bmTikla(g.bolge_id ?? "yok")}
                baslik={
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span className="text-sm font-medium text-gray-900">{g.bolge_adi}</span>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{g.uttler.length} takım</span>
                      <span className="text-sm font-bold" style={{ color: "#56aeff" }}>{g.toplam_puan}</span>
                    </div>
                  </div>
                }
              >
                {uttAkordiyonListesi(g.uttler, 20)}
              </LigAkordiyon>
            ))}
          </div>
        )}
      </div>

      <HataMesajiContainer mesajlar={mesajlar} />
    </div>
  );
}