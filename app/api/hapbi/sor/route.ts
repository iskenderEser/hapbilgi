// app/api/hapbi/sor/route.ts
//
// Hapbi AI Soru-Cevap, Kullanıcı Canlı Bağlamı ve Walkthrough Yönlendirme API Ucu.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { HAPBI_SISTEM_ISTEMI } from "@/lib/hapbi/hapbiBilgiTabani";
import { getHapbiKullaniciBaglami, type HapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";

export async function POST(req: Request) {
  try {
    const { soru, pathname } = await req.json();

    if (!soru || typeof soru !== "string") {
      return NextResponse.json({ error: "Soru gereklidir." }, { status: 400 });
    }

    // Kullanıcı oturumu ve canlı bağlamı çek
    let kullaniciBaglami: HapbiKullaniciBaglami | null = null;
    try {
      const supabase = await createClient();
      const adminSupabase = createAdminClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        kullaniciBaglami = await getHapbiKullaniciBaglami(adminSupabase, user.id);
      }
    } catch (authError) {
      console.warn("Kullanıcı oturum bağlamı alınamadı (anonim devam ediliyor):", authError);
    }

    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";

    // Kullanıcı Bağlam Metni
    const baglamMetni = kullaniciBaglami
      ? `
KULLANICININ ANLIK CANLI VERİLERİ (GİZLİ SİSTEM BİLGİSİ - DOĞRUDAN KULLAN):
- Adı Soyadı: ${kullaniciBaglami.adSoyad} (Hitap ederken bu adı kullan: örneğin "${kullaniciBaglami.adSoyad.split(" ")[0]} Bey/Hanım")
- Rolü: ${kullaniciBaglami.rol.toUpperCase()}
- Firması: ${kullaniciBaglami.firmaAdi ?? "Bilinmiyor"}
- Takımı: ${kullaniciBaglami.takimAdi ?? "Bilinmiyor"}
- Bölgesi: ${kullaniciBaglami.bolgeAdi ?? "Bilinmiyor"}
- Bu Haftaki Puanı: ${kullaniciBaglami.haftalikPuan} Puan
- Toplam Lig Puanı: ${kullaniciBaglami.toplamPuan} Puan
- Lig Sıralamaları:
  * Takım İçi Sırası: ${kullaniciBaglami.takimSirasi ?? 1}. sıra
  * Firma İçi Sırası: ${kullaniciBaglami.firmaSirasi ?? 1}. sıra
  * Bölge İçi Sırası: ${kullaniciBaglami.bolgeSirasi ?? 1}. sıra
- Puan Kaynakları ve Kayıplar:
  * Video İzleme Puanı: +${kullaniciBaglami.izlemePuani} Puan
  * Quiz / Soru Cevaplama Puanı: +${kullaniciBaglami.cevaplamaPuani} Puan
  * Video Öneri Puanı: +${kullaniciBaglami.oneriPuani} Puan
  * İleri Sarma Kaybı (Ceza): -${kullaniciBaglami.ileriSarmaKaybi} Puan
  * Test Yanlış Cevap Kaybı: -${kullaniciBaglami.yanlisCevapKaybi} Puan
- HBStore Cüzdan (Sipariş) Bakiyesi: ${kullaniciBaglami.siparisPuani} Puan
- Eğitim Durumu: Tamamlanan Video: ${kullaniciBaglami.tamamlananVideoSayisi} / Toplam Yayındaki Video: ${kullaniciBaglami.toplamVideoSayisi}
- E-Club Eczane Durumu: Bağlı Eczane Sayısı: ${kullaniciBaglami.bagliEczaneSayisi}
`
      : `
Kullanıcı Anonim veya oturum açılmamış. Genel kurumsal rehberlik yap.
`;

    // Eğer Gemini API anahtarı varsa Gemini ile çağrı yapalım
    if (apiKey) {
      try {
        const promptIcerigi = `
${HAPBI_SISTEM_ISTEMI}

${baglamMetni}

Kullanıcının o an bulunduğu sayfa: ${pathname ?? "/ana-sayfa"}
Kullanıcının Sorusu: "${soru}"

ÖZEL TALİMATLAR:
1. Eğer soru lig, puan veya sıralama ile ilgiliyse ("kaçıncı sıradayım?", "puanım kaç?" vb.): Kullanıcının canlı verilerindeki güncel puanını ve sırasını söyle.
2. Eğer soru kişisel gelişim veya koçluk ile ilgiliyse ("kendimi nerede geliştirmeliyim?", "ne yapmalıyım?" vb.):
   - Kullanıcının puan kayıplarını (varsa ileri sarma kaybı ve test yanlışları),
   - İzlemediği kalan videoları,
   - Eczane ve öneri fırsatlarını analiz ederek 3 somut maddelik profesyonel bir gelişim tavsiyesi ver.
3. Yanıtı gereksiz uzatmadan, net maddelerle ver ve cevabın yarım kesilmeyeceğinden emin ol.
`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: promptIcerigi }],
                },
              ],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 2000,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const cevapMetni = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (cevapMetni) {
            // Soruya uygun akıllı aksiyon türetelim
            let aksiyon;
            const q = soru.toLowerCase();
            if (q.includes("lig") || q.includes("sıra") || q.includes("kaçıncı") || q.includes("puan")) {
              aksiyon = { etiket: "T-Club Ligi Tablosuna Git 🏆", turId: "lig_tur", url: "/hbligi" };
            } else if (q.includes("geliştir") || q.includes("video") || q.includes("izle") || q.includes("eksik")) {
              aksiyon = { etiket: "Eğitim Videolarına Git 🎬", turId: "video_tur", url: "/videolarim" };
            } else if (q.includes("bağla") || q.includes("ekle") || q.includes("davet") || q.includes("eczanelerim") || q.includes("takımım") || q.includes("eczane")) {
              aksiyon = { etiket: "E-Club Takımıma Git 🤝", url: "/eclub/eczanelerim" };
            } else if (q.includes("store") || q.includes("sipariş") || q.includes("hediye") || q.includes("mağaza")) {
              aksiyon = { etiket: "HBStore'a Git 🎁", turId: "store_tur", url: "/store" };
            } else if (q.includes("12 saat") || q.includes("iptal")) {
              aksiyon = { etiket: "Siparişlerime Git 📦", url: "/store/siparislerim" };
            } else if (q.includes("öneri") || q.includes("tavsiye")) {
              aksiyon = { etiket: "Öneri Takibine Git 💡", turId: "oneri_tur", url: "/oneri-takibi" };
            }

            return NextResponse.json({
              cevap: cevapMetni,
              aksiyon,
            });
          }
        }
      } catch (geminiError) {
        console.error("Gemini API çağrı hatası:", geminiError);
      }
    }

    // Yerel Kural Motoru (Fallback)
    const q = soru.toLowerCase();
    let cevap = "HapBilgi eğitim ve ödül ekosistemidir. Sorularınızı yanıtlamaktan memnuniyet duyarım.";
    let aksiyon;

    if (q.includes("sıra") || q.includes("lig") || q.includes("kaçıncı") || q.includes("puan")) {
      const p = kullaniciBaglami?.haftalikPuan ?? 0;
      const s = kullaniciBaglami?.takimSirasi ?? 1;
      cevap = `Şu an takımınızda ${p} puanla ${s}. sıradasınız. Detaylı haftalık lig sıralamanızı ve rakiplerinizi görmek için lig tablosunu ziyaret edebilirsiniz.`;
      aksiyon = { etiket: "T-Club Ligi'ne Git 🏆", url: "/hbligi" };
    } else if (q.includes("bağla") || q.includes("ekle") || q.includes("davet") || q.includes("eczanelerim")) {
      cevap = "E-Club'a eczane eklemek ve takımınızdaki eczaneleri yönetmek için 'E-Club Takımım' sayfasını kullanabilirsiniz.";
      aksiyon = { etiket: "E-Club Takımıma Git 🤝", url: "/eclub/eczanelerim" };
    }

    return NextResponse.json({
      cevap,
      aksiyon,
    });
  } catch (error) {
    console.error("Hapbi API hatası:", error);
    return NextResponse.json(
      { error: "İstek işlenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
