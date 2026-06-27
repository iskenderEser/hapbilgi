// components/cc-ligi/CcLigiTablosu.tsx
//
// CC Ligi ana sıralama tablosu. İki render katmanı:
//   - Dikey mobil (portrait, ≤768px): 5 sütun (Sıra/Ad/Kazanım/Kayıp/Net) + akordiyon detay
//   - Yatay mobil + Desktop: 11 sütun renkli tablo (kazanım yeşil tonlu, kayıp kırmızı tonlu)
//
// CSS media query ile yönetilir, tek bileşen iki görünüm üretir.
// Veri kaynağı: get_cc_ligi_aylik / get_cc_ligi_donemlik / get_cc_ligi_yillik RPC'leri
// (page.tsx çağırır, prop olarak geçer).

"use client";

import { useState } from "react";

export interface LigSatiri {
  kullanici_id: string;
  ad: string;
  soyad: string;
  firma_id: string;
  takim_id: string;
  bolge_id: string;
  izleme_puani: number;
  cevaplama_puani: number;
  extra_puani: number;
  cc_gonderme_puani: number;
  cc_referral_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  challenge_kaybi: number;
  toplam_net_puan: number;
  genel_sira: number;
  firma_sirasi: number;
  takim_sirasi: number;
  bolge_sirasi: number;
}

interface Props {
  satirlar: LigSatiri[];
  yukleniyor: boolean;
}

const BORDO = "#bc2d0d";
const YESIL = "#16a34a";
const YESIL_ARKA = "#f0fdf4";
const KIRMIZI_ARKA = "#fef2f2";
const KOYU_METIN = "#111827";
const GRI_METIN = "#737373";

