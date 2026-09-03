import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });

const uygula = process.argv.includes("--apply");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const testTelefonuMu = (telefon) => /^0500[12]\d{6}$/.test(telefon ?? "");
const testEpostasi = (telefon) => `eczanem.test.${telefon}@example.com`;

const { data: tumEksikMusteriler, error: musteriHatasi } = await supabase
  .from("eczanem_musteriler")
  .select("musteri_id,telefon,ad_soyad,aktif_mi,auth_user_id")
  .is("auth_user_id", null)
  .order("telefon");

if (musteriHatasi) throw musteriHatasi;

const musteriler = (tumEksikMusteriler ?? []).filter(({ telefon }) => testTelefonuMu(telefon));

if (musteriler.length !== 35) {
  throw new Error(`Onarım durduruldu: Auth kimliği eksik hedef müşteri sayısı ${musteriler.length}, beklenen 35.`);
}

if (!musteriler.every(({ aktif_mi }) => aktif_mi === true)) {
  throw new Error("Onarım durduruldu: Hedef müşterilerin tamamı aktif değil.");
}

if (!uygula) {
  console.log(JSON.stringify({ mod: "dry-run", hedefMusteri: musteriler.length }, null, 2));
  process.exit(0);
}

const mevcutAuthKullanicilari = new Map();
for (let sayfa = 1; ; sayfa += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: sayfa, perPage: 1000 });
  if (error) throw error;

  for (const kullanici of data.users) {
    if (kullanici.email) mevcutAuthKullanicilari.set(kullanici.email.toLowerCase(), kullanici);
  }
  if (data.users.length < 1000) break;
}

let olusturulan = 0;
let yenidenKullanilan = 0;
let guncellenen = 0;

for (const musteri of musteriler) {
  const eposta = testEpostasi(musteri.telefon);
  let authUser = mevcutAuthKullanicilari.get(eposta);
  let buKosudaOlusturuldu = false;

  if (!authUser) {
    const sifre = `Hb!${randomBytes(24).toString("base64url")}`;
    const { data, error } = await supabase.auth.admin.createUser({
      email: eposta,
      password: sifre,
      email_confirm: true,
      app_metadata: { test_verisi: true },
      user_metadata: {
        kimlik: "eczanem_musteri",
        test_verisi: true,
        ad_soyad: musteri.ad_soyad,
        telefon: musteri.telefon,
      },
    });
    if (error || !data.user) throw error ?? new Error(`${eposta} Auth kullanıcısı oluşturulamadı.`);
    authUser = data.user;
    buKosudaOlusturuldu = true;
    olusturulan += 1;
  } else {
    yenidenKullanilan += 1;
  }

  const { data: guncellenenMusteri, error: guncellemeHatasi } = await supabase
    .from("eczanem_musteriler")
    .update({ auth_user_id: authUser.id })
    .eq("musteri_id", musteri.musteri_id)
    .is("auth_user_id", null)
    .select("musteri_id")
    .single();

  if (guncellemeHatasi || !guncellenenMusteri) {
    if (buKosudaOlusturuldu) await supabase.auth.admin.deleteUser(authUser.id);
    throw guncellemeHatasi ?? new Error(`${musteri.musteri_id} güncellenemedi.`);
  }
  guncellenen += 1;
}

console.log(JSON.stringify({
  mod: "apply",
  hedefMusteri: musteriler.length,
  olusturulanAuthKullanicisi: olusturulan,
  yenidenKullanilanAuthKullanicisi: yenidenKullanilan,
  guncellenenMusteri: guncellenen,
}, null, 2));
