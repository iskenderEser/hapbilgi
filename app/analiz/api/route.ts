// app/analiz/api/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hataYaniti, yetkiHatasi, rolHatasi, validasyonHatasi, sunucuHatasi } from '@/lib/utils/hataIsle';
import { tarihAraligi } from '@/lib/utils/tarihAraligi';
import { aiYorumAl } from '@/lib/utils/aiIstemci';
import { URETICI_ROLLER, YONETICI_ROLLER, ADMIN_ROLLER } from '@/lib/utils/roller';

type Kapsam = 'takim' | 'bolge' | 'utt';
type RpcFonksiyon = 'get_analiz_utt' | 'get_analiz_bolge' | 'get_analiz_takim';

interface Kullanici {
  kullanici_id: string;
  rol: string;
  takim_id: string;
  bolge_id: string;
  firma_id: string;
}

// ─── RPC Lookup Table ─────────────────────────────────────────────────────────
// Yeni rol veya kapsam eklenince sadece bu tabloyu güncelle.

type RolGrubu = 'bm' | 'tm' | 'pm' | 'gm';

function rolGrubuBelirle(rol: string): RolGrubu {
  if (rol === 'bm') return 'bm';
  if (rol === 'tm') return 'tm';
  if (URETICI_ROLLER.includes(rol)) return 'pm';
  if (YONETICI_ROLLER.includes(rol) || ADMIN_ROLLER.includes(rol)) return 'gm';
  throw new Error(`Tanımsız rol: ${rol}`);
}

function rpcFonksiyonBelirle(rolGrubu: RolGrubu, kapsam: Kapsam): RpcFonksiyon {
  const matrix: Record<RolGrubu, Partial<Record<Kapsam, RpcFonksiyon>>> = {
    bm: { utt: 'get_analiz_utt' },
    tm: { bolge: 'get_analiz_bolge' },
    pm: { takim: 'get_analiz_takim', bolge: 'get_analiz_bolge' },
    gm: { takim: 'get_analiz_takim', bolge: 'get_analiz_bolge' },
  };

  const fonksiyon = matrix[rolGrubu]?.[kapsam];
  if (!fonksiyon) throw new Error(`Geçersiz rol/kapsam kombinasyonu: ${rolGrubu}/${kapsam}`);
  return fonksiyon;
}

// ─── RPC Parametre Builder ────────────────────────────────────────────────────

function rpcParametre(
  rpcFonksiyon: RpcFonksiyon,
  rolGrubu: RolGrubu,
  kullanici: Kullanici,
  kapsam: Kapsam,
  kapsamId: string | null,
  baslangic: string,
  bitis: string,
  urunId: string | null
): Record<string, unknown> {
  switch (rpcFonksiyon) {
    case 'get_analiz_utt':
      return {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_bolge_id: kullanici.bolge_id,
        p_kullanici_id: kapsamId,
        p_urun_id: urunId,
      };
    case 'get_analiz_bolge':
      return {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_firma_id: kullanici.firma_id,
        p_takim_id: rolGrubu === 'tm' || rolGrubu === 'pm' ? kullanici.takim_id : null,
        p_bolge_id: kapsamId,
        p_urun_id: urunId,
      };
    case 'get_analiz_takim':
      return {
        p_baslangic: baslangic,
        p_bitis: bitis,
        p_firma_id: kullanici.firma_id,
        p_takim_id: rolGrubu === 'pm' ? kullanici.takim_id : kapsamId,
        p_urun_id: urunId,
      };
  }
}

// ─── AI Yorum ─────────────────────────────────────────────────────────────────

interface AiYanit {
  yorum: string;
  aksiyonlar: string[];
}

function aiYanitGecerliMi(parsed: unknown): parsed is AiYanit {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Record<string, unknown>;
  return (
    typeof p.yorum === 'string' &&
    Array.isArray(p.aksiyonlar) &&
    p.aksiyonlar.every((a: unknown) => typeof a === 'string')
  );
}

async function aiYorumGetir(
  analizVerisi: unknown,
  periyot: string,
  kapsam: string,
  rpcFonksiyon: string
): Promise<{ yorum: string | null; aksiyonlar: string[] }> {
  try {
    const prompt = `
HapBilgi kurumsal e-öğrenme platformu için analiz verisi:

Periyot: ${periyot}
Kapsam: ${kapsam}
RPC: ${rpcFonksiyon}

Veri:
${JSON.stringify(analizVerisi, null, 2)}

Lütfen bu veriye dayanarak:
1. Kısa ve net bir yönetici yorumu yaz (max 3 cümle)
2. 3 somut aksiyon önerisi sun

JSON formatında yanıt ver:
{
  "yorum": "...",
  "aksiyonlar": ["...", "...", "..."]
}
`;
    const aiYaniti = await aiYorumAl(prompt);
    const parsed: unknown = JSON.parse(aiYaniti);

    if (!aiYanitGecerliMi(parsed)) {
      console.error('[AI] Beklenmeyen yanıt formatı:', parsed);
      return { yorum: null, aksiyonlar: [] };
    }

    return { yorum: parsed.yorum, aksiyonlar: parsed.aksiyonlar };
  } catch (aiHata) {
    console.error('[AI] Yorum alınamadı:', aiHata);
    return { yorum: null, aksiyonlar: [] };
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi('Oturum açılmamış');

    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from('kullanicilar')
      .select('kullanici_id, rol, takim_id, bolge_id, firma_id')
      .eq('eposta', user.email)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti('Kullanıcı bulunamadı', 'kullanicilar SELECT', kullaniciError);

    const rol = (kullanici.rol ?? '').toLowerCase();

    let rolGrubu: RolGrubu;
    try {
      rolGrubu = rolGrubuBelirle(rol);
    } catch {
      return rolHatasi('Bu sayfaya erişim yetkiniz yok');
    }

    const body = await request.json();
    const { periyot, kapsam, kapsam_id, urun_id } = body;

    if (!periyot) return validasyonHatasi('Periyot zorunludur.', ['periyot']);
    if (!kapsam) return validasyonHatasi('Kapsam zorunludur.', ['kapsam']);

    const gecerliKapsam: Kapsam[] = ['takim', 'bolge', 'utt'];
    if (!gecerliKapsam.includes(kapsam)) return validasyonHatasi('Geçersiz kapsam değeri.', ['kapsam']);

    const { baslangic, bitis } = tarihAraligi(periyot);

    // kapsam_id: "tümü" seçilmişse null, belirli bir id seçilmişse o id
    const kapsamId: string | null = (!kapsam_id || kapsam_id === kapsam) ? null : kapsam_id;

    // urun_id: boş string veya yoksa null
    const urunId: string | null = urun_id || null;

    const rpcFonksiyon = rpcFonksiyonBelirle(rolGrubu, kapsam as Kapsam);
    const params = rpcParametre(rpcFonksiyon, rolGrubu, kullanici, kapsam as Kapsam, kapsamId, baslangic, bitis, urunId);

    const { data: analizVerisi, error: rpcError } = await adminSupabase.rpc(rpcFonksiyon, params);
    if (rpcError) return hataYaniti('Analiz verisi çekilemedi.', `${rpcFonksiyon} RPC`, rpcError);

    const { yorum, aksiyonlar } = await aiYorumGetir(analizVerisi, periyot, kapsam, rpcFonksiyon);

    return NextResponse.json({
      veri: analizVerisi,
      yorum,
      aksiyonlar,
      meta: { periyot, kapsam, kapsam_id, baslangic, bitis },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, 'POST /analiz/api');
  }
}