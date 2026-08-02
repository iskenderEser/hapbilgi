// app/talepler/_components/TalepListesi.tsx
//
// DEVAM EDEN TALEPLER: üretimi süren talepler (senaryo / video / soru seti
// aşamasındakiler + sistem hatası olanlar). Mobil kart + masaüstü tablo.
//
// 27.07 — kapsam daraldı (İskender kararı): üretimi BİTMİŞ talepler bu listede
// görünmez, onlar ana sayfadaki Yayın Listesi'ne aittir. İPTAL edilenler de
// burada değil, hemen altındaki kendi tablosunda. Eskiden üçü tek listedeydi ve
// Merve'nin 6 talebinin 5'i aslında bitmiş işti — liste %83 tekrar üretiyordu.
// Süzme sayfada (page.tsx) yapılır; bu bileşen ne süzer ne durum yorumlar.
//
// Arama ve kademeli listeleme merkezden (components/liste) — 40 liste ekranının
// hepsi aynı davranışı paylaşsın diye. Routing parent'ta.

"use client";

import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { type Talep, TUR_ROZET } from "../_types";
import { talepIdGoster } from "@/lib/utils/talepId";
import { Pill, VaryantPill, AsamaPill } from "@/components/pill";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";

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
  // Aranabilir alanları sayfa tanımlar; merkez "talep no" diye bir kavram bilmez.
  const liste = useListe({
    veri: talepler,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (t: Talep) => t.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (t: Talep) => t.urun_adi },
    ],
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {isUretici ? "Devam Eden Taleplerim" : "Devam Eden Talepler"}
          </span>
          <span className="text-xs text-gray-500">{liste.toplam} kayıt</span>
        </div>
        <ListeArama arama={liste.arama} />
      </div>

      {liste.toplam === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">
          {liste.hamToplam === 0
            ? (isUretici ? "Devam eden talebiniz yok." : "Devam eden talep bulunmuyor.")
            : "Aramanıza uyan talep bulunamadı."}
        </div>
      ) : (
        <>
          {/* MOBİL — kart görünümü */}
          <div className="md:hidden">
            {liste.gorunen.map((t) => {
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
                      {t.urun_adi !== "-" && rozet.etiket && (
                        <Pill renk={{ bg: rozet.bg, metin: rozet.renk, kenar: rozet.border }}>
                          {rozet.etiket}
                        </Pill>
                      )}
                      <VaryantPill hazirVideo={t.hazir_video} hazirSoruSeti={t.hazir_soru_seti} />
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" width="14" height="14">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <AsamaPill asama={t.asama} />
                    {t.teknik_adi !== "-" && <span className="text-xs text-gray-500">{t.teknik_adi}</span>}
                  </div>
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
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Aşama</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Soru Seti</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {liste.gorunen.map((t) => {
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
                          {t.urun_adi !== "-" && rozet.etiket && (
                            <Pill renk={{ bg: rozet.bg, metin: rozet.renk, kenar: rozet.border }}>
                              {rozet.etiket}
                            </Pill>
                          )}
                          <VaryantPill hazirVideo={t.hazir_video} hazirSoruSeti={t.hazir_soru_seti} kendiSatirinda={false} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {t.teknik_adi !== "-" ? (
                          t.teknik_adi
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3"><AsamaPill asama={t.asama} /></td>
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

          <DahaFazlaGoster
            dahaVar={liste.dahaVar}
            gorunenSayi={liste.gorunen.length}
            toplam={liste.toplam}
            onGoster={liste.dahaFazlaGoster}
          />
        </>
      )}
    </div>
  );
}
