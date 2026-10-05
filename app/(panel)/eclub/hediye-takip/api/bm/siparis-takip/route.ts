import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { bmTakipKapsaminiCoz, bmTakipListeKapsamlari } from "@/lib/eclub/hediyeTakip/bmTakipKapsami";
import { siparisTakipFiltreleriniParseEt } from "@/lib/eclub/hediyeTakip/siparisTakipFiltreleri";
import { siparisTakipVerisiniGetir } from "@/lib/eclub/hediyeTakip/siparisTakipListesi";
import type { SiparisTakipApiYaniti, SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";
import { hataYaniti, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";

const statTopla = (statlar: SiparisTakipStatlari[]) => ({ toplam: statlar.reduce((n, s) => n + s.toplam, 0), inceleme_bekliyor: statlar.reduce((n, s) => n + s.inceleme_bekliyor, 0), utt_onayladi: statlar.reduce((n, s) => n + s.utt_onayladi, 0), bm_onayladi: statlar.reduce((n, s) => n + s.bm_onayladi, 0), talep_iptal: statlar.reduce((n, s) => n + s.talep_iptal, 0) });

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authHatasi } = await supabase.auth.getUser();
    if (authHatasi || !user) return yetkiHatasi();
    const admin = createAdminClient();
    const erisim = await bmTakipKapsaminiCoz(admin, user.id, "yonetim");
    if (!erisim.ok) return erisim.detay ? hataYaniti(erisim.mesaj, "BM Sipariş Takip kapsamı", erisim.detay) : rolHatasi(erisim.mesaj);
    const filtre = siparisTakipFiltreleriniParseEt(request.nextUrl.searchParams);
    if (!filtre.ok) return validasyonHatasi(filtre.hata, filtre.alanlar);
    const listeKapsami = bmTakipListeKapsamlari(erisim.uttler, request.nextUrl.searchParams.get("utt_id"));
    if (!listeKapsami.ok) return rolHatasi(listeKapsami.mesaj);
    const tumFiltre = { ...filtre.filtreler, offset: 0, limit: Number.MAX_SAFE_INTEGER };
    const [listeParcalari, bolgeParcalari] = await Promise.all([
      Promise.all(listeKapsami.uttler.map(async (utt) => ({ utt, sonuc: await siparisTakipVerisiniGetir(admin, utt.kapsam, tumFiltre) }))),
      Promise.all(erisim.uttler.map((utt) => siparisTakipVerisiniGetir(admin, utt.kapsam, tumFiltre))),
    ]);
    const tumTalepler = listeParcalari.flatMap(({ utt, sonuc }) => sonuc.talepler.map((talep) => ({ ...talep, utt: { utt_id: utt.utt_id, utt_adi: utt.utt_adi }, onaylanabilir_mi: erisim.rol === "bm" && sonuc.bm_onay_hazir && talep.durum === "utt_onayladi" })))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.talep_id.localeCompare(b.talep_id));
    const talepler = tumTalepler.slice(filtre.filtreler.offset, filtre.filtreler.offset + filtre.filtreler.limit);
    const eczaneler = [...new Map(bolgeParcalari.flatMap((parca) => parca.filtre_secenekleri.eczaneler).map((x) => [x.id, x])).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr"));
    const urunler = [...new Map(bolgeParcalari.flatMap((parca) => parca.filtre_secenekleri.urunler).map((x) => [x.id, x])).values()].sort((a, b) => a.etiket.localeCompare(b.etiket, "tr"));
    const yanit: SiparisTakipApiYaniti & { uttler: Array<{ utt_id: string; utt_adi: string }> } = {
      bm_onay_hazir: bolgeParcalari.every((parca) => parca.bm_onay_hazir),
      statlar: statTopla(bolgeParcalari.map((parca) => parca.statlar)),
      filtre_secenekleri: { eczaneler, urunler },
      uttler: erisim.uttler.map(({ utt_id, utt_adi }) => ({ utt_id, utt_adi })),
      talepler,
      sayfalama: { toplam: tumTalepler.length, offset: filtre.filtreler.offset, limit: filtre.filtreler.limit, sonraki_kayit_var_mi: filtre.filtreler.offset + talepler.length < tumTalepler.length },
    };
    return NextResponse.json(yanit, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return sunucuHatasi(error, "GET /eclub/hediye-takip/api/bm/siparis-takip");
  }
}
