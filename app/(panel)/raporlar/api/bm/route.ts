import { firmaEclubDurumu } from '@/lib/firma/eclubDurumu';
import { raporModulDurumunuUygula } from '@/lib/rapor/paylasilan/eclubDurumu';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { PERIYOTLAR } from '@/lib/utils/raporUtils';
import { getBmDavranis, getBmKarsilastirma, TemsilciKapsamHatasi } from '@/lib/rapor/bm/getBmDavranis';

export async function GET(request: Request) {
  try {
    const periyot = new URL(request.url).searchParams.get('periyot') ?? 'bu_hafta';
    if (!PERIYOTLAR.some(p => p.key === periyot)) return validasyonHatasi('Geçersiz rapor zamanı.', ['periyot']);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const db = createAdminClient();
    const { data: kullanici, error: kullaniciError } = await db.from('kullanicilar')
      .select('kullanici_id,rol,bolge_id,takim_id,firma_id').eq('kullanici_id', user.id).eq('aktif_mi', true).single();
    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı.', 'BM rapor kimliği', kullaniciError);
    if (kullanici.rol !== 'bm') return yetkiHatasi('Bu rapora erişim yetkiniz yok.');
    if (!kullanici.bolge_id || !kullanici.firma_id) return validasyonHatasi('Bölge veya firma bilgisi eksik.', ['bolge_id', 'firma_id']);
    const eclubAcik = await firmaEclubDurumu(db, kullanici.firma_id);
    if (new URL(request.url).searchParams.get('modul') === '1') {
      return NextResponse.json({ success: true, eclub_acik: eclubAcik }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { baslangic, bitis } = tarihAraligi(periyot);
    const temsilciId = new URL(request.url).searchParams.get('temsilci') ?? '';
    const yenile = new URL(request.url).searchParams.get('yenile') === '1';
    const ikinciId = new URL(request.url).searchParams.get('karsilastir') ?? '';
    if (ikinciId && (!temsilciId || temsilciId === ikinciId)) return validasyonHatasi('İki farklı temsilci seçiniz.', ['temsilci', 'karsilastir']);
    const data = ikinciId ? await getBmKarsilastirma(db, kullanici, baslangic, bitis, temsilciId, ikinciId, yenile)
      : await getBmDavranis(db, kullanici, baslangic, bitis, temsilciId, yenile);
    return NextResponse.json({ success: true, data: raporModulDurumunuUygula(data, eclubAcik) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TemsilciKapsamHatasi) return yetkiHatasi(error.message);
    return sunucuHatasi(error, 'GET /raporlar/api/bm — bölge öğrenme davranışları');
  }
}
