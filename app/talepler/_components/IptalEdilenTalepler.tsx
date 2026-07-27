// app/talepler/_components/IptalEdilenTalepler.tsx
//
// İPTAL EDİLEN TALEPLER (27.07 — İskender kararı).
//
// Neden Talepler sayfasında, ana sayfada değil: iptal edilen talep hiç içerik
// üretmedi, yani yayın tarafında hiç var olmadı. Onu Yayın Listesi'ne koymak,
// olmayan bir yayının kaydını yayın ekranında tutmak olurdu. Mutfakta doğdu,
// mutfakta öldü — kaydı da mutfakta durur.
//
// Amaç geriye bakmak: "ne iptal ettik, hangi aşamada, iş kimdeydi". Bir sonraki
// talepte daha dikkatli olmayı sağlar. Bu yüzden tıklanabilir değil — kapalı iş.
//
// Boşsa hiç çizilmez: iptali olmayan üreticinin sayfasında boş bir kutu durmasın.

"use client";

import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { type Talep, TUR_ROZET } from "../_types";
import { talepIdGoster } from "@/lib/utils/talepId";
import { Pill, AsamaPill } from "@/components/pill";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";

interface Props {
  talepler: Talep[];
  formatTarih: (tarih: string) => string;
}

export function IptalEdilenTalepler({ talepler, formatTarih }: Props) {
  const liste = useListe({
    veri: talepler,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (t: Talep) => t.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (t: Talep) => t.urun_adi },
    ],
  });

  if (talepler.length === 0) return null;

  const baslikVer = (t: Talep) =>
    t.urun_adi !== "-" ? t.urun_adi : (TALEP_TURU_KURALLARI[t.egitim_turu]?.ad ?? t.egitim_turu);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">İptal Edilen Talepler</span>
          <span className="text-xs text-gray-500">{liste.toplam} kayıt</span>
        </div>
        <ListeArama arama={liste.arama} />
      </div>

      {liste.toplam === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">Aramanıza uyan kayıt bulunamadı.</div>
      ) : (
        <>
          {/* MOBİL */}
          <div className="md:hidden">
            {liste.gorunen.map((t) => {
              const rozet = TUR_ROZET[t.egitim_turu];
              return (
                <div key={t.talep_id} className="px-4 py-3 border-b border-gray-50">
                  <div className="text-xs text-gray-500 mb-1">{talepIdGoster(t.firma_adi, t.talep_no)}</div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-gray-500">{baslikVer(t)}</span>
                    {t.urun_adi !== "-" && rozet.etiket && (
                      <Pill renk={{ bg: rozet.bg, metin: rozet.renk, kenar: rozet.border }}>{rozet.etiket}</Pill>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AsamaPill asama={t.asama} />
                    {t.iu_ad_soyad && <span className="text-xs text-gray-500">{t.iu_ad_soyad}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatTarih(t.created_at)}</div>
                </div>
              );
            })}
          </div>

          {/* MASAÜSTÜ */}
          <div className="hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Tür</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">İptal Aşaması</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">İçerik Üreticisi</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {liste.gorunen.map((t) => {
                  const rozet = TUR_ROZET[t.egitim_turu];
                  return (
                    <tr key={t.talep_id} className="border-b border-gray-50">
                      <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{talepIdGoster(t.firma_adi, t.talep_no)}</td>
                      <td className="px-3 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{baslikVer(t)}</span>
                          {t.urun_adi !== "-" && rozet.etiket && (
                            <Pill renk={{ bg: rozet.bg, metin: rozet.renk, kenar: rozet.border }}>{rozet.etiket}</Pill>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3"><AsamaPill asama={t.asama} /></td>
                      <td className="px-3 py-3 text-gray-500 text-xs">
                        {t.iu_ad_soyad ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{formatTarih(t.created_at)}</td>
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
