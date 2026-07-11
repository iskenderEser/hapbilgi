// app/eczanem/utt/page.tsx
// UTT Eczanem dağıtım ekranı (İP-§5.1–5.3): Eczanem yayınları + UTT'nin
// bağladığı eczaneler (aktif üye sayısı + eşik durumu) + yayın→eczane
// gönderimi. Eşik altı eczaneye gönderim butonu kapalı; server da reddeder.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";

interface Yayin {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  yayin_tarihi: string | null;
}
interface Eczane {
  eczane_id: string;
  eczane_adi: string;
  aktif_uye_sayisi: number;
  esik_uygun: boolean;
}
interface Veri {
  esik: number;
  yayinlar: Yayin[];
  eczaneler: Eczane[];
  gonderilenler: string[];
}

const TUKETICI_ROLLER = ["utt", "kd_utt"];

export default function UttEczanemPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const uttMu =
    !!kullanici &&
    kullanici.kimlik_turu === "kullanici" &&
    TUKETICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase());

  const [veri, setVeri] = useState<Veri | null>(null);
  const [seciliYayin, setSeciliYayin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gonderilenEczane, setGonderilenEczane] = useState<string | null>(null);

  const veriCek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/utt/api");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Veriler yüklenemedi.", "eczanem utt"); return; }
      setVeri(data);
      setSeciliYayin((onceki) => onceki ?? data.yayinlar?.[0]?.yayin_id ?? null);
    } catch {
      hata("Veriler yüklenemedi.", "eczanem utt");
    } finally {
      setLoading(false);
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!uttMu) { router.replace("/ana-sayfa"); return; }
    veriCek();
  }, [kullanici, authYukleniyor, uttMu, router, veriCek]);

  const gonder = async (eczaneId: string) => {
    if (!seciliYayin) return;
    setGonderilenEczane(eczaneId);
    try {
      const res = await fetch("/eczanem/utt/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: seciliYayin, eczane_id: eczaneId }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Gönderilemedi.", "gönderim"); return; }
      basari("Video eczaneye gönderildi.");
      await veriCek();
    } catch {
      hata("Gönderilemedi.", "gönderim");
    } finally {
      setGonderilenEczane(null);
    }
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

  const yayinlar = veri?.yayinlar ?? [];
  const eczaneler = veri?.eczaneler ?? [];
  const esik = veri?.esik ?? 0;
  const gonderilenSet = new Set(veri?.gonderilenler ?? []);

  return (
    <div className="min-h-screen bg-gray-50">
      <HataMesajiContainer mesajlar={mesajlar} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-gray-900">Eczanem — Video Dağıtımı</h1>
        </div>
        <p className="text-xs text-gray-500 mb-6">
          Bir video, eczaneye yalnızca bir kez gönderilir. Yalnızca aktif üye sayısı eşiği
          (≥ {esik}) sağlayan eczanelere gönderim yapılabilir.
        </p>

        {yayinlar.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-400">
            Takımınızda dağıtıma hazır Eczanem videosu yok.
          </div>
        ) : (
          <>
            {/* Yayın seçimi */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="text-sm font-semibold text-gray-700 mb-3">Videolar</div>
              <div className="flex flex-col gap-2">
                {yayinlar.map((y) => {
                  const secili = y.yayin_id === seciliYayin;
                  return (
                    <button
                      key={y.yayin_id}
                      onClick={() => setSeciliYayin(y.yayin_id)}
                      className={`text-left rounded-lg border px-3 py-2.5 transition ${
                        secili ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-800">{y.urun_adi}</div>
                      <div className="text-xs text-gray-400">{y.teknik_adi}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Eczane listesi */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-sm font-semibold text-gray-700 mb-3">Eczaneleriniz</div>
              {eczaneler.length === 0 ? (
                <div className="text-sm text-gray-400">Bağlı eczaneniz bulunmuyor.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {eczaneler.map((e) => {
                    const gonderilmis = !!seciliYayin && gonderilenSet.has(`${seciliYayin}::${e.eczane_id}`);
                    const gonderiliyor = gonderilenEczane === e.eczane_id;
                    return (
                      <div key={e.eczane_id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-800 truncate">{e.eczane_adi}</div>
                          <div className="text-xs" style={{ color: e.esik_uygun ? "#15803d" : "#b45309" }}>
                            {e.aktif_uye_sayisi} aktif üye
                            {!e.esik_uygun && ` — eşik altı (≥ ${esik} gerekli)`}
                          </div>
                        </div>
                        {gonderilmis ? (
                          <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Gönderildi ✓</span>
                        ) : (
                          <button
                            onClick={() => gonder(e.eczane_id)}
                            disabled={!e.esik_uygun || gonderiliyor}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 whitespace-nowrap"
                            style={{ background: "#b45309" }}
                          >
                            {gonderiliyor ? "Gönderiliyor…" : "Gönder"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
