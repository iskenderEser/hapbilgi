// app/(panel)/raporlar/api/uretim/route.ts
//
// Üretim Raporları Backend API Rotası.
// Üretici (PM, Medikal, Eğitim, İK), Yönetici ve Admin rollerine açıktır.
// Şirket düzeyinde içerik üretim hacmi, V1-V4 varyant dağılımı ve eğitim türü saha etkisini döner.

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { hataYaniti, yetkiHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { URETICI_ROLLER, YONETICI_ROLLER, ADMIN_ROLLER } from '@/lib/utils/roller';
import {
  TALEP_TURU_SIRA,
  isTalepTuru,
  talepTuruAdi,
  type TalepTuru,
} from '@/lib/uretici/yetenekler';

const sayi = (deger: unknown) => Number(deger ?? 0);

export async function GET(request: Request) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const { searchParams } = new URL(request.url);
  const { baslangic, bitis } = tarihAraligi(searchParams.get('periyot') || 'bu_ay');

  // 1. Auth Kontrolü
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return yetkiHatasi('Oturum açılmamış');

  // 2. Kullanıcı ve Rol Çözümleme
  const { data: kullanici, error: kullaniciError } = await adminSupabase
    .from('kullanicilar')
    .select('kullanici_id, ad, soyad, rol, firma_id')
    .eq('eposta', user.email)
    .single();

  if (kullaniciError || !kullanici) {
    return hataYaniti('Kullanıcı bulunamadı', 'kullanici_bulamadi', kullaniciError);
  }

  const rol = (kullanici.rol ?? '').toLowerCase();
  const yetkili =
    URETICI_ROLLER.includes(rol) ||
    YONETICI_ROLLER.includes(rol) ||
    ADMIN_ROLLER.includes(rol);

  if (!yetkili) {
    return yetkiHatasi('Bu rapora erişim yetkiniz yok');
  }

  // 3. Firma Bilgisi ve Şirket Yönetici Kapsamı
  const { data: firma } = await adminSupabase
    .from('firmalar')
    .select('firma_adi')
    .eq('firma_id', kullanici.firma_id)
    .maybeSingle();

  // get_yonetici_* RPC'leri yonetici_scope için YONETICI_ROLLER'den bir kullanıcı kimliği bekler
  let yoneticiKullaniciId = kullanici.kullanici_id;
  if (!YONETICI_ROLLER.includes(rol)) {
    const { data: sirketGmsi } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id')
      .eq('firma_id', kullanici.firma_id)
      .in('rol', YONETICI_ROLLER)
      .limit(1)
      .maybeSingle();

    if (sirketGmsi) {
      yoneticiKullaniciId = sirketGmsi.kullanici_id;
    }
  }

  // 4. Veritabanı Sorguları
  const [ozetRes, egitimTuruRes] = await Promise.all([
    adminSupabase.rpc('get_yonetici_rapor_ana_ozet_v2', {
      p_yonetici_id: yoneticiKullaniciId,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
    adminSupabase.rpc('get_yonetici_egitim_turu_etkisi_v3', {
      p_yonetici_id: yoneticiKullaniciId,
      p_baslangic: baslangic,
      p_bitis: bitis,
    }),
  ]);

  if (ozetRes.error) {
    return hataYaniti('Üretim raporu özeti çekilemedi.', 'get_yonetici_rapor_ana_ozet_v2', ozetRes.error);
  }
  if (egitimTuruRes.error) {
    return hataYaniti('Eğitim türü dağılımı çekilemedi.', 'get_yonetici_egitim_turu_etkisi_v3', egitimTuruRes.error);
  }

  const o = ozetRes.data?.[0] ?? {};
  const egitimHaritasi = new Map<TalepTuru, Record<string, unknown>>();
  for (const ham of (egitimTuruRes.data ?? []) as Record<string, unknown>[]) {
    if (isTalepTuru(ham.egitim_turu)) egitimHaritasi.set(ham.egitim_turu, ham);
  }

  const egitimTurleri = TALEP_TURU_SIRA.map((tur) => {
    const ham = egitimHaritasi.get(tur) ?? {};
    return {
      egitim_turu: tur,
      egitim_adi: talepTuruAdi(tur),
      donemde_yayina_alinan: sayi(ham.donemde_yayina_alinan),
      tamamlanan_izleme: sayi(ham.tamamlanan_izleme),
      izleme_puani: sayi(ham.izleme_puani),
      cevaplama_puani: sayi(ham.cevaplama_puani),
      oneri_puani: sayi(ham.oneri_puani),
      extra_puani: sayi(ham.extra_puani),
      ileri_sarma_kaybi: sayi(ham.ileri_sarma_kaybi),
      yanlis_cevap_kaybi: sayi(ham.yanlis_cevap_kaybi),
      oneri_kaybi: sayi(ham.oneri_kaybi),
      challenge_kaybi: sayi(ham.challenge_kaybi),
      kazanilan_toplam: sayi(ham.kazanilan_toplam),
      kaybedilen_toplam: sayi(ham.kaybedilen_toplam),
      net_puan: sayi(ham.net_puan),
      begeni_sayisi: sayi(ham.begeni_sayisi),
      favori_sayisi: sayi(ham.favori_sayisi),
      extra_izleme_sayisi: sayi(ham.extra_izleme_sayisi),
      urun_dagilimi: Array.isArray(ham.urun_dagilimi) ? ham.urun_dagilimi : [],
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      kullanici: {
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        rol: kullanici.rol,
        firma_adi: firma?.firma_adi ?? '—',
      },
      uretim: {
        toplam_yayina_alma: sayi(o.toplam_yayina_alma),
        donemde_yayina_alinan: sayi(o.donemde_yayina_alinan),
        su_an_yayinda: sayi(o.su_an_yayinda),
        turler: egitimTurleri.map((tur) => ({
          kod: tur.egitim_turu,
          ad: tur.egitim_adi,
          adet: tur.donemde_yayina_alinan,
        })),
        varyantlar: [
          { kod: 'normal', ad: 'Tam Üretim', adet: sayi(o.donem_normal_uretim) },
          { kod: 'hazir_video', ad: 'Hazır Video', adet: sayi(o.donem_hazir_video) },
          { kod: 'hazir_set', ad: 'Hazır Soru Seti', adet: sayi(o.donem_hazir_soru_seti) },
          { kod: 'hazir_ikisi', ad: 'Hazır Video + Set', adet: sayi(o.donem_hazir_video_ve_soru_seti) },
        ],
      },
      egitim_turu_etkisi: egitimTurleri,
    },
  });
}