export default function CcLigiTablosu({ satirlar, yukleniyor }: Props) {
  const [acikAkordiyon, setAcikAkordiyon] = useState<string | null>(null);

  // Yardımcı: toplam kazanım ve kayıp
  const toplamKazanim = (s: LigSatiri) =>
    s.izleme_puani +
    s.cevaplama_puani +
    s.extra_puani +
    s.cc_gonderme_puani +
    s.cc_referral_puani;

  const toplamKayip = (s: LigSatiri) =>
    s.ileri_sarma_kaybi + s.yanlis_cevap_kaybi + s.challenge_kaybi;

  if (yukleniyor) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
        style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
      >
        Yükleniyor...
      </div>
    );
  }

  if (satirlar.length === 0) {
    return (
      <div
        className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm"
        style={{ color: GRI_METIN, fontFamily: "'Nunito', sans-serif" }}
      >
        Bu periyotta sıralama verisi yok.
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      style={{ fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Dikey mobil görünüm (akordiyon) — sadece dar ekranda görünür */}
      <div className="block md:hidden">
        {/* Başlık satırı */}
        <div
          className="grid items-center px-3 py-2.5 text-xs font-semibold border-b"
          style={{
            gridTemplateColumns: "40px 1fr 70px 70px 70px 28px",
            background: "#f9fafb",
            color: KOYU_METIN,
            borderColor: "#e5e7eb",
          }}
        >
          <div>Sıra</div>
          <div>Ad Soyad</div>
          <div className="text-right" style={{ color: YESIL }}>
            Kazanım
          </div>
          <div className="text-right" style={{ color: BORDO }}>
            Kayıp
          </div>
          <div className="text-right">Net</div>
          <div></div>
        </div>

        {/* Veri satırları */}
        {satirlar.map((s) => {
          const acik = acikAkordiyon === s.kullanici_id;
          const kazanim = toplamKazanim(s);
          const kayip = toplamKayip(s);

          return (
            <div key={s.kullanici_id} className="border-b" style={{ borderColor: "#f3f4f6" }}>
              {/* Ana satır */}
              <button
                onClick={() => setAcikAkordiyon(acik ? null : s.kullanici_id)}
                className="w-full grid items-center px-3 py-2.5 text-sm bg-white cursor-pointer border-none text-left"
                style={{
                  gridTemplateColumns: "40px 1fr 70px 70px 70px 28px",
                  color: KOYU_METIN,
                  fontFamily: "'Nunito', sans-serif",
                }}
              >
                <div className="font-semibold">{s.genel_sira}</div>
                <div className="font-medium truncate">
                  {s.ad} {s.soyad}
                </div>
                <div className="text-right" style={{ color: YESIL, fontWeight: 500 }}>
                  {kazanim}
                </div>
                <div className="text-right" style={{ color: BORDO, fontWeight: 500 }}>
                  {kayip}
                </div>
                <div className="text-right font-bold">{s.toplam_net_puan}</div>
                <div className="text-center" style={{ color: GRI_METIN }}>
                  {acik ? "▲" : "▼"}
                </div>
              </button>

              {/* Akordiyon detay */}
              {acik && (
                <div
                  className="px-3 py-3 grid gap-2"
                  style={{
                    background: "#f9fafb",
                    gridTemplateColumns: "1fr 1fr",
                  }}
                >
                  {/* Kazanım blok */}
                  <div
                    className="px-3 py-2.5 rounded-lg"
                    style={{ background: YESIL_ARKA, border: `0.5px solid #bbf7d0` }}
                  >
                    <div
                      className="text-xs font-semibold mb-1.5"
                      style={{ color: YESIL }}
                    >
                      Kazanım: {kazanim}
                    </div>
                    <DetaySatiri etiket="İzleme" deger={s.izleme_puani} />
                    <DetaySatiri etiket="Cevaplama" deger={s.cevaplama_puani} />
                    <DetaySatiri etiket="Extra" deger={s.extra_puani} />
                    <DetaySatiri etiket="Gönderme" deger={s.cc_gonderme_puani} />
                    <DetaySatiri etiket="Referral" deger={s.cc_referral_puani} />
                  </div>

                  {/* Kayıp blok */}
                  <div
                    className="px-3 py-2.5 rounded-lg"
                    style={{ background: KIRMIZI_ARKA, border: `0.5px solid #fecaca` }}
                  >
                    <div
                      className="text-xs font-semibold mb-1.5"
                      style={{ color: BORDO }}
                    >
                      Kayıp: {kayip}
                    </div>
                    <DetaySatiri etiket="İleri Sarma" deger={s.ileri_sarma_kaybi} />
                    <DetaySatiri etiket="Yanlış Cevap" deger={s.yanlis_cevap_kaybi} />
                    <DetaySatiri etiket="Challenge" deger={s.challenge_kaybi} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Yatay mobil + Desktop görünüm (tam tablo) — sadece geniş ekranda görünür */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: "'Nunito', sans-serif" }}>
          <thead>
            <tr style={{ background: "#f9fafb", color: KOYU_METIN }}>
              <th className="text-left px-3 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb" }}>Sıra</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb" }}>Ad Soyad</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: YESIL, background: YESIL_ARKA }}>İzleme</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: YESIL, background: YESIL_ARKA }}>Cevaplama</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: YESIL, background: YESIL_ARKA }}>Extra</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: YESIL, background: YESIL_ARKA }}>Gönderme</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: YESIL, background: YESIL_ARKA }}>Referral</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: BORDO, background: KIRMIZI_ARKA }}>İleri Sarma</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: BORDO, background: KIRMIZI_ARKA }}>Yanlış Cevap</th>
              <th className="text-right px-2 py-2.5 text-xs font-semibold border-b" style={{ borderColor: "#e5e7eb", color: BORDO, background: KIRMIZI_ARKA }}>Challenge Kaybı</th>
              <th className="text-right px-3 py-2.5 text-xs font-bold border-b" style={{ borderColor: "#e5e7eb" }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((s, i) => (
              <tr
                key={s.kullanici_id}
                style={{
                  background: i % 2 === 0 ? "white" : "#fafafa",
                  color: KOYU_METIN,
                }}
              >
                <td className="px-3 py-2.5 font-semibold">{s.genel_sira}</td>
                <td className="px-3 py-2.5 font-medium">{s.ad} {s.soyad}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: YESIL }}>{s.izleme_puani}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: YESIL }}>{s.cevaplama_puani}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: YESIL }}>{s.extra_puani}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: YESIL }}>{s.cc_gonderme_puani}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: YESIL }}>{s.cc_referral_puani}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: BORDO }}>{s.ileri_sarma_kaybi}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: BORDO }}>{s.yanlis_cevap_kaybi}</td>
                <td className="px-2 py-2.5 text-right" style={{ color: BORDO }}>{s.challenge_kaybi}</td>
                <td className="px-3 py-2.5 text-right font-bold">{s.toplam_net_puan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Media query stillemesi */}
     
    </div>
  );
}

// ─── Yardımcı bileşen: akordiyon detay satırı ────────────────────────────────

function DetaySatiri({ etiket, deger }: { etiket: string; deger: number }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span style={{ color: GRI_METIN }}>{etiket}:</span>
      <span style={{ color: KOYU_METIN, fontWeight: 500 }}>{deger}</span>
    </div>
  );
}