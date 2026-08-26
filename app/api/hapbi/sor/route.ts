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

    const baglamMetni = kullaniciBaglami?.canliVeriMetni ?? "Kullanıcı oturumu anonim. Genel kurumsal rehberlik yap.";

    // Eğer Gemini API anahtarı varsa Gemini ile çağrı yapalım
    if (apiKey) {
      try {
        const promptIcerigi = `
${HAPBI_SISTEM_ISTEMI}

${baglamMetni}

Kullanıcının o an bulunduğu sayfa: ${pathname ?? "/ana-sayfa"}
Kullanıcının Sorusu: "${soru}"

TEMEL YÖNERGELER:
- Kullanıcının sorusuna yukarıdaki canlı veritabanı tablosuna dayanarak DOĞAL, DİNAMİK ve NOKTA ATIŞI cevap ver.
- ASLA ezbere kalıp veya zoraki 3 madde şablonu kullanma; kullanıcının sorusu tam olarak neyi hedefliyorsa yalnızca ona odaklan.
- Eğer kullanıcı "hangi videoları izleyeyim / video önerisi" soruyorsa; tablodaki "HENÜZ İZLEMEDİĞİ AKTİF VİDEOLAR" listesindeki GERÇEK video/ürün isimlerini, kategorilerini, puanlarını ve yeni olma durumunu referans vererek en mantıklı videoları öner. Konu dışına çıkıp eczane veya öneri anlatma.
- Eğer kullanıcı lig sırasını veya puanını soruyorsa; tablodaki güncel puanını ve sırasını söyle.
- Yanıtını kurumsal, net, maddelerle okunabilir ve tam bir şekilde tamamla.
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
                temperature: 0.4,
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
            if (q.includes("video") || q.includes("izle") || q.includes("hangi")) {
              aksiyon = { etiket: "Tüm Videolarıma Git 🎬", turId: "video_tur", url: "/videolarim" };
            } else if (q.includes("lig") || q.includes("sıra") || q.includes("kaçıncı") || q.includes("puan")) {
              aksiyon = { etiket: "T-Club Ligi Tablosuna Git 🏆", turId: "lig_tur", url: "/hbligi" };
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
    return NextResponse.json({
      cevap: "HapBilgi eğitim ve ödül ekosistemidir. Sorularınızı yanıtlamaktan memnuniyet duyarım.",
      aksiyon: { etiket: "Ana Sayfaya Git 🏠", url: "/ana-sayfa" },
    });
  } catch (error) {
    console.error("Hapbi API hatası:", error);
    return NextResponse.json(
      { error: "İstek işlenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
