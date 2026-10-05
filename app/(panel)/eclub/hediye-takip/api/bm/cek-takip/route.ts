import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { bmTakipKapsaminiCoz, bmTakipListeKapsamlari } from "@/lib/eclub/hediyeTakip/bmTakipKapsami";
import { cekTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/cekTakipFiltreleri";
import { cekTakipFiltreSecenekleriniGetir } from "@/lib/eclub/hediyeTakip/cekTakipFiltreSecenekleri";
import { cekTakipTalepleriniGetir } from "@/lib/eclub/hediyeTakip/cekTakipListesi";
import { cekTakipStatlariniGetir } from "@/lib/eclub/hediyeTakip/cekTakipStatlari";
import type { CekTakipFiltreSecenekleri, CekTakipStatlari, CekTakipIslemi } from "@/lib/eclub/hediyeTakip/cekTakip";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

const bosStat = (): CekTakipStatlari => ({ toplam: 0, onay_surecinde: 0, teslimat_surecinde: 0, tamamlanan: 0 });
const statTopla = (hedef: CekTakipStatlari, kaynak: CekTakipStatlari) => { hedef.toplam += kaynak.toplam; hedef.onay_surecinde += kaynak.onay_surecinde; hedef.teslimat_surecinde += kaynak.teslimat_surecinde; hedef.tamamlanan += kaynak.tamamlanan; };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();
    const admin = createAdminClient();
    const erisim = await bmTakipKapsaminiCoz(admin, user.id, "yonetim");
    if (!erisim.ok) return erisim.detay ? hataYaniti(erisim.mesaj, "BM Çek Takip kapsamı", erisim.detay) : rolHatasi(erisim.mesaj);
    const filtre = cekTakipFiltreleriniParseEt(request.nextUrl.searchParams);
    if (!filtre.ok) return validasyonHatasi(filtre.hata, filtre.alanlar);
    const listeKapsami = bmTakipListeKapsamlari(erisim.uttler, request.nextUrl.searchParams.get("utt_id"));
    if (!listeKapsami.ok) return rolHatasi(listeKapsami.mesaj);

    const tumFiltre = { ...filtre.filtreler, offset: 0, limit: Number.MAX_SAFE_INTEGER };
    const [listeParcalari, statParcalari, secenekParcalari] = await Promise.all([
      Promise.all(listeKapsami.uttler.map(async (utt) => ({ utt, sonuc: await cekTakipTalepleriniGetir(admin, utt.kapsam, tumFiltre) }))),
      Promise.all(erisim.uttler.map((utt) => cekTakipStatlariniGetir(admin, utt.kapsam, filtre.filtreler))),
      Promise.all(erisim.uttler.map((utt) => cekTakipFiltreSecenekleriniGetir(admin, utt.kapsam))),
    ]);
    const statlar = bosStat();
    statParcalari.forEach((stat) => statTopla(statlar, stat));
    const tumTalepler = listeParcalari.flatMap(({ utt, sonuc }) => sonuc.talepler.map((talep) => ({ ...talep, utt: { utt_id: utt.utt_id, utt_adi: utt.utt_adi }, izin_verilen_islemler: (erisim.rol === "tm"
      ? talep.durum === "tm_onayinda" && talep.onay.tm.kullanici_id === user.id ? ["tm_onayla"] : []
      : talep.durum === "bm_onayinda" && talep.onay.bm.kullanici_id === user.id ? ["bm_onayla"] : []) as CekTakipIslemi[] })))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.talep_id.localeCompare(b.talep_id));
    const talepler = tumTalepler.slice(filtre.filtreler.offset, filtre.filtreler.offset + filtre.filtreler.limit);
    const secenekler: CekTakipFiltreSecenekleri = {
      eczaneler: [...new Map(secenekParcalari.flatMap((parca) => parca.eczaneler).map((x) => [x.eczane_id, x])).values()].sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr")),
      uyeler: [...new Map(secenekParcalari.flatMap((parca) => parca.uyeler).map((x) => [x.kisi_id, x])).values()].sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, "tr")),
      urunler: [...new Map(secenekParcalari.flatMap((parca) => parca.urunler).map((x) => [x.urun_id, x])).values()].sort((a, b) => a.urun_adi.localeCompare(b.urun_adi, "tr")),
    };
    return NextResponse.json({ statlar, filtre_secenekleri: secenekler, uttler: erisim.uttler.map(({ utt_id, utt_adi }) => ({ utt_id, utt_adi })), talepler, sayfalama: { toplam: tumTalepler.length, offset: filtre.filtreler.offset, limit: filtre.filtreler.limit, sonraki_kayit_var_mi: filtre.filtreler.offset + talepler.length < tumTalepler.length } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/hediye-takip/api/bm/cek-takip");
  }
}
