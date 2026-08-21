import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isKuraluHatasi, rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { MUSTERI_ROLU } from "@/lib/utils/roller";
import { puanOmruGun } from "@/lib/eczanem/kasa";

const YENIDEN_DOGRULANACAK = new Set(["puandan_vazgec", "puan_kullanimi_tamamlandi", "reddet"]);

async function musteriOturumu() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { hata: yetkiHatasi() };

  const adminSupabase = createAdminClient();
  const rol = await rolCozucu(adminSupabase, user.id);
  if (rol !== MUSTERI_ROLU) return { hata: rolHatasi("Bu işlem yalnızca Eczanem müşterisine açıktır.") };
  return { supabase, adminSupabase, user };
}

export async function GET() {
  try {
    const oturum = await musteriOturumu();
    if ("hata" in oturum) return oturum.hata;

    const { adminSupabase, user } = oturum;
    const { data: talep, error: talepHatasi } = await adminSupabase
      .from("eczanem_eclub_gecis_talepleri")
      .select("gecis_id, musteri_id, eczane_id, rol, ad, soyad, durum, karar, created_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (talepHatasi) return sunucuHatasi(talepHatasi, "eczanem_eclub_gecis_talepleri SELECT — müşteri");
    if (!talep) return NextResponse.json({ talep: null }, { status: 200 });

    const omur = await puanOmruGun(adminSupabase);
    const altSinir = new Date(Date.now() - omur * 24 * 60 * 60 * 1000).toISOString();
    const [puanSonucu, siparisSonucu, eczaneSonucu] = await Promise.all([
      adminSupabase
        .from("eczanem_puan_kayitlari")
        .select("kalan_puan")
        .eq("musteri_id", talep.musteri_id)
        .gt("kalan_puan", 0)
        .gte("created_at", altSinir),
      adminSupabase
        .from("eczanem_siparisler")
        .select("siparis_id", { count: "exact", head: true })
        .eq("musteri_id", talep.musteri_id)
        .eq("durum", "bekliyor"),
      adminSupabase
        .from("eclub_eczaneler")
        .select("gln")
        .eq("eczane_id", talep.eczane_id)
        .maybeSingle(),
    ]);
    if (puanSonucu.error) return sunucuHatasi(puanSonucu.error, "eczanem_puan_kayitlari SELECT — geçiş bakiyesi");
    if (siparisSonucu.error) return sunucuHatasi(siparisSonucu.error, "eczanem_siparisler COUNT — geçiş kuyruğu");
    if (eczaneSonucu.error || !eczaneSonucu.data?.gln) return sunucuHatasi(eczaneSonucu.error, "eclub_eczaneler SELECT — geçiş eczanesi");

    const { data: master } = await adminSupabase
      .from("eclub_eczane_master")
      .select("eczane_adi")
      .eq("gln", eczaneSonucu.data.gln)
      .maybeSingle();

    return NextResponse.json({
      talep: {
        gecis_id: talep.gecis_id,
        eczane_adi: master?.eczane_adi ?? "Eczane",
        rol: talep.rol,
        ad: talep.ad,
        soyad: talep.soyad,
        durum: talep.durum,
        karar: talep.karar,
        kullanilabilir_puan: (puanSonucu.data ?? []).reduce((toplam, satir) => toplam + Number(satir.kalan_puan ?? 0), 0),
        bekleyen_siparis: siparisSonucu.count ?? 0,
        created_at: talep.created_at,
      },
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eczanem/api/eclub-gecisi");
  }
}

export async function POST(request: NextRequest) {
  try {
    const oturum = await musteriOturumu();
    if ("hata" in oturum) return oturum.hata;
    const { supabase, adminSupabase, user } = oturum;

    const body = await request.json();
    const gecisId = typeof body?.gecis_id === "string" ? body.gecis_id : "";
    const karar = typeof body?.karar === "string" ? body.karar : "";
    if (!gecisId) return validasyonHatasi("Geçiş talebi zorunludur.", ["gecis_id"]);
    if (!["puan_kullan", "puandan_vazgec", "puan_kullanimi_tamamlandi", "reddet"].includes(karar)) {
      return validasyonHatasi("Geçersiz geçiş kararı.", ["karar"]);
    }
    if (karar === "puandan_vazgec" && body?.vazgecme_onayi !== true) {
      return validasyonHatasi("Puanlardan vazgeçme beyanı açıkça onaylanmalıdır.", ["vazgecme_onayi"]);
    }

    const { data: talep, error: talepHatasi } = await adminSupabase
      .from("eczanem_eclub_gecis_talepleri")
      .select("gecis_id, rol, ad, soyad")
      .eq("gecis_id", gecisId)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (talepHatasi) return sunucuHatasi(talepHatasi, "eczanem_eclub_gecis_talepleri SELECT — karar öncesi");
    if (!talep) return isKuraluHatasi("E-Club geçiş talebi bulunamadı.");

    if (YENIDEN_DOGRULANACAK.has(karar)) {
      const sifre = typeof body?.sifre === "string" ? body.sifre : "";
      if (!sifre) return validasyonHatasi("Kararı onaylamak için mevcut şifrenizi girin.", ["sifre"]);
      if (!user.email) return isKuraluHatasi("Giriş hesabınız doğrulanamadı.");
      const { data: teyit, error: teyitHatasi } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: sifre,
      });
      if (teyitHatasi || teyit.user?.id !== user.id) return isKuraluHatasi("Şifreniz hatalı.");
    }

    const { data: sonuc, error: kararHatasi } = await adminSupabase.rpc("eczanem_eclub_gecis_karar_ver", {
      p_gecis_id: gecisId,
      p_auth_user_id: user.id,
      p_karar: karar,
    });
    if (kararHatasi?.code === "P0001" || kararHatasi?.code === "P0002" || kararHatasi?.code === "22023") {
      return isKuraluHatasi(kararHatasi.message);
    }
    if (kararHatasi) return sunucuHatasi(kararHatasi, "eczanem_eclub_gecis_karar_ver RPC");

    const cevap = (sonuc ?? {}) as { tamamlandi?: boolean; reddedildi?: boolean; vazgecilen_puan?: number };
    if (cevap.tamamlandi) {
      // Yetkinin kaynağı DB kimliğidir. Metadata yalnız eski istemciler için
      // güncellenir; bu yardımcı yazım başarısız olsa da atomik geçiş geçerlidir.
      const { error: metadataHatasi } = await adminSupabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          kimlik: "eclub_kisi",
          rol: talep.rol,
          ad: talep.ad,
          soyad: talep.soyad,
          eclub_kisi: true,
        },
      });
      if (metadataHatasi) console.error("[Eczanem → E-Club] Auth metadata güncellenemedi:", metadataHatasi.message);
    }

    return NextResponse.json({
      ok: true,
      ...cevap,
      mesaj: cevap.tamamlandi
        ? "E-Club üyeliğiniz tamamlandı. Aynı giriş hesabınızla devam edebilirsiniz."
        : cevap.reddedildi
          ? "E-Club üyelik talebini reddettiniz."
          : "Puanlarınızı kullanma tercihiniz kaydedildi.",
    }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eczanem/api/eclub-gecisi");
  }
}
