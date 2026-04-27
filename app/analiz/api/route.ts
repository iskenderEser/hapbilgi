// app/analiz/api/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';

const ANALIZ_ROLLERI = ['bm', 'tm', 'pm', 'jr_pm', 'kd_pm', 'gm', 'gm_yrd', 'drk', 'paz_md', 'blm_md', 'med_md', 'grp_pm', 'sm', 'egt_md', 'egt_yrd_md', 'egt_yon', 'egt_uz'];

function tarihAraligi(zaman: string): { baslangic: string; bitis: string } {
  const simdi = new Date();
  const bitis = simdi.toISOString();

  if (zaman === 'bu_hafta') {
    const gun = simdi.getDay();
    const fark = gun === 0 ? 6 : gun - 1;
    const pazartesi = new Date(simdi);
    pazartesi.setDate(simdi.getDate() - fark);
    pazartesi.setHours(0, 0, 0, 0);
    return { baslangic: pazartesi.toISOString(), bitis };
  }

  if (zaman === 'bu_ay') {
    const baslangic = new Date(simdi.getFullYear(), simdi.getMonth(), 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  if (zaman === 'bu_donem') {
    const ay = simdi.getMonth();
    const ceyrekBaslangicAy = Math.floor(ay / 3) * 3;
    const baslangic = new Date(simdi.getFullYear(), ceyrekBaslangicAy, 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  if (zaman === 'bu_yil') {
    const baslangic = new Date(simdi.getFullYear(), 0, 1);
    return { baslangic: baslangic.toISOString(), bitis };
  }

  // bu_gun
  const bugun = new Date(simdi);
  bugun.setHours(0, 0, 0, 0);
  return { baslangic: bugun.toISOString(), bitis };
}

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

    // Kapsam kontrolü — BM sadece UTT görebilir
    if (kullanici.rol === 'bm' && kapsam !== 'utt') {
      return rolHatasi('BM yalnızca UTT kapsamında analiz yapabilir.');
    }
    if (kullanici.rol === 'tm' && kapsam === 'utt') {
      return rolHatasi('TM UTT kapsamında analiz yapamaz.');
    }

    // Seçilen kolonları belirle
    const kolonlar = degiskenler.map((d: string) => kolonAdi(d)).filter(Boolean);
    if (kolonlar.length === 0) return validasyonHatasi('Geçersiz değişken seçimi.', ['degiskenler']);

    // View seç ve sorgu at
    let veri: any[] = [];
    let kimlikKolonu = '';
    let kimlikAdi = '';

    if (kapsam === 'takim' || kapsam.startsWith('takim_')) {
      kimlikKolonu = 'takim_id';
      kimlikAdi = 'takim_adi';
      let query = adminSupabase
        .from('v_analiz_takim')
        .select(`takim_id, takim_adi, ${kolonlar.join(', ')}`)
        .eq('firma_id', kullanici.firma_id);

      if (kapsam !== 'takim') query = query.eq('takim_id', kapsam);
      else if (kullanici.rol === 'tm') query = query.eq('takim_id', kullanici.takim_id);
      else if (['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) query = query.eq('takim_id', kullanici.takim_id);

      if (urun_filtre) query = query.eq('urun_id', urun_filtre);

      const { data, error } = await query;
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'v_analiz_takim SELECT', error);
      veri = data ?? [];

    } else if (kapsam === 'bolge' || kapsam.startsWith('bolge_')) {
      kimlikKolonu = 'bolge_id';
      kimlikAdi = 'bolge_adi';
      let query = adminSupabase
        .from('v_analiz_bolge')
        .select(`bolge_id, bolge_adi, takim_adi, ${kolonlar.join(', ')}`);

      if (kapsam !== 'bolge') query = query.eq('bolge_id', kapsam);
      else if (kullanici.rol === 'tm') query = query.eq('takim_id', kullanici.takim_id);
      else if (['pm', 'jr_pm', 'kd_pm'].includes(kullanici.rol)) query = query.eq('takim_id', kullanici.takim_id);
      else query = query.eq('firma_id', kullanici.firma_id);

      const { data, error } = await query;
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'v_analiz_bolge SELECT', error);
      veri = data ?? [];

    } else if (kapsam === 'utt' || kapsam.startsWith('utt_')) {
      if (kullanici.rol !== 'bm') return rolHatasi('UTT kapsamı yalnızca BM için geçerlidir.');
      kimlikKolonu = 'kullanici_id';
      kimlikAdi = 'ad';
      let query = adminSupabase
        .from('v_analiz_utt')
        .select(`kullanici_id, ad, soyad, ${kolonlar.join(', ')}`)
        .eq('bolge_id', kullanici.bolge_id);

      if (kapsam !== 'utt') query = query.eq('kullanici_id', kapsam);

      const { data, error } = await query;
      if (error) return hataYaniti('Analiz verisi çekilemedi.', 'v_analiz_utt SELECT', error);
      veri = data ?? [];
    }

    if (veri.length === 0) {
      return NextResponse.json({
        success: true,
        veri: [],
        yorum: 'Seçilen kapsam ve zaman aralığında veri bulunamadı.',
        aksiyonlar: [],
      });
    }

    // Claude API'ye gönder
    const veriMetni = JSON.stringify(veri, null, 2);
    const degiskenListesi = degiskenler.join(', ');
    const zamanLabel: Record<string, string> = {
      bu_gun: 'bugün',
      bu_hafta: 'bu hafta',
      bu_ay: 'bu ay',
      bu_donem: 'bu dönem',
      bu_yil: 'bu yıl',
    };

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

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    let yorum = 'AI yorumu alınamadı.';
    let aksiyonlar: string[] = [];

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const content = aiData.content?.[0]?.text ?? '';
      try {
        const clean = content.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        yorum = parsed.yorum ?? yorum;
        aksiyonlar = parsed.aksiyonlar ?? [];
      } catch {
        yorum = content;
      }
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