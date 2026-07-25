// components/TalepSahibiKarti.tsx
//
// Üretim hattı ekranlarının en üstünde sabit duran iletişim kartı — karşı tarafın
// adı, unvanı, cep telefonu ve e-postası (İskender 25.07: acil hızlı iletişim).
// Talep boyunca her aşamada aynı yerde durur: talep detayı, senaryo, video, soru seti.
//
// Kim kimi görür:
//   - İçerik Üreticisi → talebi açan üreticinin künyesi. Talep açıldığı an vardır.
//   - Üretici          → içerik üreticisinin künyesi. İÜ talebe İLK CEVABI verene
//                        kadar (zincirde iu_id doğana kadar) kart çizilmez —
//                        varyant fark etmez; hazır videoda iş soru setinden başlar.
//
// Ekran elindeki kimliği verir (talep_id / senaryo_durum_id / video_durum_id);
// çözümü sunucu yapar. Künye yoksa kart hiç çizilmez — boş kutu bırakmaz.

"use client";

import { useEffect, useState } from "react";

interface Kunye {
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
  const [veri, setVeri] = useState<{ sahip: Kunye | null; icerik_ureticisi: Kunye | null } | null>(null);

  const anahtar = talepId ?? senaryoDurumId ?? videoDurumId ?? "";

  useEffect(() => {
    if (!anahtar) return;
    const q = talepId ? `talep_id=${talepId}`
      : senaryoDurumId ? `senaryo_durum_id=${senaryoDurumId}`
      : `video_durum_id=${videoDurumId}`;
    let iptal = false;
    fetch(`/talepler/api/sahip?${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!iptal) setVeri(d ?? null); })
      .catch(() => { /* kart kritik değil — sessizce çizilmez */ });
    return () => { iptal = true; };
  }, [anahtar, talepId, senaryoDurumId, videoDurumId]);

  const isIU = rol === "iu";
  const kisi = isIU ? veri?.sahip : veri?.icerik_ureticisi;
  if (!kisi) return null;

  return (
    <div className="max-w-3xl mx-auto px-3 md:px-6 pt-4">
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 mb-0.5">{isIU ? "Talebi açan" : "İçerik üreticisi"}</div>
          <div className="text-sm font-bold text-gray-900">{kisi.ad_soyad}</div>
          <div className="text-xs text-gray-500">{kisi.unvan}</div>
        </div>
        <div className="flex flex-col md:items-end gap-0.5">
          {kisi.telefon && (
            <a href={`tel:${kisi.telefon}`} className="text-xs font-semibold" style={{ color: "#56aeff" }}>
              {kisi.telefon}
            </a>
          )}
          {kisi.eposta && (
            <a href={`mailto:${kisi.eposta}`} className="text-xs break-all" style={{ color: "#56aeff" }}>
              {kisi.eposta}
            </a>
          )}
          {!kisi.telefon && !kisi.eposta && (
            <span className="text-xs text-gray-400">İletişim bilgisi kayıtlı değil</span>
          )}
        </div>
      </div>
    </div>
  );
}
