// app/talepler-v2/_components/IsListesi.tsx
//
// Sol kolon — üretimi devam eden taleplerin iş kuyruğu.
//
// Bugün AŞAMA bilgisi Talepler sayfasında, DURUM bilgisi Senaryolar/Videolar/
// Soru Setleri sayfalarında duruyor; kullanıcı "nerede" ve "kimde" sorularını iki
// ayrı ekrandan topluyordu. Bu listede ikisi yan yana.
//
// Satır tıklaması ROTA DEĞİŞTİRMEZ, yalnız sağdaki şeridi seçer — sayfanın
// temel ilkesi bu (aşama ayrı bir yer değil, talebin içindeki adım).
//
// Sıra önemli: önce aşama süzgeci, sonra arama, sonra kademeli listeleme.
// Arama ve "daha fazla göster" merkezden (components/liste); süzme ve seçim
// sayfanın hook'unda — bu bileşen ne süzer ne durum yorumlar.

"use client";

import { useState } from "react";
import { TALEP_TURU_KURALLARI } from "@/lib/uretici/yetenekler";
import { talepIdGoster } from "@/lib/utils/talepId";
import { ureticiDurumMesaji } from "@/lib/utils/durum/mesaj";
import { AsamaPill, DurumPill } from "@/components/pill";
import { useListe, ListeArama, DahaFazlaGoster } from "@/components/liste";
import { ASAMA_SUZGEC_SECENEKLERI, type AsamaSuzgeci, type TalepSatiri } from "../_types";

interface Props {
  talepler: TalepSatiri[];
  seciliTalepId: string | null;
  rol: string;
  onSec: (talep_id: string) => void;
}

/** Ürünsüz türlerde (medikal / İK) izleyiciye görünen ad türün kendi adıdır. */
const baslikVer = (t: TalepSatiri) =>
  t.urun_adi !== "-" ? t.urun_adi : (TALEP_TURU_KURALLARI[t.egitim_turu]?.ad ?? t.egitim_turu);

export function IsListesi({ talepler, seciliTalepId, rol, onSec }: Props) {
  const [asamaSuzgeci, setAsamaSuzgeci] = useState<AsamaSuzgeci>("hepsi");

  const asamaSuzulmus =
    asamaSuzgeci === "hepsi" ? talepler : talepler.filter((t) => t.asama === asamaSuzgeci);

  // Aranabilir alanları sayfa tanımlar; merkez "talep no" diye bir kavram bilmez.
  const liste = useListe({
    veri: asamaSuzulmus,
    aramaAlanlari: [
      { anahtar: "no", etiket: "Talep No", deger: (t: TalepSatiri) => t.talep_no },
      { anahtar: "ad", etiket: "Ürün / Eğitim", deger: (t: TalepSatiri) => baslikVer(t) },
    ],
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">Devam Eden Taleplerim</span>
          <span className="text-xs text-gray-500">{liste.toplam} kayıt</span>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <select
            value={asamaSuzgeci}
            onChange={(e) => setAsamaSuzgeci(e.target.value as AsamaSuzgeci)}
            className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer outline-none"
            style={{ fontFamily: "'Nunito', sans-serif" }}
          >
            {ASAMA_SUZGEC_SECENEKLERI.map((s) => (
              <option key={s.deger} value={s.deger}>{s.etiket}</option>
            ))}
          </select>
          <ListeArama arama={liste.arama} />
        </div>
      </div>

      {liste.toplam === 0 ? (
        <div className="p-10 text-center text-sm text-gray-400">
          {talepler.length === 0
            ? "Devam eden talebiniz yok."
            : liste.hamToplam === 0
            ? "Bu aşamada talep yok."
            : "Aramanıza uyan talep bulunamadı."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-2.5 text-gray-400 font-medium text-xs uppercase">ID</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Ürün / Eğitim</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Teknik</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Aşama</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-medium text-xs uppercase">Durum</th>
                </tr>
              </thead>
              <tbody>
                {liste.gorunen.map((t) => {
                  // "Top kimde" sorusunun cevabı sözlükten okunur; burada durum
                  // listesi yazılmaz — sözlük değişirse bu satır kendiliğinden uyar.
                  const aksiyonBende = ureticiDurumMesaji(t.durum_kodu).top === "uretici";
                  const secili = t.talep_id === seciliTalepId;
                  return (
                    <tr
                      key={t.talep_id}
                      onClick={() => onSec(t.talep_id)}
                      className="border-b border-gray-50 cursor-pointer transition-colors duration-100"
                      style={{
                        background: secili ? "#f0f7ff" : undefined,
                        boxShadow: aksiyonBende ? "inset 3px 0 0 0 #bc2d0d" : undefined,
                      }}
                    >
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {talepIdGoster(t.firma_adi, t.talep_no)}
                      </td>
                      {/* Yalnız ad. Üretim varyantı ve tarih BURAYA yazılmaz
                          (İskender 28.07): süreci Durum sütunu ve sağdaki şerit
                          anlatıyor, listede tekrarı gürültü. */}
                      <td className="px-3 py-3 text-gray-900">
                        <span style={{ fontWeight: aksiyonBende ? 700 : 500 }}>{baslikVer(t)}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {t.teknik_adi !== "-" ? t.teknik_adi : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3"><AsamaPill asama={t.asama} /></td>
                      <td className="px-3 py-3"><DurumPill kod={t.durum_kodu} rol={rol} tarih={t.created_at} /></td>
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
