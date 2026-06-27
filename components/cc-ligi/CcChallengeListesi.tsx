// components/cc-ligi/CcChallengeListesi.tsx
//
// CC Ligi alt bloku: Bu ayki challenge listesi (6 sütun tablo).
// Veri kaynağı: v_cc_challenge_listesi VIEW (ay filtreli).
//
// Sütunlar:
//   - Challenger (Gönderen)
//   - Challengee (Alan)
//   - Video
//   - Challenge Tarihi
//   - Durum (İzlendi / Bekliyor / Süresi Doldu)
//   - İzleme Tarihi

"use client";

import { useEffect, useState } from "react";

interface ChallengeKaydi {
  challenge_id: string;
  challenger_adi: string;
  challengee_adi: string;
  urun_adi: string | null;
  teknik_adi: string | null;
  challenge_tarihi: string;
  son_tarih: string;
  izlendi_mi: boolean;
  durum: string;
  izleme_tarihi: string | null;
}

interface Props {
  yil: number;
  ay: number;
  hata: (mesaj: string, adim?: string, detay?: any) => void;
}

const BORDO = "#bc2d0d";
const YESIL = "#16a34a";
const SARI_TEXT = "#854d0e";
const KOYU_METIN = "#111827";
const GRI_METIN = "#737373";

export default function CcChallengeListesi({ yil, ay, hata }: Props) {
  const [kayitlar, setKayitlar] = useState<ChallengeKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const yukle = async () => {
      setYukleniyor(true);
      try {
        const res = await fetch(
          `/cc-ligi/api?tip=challenge-listesi&yil=${yil}&ay=${ay}`
        );
        const d = await res.json();
        if (!res.ok) {
          hata(d.hata ?? "Challenge listesi çekilemedi.", d.adim, d.detay);
          setYukleniyor(false);
          return;
        }
        setKayitlar(d.challengeler ?? []);
      } catch (err) {
        hata("Challenge listesi yüklenemedi.", "fetch", String(err));
      }
      setYukleniyor(false);
    };

    yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yil, ay]);

  const tarihFormatla = (iso: string | null) => {
    if (!iso) return "—";
    const t = new Date(iso);
    return t.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const durumStili = (durum: string) => {
    switch (durum) {
      case "İzlendi":
        return { renk: YESIL, arka: "#f0fdf4", kenar: "#bbf7d0" };
      case "Bekliyor":
        return { renk: SARI_TEXT, arka: "#fefce8", kenar: "#fde68a" };
      case "Süresi Doldu":
        return { renk: BORDO, arka: "#fef2f2", kenar: "#fecaca" };
      default:
        return { renk: GRI_METIN, arka: "#f3f4f6", kenar: "#e5e7eb" };
    }
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-4"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Başlık */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "#f3f4f6", background: "#fafafa" }}
      >
        <div className="text-sm font-semibold" style={{ color: KOYU_METIN }}>
          Challenge Listesi — Bu Ay
        </div>
        <div className="text-xs mt-0.5" style={{ color: GRI_METIN }}>
          Bu ay gönderilen tüm challenge'lar
        </div>
      </div>

      {/* İçerik */}
      {yukleniyor ? (
        <div
          className="p-10 text-center text-sm"
          style={{ color: GRI_METIN }}
        >
          Yükleniyor...
        </div>
      ) : kayitlar.length === 0 ? (
        <div
          className="p-10 text-center text-sm"
          style={{ color: GRI_METIN }}
        >
          Bu ay henüz challenge gönderilmedi.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9fafb", color: KOYU_METIN }}>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  Challenger (Gönderen)
                </th>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  Challengee (Alan)
                </th>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  Video
                </th>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  Challenge Tarihi
                </th>
                <th
                  className="text-center px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  Durum
                </th>
                <th
                  className="text-left px-3 py-2.5 text-xs font-semibold border-b"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  İzleme Tarihi
                </th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k, i) => {
                const d = durumStili(k.durum);
                return (
                  <tr
                    key={k.challenge_id}
                    style={{
                      background: i % 2 === 0 ? "white" : "#fafafa",
                      color: KOYU_METIN,
                    }}
                  >
                    <td className="px-3 py-2.5 font-medium">{k.challenger_adi}</td>
                    <td className="px-3 py-2.5">{k.challengee_adi}</td>
                    <td className="px-3 py-2.5">
                      <div>{k.urun_adi ?? "-"}</div>
                      {k.teknik_adi && (
                        <div className="text-xs" style={{ color: GRI_METIN }}>
                          {k.teknik_adi}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: GRI_METIN }}>
                      {tarihFormatla(k.challenge_tarihi)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="inline-block px-2.5 py-1 rounded-full text-xs font-medium border"
                        style={{
                          color: d.renk,
                          background: d.arka,
                          borderColor: d.kenar,
                        }}
                      >
                        {k.durum}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: GRI_METIN }}>
                      {tarihFormatla(k.izleme_tarihi)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}