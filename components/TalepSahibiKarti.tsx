// components/TalepSahibiKarti.tsx
//
// İÜ ekranlarının en üstünde sabit duran iletişim kartı: talebi açan üreticinin
// adı, unvanı, e-postası ve cep telefonu (İskender 25.07 — acil hızlı iletişim).
// Talep boyunca her aşamada aynı yerde durur: talep detayı, senaryo, video,
// soru seti. Yalnız İÜ görür; üreticiye İÜ künyesini gösteren kart ayrı iştir.
//
// Ekran elindeki kimliği verir (talep_id / senaryo_durum_id / video_durum_id);
// çözümü sunucu yapar. Künye yoksa kart hiç çizilmez — boş kutu bırakmaz.

"use client";

import { useEffect, useState } from "react";

interface Sahip {
  ad_soyad: string;
  unvan: string;
  eposta: string | null;
  telefon: string | null;
}

interface Props {
  rol: string;
  talepId?: string;
  senaryoDurumId?: string;
  videoDurumId?: string;
}

export default function TalepSahibiKarti({ rol, talepId, senaryoDurumId, videoDurumId }: Props) {
  const [sahip, setSahip] = useState<Sahip | null>(null);

  const anahtar = talepId ?? senaryoDurumId ?? videoDurumId ?? "";

  useEffect(() => {
    if (rol !== "iu" || !anahtar) return;
    const q = talepId ? `talep_id=${talepId}`
      : senaryoDurumId ? `senaryo_durum_id=${senaryoDurumId}`
      : `video_durum_id=${videoDurumId}`;
    let iptal = false;
    fetch(`/talepler/api/sahip?${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!iptal) setSahip(d?.sahip ?? null); })
      .catch(() => { /* kart kritik değil — sessizce çizilmez */ });
    return () => { iptal = true; };
  }, [rol, anahtar, talepId, senaryoDurumId, videoDurumId]);

  if (rol !== "iu" || !sahip) return null;

  return (
    <div className="max-w-4xl mx-auto px-3 md:px-6 pt-4">
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 mb-0.5">Talebi açan</div>
          <div className="text-sm font-bold text-gray-900">{sahip.ad_soyad}</div>
          <div className="text-xs text-gray-500">{sahip.unvan}</div>
        </div>
        <div className="flex flex-col md:items-end gap-0.5">
          {sahip.telefon && (
            <a href={`tel:${sahip.telefon}`} className="text-xs font-semibold" style={{ color: "#56aeff" }}>
              {sahip.telefon}
            </a>
          )}
          {sahip.eposta && (
            <a href={`mailto:${sahip.eposta}`} className="text-xs break-all" style={{ color: "#56aeff" }}>
              {sahip.eposta}
            </a>
          )}
          {!sahip.telefon && !sahip.eposta && (
            <span className="text-xs text-gray-400">İletişim bilgisi kayıtlı değil</span>
          )}
        </div>
      </div>
    </div>
  );
}
