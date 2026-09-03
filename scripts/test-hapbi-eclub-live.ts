import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getHapbiKullaniciBaglami } from "@/lib/hapbi/hapbiKullaniciBaglami";
import { hapbiAraclariniOlustur } from "@/lib/hapbi/araclar";
import { hapbiYanitUret } from "@/lib/hapbi/gemini";

dotenv.config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GEMINI_API_KEY;
const model = (process.env.GEMINI_MODEL || "gemini-flash-latest").trim();

if (!supabaseUrl || !serviceRoleKey || !apiKey) {
  throw new Error("Supabase veya Gemini ortam değişkenleri eksik.");
}

const authUserId = "6e0ded1b-f126-462a-a662-0156b5512792";
const soru = "Bekleyen, tamamlanan ve süresi geçmiş eğitim sayım; toplam kazandığım, ileri sarmada kaybettiğim, net ve kullanılabilir puanım; doğru ve yanlış cevap sayım nedir? Ayrıca lig sıramı ve bu dönem sonucumu söyle.";
const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const baglam = await getHapbiKullaniciBaglami(db, authUserId);
const araclar = hapbiAraclariniOlustur(db, baglam);
const sonuc = await hapbiYanitUret({
  soru,
  pathname: "/eclub/panel",
  rol: baglam.rol,
  takvim: araclar.takvim,
  gecmis: [],
  arac: araclar.calistir,
  apiKey,
  model,
});

console.log(JSON.stringify({
  soru,
  kimlik_turu: baglam.kimlik_turu,
  rol: baglam.rol,
  cevap: sonuc.cevap,
  kaynaklar: sonuc.kaynaklar,
  egitimler: sonuc.egitimler,
  araclar: sonuc.araclar,
  model: sonuc.model,
}, null, 2));
