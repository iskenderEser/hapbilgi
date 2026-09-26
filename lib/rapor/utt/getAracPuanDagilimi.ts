import type { SupabaseClient } from '@/lib/types/rapor';
import type { OgrenmeAraciTuru } from '@/lib/ogrenmeAraci/tipler';

const ARAC_TURLERI: OgrenmeAraciTuru[] = ['video', 'podcast', 'gorsel', 'flip_pdf'];

export interface AracPuanDagilimiSatiri {
  arac_turu: OgrenmeAraciTuru;
  tamamlama_puani: number;
  dogru_cevap_puani: number;
  oneri_puani: number;
  extra_puani: number;
  eclub_puani: number;
  ileri_sarma_kaybi: number;
  yanlis_cevap_kaybi: number;
  oneri_kaybi: number;
  kazanilan_toplam: number;
  kaybedilen_toplam: number;
  net_puan: number;
}

type PuanKaydi = { yayin_id: string; puan_turu?: string; puan?: number; kaybedilen_puan?: number };

export async function getAracPuanDagilimi(
  db: SupabaseClient,
  kullaniciId: string,
  baslangic: string,
  bitis: string,
): Promise<AracPuanDagilimiSatiri[]> {
  const [kazanimlar, eclubKazanimlari, ileriSarma, yanlisCevap, oneriKaybi] = await Promise.all([
    db.from('kazanilan_puanlar').select('yayin_id, puan_turu, puan')
      .eq('kullanici_id', kullaniciId).gte('created_at', baslangic).lte('created_at', bitis),
    db.from('eclub_utt_puanlari').select('yayin_id, puan')
      .eq('utt_id', kullaniciId).gte('created_at', baslangic).lte('created_at', bitis),
    db.from('ileri_sarma_kayitlari').select('yayin_id, kaybedilen_puan')
      .eq('kullanici_id', kullaniciId).gte('created_at', baslangic).lte('created_at', bitis),
    db.from('yanlis_cevap_kayitlari').select('yayin_id, kaybedilen_puan')
      .eq('kullanici_id', kullaniciId).gte('created_at', baslangic).lte('created_at', bitis),
    db.from('oneri_kayip_kayitlari').select('yayin_id, kaybedilen_puan')
      .eq('kullanici_id', kullaniciId).gte('created_at', baslangic).lte('created_at', bitis),
  ]);

  const hata = kazanimlar.error ?? eclubKazanimlari.error ?? ileriSarma.error ?? yanlisCevap.error ?? oneriKaybi.error;
  if (hata) throw new Error(`Öğrenme aracı puan dağılımı alınamadı: ${hata.message}`);

  const tumKayitlar = [
    ...(kazanimlar.data ?? []),
    ...(eclubKazanimlari.data ?? []),
    ...(ileriSarma.data ?? []),
    ...(yanlisCevap.data ?? []),
    ...(oneriKaybi.data ?? []),
  ] as PuanKaydi[];
  const yayinIdleri = [...new Set(tumKayitlar.map((kayit) => kayit.yayin_id).filter(Boolean))];
  const aracHaritasi = new Map<string, OgrenmeAraciTuru>();

  if (yayinIdleri.length > 0) {
    const { data: yayinlar, error } = await db.from('v_yayin_kunye')
      .select('yayin_id, arac_turu')
      .in('yayin_id', yayinIdleri);
    if (error) throw new Error(`Yayınların öğrenme aracı türü alınamadı: ${error.message}`);
    for (const yayin of yayinlar ?? []) {
      const aracTuru = ARAC_TURLERI.includes(yayin.arac_turu as OgrenmeAraciTuru)
        ? yayin.arac_turu as OgrenmeAraciTuru
        : 'video';
      aracHaritasi.set(yayin.yayin_id, aracTuru);
    }
  }

  const sonuc = new Map<OgrenmeAraciTuru, AracPuanDagilimiSatiri>(ARAC_TURLERI.map((arac_turu) => [arac_turu, {
    arac_turu,
    tamamlama_puani: 0,
    dogru_cevap_puani: 0,
    oneri_puani: 0,
    extra_puani: 0,
    eclub_puani: 0,
    ileri_sarma_kaybi: 0,
    yanlis_cevap_kaybi: 0,
    oneri_kaybi: 0,
    kazanilan_toplam: 0,
    kaybedilen_toplam: 0,
    net_puan: 0,
  }]));

  const eslesmeyenYayinIdleri = yayinIdleri.filter((yayinId) => !aracHaritasi.has(yayinId));
  if (eslesmeyenYayinIdleri.length > 0) {
    throw new Error('Bazı puan kayıtlarının öğrenme aracı türü çözümlenemedi.');
  }

  const satir = (yayinId: string) => sonuc.get(aracHaritasi.get(yayinId)!)!;
  for (const kayit of (kazanimlar.data ?? []) as PuanKaydi[]) {
    const hedef = satir(kayit.yayin_id);
    const puan = Number(kayit.puan ?? 0);
    if (kayit.puan_turu === 'izleme') hedef.tamamlama_puani += puan;
    else if (kayit.puan_turu === 'cevaplama') hedef.dogru_cevap_puani += puan;
    else if (kayit.puan_turu === 'oneri') hedef.oneri_puani += puan;
    else if (kayit.puan_turu === 'extra') hedef.extra_puani += puan;
  }
  for (const kayit of (eclubKazanimlari.data ?? []) as PuanKaydi[]) satir(kayit.yayin_id).eclub_puani += Number(kayit.puan ?? 0);
  for (const kayit of (ileriSarma.data ?? []) as PuanKaydi[]) satir(kayit.yayin_id).ileri_sarma_kaybi += Number(kayit.kaybedilen_puan ?? 0);
  for (const kayit of (yanlisCevap.data ?? []) as PuanKaydi[]) satir(kayit.yayin_id).yanlis_cevap_kaybi += Number(kayit.kaybedilen_puan ?? 0);
  for (const kayit of (oneriKaybi.data ?? []) as PuanKaydi[]) satir(kayit.yayin_id).oneri_kaybi += Number(kayit.kaybedilen_puan ?? 0);

  return ARAC_TURLERI.map((aracTuru) => {
    const hedef = sonuc.get(aracTuru)!;
    hedef.kazanilan_toplam = hedef.tamamlama_puani + hedef.dogru_cevap_puani + hedef.oneri_puani + hedef.extra_puani + hedef.eclub_puani;
    hedef.kaybedilen_toplam = hedef.ileri_sarma_kaybi + hedef.yanlis_cevap_kaybi + hedef.oneri_kaybi;
    hedef.net_puan = hedef.kazanilan_toplam - hedef.kaybedilen_toplam;
    return hedef;
  });
}
