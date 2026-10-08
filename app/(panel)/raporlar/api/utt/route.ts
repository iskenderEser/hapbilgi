import { firmaEclubDurumu } from '@/lib/firma/eclubDurumu';
import { raporModulDurumunuUygula } from '@/lib/rapor/paylasilan/eclubDurumu';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, sunucuHatasi, yetkiHatasi, validasyonHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { TUKETICI_ROLLER } from '@/lib/utils/roller';
import { PERIYOTLAR } from '@/lib/utils/raporUtils';
import { getUttDavranis } from '@/lib/rapor/utt/getUttDavranis';
import { getUttKatki } from '@/lib/rapor/utt/getUttKatki';

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
    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı.', 'UTT rapor kimliği', kullaniciError);
    if (!TUKETICI_ROLLER.includes(kullanici.rol)) return yetkiHatasi('Bu rapora erişim yetkiniz yok.');
    const eclubAcik = await firmaEclubDurumu(db, kullanici.firma_id);
    if (new URL(request.url).searchParams.get('modul') === '1') {
      return NextResponse.json({ success: true, eclub_acik: eclubAcik }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { baslangic, bitis } = tarihAraligi(periyot);
    const [data, katki] = await Promise.all([
      getUttDavranis(db, user.id, baslangic, bitis),
      getUttKatki(db, kullanici, baslangic, bitis),
    ]);
    return NextResponse.json({ success: true, data: raporModulDurumunuUygula({ ...data, katki }, eclubAcik) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return sunucuHatasi(error, 'GET /raporlar/api/utt — öğrenme davranışları');
  }
}
