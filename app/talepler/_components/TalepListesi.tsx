// app/talepler/_components/TalepListesi.tsx
//
// Talepler listesi: mobil kart görünümü + masaüstü tablo görünümü.
// Tüm liste kartını (dış sarmal + başlık + boş durum + satırlar) kapsar.
// Routing parent'ta — bu bileşen sadece tıklama olayını yukarı bildirir.

"use client";

import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { type Talep, TUR_ROZET } from "../_types";
import { talepIdGoster } from "@/lib/utils/talepId";

interface TalepListesiProps {
  talepler: Talep[];
  isUretici: boolean;
  okunmamisIdler: Set<string>;
  formatTarih: (tarih: string) => string;
  onTalepClick: (talep_id: string) => void;
}

// Her satır için ortak hesaplanan görsel veriler.
function talepGorselVerisi(t: Talep, okunmamisIdler: Set<string>) {
  const okunmamis = okunmamisIdler.has(t.talep_id);
  const rozet = TUR_ROZET[t.egitim_turu];
  const turAdi = TALEP_TURU_KURALLARI[t.egitim_turu]?.ad ?? t.egitim_turu;
  const baslik = t.urun_adi !== "-" ? t.urun_adi : turAdi;
  return { okunmamis, rozet, baslik };
}

export function TalepListesi({
  talepler,
  isUretici,
  okunmamisIdler,
  formatTarih,
  onTalepClick,
}: TalepListesiProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">
          {isUretici ? "Taleplerim" : "Tüm Talepler"}
        </span>
        <span className="text-xs text-gray-500">{talepler.length} kayıt</span>
      </div>

      {talepler.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">
          {isUretici ? "Henüz talep oluşturmadınız." : "Henüz talep bulunmuyor."}
        </div>
      ) : (
        <>
          {/* MOBİL — kart görünümü */}
          <div className="md:hidden">
            {talepler.map((t) => {
              const { okunmamis, rozet, baslik } = talepGorselVerisi(t, okunmamisIdler);
              return (
                <div
                  key={t.talep_id}
                  onClick={() => onTalepClick(t.talep_id)}
                  className="relative px-4 py-3 border-b border-gray-50 cursor-pointer"
                  style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}
                >
                  <div className="text-xs text-gray-500 mb-1">{talepIdGoster(t.firma_adi, t.talep_no)}</div>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {okunmamis && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: "#bc2d0d" }}
                        />
                      )}
                      <span
                        className="text-sm text-gray-900"
                        style={{ fontWeight: okunmamis ? 700 : 600 }}
                      >
                        {baslik}
                      </span>
                      {rozet.etiket && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: rozet.bg,
                            color: rozet.renk,
                            border: `0.5px solid ${rozet.border}`,
                            fontSize: 9,
                          }}
                        >
                          {rozet.etiket}
                        </span>
                      )}
                      {t.hazir_video && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: "#fff7ed",
                            color: "#c2410c",
                            border: "0.5px solid #fed7aa",
                            fontSize: 9,
                          }}
                        >
                          Hazır Video
                        </span>
                      )}
                      {t.hazir_soru_seti && (
                        <span
                          className="text-xs font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "0.5px solid #bfdbfe",
                            fontSize: 9,
                          }}
                        >
                          Hazır Soru Seti
                        </span>
                      )}
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="14" height="14">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  {t.teknik_adi !== "-" && (
                    <div className="text-xs text-gray-500">{t.teknik_adi}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{formatTarih(t.created_at)}</div>
                </div>
              );
            })}
          </div>

          {/* MASAÜSTÜ — tablo görünümü */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Tür</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik Adı</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru Seti</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {talepler.map((t) => {
                  const { okunmamis, rozet, baslik } = talepGorselVerisi(t, okunmamisIdler);
                  return (
                    <tr
                      key={t.talep_id}
                      onClick={() => onTalepClick(t.talep_id)}
                      className="border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-100"
                      style={okunmamis ? { boxShadow: "inset 3px 0 0 0 #bc2d0d" } : undefined}
                    >
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{talepIdGoster(t.firma_adi, t.talep_no)}</td>
                      <td className="px-3 py-3 text-gray-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {okunmamis && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: "#bc2d0d" }}
                            />
                          )}
                          <span style={{ fontWeight: okunmamis ? 700 : 500 }}>{baslik}</span>
                          {rozet.etiket && (
                            <span
                              className="font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                fontSize: 9,
                                background: rozet.bg,
                                color: rozet.renk,
                                border: `0.5px solid ${rozet.border}`,
                              }}
                            >
                              {rozet.etiket}
                            </span>
                          )}
                          {t.hazir_video && (
                            <span
                              className="font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                fontSize: 9,
                                background: "#fff7ed",
                                color: "#c2410c",
                                border: "0.5px solid #fed7aa",
                              }}
                            >
                              Hazır Video
                            </span>
                          )}
                          {t.hazir_soru_seti && (
                            <span
                              className="font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{
                                fontSize: 9,
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "0.5px solid #bfdbfe",
                              }}
                            >
                              Hazır Soru Seti
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {t.teknik_adi !== "-" ? (
                          t.teknik_adi
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-gray-500">{t.soru_seti_buyuklugu} soru</span>
                        <span className="text-xs text-gray-400 ml-1">
                          / {t.video_basi_soru_sayisi} göster
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(t.created_at)}</td>
                      <td className="px-5 py-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="16" height="16">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}