// app/eczanem/_components/EczanemKasa.tsx
// Müşteri kasa bölümü (İP-§8): İndirim kullan (eczane seç → barkod → hesap →
// adet → sipariş gönder) + siparişler/fişler listesi. Puan onayda düşer;
// bu ekran puanı DÜŞÜRMEZ, yalnız bekleyen sipariş açar.

"use client";

import { useCallback, useEffect, useState } from "react";

interface Eczane { eczane_id: string; eczane_adi: string; }
interface Siparis {
  siparis_id: string;
  urun_adi: string;
  eczane_adi: string;
  adet: number;
  kullanilan_puan: number;
  indirim_tl: number;
  durum: string;
  islem_kodu: string | null;
  onay_tarihi: string | null;
  created_at: string;
}
interface Hesap { urun_id: string; urun_adi: string; bakiye_puan: number; indirim_tl: number; }

interface Props {
  hata: (mesaj: string, adim?: string) => void;
  basari: (mesaj: string) => void;
}

const DURUM: Record<string, { etiket: string; renk: string }> = {
  bekliyor: { etiket: "Onay bekliyor", renk: "#b45309" },
  onaylandi: { etiket: "Onaylandı", renk: "#15803d" },
  dustu: { etiket: "Düştü", renk: "#737373" },
};

export default function EczanemKasa({ hata, basari }: Props) {
  const [eczaneler, setEczaneler] = useState<Eczane[]>([]);
  const [siparisler, setSiparisler] = useState<Siparis[]>([]);
  const [seciliEczane, setSeciliEczane] = useState<string>("");
  const [barkod, setBarkod] = useState("");
  const [hesap, setHesap] = useState<Hesap | null>(null);
  const [adet, setAdet] = useState(1);
  const [isliyor, setIsliyor] = useState(false);

  const cek = useCallback(async () => {
    try {
      const res = await fetch("/eczanem/api/siparis");
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Kasa verisi yüklenemedi.", "kasa"); return; }
      setEczaneler(d.eczaneler ?? []);
      setSiparisler(d.siparisler ?? []);
      setSeciliEczane((o) => o || d.eczaneler?.[0]?.eczane_id || "");
    } catch { hata("Kasa verisi yüklenemedi.", "kasa"); }
  }, [hata]);

  useEffect(() => { cek(); }, [cek]);

  const hesapla = async () => {
    if (!seciliEczane || !barkod.trim()) return;
    setIsliyor(true);
    setHesap(null);
    try {
      const res = await fetch("/eczanem/api/siparis/hesap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eczane_id: seciliEczane, barkod: barkod.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Hesap yapılamadı.", "hesap"); return; }
      setHesap(d);
      setAdet(1);
    } catch { hata("Hesap yapılamadı.", "hesap"); }
    finally { setIsliyor(false); }
  };

  const siparisGonder = async () => {
    if (!hesap || !seciliEczane) return;
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eczane_id: seciliEczane, barkod: barkod.trim(), adet }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Sipariş gönderilemedi.", "sipariş"); return; }
      basari(d.mesaj ?? "Sipariş gönderildi.");
      setHesap(null); setBarkod("");
      cek();
    } catch { hata("Sipariş gönderilemedi.", "sipariş"); }
    finally { setIsliyor(false); }
  };

  const vazgec = async (siparis_id: string) => {
    setIsliyor(true);
    try {
      const res = await fetch("/eczanem/api/siparis/vazgec", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siparis_id }),
      });
      const d = await res.json();
      if (!res.ok) { hata(d.hata ?? "Vazgeçilemedi.", "vazgeç"); return; }
      basari("Siparişten vazgeçildi.");
      cek();
    } catch { hata("Vazgeçilemedi.", "vazgeç"); }
    finally { setIsliyor(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
      <div className="text-sm font-semibold text-gray-700 mb-1">İndirim Kullan</div>
      <div className="text-xs text-gray-500 mb-4">
        Kasadaki ürünün barkodunu okutun; puanınız eczacı onayında indirim olarak düşer.
      </div>

      {eczaneler.length === 0 ? (
        <div className="text-sm text-gray-400 mb-4">Aktif üyeliğiniz yok.</div>
      ) : (
        <div className="flex flex-col gap-3 mb-4">
          {eczaneler.length > 1 && (
            <select
              value={seciliEczane}
              onChange={(e) => { setSeciliEczane(e.target.value); setHesap(null); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {eczaneler.map((e) => <option key={e.eczane_id} value={e.eczane_id}>{e.eczane_adi}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={barkod}
              onChange={(e) => { setBarkod(e.target.value); setHesap(null); }}
              placeholder="Ürün barkodu"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={hesapla}
              disabled={isliyor || !barkod.trim() || !seciliEczane}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
              style={{ background: "#b45309" }}
            >
              Hesapla
            </button>
          </div>

          {hesap && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <div className="text-sm font-semibold text-gray-800">{hesap.urun_adi}</div>
              <div className="text-xs text-gray-600 mt-1">
                Kullanılabilir puan: <b>{hesap.bakiye_puan}</b> → İndirim: <b>{hesap.indirim_tl.toFixed(2)} TL</b>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Adet</span>
                  <button onClick={() => setAdet((a) => Math.max(1, a - 1))} className="w-7 h-7 rounded border border-gray-300 text-gray-700">−</button>
                  <span className="text-sm font-semibold w-6 text-center">{adet}</span>
                  <button onClick={() => setAdet((a) => a + 1)} className="w-7 h-7 rounded border border-gray-300 text-gray-700">+</button>
                </div>
                <button
                  onClick={siparisGonder}
                  disabled={isliyor || hesap.bakiye_puan <= 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "#b45309" }}
                >
                  Siparişi Gönder
                </button>
              </div>
              <div className="text-[11px] text-gray-400 mt-2">Adet yalnızca kutu sayısını kaydeder; indirim hakkınız kadardır.</div>
            </div>
          )}
        </div>
      )}

      {siparisler.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-gray-500 mb-2">Siparişlerim & Fişlerim</div>
          <div className="divide-y divide-gray-100">
            {siparisler.map((s) => {
              const d = DURUM[s.durum] ?? { etiket: s.durum, renk: "#737373" };
              return (
                <div key={s.siparis_id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800 truncate">{s.urun_adi} <span className="text-xs text-gray-400">×{s.adet}</span></div>
                    <div className="text-xs text-gray-400 truncate">
                      {s.eczane_adi}
                      {s.durum === "onaylandi" && s.islem_kodu && ` • ${s.indirim_tl.toFixed(2)} TL • ${s.islem_kodu}`}
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-xs font-semibold" style={{ color: d.renk }}>{d.etiket}</div>
                    {s.durum === "bekliyor" && (
                      <button onClick={() => vazgec(s.siparis_id)} disabled={isliyor} className="text-[11px] text-gray-500 hover:underline">Vazgeç</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
