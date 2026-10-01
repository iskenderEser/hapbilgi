import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import {
  hataYaniti,
  sunucuHatasi,
  yetkiHatasi,
  rolHatasi,
  validasyonHatasi,
  isKuraluHatasi,
} from "@/lib/utils/hataIsle";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import { eclubStoreSiparisAcikMi, eclubStoreTakvimDurumu } from "@/lib/eclub/store/takvim";
import { eclubCekTalebiOlusturabilirMi } from "@/lib/eclub/store/cekTalebiYetkisi";

async function kisiCoz(adminSupabase: ReturnType<typeof createAdminClient>, authUserId: string) {
  const { data } = await adminSupabase
    .from("eclub_kisiler")
    .select("kisi_id, rol")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const { searchParams } = new URL(request.url);
    const durum = searchParams.get("durum");
    const { data: aktifUyelikler, error: uyelikError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("eczane_id")
      .eq("kisi_id", kisi.kisi_id)
      .eq("aktif_mi", true);
    if (uyelikError) return hataYaniti("Eczane üyeliği alınamadı.", "eclub_kisi_eczane SELECT — çek talepleri", uyelikError);

    const eczaneIdler = [...new Set((aktifUyelikler ?? []).map((uyelik) => uyelik.eczane_id))];
    if (eczaneIdler.length === 0) return NextResponse.json({ talepler: [] }, { status: 200 });

    let talepQuery = adminSupabase
      .from("eclub_store_cek_talepleri")
      .select(`
        talep_id, eczane_id, firma_id, yayin_id, talep_eden_kisi_id,
        toplanan_puan, talep_edilen_cek_tl, siparis_tipi,
        siparis_verildi_mi, siparis_adet, siparis_mal_fazlasi,
        durum, cek_kodu, cek_gonderim_tarihi, devreden_puan, created_at,
        v_yayin_kunye ( urun_id ),
        firmalar ( firma_adi )
      `)
      .in("eczane_id", eczaneIdler)
      .order("created_at", { ascending: false });
    if (durum) talepQuery = talepQuery.eq("durum", durum);

    const { data: talepler, error: talepError } = await talepQuery;
    if (talepError) return hataYaniti("Çek talepleri alınamadı.", "eclub_store_cek_talepleri SELECT", talepError);

    const urunIdler = [...new Set((talepler ?? []).flatMap((talep) => {
      const kunye = Array.isArray(talep.v_yayin_kunye) ? talep.v_yayin_kunye[0] : talep.v_yayin_kunye;
      return kunye?.urun_id ? [kunye.urun_id] : [];
    }))];
    const urunAdlari = new Map<string, string>();
    if (urunIdler.length > 0) {
      const { data: urunler, error: urunError } = await adminSupabase
        .from("urunler")
        .select("urun_id, urun_adi")
        .in("urun_id", urunIdler);
      if (urunError) return hataYaniti("Ürün bilgileri alınamadı.", "urunler SELECT — çek talepleri", urunError);
      for (const urun of urunler ?? []) urunAdlari.set(urun.urun_id, urun.urun_adi);
    }

    const sonuc = (talepler ?? []).map((talep) => {
      const kunye = Array.isArray(talep.v_yayin_kunye) ? talep.v_yayin_kunye[0] : talep.v_yayin_kunye;
      const firma = Array.isArray(talep.firmalar) ? talep.firmalar[0] : talep.firmalar;
      return {
        talep_id: talep.talep_id,
        eczane_id: talep.eczane_id,
        firma_id: talep.firma_id,
        firma_adi: firma?.firma_adi ?? "Firma",
        yayin_id: talep.yayin_id,
        urun_adi: (kunye?.urun_id ? urunAdlari.get(kunye.urun_id) : null) ?? "Migros Hediye Çeki",
        talep_eden_kisi_id: talep.talep_eden_kisi_id,
        toplanan_puan: Number(talep.toplanan_puan ?? 0),
        talep_edilen_cek_tl: Number(talep.talep_edilen_cek_tl ?? 0),
        siparis_tipi: talep.siparis_tipi,
        siparis_verildi_mi: talep.siparis_verildi_mi,
        siparis_adet: talep.siparis_adet ?? 0,
        siparis_mal_fazlasi: talep.siparis_mal_fazlasi ?? 0,
        durum: talep.durum,
        cek_kodu: talep.cek_kodu,
        cek_gonderim_tarihi: talep.cek_gonderim_tarihi,
        devreden_puan: talep.devreden_puan ?? 0,
        created_at: talep.created_at,
      };
    });

    return NextResponse.json({ talepler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/api/cek-talepleri");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const erisim = await eclubKisiErisimi(adminSupabase, user.id);
    const kisi = erisim.kisi;
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");
    if (!erisim.eclub_aktif || !erisim.eclub_store_aktif) {
      return rolHatasi("Aktif E-Club üyeliğiniz bulunmadığı için çek talebi oluşturamazsınız.");
    }
    if (!eclubCekTalebiOlusturabilirMi(kisi.rol)) {
      return rolHatasi("Hediye çeki talebini yalnız ana eczacı oluşturabilir.");
    }
    if (!eclubStoreSiparisAcikMi()) {
      const durum = eclubStoreTakvimDurumu();
      return isKuraluHatasi(
        `Hediye çeki talepleri şu an kapalıdır. Talepler yalnızca Hediye Çeki Günleri (${durum.sonrakiDonemEtiketi}) döneminde oluşturulabilir.`
      );
    }

    const body = await request.json();
    if (!body.yayin_id || typeof body.yayin_id !== "string") {
      return validasyonHatasi("yayin_id zorunludur.", ["yayin_id"]);
    }

    const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_cek_talebi_olustur", {
      p_kisi_id: kisi.kisi_id,
      p_yayin_id: body.yayin_id,
      p_siparis_verilsin_mi: Boolean(body.siparis_verilsin_mi),
    });
    if (rpcErr) return hataYaniti("Talep oluşturulamadı.", "eclub_store_cek_talebi_olustur RPC", rpcErr);

    const sonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
    if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "İşlem gerçekleştirilemedi.");

    return NextResponse.json({
      mesaj: Boolean(body.siparis_verilsin_mi)
        ? "Sipariş şartı ve hediye çeki talebiniz alındı, UTT onayına iletildi."
        : "Hediye çeki talebiniz alındı, UTT onayına iletildi.",
      talep_id: sonuc.talep_id,
      cek_tutari: sonuc.cek_tutari,
      devreden_puan: sonuc.devreden_puan,
    }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/api/cek-talepleri");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const kisi = await kisiCoz(adminSupabase, user.id);
    if (!kisi) return rolHatasi("Bu işlem yalnız E-Club kişilerine açıktır.");
    if (!ECLUB_TUKETICI_ROLLERI.includes(kisi.rol)) return rolHatasi("Geçersiz kişi rolü.");

    const body = await request.json();
    if (body.action !== "iptal") return validasyonHatasi("Yalnız iptal işlemi desteklenir.", ["action"]);
    if (!body.talep_id || typeof body.talep_id !== "string") {
      return validasyonHatasi("talep_id zorunludur.", ["talep_id"]);
    }

    const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_cek_talebi_iptal", {
      p_talep_id: body.talep_id,
      p_kisi_id: kisi.kisi_id,
      p_admin_mi: false,
    });
    if (rpcErr) return hataYaniti("Çek talebi iptal edilemedi.", "eclub_store_cek_talebi_iptal RPC", rpcErr);
    const sonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
    if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Çek talebi iptal edilemedi.");

    return NextResponse.json({ mesaj: "Çek talebi iptal edildi; devreden puan geri açıldı." }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "PATCH /eclub/api/cek-talepleri");
  }
}
