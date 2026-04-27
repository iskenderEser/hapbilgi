// app/bm-egitim/api/izle/cevap/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, veriKontrol, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM cevap verebilir.');

    const body = await request.json();
    const { izleme_id, cevaplar } = body;

    if (!izleme_id) return validasyonHatasi('izleme_id zorunludur.', ['izleme_id']);
    if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
      return validasyonHatasi('cevaplar dizisi zorunludur ve en az 1 cevap içermelidir.', ['cevaplar']);
    }

    // İzleme kaydını kontrol et
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .select('izleme_id, yayin_id, kullanici_id, tamamlandi_mi')
      .eq('izleme_id', izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, 'bm_izleme_kayitlari SELECT', 'İzleme kaydı bulunamadı.');
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti('İzleme kaydı sorgulanamadı', 'bm_izleme_kayitlari SELECT', izlemeError);
    if (izleme.kullanici_id !== user.id) return rolHatasi('Bu izleme kaydına erişim yetkiniz yok.');
    if (!izleme.tamamlandi_mi) return isKuraluHatasi('Cevaplar ancak video tamamlandıktan sonra gönderilebilir.');

    // Daha önce cevap verildi mi?
    const { data: oncekiCevap } = await adminSupabase
      .from('bm_soru_cevaplari')
      .select('soru_cevap_id')
      .eq('izleme_id', izleme_id)
      .limit(1);

    if ((oncekiCevap ?? []).length > 0) return isKuraluHatasi('Bu izleme için sorular zaten cevaplandı.');

    // Yayın → soru seti zinciri
    const { data: yayin } = await adminSupabase
      .from('bm_yayin_yonetimi')
      .select('soru_seti_durum_id')
      .eq('yayin_id', izleme.yayin_id)
      .single();

    if (!yayin) return hataYaniti('Yayın bulunamadı', 'bm_yayin_yonetimi SELECT', null, 404);

    const { data: soruSetiDurum } = await adminSupabase
      .from('bm_soru_seti_durumu')
      .select('soru_seti_id')
      .eq('soru_seti_durum_id', yayin.soru_seti_durum_id)
      .single();

    if (!soruSetiDurum) return hataYaniti('Soru seti durumu bulunamadı', 'bm_soru_seti_durumu SELECT', null, 404);

    const { data: soruSeti } = await adminSupabase
      .from('bm_soru_setleri')
      .select('sorular')
      .eq('soru_seti_id', soruSetiDurum.soru_seti_id)
      .single();

    if (!soruSeti) return hataYaniti('Soru seti bulunamadı', 'bm_soru_setleri SELECT', null, 404);

    const { data: soruPuan } = await adminSupabase
      .from('bm_soru_seti_puanlari')
      .select('soru_puani')
      .eq('soru_seti_durum_id', yayin.soru_seti_durum_id)
      .single();

    const soru_puani = soruPuan?.soru_puani ?? 0;

    // Her cevabı kaydet ve puanı hesapla
    let kazanilanPuan = 0;
    const cevapSonuclari = [];

    for (const cevap of cevaplar) {
      const { soru_index, verilen_cevap } = cevap;
      if (soru_index === undefined || soru_index === null) continue;

      const soru = soruSeti.sorular?.[soru_index];
      if (!soru) continue;

      const dogruSecenek = soru.secenekler.find((s: any) => s.dogru);
      const dogru_mu = dogruSecenek?.harf === verilen_cevap;

      await adminSupabase
        .from('bm_soru_cevaplari')
        .insert({ izleme_id, kullanici_id: user.id, soru_index, verilen_cevap, dogru_mu });

      if (dogru_mu && soru_puani > 0) {
        kazanilanPuan += soru_puani;
        await adminSupabase
          .from('bm_kazanilan_puanlar')
          .insert({
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: 'cevaplama',
            puan: soru_puani,
          });
      }

      cevapSonuclari.push({ soru_index, verilen_cevap, dogru_mu, dogru_cevap: dogruSecenek?.harf });
    }

    return NextResponse.json({
      mesaj: 'Cevaplar kaydedildi.',
      sonuclar: cevapSonuclari,
      kazanilan_puan: kazanilanPuan,
    }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /bm-egitim/api/izle/cevap');
  }
}