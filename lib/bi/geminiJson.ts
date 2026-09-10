// Gemini yalnız yapılandırılmış sorgu çıkarır; veri hesabı bu bağlantıya gönderilmez.
export async function geminiJsonOku(soru: string, talimat: string, sema: object, signal?: AbortSignal): Promise<unknown> {
  const anahtar = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!anahtar || !model) throw new Error('GEMINI_BAGLANTI');
  const yanit = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
    cache: 'no-store', signal: AbortSignal.any([AbortSignal.timeout(12_000), ...(signal ? [signal] : [])]),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: talimat }] },
      contents: [{ role: 'user', parts: [{ text: soru }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: sema },
    }),
  });
  if (!yanit.ok) throw new Error('GEMINI_BAGLANTI');
  const veri = await yanit.json();
  const aday = veri.candidates?.[0];
  if (aday?.finishReason !== 'STOP') throw new Error('GEMINI_BAGLANTI');
  return JSON.parse(aday.content?.parts?.filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '').join(''));
}
