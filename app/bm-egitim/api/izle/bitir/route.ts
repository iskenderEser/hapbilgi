// app/bm-egitim/api/izle/bitir/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, veriKontrol, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

async function videoDuresiGetir(video_url: string): Promise<number> {
  try {
    const videoId = video_url.match(/\/([0-9a-f-]{36})\/?(?:\?.*)?$/)?.[1];
    if (!videoId) return 0;
    const res = await fetch(`https://video.bunnycdn.com/library/${process.env.BUNNY_LIBRARY_ID}/videos/${videoId}`, {
      headers: { AccessKey: process.env.BUNNY_API_KEY ?? '', accept: 'application/json' },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.length ?? 0;
  } catch {
    return 0;
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const rol = (user.user_metadata?.rol ?? '').toLowerCase();
    if (rol !== 'bm') return rolHatasi('Sadece BM izleyebilir.');

    const body = await request.json();
    const { izleme_id, ileri_sarilan_sure } = body;

    if (!izleme_id) return validasyonHatasi('izleme_id zorunludur.', ['izleme_id']);

    const ileriSarilanSure = Math.round(ileri_sarilan_sure ?? 0);

    // İzleme kaydını çek
    const { data: izleme, error: izlemeError } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .select('izleme_id, yayin_id, kullanici_id, izleme_turu, tamamlandi_mi, izleme_baslangic')
      .eq('izleme_id', izleme_id)
      .single();

    const izlemeKontrol = veriKontrol(izleme, 'bm_izleme_kayitlari SELECT', 'İzleme kaydı bulunamadı.');
    if (!izlemeKontrol.gecerli) return izlemeKontrol.yanit;
    if (izlemeError) return hataYaniti('İzleme kaydı sorgulanamadı', 'bm_izleme_kayitlari SELECT', izlemeError);
    if (izleme.kullanici_id !== user.id) return rolHatasi('Bu izleme kaydına erişim yetkiniz yok.');
    if (izleme.tamamlandi_mi) return isKuraluHatasi('Bu izleme zaten tamamlanmış.');

    const bitisTarihi = new Date();
    const baslangicTarihi = new Date(izleme.izleme_baslangic);

    // İzlemeyi tamamla
    const { error: updateError } = await adminSupabase
      .from('bm_izleme_kayitlari')
      .update({ tamamlandi_mi: true, izleme_bitis: bitisTarihi.toISOString() })
      .eq('izleme_id', izleme_id);

    if (updateError) return hataYaniti('İzleme tamamlanamadı', 'bm_izleme_kayitlari UPDATE', updateError);

    // Puan kazanma zaman kontrolü
    const gun = baslangicTarihi.getDay();
    const dakikaCinsinden = baslangicTarihi.getHours() * 60 + baslangicTarihi.getMinutes();
    const puanKazanabilir = gun >= 1 && gun <= 5 && dakikaCinsinden >= 420 && dakikaCinsinden <= 1229;

    if (!puanKazanabilir) {
      return NextResponse.json({
        mesaj: 'İzleme tamamlandı. Puan kazanma saatleri dışında izlendiği için puan verilmedi.',
        puan_kazanildi: false,
        soru_gosterilecek: false,
      }, { status: 200 });
    }

    // Yayın bilgisi
    const { data: yayin } = await adminSupabase
      .from('bm_yayin_yonetimi')
      .select('soru_seti_durum_id, ileri_sarma_acik, extra_puan')
      .eq('yayin_id', izleme.yayin_id)
      .single();

    if (!yayin) {
      return NextResponse.json({ mesaj: 'İzleme tamamlandı.', puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    const ileriSarmaAcik = yayin.ileri_sarma_acik ?? false;
    const ileriSarildi = ileriSarmaAcik && ileriSarilanSure > 0;

    // Video puanı zinciri
    const { data: soruSetiDurum } = await adminSupabase
      .from('bm_soru_seti_durumu')
      .select('soru_seti_id')
      .eq('soru_seti_durum_id', yayin.soru_seti_durum_id)
      .single();

    if (!soruSetiDurum) {
      return NextResponse.json({ mesaj: 'İzleme tamamlandı.', puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    const { data: soruSeti } = await adminSupabase
      .from('bm_soru_setleri')
      .select('video_durum_id')
      .eq('soru_seti_id', soruSetiDurum.soru_seti_id)
      .single();

    if (!soruSeti) {
      return NextResponse.json({ mesaj: 'İzleme tamamlandı.', puan_kazanildi: false, soru_gosterilecek: false }, { status: 200 });
    }

    const { data: vPuan } = await adminSupabase
      .from('bm_video_puanlari')
      .select('video_puani')
      .eq('video_durum_id', soruSeti.video_durum_id)
      .single();

    const video_puani = vPuan?.video_puani ?? 0;

    // İleri sarma varsa puan hesapla
    let kazanilacakIzlemePuani = video_puani;
    if (ileriSarildi && video_puani > 0) {
      const { data: videoKayit } = await adminSupabase
        .from('bm_videolar')
        .select('video_url')
        .eq('video_durum_id', soruSeti.video_durum_id)
        .single();

      const videoSuresi = videoKayit?.video_url ? await videoDuresiGetir(videoKayit.video_url) : 0;

      if (videoSuresi > 0) {
        const saniyeBasiPuan = video_puani / videoSuresi;
        const kayipPuan = Math.round(saniyeBasiPuan * ileriSarilanSure);
        kazanilacakIzlemePuani = Math.max(0, video_puani - kayipPuan);
      }
    }

    // Daha önce bu videodan puan aldı mı?
    const { data: oncekiPuan } = await adminSupabase
      .from('bm_kazanilan_puanlar')
      .select('kazanilan_puan_id')
      .eq('yayin_id', izleme.yayin_id)
      .eq('kullanici_id', user.id)
      .eq('puan_turu', 'izleme')
      .limit(1);

    const kazanilanPuanlar = [];
    const ilkIzleme = (oncekiPuan ?? []).length === 0;

    if (ilkIzleme && kazanilacakIzlemePuani > 0) {
      const { error: pError } = await adminSupabase
        .from('bm_kazanilan_puanlar')
        .insert({
          kullanici_id: user.id,
          yayin_id: izleme.yayin_id,
          izleme_id,
          puan_turu: 'izleme',
          puan: kazanilacakIzlemePuani,
        });

      if (!pError) kazanilanPuanlar.push({ tur: 'izleme', puan: kazanilacakIzlemePuani });

    } else if (!ilkIzleme && !ileriSarildi && !ileriSarmaAcik) {
      // Extra puan kontrolü
      const haftaBaslangic = new Date(baslangicTarihi);
      haftaBaslangic.setDate(baslangicTarihi.getDate() - baslangicTarihi.getDay() + 1);
      haftaBaslangic.setHours(0, 0, 0, 0);

      const { count: haftaIzlemeSayisi } = await adminSupabase
        .from('bm_izleme_kayitlari')
        .select('izleme_id', { count: 'exact', head: true })
        .eq('yayin_id', izleme.yayin_id)
        .eq('kullanici_id', user.id)
        .eq('tamamlandi_mi', true)
        .gte('izleme_baslangic', haftaBaslangic.toISOString());

      if ((haftaIzlemeSayisi ?? 0) === 3) {
        const { data: extraKayit } = await adminSupabase
          .from('bm_kazanilan_puanlar')
          .select('kazanilan_puan_id')
          .eq('yayin_id', izleme.yayin_id)
          .eq('kullanici_id', user.id)
          .eq('puan_turu', 'extra')
          .gte('created_at', haftaBaslangic.toISOString())
          .limit(1);

        if ((extraKayit ?? []).length === 0 && (yayin.extra_puan ?? 0) > 0) {
          const { error: epError } = await adminSupabase
            .from('bm_kazanilan_puanlar')
            .insert({
              kullanici_id: user.id,
              yayin_id: izleme.yayin_id,
              izleme_id,
              puan_turu: 'extra',
              puan: yayin.extra_puan,
            });

          if (!epError) kazanilanPuanlar.push({ tur: 'extra', puan: yayin.extra_puan });
        }
      }
    }

    // Challenge izleme puanı kontrolü
    if (izleme.izleme_turu === 'challenge') {
      const { data: challenge } = await adminSupabase
        .from('challenge_kayitlari')
        .select('challenge_id, gonderen_id, son_tarih')
        .eq('yayin_id', izleme.yayin_id)
        .eq('alan_id', user.id)
        .eq('izlendi_mi', false)
        .single();

      if (challenge && new Date() <= new Date(challenge.son_tarih)) {
        // Challenge'ı izlendi olarak işaretle
        await adminSupabase
          .from('challenge_kayitlari')
          .update({ izlendi_mi: true })
          .eq('challenge_id', challenge.challenge_id);

        // Alan kişi challenge izleme puanı kazanır
        const { data: sPuan } = await adminSupabase
          .from('bm_soru_seti_puanlari')
          .select('soru_puani')
          .eq('soru_seti_durum_id', yayin.soru_seti_durum_id)
          .limit(1)
          .single();

        const challengeIzlemePuani = sPuan?.soru_puani ?? 5;

        const { error: cipError } = await adminSupabase
          .from('bm_kazanilan_puanlar')
          .insert({
            kullanici_id: user.id,
            yayin_id: izleme.yayin_id,
            izleme_id,
            puan_turu: 'challenge_izleme',
            puan: challengeIzlemePuani,
          });

        if (!cipError) kazanilanPuanlar.push({ tur: 'challenge_izleme', puan: challengeIzlemePuani });
      }
    }

    return NextResponse.json({
      mesaj: 'İzleme tamamlandı.',
      puan_kazanildi: kazanilanPuanlar.length > 0,
      kazanilan_puanlar: kazanilanPuanlar,
      soru_gosterilecek: ilkIzleme && !ileriSarildi,
      ileri_sarildi: ileriSarildi,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'PUT /bm-egitim/api/izle/bitir');
  }
}