// lib/utils/aiIstemci.ts
// Provider bağımsız AI yorum servisi.
// Desteklenen providerlar: anthropic, openai, gemini, deepseek
// Provider seçimi ve yapılandırması .env.local üzerinden yönetilir:
//   AI_PROVIDER=anthropic
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_MODEL=claude-sonnet-4-6
//
// Dayanıklılık (retry):
//   - Tüm provider çağrıları denemeliFetch() üzerinden geçer.
//   - Geçici hatalarda (429, 500, 502, 503, 504 ve ağ hataları) exponential
//     backoff ile otomatik retry yapılır (varsayılan 3 deneme: 500ms, 1000ms).
//   - Kalıcı hatalar (400/401/403/404 vb.) retry EDİLMEZ; ilk denemede döner.
//   - Tüm denemeler tükenirse mevcut davranış korunur: provider bloğundaki
//     "!res.ok" kontrolü provider'a özel hatayı fırlatır.
//
// Gelecek geliştirmeler (şimdilik erken):
//   - Resmi SDK kullanımı (Vercel AI SDK veya provider SDK'ları)
//   - Timeout ve provider/model fallback mekanizması
//   - Yapılandırılmış prompt input standardizasyonu

// --- Geçici hatalarda otomatik retry sarmalayıcısı ---

const GECICI_HATA_KODLARI = new Set([429, 500, 502, 503, 504]);
const MAX_DENEME = 3; // toplam deneme sayısı
const BEKLEME_BASLANGIC_MS = 500; // ilk backoff süresi (ms)

function bekle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch + geçici hatalarda otomatik retry (exponential backoff).
 *
 * - Başarılı yanıt veya KALICI hata (400/401/403/404 vb.) → ilk denemede döner.
 * - GEÇİCİ hata (429/500/502/503/504) veya ağ hatası → backoff ile yeniden denenir.
 * - Tüm denemeler tükenirse: son Response döndürülür (çağıran "!res.ok" ile yönetir);
 *   son denemede de ağ hatası varsa o hata fırlatılır.
 *
 * Backoff: 500ms, 1000ms (3 deneme için iki bekleme).
 */
async function denemeliFetch(url: string, options: RequestInit): Promise<Response> {
  let sonAgHatasi: unknown = null;

  for (let deneme = 1; deneme <= MAX_DENEME; deneme++) {
    try {
      const res = await fetch(url, options);

      // Başarılı ya da kalıcı hata → retry etme, olduğu gibi döndür
      if (res.ok || !GECICI_HATA_KODLARI.has(res.status)) {
        return res;
      }

      // Geçici hata: son deneme değilse bekle ve tekrar dene
      if (deneme < MAX_DENEME) {
        await bekle(BEKLEME_BASLANGIC_MS * 2 ** (deneme - 1));
        continue;
      }

      // Son deneme de geçici hata → Response'u döndür, çağıran karar versin
      return res;
    } catch (err) {
      // Ağ hatası (fetch throw etti) → geçici kabul edip yeniden dene
      sonAgHatasi = err;
      if (deneme < MAX_DENEME) {
        await bekle(BEKLEME_BASLANGIC_MS * 2 ** (deneme - 1));
        continue;
      }
      throw err;
    }
  }

  // Teorik olarak ulaşılmaz
  throw sonAgHatasi ?? new Error('denemeliFetch: beklenmeyen durum');
}

export async function aiYorumAl(prompt: string): Promise<string> {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

    if (!apiKey) throw new Error('ANTHROPIC_API_KEY tanımlı değil.');

    const res = await denemeliFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const hata = await res.text();
      throw new Error(`Anthropic API hatası: ${hata}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY ?? '';
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o';

    if (!apiKey) throw new Error('OPENAI_API_KEY tanımlı değil.');

    const res = await denemeliFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const hata = await res.text();
      throw new Error(`OpenAI API hatası: ${hata}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-pro';

    if (!apiKey) throw new Error('GEMINI_API_KEY tanımlı değil.');

    const res = await denemeliFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 3000 },
        }),
      }
    );

    if (!res.ok) {
      const hata = await res.text();
      throw new Error(`Gemini API hatası: ${hata}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY ?? '';
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

    if (!apiKey) throw new Error('DEEPSEEK_API_KEY tanımlı değil.');

    const res = await denemeliFetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const hata = await res.text();
      throw new Error(`DeepSeek API hatası: ${hata}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  throw new Error(`Desteklenmeyen AI provider: ${provider}`);
}