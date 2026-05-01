// app/analiz/api/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { aiYorumAl } from '@/lib/utils/aiIstemci';

const ANALIZ_ROLLERI = ['bm', 'tm', 'pm', 'jr_pm', 'kd_pm', 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function kolonAdi(degisken: string): string | null {
  const MAP: Record<string, string> = {
    urun_sayisi: 'urun_sayisi',
    video_sayisi: 'video_sayisi',
    soru_sayisi: 'soru_sayisi',
    extra_izleme_video_sayisi: 'extra_izleme_video_sayisi',
    ileri_sarma_izinli_video_sayisi: 'ileri_sarma_izinli_video_sayisi',
    pvip: 'pvip',
    ptcp: 'ptcp',
    pevip: 'pevip',
    oneri_sayisi: 'oneri_sayisi',
    izlenen_video_sayisi: 'izlenen_video_sayisi',
    extra_izleme_sayisi: 'extra_izleme_sayisi',
    onerilen_video_sayisi: 'onerilen_video_sayisi',
    kazanilan_izleme_puani: 'kazanilan_izleme_puani',
    kazanilan_cevaplama_puani: 'kazanilan_cevaplama_puani',
    kazanilan_oneri_puani: 'kazanilan_oneri_puani',
    kazanilan_extra_puani: 'kazanilan_extra_puani',
    dogru_cevap_sayisi: 'dogru_cevap_sayisi',
    yanlis_cevap_sayisi: 'yanlis_cevap_sayisi',
    ileri_sarilan_video_sayisi: 'ileri_sarilan_video_sayisi',
    ileri_sarilan_sure: 'ileri_sarilan_sure',
    kaybedilen_ileri_sarma_puani: 'kaybedilen_ileri_sarma_puani',
    izlenmeyen_oneri_sayisi: 'izlenmeyen_oneri_sayisi',
    kaybedilen_izlenmemis_video_puani: 'kaybedilen_izlenmemis_video_puani',
    kaybedilen_yanlis_cevap_puani: 'kaybedilen_yanlis_cevap_puani',
  };
  return MAP[degisken] ?? null;
}

function kapsamTipi(kapsam: string, rol: string): 'takim' | 'bolge' | 'utt' | 'bilinmiyor' {
  if (kapsam === 'takim' || kapsam.startsWith('takim_')) return 'takim';
  if (kapsam === 'bolge' || kapsam.startsWith('bolge_')) return 'bolge';
  if (kapsam === 'utt' || kapsam.startsWith('utt_')) return 'utt';

  if (UUID_REGEX.test(kapsam)) {
    if (rol === 'bm') return 'utt';
    if (rol === 'tm') return 'bolge';
    return 'takim';
  }

  return 'bilinmiyor';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, ad, soyad, rol, takim_id, bolge_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);
    if (!ANALIZ_ROLLERI.includes(kullanici.rol)) return rolHatasi('Bu sayfaya erişim yetkiniz yok');

    const body = await request.json();
    const { degiskenler, kapsam, urun_filtre, zaman } = body;

    if (!degiskenler || degiskenler.length < 2) return validasyonHatasi('En az 2 değişken seçmelisiniz.', ['degiskenler']);
    if (!kapsam) return validasyonHatasi('Kapsam seçimi zorunludur.', ['kapsam']);
    if (!zaman) return validasyonHatasi('Zaman seçimi zorunludur.', ['zaman']);

    const { baslangic, bitis } = tarihAraligi(zaman);
    const tip = kapsamTipi(kapsam, kullanici.rol);

    if (kullanici.rol === 'bm' && tip !== 'utt') {
      return rolHatasi('BM yalnızca UTT kapsamında analiz yapabilir.');
    }
    if (kullanici.rol === 'tm' && tip === 'utt') {
      return rolHatasi('TM UTT kapsamında analiz yapamaz.');
    }

    const kolonlar = degiskenler.map((d: string) => kolonAdi(d)).filter(Boolean);
    if (kolonlar.length === 0) return validasyonHatasi('Geçersiz değişken seçimi.', ['degiskenler']);

    let veri: any[] = [];
    let kimlikKolonu = '';
    let kimlikAdi = '';

    if (tip === 'takim') {
      kimlikKolonu = 'takim_id';
      kimlikAdi = 'takim_adi';

      const params: Record<string, any> = {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_firma_id: kullanici.firma_id,
        p_takim_id: null,
      };

      if (kapsam !== 'takim') params.p_takim_id = kapsam;
      else if (['tm', 'pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) params.p_takim_id = kullanici.takim_id;

      const { data, error } = await adminSupabase.rpc('get_analiz_takim', params);
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'get_analiz_takim RPC', error);

      veri = (data ?? []).map((row: any) => {
        const filtered: Record<string, any> = { takim_id: row.takim_id, takim_adi: row.takim_adi };
        kolonlar.forEach((k: string) => { filtered[k] = row[k]; });
        return filtered;
      });

      if (veri.length === 0 && UUID_REGEX.test(kapsam) && ['pm', 'jr_pm', 'kd_pm', 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz'].includes(kullanici.rol)) {
        const bolgeParams: Record<string, any> = {
          p_baslangic: baslangic,
          p_bitis: bitis,
          p_firma_id: null,
          p_takim_id: null,
          p_bolge_id: kapsam,
        };
        const { data: bolgeData, error: bolgeError } = await adminSupabase.rpc('get_analiz_bolge', bolgeParams);
        if (!bolgeError && bolgeData && bolgeData.length > 0) {
          kimlikKolonu = 'bolge_id';
          kimlikAdi = 'bolge_adi';
          veri = (bolgeData ?? []).map((row: any) => {
            const filtered: Record<string, any> = { bolge_id: row.bolge_id, bolge_adi: row.bolge_adi, takim_adi: row.takim_adi };
            kolonlar.forEach((k: string) => { filtered[k] = row[k]; });
            return filtered;
          });
        }
      }

      if (urun_filtre) veri = veri.filter((row: any) => row.urun_id === urun_filtre);

    } else if (tip === 'bolge') {
      kimlikKolonu = 'bolge_id';
      kimlikAdi = 'bolge_adi';

      const params: Record<string, any> = {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_firma_id: null,
        p_takim_id: null,
        p_bolge_id: null,
      };

      if (kapsam !== 'bolge') params.p_bolge_id = kapsam;
      else if (kullanici.rol === 'tm') params.p_takim_id = kullanici.takim_id;
      else if (['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) params.p_takim_id = kullanici.takim_id;
      else params.p_firma_id = kullanici.firma_id;

      const { data, error } = await adminSupabase.rpc('get_analiz_bolge', params);
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'get_analiz_bolge RPC', error);

      veri = (data ?? []).map((row: any) => {
        const filtered: Record<string, any> = { bolge_id: row.bolge_id, bolge_adi: row.bolge_adi, takim_adi: row.takim_adi };
        kolonlar.forEach((k: string) => { filtered[k] = row[k]; });
        return filtered;
      });

    } else if (tip === 'utt') {
      if (kullanici.rol !== 'bm') return rolHatasi('UTT kapsamı yalnızca BM için geçerlidir.');
      kimlikKolonu = 'kullanici_id';
      kimlikAdi = 'ad';

      const params: Record<string, any> = {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_bolge_id: kullanici.bolge_id,
        p_kullanici_id: null,
      };

      if (kapsam !== 'utt') params.p_kullanici_id = kapsam;

      const { data, error } = await adminSupabase.rpc('get_analiz_utt', params);
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'get_analiz_utt RPC', error);

      veri = (data ?? []).map((row: any) => {
        const filtered: Record<string, any> = { kullanici_id: row.kullanici_id, ad: row.ad, soyad: row.soyad };
        kolonlar.forEach((k: string) => { filtered[k] = row[k]; });
        return filtered;
      });

    } else {
      return validasyonHatasi('Geçersiz kapsam seçimi.', ['kapsam']);
    }

    if (veri.length === 0) {
      return NextResponse.json({
        success: true,
        veri: [],
        yorum: 'Seçilen kapsam ve zaman aralığında veri bulunamadı.',
        aksiyonlar: [],
      });
    }

    const zamanLabel: Record<string, string> = {
      bu_gun: 'bugün',
      bu_hafta: 'bu hafta',
      bu_ay: 'bu ay',
      bu_donem: 'bu dönem',
      bu_yil: 'bu yıl',
    };

    const degiskenListesi = degiskenler.join(', ');
    const veriMetni = JSON.stringify(veri, null, 2);

    const prompt = `Sen HapBilgi ilaç sektörü eğitim platformunun analiz asistanısın. 
Aşağıdaki veriler ${zamanLabel[zaman] ?? zaman} dönemine ait ${kapsam} bazlı analiz sonuçlarıdır.
Seçilen değişkenler: ${degiskenListesi}

Veri:
${veriMetni}

Lütfen şunları yap:
1. Veriler arasındaki en önemli 2-3 bulguyu kısa ve net Türkçe cümlerle açıkla
2. Varsa dikkat çekici sapmaları veya sorunları belirt
3. Oransal ve ortalama hesaplamalar yap, yorumuna ekle
4. Somut ve uygulanabilir 3 aksiyon önerisi sun

Yanıtını JSON formatında ver:
{
  "yorum": "analiz yorumu buraya",
  "aksiyonlar": ["aksiyon 1", "aksiyon 2", "aksiyon 3"]
}`;

    let yorum = 'AI yorumu alınamadı.';
    let aksiyonlar: string[] = [];

    try {
      const aiMetin = await aiYorumAl(prompt);
      const clean = aiMetin.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      yorum = parsed.yorum ?? yorum;
      aksiyonlar = parsed.aksiyonlar ?? [];
    } catch (aiHata) {
      console.error('[UYARI] AI yorumu alınamadı:', aiHata);
    }

    return NextResponse.json({
      success: true,
      veri,
      kimlik_kolonu: kimlikKolonu,
      kimlik_adi: kimlikAdi,
      degiskenler: kolonlar,
      zaman: { baslangic, bitis, label: zamanLabel[zaman] },
      yorum,
      aksiyonlar,
    });

  } catch (err) {
    return sunucuHatasi(err, 'POST /analiz/api');
  }
}