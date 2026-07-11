// app/eczanem/eczane/page.tsx
// Eczacı/teknisyen Eczanem ekranı: davet formu + davet listesi (U2) ve
// gelen videolar + aktif üyelere tekil/toplu gönderim (U6, İP-§5.5).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { useAuth } from "@/app/providers/AuthProvider";
import EczanemSiparisKuyrugu from "./_components/EczanemSiparisKuyrugu";

interface DavetSatiri {
  davet_id: string;
  ad_soyad: string;
  telefon: string; // maskeli gelir (son-4-hane)
  durum: string;
  created_at: string;
}

const DURUM_ETIKETLERI: Record<string, { etiket: string; renk: string }> = {
  bekliyor: { etiket: "Bekliyor", renk: "#b45309" },
  tamamlandi: { etiket: "Üye Oldu", renk: "#15803d" },
  suresi_doldu: { etiket: "Süresi Doldu", renk: "#737373" },
  iptal: { etiket: "Yenilendi/İptal", renk: "#737373" },
};

interface GelenVideo {
  yayin_id: string;
  urun_adi: string;
  teknik_adi: string;
  gelis_tarihi: string;
}
interface Uye {
  musteri_id: string;
  telefon_maskeli: string;
}

export default function EczanemDavetPage() {
  const router = useRouter();
  const { kullanici, yukleniyor: authYukleniyor } = useAuth();
  const { mesajlar, hata, basari } = useHataMesaji();

  const eclubKisi = !!kullanici && kullanici.kimlik_turu === "eclub_kisi";

  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [davetler, setDavetler] = useState<DavetSatiri[]>([]);
  const [loading, setLoading] = useState(true);

  const [videolar, setVideolar] = useState<GelenVideo[]>([]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [seciliVideo, setSeciliVideo] = useState<string | null>(null);
  const [seciliUyeler, setSeciliUyeler] = useState<Set<string>>(new Set());
  const [dagitiliyor, setDagitiliyor] = useState(false);

  const davetleriCek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/eczane/api/davetler");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davetler yüklenemedi.", "davet listesi"); return; }
      setDavetler(data.davetler ?? []);
    } catch {
      hata("Davetler yüklenemedi.", "davet listesi");
    } finally {
      setLoading(false);
    }
  }, [hata]);

  const dagitimCek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/eczane/api/gonderim");
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Gönderim verisi yüklenemedi.", "gönderim"); return; }
      setVideolar(data.videolar ?? []);
      setUyeler(data.uyeler ?? []);
      setSeciliVideo((onceki) => onceki ?? data.videolar?.[0]?.yayin_id ?? null);
    } catch {
      hata("Gönderim verisi yüklenemedi.", "gönderim");
    }
  }, [hata]);

  useEffect(() => {
    if (authYukleniyor) return;
    if (!kullanici) { router.replace("/login"); return; }
    if (!eclubKisi) { router.replace("/ana-sayfa"); return; }
    davetleriCek();
    dagitimCek();
  }, [kullanici, authYukleniyor, eclubKisi, router, davetleriCek, dagitimCek]);

  const uyeToggle = (musteriId: string) => {
    setSeciliUyeler((onceki) => {
      const yeni = new Set(onceki);
      if (yeni.has(musteriId)) yeni.delete(musteriId);
      else yeni.add(musteriId);
      return yeni;
    });
  };

  const tumunuSec = () => {
    setSeciliUyeler((onceki) =>
      onceki.size === uyeler.length ? new Set() : new Set(uyeler.map((u) => u.musteri_id))
    );
  };

  const videoDagit = async () => {
    if (!seciliVideo || seciliUyeler.size === 0) return;
    setDagitiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/gonderim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yayin_id: seciliVideo, musteri_idler: [...seciliUyeler] }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Gönderilemedi.", "gönderim"); return; }
      basari(data.mesaj ?? "Gönderildi.");
      setSeciliUyeler(new Set());
    } catch {
      hata("Gönderilemedi.", "gönderim");
    } finally {
      setDagitiliyor(false);
    }
  };

  const davetGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    try {
      const res = await fetch("/eczanem/eczane/api/davetler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_soyad: adSoyad, telefon }),
      });
      const data = await res.json();
      if (!res.ok) { hata(data.hata ?? "Davet gönderilemedi.", "davet"); return; }
      basari("Davet gönderildi — müşterinize SMS ile kod iletildi.");
      setAdSoyad("");
      setTelefon("");
      davetleriCek();
    } catch {
      hata("Davet gönderilemedi.", "davet");
    } finally {
      setGonderiliyor(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <HataMesajiContainer mesajlar={mesajlar} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Eczanem — Müşteri Davetleri</h1>
          <button onClick={() => router.push("/eclub/panel")} className="text-sm text-gray-500 hover:text-gray-700">
            ← Panele Dön
          </button>
        </div>

        <form onSubmit={davetGonder} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-3">Yeni Davet</div>
          <div className="text-xs text-gray-500 mb-4">
            Sözlü rızasını aldığınız müşterinizin adını ve cep telefonunu girin; kendisine SMS ile
            tek kullanımlık kod ve üyelik bağlantısı gönderilir.
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={adSoyad}
              onChange={(e) => setAdSoyad(e.target.value)}
              placeholder="Ad Soyad"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <input
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
            <button
              type="submit"
              disabled={gonderiliyor}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "#b45309" }}
            >
              {gonderiliyor ? "Gönderiliyor…" : "Davet Gönder"}
            </button>
          </div>
        </form>

        {/* Sipariş onay kuyruğu (İP-§8) — kasada müşteri bekleyebilir, üstte */}
        <EczanemSiparisKuyrugu hata={hata} basari={basari} />

        {/* Gelen videolar + üyelere dağıtım (İP-§5.5) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-1">Video Dağıtımı</div>
          <div className="text-xs text-gray-500 mb-4">
            Size gelen bir videoyu üyelerinizden seçtiklerinize gönderin. Aynı video bir
            müşteriye yalnızca bir kez gider; zaten gönderilmiş olanlar atlanır.
          </div>

          {videolar.length === 0 ? (
            <div className="text-sm text-gray-400">Henüz size gönderilmiş video yok.</div>
          ) : (
            <>
              <div className="text-xs font-semibold text-gray-500 mb-2">Video seç</div>
              <div className="flex flex-col gap-2 mb-5">
                {videolar.map((v) => {
                  const secili = v.yayin_id === seciliVideo;
                  return (
                    <button
                      key={v.yayin_id}
                      onClick={() => setSeciliVideo(v.yayin_id)}
                      className={`text-left rounded-lg border px-3 py-2.5 transition ${
                        secili ? "border-amber-500 bg-amber-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-800">{v.urun_adi}</div>
                      <div className="text-xs text-gray-400">{v.teknik_adi}</div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">
                  Üyeler {uyeler.length > 0 && `(${seciliUyeler.size}/${uyeler.length} seçili)`}
                </div>
                {uyeler.length > 0 && (
                  <button onClick={tumunuSec} className="text-xs text-amber-700 hover:underline">
                    {seciliUyeler.size === uyeler.length ? "Seçimi kaldır" : "Tümünü seç"}
                  </button>
                )}
              </div>

              {uyeler.length === 0 ? (
                <div className="text-sm text-gray-400">Aktif üyeniz yok.</div>
              ) : (
                <div className="divide-y divide-gray-100 mb-4 max-h-64 overflow-y-auto">
                  {uyeler.map((u) => (
                    <label key={u.musteri_id} className="flex items-center gap-3 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={seciliUyeler.has(u.musteri_id)}
                        onChange={() => uyeToggle(u.musteri_id)}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span className="text-sm text-gray-700">{u.telefon_maskeli}</span>
                    </label>
                  ))}
                </div>
              )}

              <button
                onClick={videoDagit}
                disabled={dagitiliyor || !seciliVideo || seciliUyeler.size === 0}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "#b45309" }}
              >
                {dagitiliyor ? "Gönderiliyor…" : `Seçili ${seciliUyeler.size} üyeye gönder`}
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-700 mb-3">Davetler</div>
          {davetler.length === 0 ? (
            <div className="text-sm text-gray-400">Henüz davet yok.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {davetler.map((d) => {
                const durum = DURUM_ETIKETLERI[d.durum] ?? { etiket: d.durum, renk: "#737373" };
                return (
                  <div key={d.davet_id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-800">{d.ad_soyad}</div>
                      <div className="text-xs text-gray-400">{d.telefon}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold" style={{ color: durum.renk }}>{durum.etiket}</div>
                      <div className="text-[11px] text-gray-400">{new Date(d.created_at).toLocaleString("tr-TR")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
