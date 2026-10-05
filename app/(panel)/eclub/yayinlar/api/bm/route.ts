import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { uttEczaneFirmaBaglari } from "@/lib/eclub/uttEczane";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";
import { ECLUB_HEDEF_ROLLER, YONLENDIRICI_ROLLER, hedefRolleriOku, type HedefRoller } from "@/lib/utils/roller";
import { gecerliTurBaslangiclari } from "@/lib/tclub/tur/kayit";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import type { BaremSatiri, SatisSartiTipi } from "@/lib/eclub/store/eclubStoreTipler";
import type { OgrenmeAraciTuru } from "@/lib/ogrenmeAraci/tipler";

interface SatisSartiSatiri { yayin_id: string; cek_karsiligi_var_mi: boolean | null; karsilik_puan: number | null; karsilik_tl: number | null; satis_sarti_tipi: SatisSartiTipi | null; gizli_sart_katlama_orani: number | null; barem_tablosu: BaremSatiri[] | null; }
interface OneriSatiri { oneri_id: string; yayin_id: string; arac_id: string; arac_turu: OgrenmeAraciTuru; kisi_id: string; oneri_baslangic: string; oneri_bitis: string; izlendi_mi: boolean | null; created_at: string | null; eclub_kisiler?: { ad: string | null; soyad: string | null; rol: string | null } | { ad: string | null; soyad: string | null; rol: string | null }[] | null; }
interface KisiBagi { kisi_id: string; eczane_id: string; baslangic_tarihi: string | null; bitis_tarihi: string | null; created_at: string | null; eclub_kisiler?: { kisi_id: string; rol: string; ad: string; soyad: string; auth_user_id: string | null } | { kisi_id: string; rol: string; ad: string; soyad: string; auth_user_id: string | null }[]; }
interface YayinAdi { yayin_id: string; urun_adi: string | null; teknik_adi: string | null; talep_no: number | null; firma_adi: string | null; hedef_roller: unknown; }

