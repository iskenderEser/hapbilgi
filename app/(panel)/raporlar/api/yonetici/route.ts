import { firmaEclubDurumu } from '@/lib/firma/eclubDurumu';
import { raporModulDurumunuUygula } from '@/lib/rapor/paylasilan/eclubDurumu';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { PERIYOTLAR } from '@/lib/utils/raporUtils';
import { getYoneticiDavranis } from '@/lib/rapor/yonetici/getYoneticiDavranis';
import { YONETICI_ROLLER } from '@/lib/utils/roller';
import { TemsilciKapsamHatasi } from '@/lib/rapor/bm/getBmDavranis';

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const periyot = params.get('periyot') ?? 'bu_hafta';
    if (!PERIYOTLAR.some(p => p.key === periyot)) return validasyonHatasi('Geçersiz rapor zamanı.', ['periyot']);
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return yetkiHatasi();
    const db = createAdminClient();
    const { data: kullanici, error: kullaniciError } = await db.from('kullanicilar')
      .select('kullanici_id,rol,firma_id').eq('kullanici_id', user.id).eq('aktif_mi', true).single();
    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı.', 'Yönetici rapor kimliği', kullaniciError);
    if (!YONETICI_ROLLER.includes((kullanici.rol ?? '').toLowerCase())) return yetkiHatasi('Bu rapora erişim yetkiniz yok.');
    if (!kullanici.firma_id) return validasyonHatasi('Firma bilgisi eksik.', ['firma_id']);
    const eclubAcik = await firmaEclubDurumu(db, kullanici.firma_id);
    if (new URL(request.url).searchParams.get('modul') === '1') {
      return NextResponse.json({ success: true, eclub_acik: eclubAcik }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { baslangic, bitis } = tarihAraligi(periyot);
    const bmId = params.get('bm') ?? '';
    const ikinciBmId = params.get('karsilastir') ?? '';
    const yenile = params.get('yenile') === '1';
    if (ikinciBmId && (!bmId || bmId === ikinciBmId || params.get('temsilci'))) return validasyonHatasi('İki farklı bölge müdürü seçiniz.', ['bm', 'karsilastir']);
    const data = await getYoneticiDavranis(db, kullanici, baslangic, bitis, params.get('takim') ?? '', bmId, params.get('temsilci') ?? '', ikinciBmId, yenile);
    return NextResponse.json({ success: true, data: raporModulDurumunuUygula(data, eclubAcik) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof TemsilciKapsamHatasi) return yetkiHatasi(error.message);
    return sunucuHatasi(error, 'GET /raporlar/api/yonetici — takım öğrenme davranışları');
  }
}
