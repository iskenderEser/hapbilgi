// lib/utils/aiIstemci.ts
// Provider bağımsız AI yorum servisi.
// Desteklenen providerlar: anthropic, openai, gemini, deepseek
// Provider seçimi ve yapılandırması .env.local üzerinden yönetilir:
//   AI_PROVIDER=anthropic
//   ANTHROPIC_API_KEY=sk-ant-...
//   ANTHROPIC_MODEL=claude-sonnet-4-6
//
// Gelecek geliştirmeler (şimdilik erken):
//   - Resmi SDK kullanımı (Vercel AI SDK veya provider SDK'ları)
//   - Timeout / retry / fallback mekanizması
//   - Yapılandırılmış prompt input standardizasyonu

export async function aiYorumAl(prompt: string): Promise<string> {
  const provider = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

    if (!apiKey) throw new Error('ANTHROPIC_API_KEY tanımlı değil.');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000 },
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

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
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