const tekil = <T,>(deger: T | T[] | null | undefined): T | null => Array.isArray(deger) ? (deger[0] ?? null) : (deger ?? null);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();
    const admin = createAdminClient();
    const { data: kullanici, error: kullaniciHatasi } = await admin.from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id, aktif_mi")
      .eq("kullanici_id", user.id).single();
    if (kullaniciHatasi || !kullanici) return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — BM E-Club Yayınları", kullaniciHatasi, 404);
    if (!kullanici.aktif_mi || !YONLENDIRICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) return rolHatasi("Bu görünüm yalnız BM ve TM rollerine açıktır.");

    const kapsam = await eclubYonetimKapsaminiGetir(admin, kullanici);
    const istenenUttId = request.nextUrl.searchParams.get("utt_id");
    const seciliUtt = istenenUttId
      ? kapsam.uttler.find((utt) => utt.utt_id === istenenUttId)
      : kapsam.uttler[0];
    if (istenenUttId && !seciliUtt) return rolHatasi("Seçilen UTT, yönetim kapsamında değildir.");
    if (!seciliUtt) return NextResponse.json({ uttler: [], secili_utt_id: null, yayinlar: [], kisiler: [], oneriler: [], bolge_gonderilen_yayin_idleri: [] }, { headers: { "Cache-Control": "private, no-store" } });

    const uttIdler = kapsam.uttler.map((utt) => utt.utt_id);
    const [hamYayinlar, seciliOneriSonucu, bolgeOneriSonucu, baglar] = await Promise.all([
      getYayindakiVideolar(seciliUtt.utt_id, seciliUtt.rol, admin),
      admin.from("eclub_oneri_kayitlari").select("oneri_id, yayin_id, arac_id, arac_turu, kisi_id, oneri_baslangic, oneri_bitis, izlendi_mi, created_at, eclub_kisiler ( ad, soyad, rol )").eq("oneren_id", seciliUtt.utt_id).order("created_at", { ascending: false }),
      admin.from("eclub_oneri_kayitlari").select("yayin_id").in("oneren_id", uttIdler),
      uttEczaneFirmaBaglari(admin, seciliUtt.utt_id),
    ]);
    if (seciliOneriSonucu.error) return hataYaniti("Gönderim geçmişi alınamadı.", "eclub_oneri_kayitlari SELECT — BM seçili UTT", seciliOneriSonucu.error);
    if (bolgeOneriSonucu.error) return hataYaniti("Bölge gönderim toplamı alınamadı.", "eclub_oneri_kayitlari SELECT — BM bölgesi", bolgeOneriSonucu.error);

    const eclubYayinlari = hamYayinlar.filter((yayin) => yayin.hedef_roller.some((rol) => ECLUB_HEDEF_ROLLER.includes(rol)));
    const yayinIdler = eclubYayinlari.map((yayin) => yayin.yayin_id);
    const soruMap = new Map<string, number>();
    const sartMap = new Map<string, SatisSartiSatiri>();
    const tamamlananIncelemeler = new Set<string>();
    if (yayinIdler.length > 0) {
      const [sorular, sartlar, incelemeler, turler] = await Promise.all([
        admin.from("v_yayin_detay").select("yayin_id, video_basi_soru_sayisi").in("yayin_id", yayinIdler),
        admin.from("yayin_yonetimi").select("yayin_id, cek_karsiligi_var_mi, karsilik_puan, karsilik_tl, satis_sarti_tipi, gizli_sart_katlama_orani, barem_tablosu").in("yayin_id", yayinIdler),
        admin.from("eclub_utt_yayin_incelemeleri").select("yayin_id, arac_id, tur_baslangici, tamamlandi_at").eq("utt_id", seciliUtt.utt_id).in("yayin_id", yayinIdler).not("tamamlandi_at", "is", null),
        gecerliTurBaslangiclari(admin, yayinIdler, true),
      ]);
      if (sorular.error) return hataYaniti("Yayın soru sayıları alınamadı.", "v_yayin_detay SELECT — BM", sorular.error);
      if (sartlar.error) return hataYaniti("Yayın koşulları alınamadı.", "yayin_yonetimi SELECT — BM", sartlar.error);
      if (incelemeler.error) return hataYaniti("Gönderim incelemeleri alınamadı.", "eclub_utt_yayin_incelemeleri SELECT — BM", incelemeler.error);
      for (const satir of sorular.data ?? []) soruMap.set(satir.yayin_id, satir.video_basi_soru_sayisi ?? 0);
      for (const satir of (sartlar.data ?? []) as SatisSartiSatiri[]) sartMap.set(satir.yayin_id, satir);
      const tarihMap = new Map(eclubYayinlari.map((yayin) => [yayin.yayin_id, yayin.yayin_tarihi]));
      const aracMap = new Map(eclubYayinlari.map((yayin) => [yayin.yayin_id, yayin.arac_id]));
      for (const inceleme of incelemeler.data ?? []) {
        const baslangic = turler[inceleme.yayin_id]?.baslangic_tarihi ?? tarihMap.get(inceleme.yayin_id);
        if (baslangic && inceleme.arac_id === aracMap.get(inceleme.yayin_id) && new Date(inceleme.tamamlandi_at).getTime() >= new Date(baslangic).getTime()) tamamlananIncelemeler.add(inceleme.yayin_id);
      }
    }
    const yayinlar = eclubYayinlari.map((yayin) => {
      const sart = sartMap.get(yayin.yayin_id);
      return { ...yayin, arac_id: yayin.arac_id!, arac_turu: yayin.arac_turu!, soru_sayisi: soruMap.get(yayin.yayin_id) ?? 0, cek_karsiligi_var_mi: sart?.cek_karsiligi_var_mi ?? null, karsilik_puan: sart?.karsilik_puan ?? null, karsilik_tl: sart?.karsilik_tl ?? null, satis_sarti_tipi: sart?.satis_sarti_tipi ?? null, gizli_sart_katlama_orani: sart?.gizli_sart_katlama_orani ?? null, barem_tablosu: sart?.barem_tablosu ?? null, gonderim_incelemesi_tamamlandi: tamamlananIncelemeler.has(yayin.yayin_id) };
    });

    const firmaBaglari = baglar.filter((bag) => bag.firmaId === kullanici.firma_id);
    const eczaneIdler = [...new Set(firmaBaglari.map((bag) => bag.eczaneId))];
    const [kisiBagSonucu, eczaneSonucu] = eczaneIdler.length > 0 ? await Promise.all([
      admin.from("eclub_kisi_eczane").select("kisi_id, eczane_id, baslangic_tarihi, bitis_tarihi, created_at, eclub_kisiler ( kisi_id, rol, ad, soyad, auth_user_id )").in("eczane_id", eczaneIdler).eq("aktif_mi", true),
      admin.from("eclub_eczaneler").select("eczane_id, gln, eclub_eczane_master ( eczane_adi )").in("eczane_id", eczaneIdler),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (kisiBagSonucu.error) return hataYaniti("UTT kadrosu alınamadı.", "eclub_kisi_eczane SELECT — BM", kisiBagSonucu.error);
    if (eczaneSonucu.error) return hataYaniti("UTT eczaneleri alınamadı.", "eclub_eczaneler SELECT — BM", eczaneSonucu.error);
    const eczaneAdiMap = new Map<string, string>();
    for (const eczane of eczaneSonucu.data ?? []) {
      const master = tekil(eczane.eclub_eczane_master as { eczane_adi: string } | { eczane_adi: string }[] | null);
      eczaneAdiMap.set(eczane.eczane_id, master?.eczane_adi ?? "-");
    }
    const kisiBaglari = (kisiBagSonucu.data ?? []) as KisiBagi[];
    const kisiler = kisiBaglari.filter((bag) => bag.bitis_tarihi === null).flatMap((bag) => {
      const kisi = tekil(bag.eclub_kisiler);
      return kisi ? [{ ...kisi, eczane_adi: eczaneAdiMap.get(bag.eczane_id) ?? null, aktif_mi: true }] : [];
    });

    const oneriSatirlari = (seciliOneriSonucu.data ?? []) as OneriSatiri[];
    const gecmisKisiIdleri = [...new Set(oneriSatirlari.map((oneri) => oneri.kisi_id))];
    const gecmisBagSonucu = gecmisKisiIdleri.length > 0
      ? await admin.from("eclub_kisi_eczane").select("kisi_id, eczane_id, baslangic_tarihi, bitis_tarihi, created_at").in("kisi_id", gecmisKisiIdleri)
      : { data: [], error: null };
    if (gecmisBagSonucu.error) return hataYaniti("Geçmiş eczane bağları alınamadı.", "eclub_kisi_eczane SELECT — BM geçmiş", gecmisBagSonucu.error);
    const gecmisEczaneIdler = [...new Set((gecmisBagSonucu.data ?? []).map((bag) => bag.eczane_id))];
    if (gecmisEczaneIdler.some((id) => !eczaneAdiMap.has(id))) {
      const eksik = gecmisEczaneIdler.filter((id) => !eczaneAdiMap.has(id));
      const { data: eskiEczaneler, error } = await admin.from("eclub_eczaneler").select("eczane_id, eclub_eczane_master ( eczane_adi )").in("eczane_id", eksik);
      if (error) return hataYaniti("Geçmiş eczane adları alınamadı.", "eclub_eczaneler SELECT — BM geçmiş", error);
      for (const eczane of eskiEczaneler ?? []) {
        const master = tekil(eczane.eclub_eczane_master as { eczane_adi: string } | { eczane_adi: string }[] | null);
        eczaneAdiMap.set(eczane.eczane_id, master?.eczane_adi ?? "-");
      }
    }
    const yayinAdiMap = new Map<string, YayinAdi>();
    const gecmisYayinIdler = [...new Set(oneriSatirlari.map((oneri) => oneri.yayin_id))];
    if (gecmisYayinIdler.length > 0) {
      const { data, error } = await admin.from("v_yayin_detay").select("yayin_id, urun_adi, teknik_adi, talep_no, firma_adi, hedef_roller").in("yayin_id", gecmisYayinIdler);
      if (error) return hataYaniti("Geçmiş yayın bilgileri alınamadı.", "v_yayin_detay SELECT — BM geçmiş", error);
      for (const yayin of (data ?? []) as YayinAdi[]) yayinAdiMap.set(yayin.yayin_id, yayin);
    }
    const baglarByKisi = new Map<string, { eczane_id: string; baslangic_tarihi: string | null; bitis_tarihi: string | null; created_at: string | null }[]>();
    for (const bag of gecmisBagSonucu.data ?? []) baglarByKisi.set(bag.kisi_id, [...(baglarByKisi.get(bag.kisi_id) ?? []), bag]);
    const oneriler = oneriSatirlari.map((oneri) => {
      const zaman = new Date(oneri.created_at ?? oneri.oneri_baslangic).getTime();
      const bag = (baglarByKisi.get(oneri.kisi_id) ?? []).filter((aday) => {
        const baslangic = aday.baslangic_tarihi ?? aday.created_at;
        return (!baslangic || new Date(baslangic).getTime() <= zaman) && (!aday.bitis_tarihi || zaman < new Date(aday.bitis_tarihi).getTime());
      }).sort((a, b) => new Date(b.baslangic_tarihi ?? b.created_at ?? 0).getTime() - new Date(a.baslangic_tarihi ?? a.created_at ?? 0).getTime())[0];
      const kisi = tekil(oneri.eclub_kisiler);
      const yayin = yayinAdiMap.get(oneri.yayin_id);
      return { oneri_id: oneri.oneri_id, yayin_id: oneri.yayin_id, arac_id: oneri.arac_id, arac_turu: oneri.arac_turu, urun_adi: yayin?.urun_adi ?? "-", teknik_adi: yayin?.teknik_adi ?? "-", talep_no: yayin?.talep_no ?? null, firma_adi: yayin?.firma_adi ?? null, hedef_roller: yayin ? hedefRolleriOku(yayin) as HedefRoller : [], kisi_id: oneri.kisi_id, kisi_ad: kisi?.ad ?? "-", kisi_soyad: kisi?.soyad ?? "-", kisi_rol: kisi?.rol ?? null, eczane_adi: bag ? eczaneAdiMap.get(bag.eczane_id) ?? "-" : "-", oneri_baslangic: oneri.oneri_baslangic, oneri_bitis: oneri.oneri_bitis, izlendi_mi: oneri.izlendi_mi ?? false, created_at: oneri.created_at ?? oneri.oneri_baslangic };
    });

    return NextResponse.json({ uttler: kapsam.uttler.map((utt) => ({ utt_id: utt.utt_id, utt_adi: utt.utt_adi, bm_id: utt.bm_id, bm_adi: utt.bm_adi, bolge_adi: utt.bolge_adi })), secili_utt_id: seciliUtt.utt_id, yayinlar, kisiler, oneriler, bolge_gonderilen_yayin_idleri: [...new Set((bolgeOneriSonucu.data ?? []).map((kayit) => kayit.yayin_id))] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/yayinlar/api/bm");
  }
}
