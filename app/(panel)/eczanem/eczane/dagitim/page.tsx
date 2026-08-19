// app/(panel)/eczanem/eczane/dagitim/page.tsx
// Eczacı/teknisyen Eczanem — Video Dağıtımı (U6, İP-§5.5): eczaneye gelen
// videolardan birini seçip aktif üyelere tekil/toplu gönderir. Aynı video bir
// müşteriye yalnızca bir kez gider; zaten gönderilmiş olanlar sunucuda atlanır.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { HataMesajiContainer, useHataMesaji } from "@/components/HataMesaji";
import { EclubKisiSayfa, EclubKisiBaslik } from "@/components/eclub/EclubKisiSayfa";

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

export default function EczanemDagitimPage() {
  const { mesajlar, hata, basari } = useHataMesaji();

  const [videolar, setVideolar] = useState<GelenVideo[]>([]);
  const [uyeler, setUyeler] = useState<Uye[]>([]);
  const [seciliVideo, setSeciliVideo] = useState<string | null>(null);
  const [seciliUyeler, setSeciliUyeler] = useState<Set<string>>(new Set());
  const [dagitiliyor, setDagitiliyor] = useState(false);

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

  useEffect(() => { dagitimCek(); }, [dagitimCek]);

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

  return (
    <EclubKisiSayfa>
      <HataMesajiContainer mesajlar={mesajlar} />
      <EclubKisiBaslik
        ikon={Send}
        ustEtiket="Eczanem"
        baslik="Video Dağıtımı"
        aciklama="Size gelen bir videoyu üyelerinizden seçtiklerinize gönderin. Aynı video bir müşteriye yalnızca bir kez gider; zaten gönderilmiş olanlar atlanır."
      />

      <div className="bg-white rounded-xl border border-gray-200 p-5">
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
    </EclubKisiSayfa>
  );
}
