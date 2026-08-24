// app/profil/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { haftaBaslangici, ayBaslangici, yilBaslangici, aktifPeriyot } from "@/lib/zaman/kontrol";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { FIRMA_KOLONLARI } from "@/lib/firma/kolonlar";
import { harcamaBakiyesi } from "@/lib/tclub/store/bakiye";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import { eclubStoreToplamBakiye } from "@/lib/eclub/store/eclubStoreBakiye";

export async function GET() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    // Dış müşteri ayrı kimlik düzlemindedir; v_kullanici_detay'da aranmaz.
    const eclubErisim = await eclubKisiErisimi(adminSupabase, user.id);
    if (eclubErisim.kisi) {
      const kisi = eclubErisim.kisi;
      const eczaneAdlari: string[] = [];
      if (eclubErisim.eczane_idler.length > 0) {
        const { data: eczaneler, error: eczaneError } = await adminSupabase
          .from("eclub_eczaneler")
          .select("gln")
          .in("eczane_id", eclubErisim.eczane_idler);
        if (eczaneError) return hataYaniti("Eczane bilgileri alınamadı.", "eclub_eczaneler SELECT — profil", eczaneError);
        const glnler = [...new Set((eczaneler ?? []).map((eczane) => eczane.gln))];
        if (glnler.length > 0) {
          const { data: master, error: masterError } = await adminSupabase
            .from("eclub_eczane_master")
            .select("eczane_adi")
            .in("gln", glnler);
          if (masterError) return hataYaniti("Eczane adları alınamadı.", "eclub_eczane_master SELECT — profil", masterError);
          eczaneAdlari.push(...[...new Set((master ?? []).map((eczane) => eczane.eczane_adi))]);
        }
      }

      const aktifFirmaAdlari = eclubErisim.firmalar
        .filter((firma) => firma.aktif !== false && firma.eclub_aktif === true)
        .map((firma) => firma.firma_adi);
      const aktifFirmalar = eclubErisim.firmalar
        .filter((firma) => firma.aktif !== false && firma.eclub_aktif === true)
        .map((firma) => ({ firma_id: firma.firma_id, firma_adi: firma.firma_adi }));
      const storePuani = eclubErisim.eclub_store_aktif
        ? await eclubStoreToplamBakiye(adminSupabase, kisi.kisi_id)
        : 0;

      return NextResponse.json({
        profil: {
          kullanici_id: kisi.kisi_id,
          ad: kisi.ad,
          soyad: kisi.soyad,
          eposta: kisi.eposta,
          telefon: kisi.telefon,
          rol: kisi.rol,
          firma_id: null,
          firma_adi: aktifFirmaAdlari.length > 0 ? aktifFirmaAdlari.join(", ") : null,
          takim_id: null,
          takim_adi: null,
          bolge_id: null,
          bolge_adi: null,
          eczane_adi: eczaneAdlari.length > 0 ? eczaneAdlari.join(", ") : null,
          fotograf_url: null,
          hbstore_aktif: false,
          cc_aktif: false,
          eclub_aktif: eclubErisim.eclub_aktif,
          eclub_store_aktif: eclubErisim.eclub_store_aktif,
          eczanem_aktif: eclubErisim.eczanem_aktif,
        },
        eclub_firmalar: aktifFirmalar,
        eclub_navbar_ozet: { store_puani: storePuani },
      }, { status: 200 });
    }

    const rol = await rolCozucu(adminSupabase, user.id);

    // v_kullanici_detay view'ı firma_adi, takim_adi, bolge_adi'yı join'liyor — 3 ayrı SELECT yerine tek view sorgusu
    const { data: kullanici, error: kullaniciError } = await adminSupabase
      .from("v_kullanici_detay")
      .select("kullanici_id, ad, soyad, eposta, rol, firma_id, firma_adi, takim_id, takim_adi, bolge_id, bolge_adi, fotograf_url")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciError || !kullanici) return hataYaniti("Kullanıcı bilgisi alınamadı.", "v_kullanici_detay SELECT", kullaniciError);

    // Firmanın HBStore, Challenge Club, E-Club ve E-Club Store açık/kapalı durumu — Navbar ve ilgili yüzeyler bunu okur
    let hbstore_aktif = false;
    let cc_aktif = false;
    let eclub_aktif = false;
    let eclub_store_aktif = false;
    let eczanem_aktif = false;
    if (kullanici.firma_id) {
      const { data: firma } = await adminSupabase
        .from("firmalar")
        .select(FIRMA_KOLONLARI)
        .eq("firma_id", kullanici.firma_id)
        .single();
      hbstore_aktif = firma?.hbstore_aktif ?? false;
      cc_aktif = firma?.cc_aktif ?? false;
      eclub_aktif = firma?.eclub_aktif ?? false;
      eclub_store_aktif = firma?.eclub_store_aktif ?? false;
      eczanem_aktif = firma?.eczanem_aktif ?? false;
    }

    const profilTemel = { ...kullanici, hbstore_aktif, cc_aktif, eclub_aktif, eclub_store_aktif, eczanem_aktif };

    if (!TUKETICI_ROLLER.includes(rol)) {
      return NextResponse.json({ profil: profilTemel }, { status: 200 });
    }

    // UTT/KD_UTT için ek veriler — zaman sınırları lib'den
    const haftaBasi = haftaBaslangici(new Date()).toISOString();
    const ayBasi = ayBaslangici().toISOString();
    const yilBasi = yilBaslangici().toISOString();

    // İzleme sayıları
    const { count: haftaIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", haftaBasi);

    const { count: ayIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", ayBasi);

    const { count: ytdIzleme } = await adminSupabase
      .from("izleme_kayitlari")
      .select("izleme_id", { count: "exact", head: true })
      .eq("kullanici_id", user.id)
      .eq("tamamlandi_mi", true)
      .gte("created_at", yilBasi);

    // Puan dağılımı (YTD)
    const { data: puanlar } = await adminSupabase
      .from("kazanilan_puanlar")
      .select("puan_turu, puan")
      .eq("kullanici_id", user.id)
      .gte("created_at", yilBasi);

    let izleme_puani = 0;
    let cevaplama_puani = 0;
    let oneri_puani = 0;
    let extra_puani = 0;

    for (const p of puanlar ?? []) {
      if (p.puan_turu === "izleme") izleme_puani += p.puan;
      else if (p.puan_turu === "cevaplama") cevaplama_puani += p.puan;
      else if (p.puan_turu === "oneri") oneri_puani += p.puan;
      else if (p.puan_turu === "extra") extra_puani += p.puan;
    }

    // Sıralama (tüm-zaman) — profil sayfası bu üçlüyü kullanır.
    const { data: siralama } = await adminSupabase
      .from("v_hbligi_sirali_v2")
      .select("firma_sirasi, takim_sirasi, bolge_sirasi")
      .eq("kullanici_id", user.id)
      .single();

    // ── Navbar özeti (yalnız UTT/KD_UTT — bu blok TUKETICI_ROLLER içinde) ──────
    // Haftalık puan + haftalık takım sırası: bu haftanın lig RPC'sinden Berk'in
    // satırı. Toplam/tüm-zaman DEĞİL — navbar değerleri haftalıktır.
    const { yil, hafta } = aktifPeriyot();
    const { data: haftalikLig } = await adminSupabase.rpc("get_hb_ligi_haftalik_v2", {
      p_yil: yil,
      p_hafta: hafta,
    });
    const benimHaftalik = Array.isArray(haftalikLig)
      ? haftalikLig.find((r: { kullanici_id: string }) => r.kullanici_id === user.id)
      : null;
    // Sipariş puanı: çeyreklik harcanabilir bakiye (formül sistemde — get_harcama_bakiyesi).
    const siparisPuani = await harcamaBakiyesi(adminSupabase, user.id);

    return NextResponse.json({
      profil: profilTemel,
      izleme: {
        haftalik: haftaIzleme ?? 0,
        aylik: ayIzleme ?? 0,
        ytd: ytdIzleme ?? 0,
      },
      puan_dagilimi: {
        izleme_puani,
        cevaplama_puani,
        oneri_puani,
        extra_puani,
      },
      siralama: {
        firma_sirasi: siralama?.firma_sirasi ?? null,
        takim_sirasi: siralama?.takim_sirasi ?? null,
        bolge_sirasi: siralama?.bolge_sirasi ?? null,
      },
      navbar_ozet: {
        haftalik_puan: benimHaftalik?.toplam_puan ?? 0,
        takim_sirasi: benimHaftalik?.takim_sirasi ?? null,
        siparis_puani: siparisPuani,
      },
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /profil/api");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const body = await request.json();
    const { fotograf_url, mevcut_sifre, yeni_sifre } = body;

    if (fotograf_url !== undefined) {
      const { data: kimlik, error: kimlikError } = await adminSupabase
        .from("v_auth_kimlik_admin")
        .select("kimlik_turu")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (kimlikError || !kimlik) return hataYaniti("Kimlik bilgisi alınamadı.", "v_auth_kimlik_admin SELECT — profil güncelleme", kimlikError);
      if (kimlik.kimlik_turu !== "kullanici") return isKuraluHatasi("E-Club profilinde fotoğraf yönetimi henüz bulunmuyor.");

      const { error: updateError } = await adminSupabase
        .from("kullanicilar")
        .update({ fotograf_url })
        .eq("kullanici_id", user.id);
      if (updateError) return hataYaniti("Fotoğraf güncellenemedi.", "kullanicilar tablosu UPDATE — fotograf_url", updateError);
      return NextResponse.json({ mesaj: "Fotoğraf güncellendi." }, { status: 200 });
    }

    if (mevcut_sifre && yeni_sifre) {
      const { error: sifreError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: mevcut_sifre,
      });
      if (sifreError) return hataYaniti("Mevcut şifre hatalı.", "auth.signInWithPassword — şifre doğrulama", sifreError, 400);

      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, { password: yeni_sifre });
      if (updateError) return hataYaniti("Şifre güncellenemedi.", "auth.admin.updateUserById — şifre güncelleme", updateError);
      return NextResponse.json({ mesaj: "Şifre güncellendi." }, { status: 200 });
    }

    return hataYaniti("Geçersiz istek.", "PUT /profil/api — body kontrolü", null, 400);

  } catch (err) {
    return sunucuHatasi(err, "PUT /profil/api");
  }
}
