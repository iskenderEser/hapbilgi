import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hataYaniti, isKuraluHatasi, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
const ADMIN_ISLEM_DURUMLARI = ["onaylandi", "teslimat_bekliyor", "cek_kodlari_gonderildi"];

export async function GET(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const supabase = createAdminClient();
    const durum = request.nextUrl.searchParams.get("durum");
    if (durum && !ADMIN_ISLEM_DURUMLARI.includes(durum)) {
      return validasyonHatasi("Admin yalnız TM onayından geçen talepleri görüntüleyebilir.", ["durum"]);
    }
    let query = supabase
      .from("eclub_store_cek_talepleri")
      .select(`
        talep_id, eczane_id, firma_id, yayin_id, talep_eden_kisi_id, toplanan_puan,
        talep_edilen_cek_tl, siparis_tipi, siparis_verildi_mi, siparis_adet,
        siparis_mal_fazlasi, durum, utt_id, bm_id, bm_onay_tarihi,
        tm_id, tm_onay_tarihi, cek_kodu,
        cek_gonderim_tarihi, devreden_puan, created_at,
        eclub_eczaneler ( gln ), firmalar ( firma_adi ),
        eclub_kisiler ( ad, soyad, rol, telefon )
      `)
      .order("created_at", { ascending: false });
    if (durum) query = query.eq("durum", durum);
    else query = query.in("durum", ADMIN_ISLEM_DURUMLARI);

    const { data, error } = await query;
    if (error) return hataYaniti("Çek talepleri alınamadı.", "eclub_store_cek_talepleri SELECT", error);

    const glnler = [...new Set((data ?? []).flatMap((talep: any) => {
      const eczane = Array.isArray(talep.eclub_eczaneler) ? talep.eclub_eczaneler[0] : talep.eclub_eczaneler;
      return eczane?.gln ? [eczane.gln as string] : [];
    }))];
    const eczaneAdlari = new Map<string, string>();
    if (glnler.length > 0) {
      const { data: masterlar, error: masterError } = await supabase
        .from("eclub_eczane_master")
        .select("gln, eczane_adi")
        .in("gln", glnler);
      if (masterError) return hataYaniti("Eczane bilgileri alınamadı.", "eclub_eczane_master SELECT", masterError);
      for (const master of masterlar ?? []) eczaneAdlari.set(master.gln, master.eczane_adi);
    }

    const talepler = (data ?? []).map((talep: any) => {
      const eczane = Array.isArray(talep.eclub_eczaneler) ? talep.eclub_eczaneler[0] : talep.eclub_eczaneler;
      const firma = Array.isArray(talep.firmalar) ? talep.firmalar[0] : talep.firmalar;
      const kisi = Array.isArray(talep.eclub_kisiler) ? talep.eclub_kisiler[0] : talep.eclub_kisiler;
      return {
        ...talep,
        eclub_eczaneler: undefined,
        firmalar: undefined,
        eclub_kisiler: undefined,
        eczane_adi: (eczane?.gln && eczaneAdlari.get(eczane.gln)) || "Eczane",
        gln: eczane?.gln ?? null,
        firma_adi: firma?.firma_adi ?? "Firma",
        urun_adi: "Migros Hediye Çeki",
        talep_eden_ad_soyad: kisi ? `${kisi.ad} ${kisi.soyad}` : "—",
        talep_eden_rol: kisi?.rol ?? "eczaci",
        talep_eden_tel: kisi?.telefon ?? null,
      };
    });
    return NextResponse.json({ talepler });
  } catch (error) {
    return sunucuHatasi(error, "GET /admin/eclub-store/api/siparis");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

    const body = await request.json();
    const supabase = createAdminClient();

    if (body.action === "cek_kodu_teslim") {
      if (!body.talep_id || !String(body.cek_kodu ?? "").trim()) {
        return validasyonHatasi("Talep ve çek kodu zorunludur.", ["talep_id", "cek_kodu"]);
      }
      const { data, error } = await supabase.rpc("eclub_store_admin_kod_teslim", {
        p_admin_id: kontrol.kullaniciId,
        p_talep_id: body.talep_id,
        p_cek_kodu: String(body.cek_kodu).trim(),
      });
      if (error) return hataYaniti("Çek kodu kaydedilemedi.", "eclub_store_admin_kod_teslim RPC", error);
      const sonuc = Array.isArray(data) ? data[0] : data;
      if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Çek kodu kaydedilemedi.");
      return NextResponse.json({ mesaj: "Çek kodu kaydedildi; e-posta ve push teslimat kuyruğuna alındı." });
    }

    if (body.action === "iptal") {
      if (!body.talep_id) return validasyonHatasi("Talep kimliği zorunludur.", ["talep_id"]);
      const { data, error } = await supabase.rpc("eclub_store_cek_talebi_iptal", {
        p_talep_id: body.talep_id,
        p_kisi_id: kontrol.kullaniciId,
        p_admin_mi: true,
      });
      if (error) return hataYaniti("Çek talebi iptal edilemedi.", "eclub_store_cek_talebi_iptal RPC", error);
      const sonuc = Array.isArray(data) ? data[0] : data;
      if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Çek talebi iptal edilemedi.");
      return NextResponse.json({ mesaj: "Çek talebi iptal edildi." });
    }

    return validasyonHatasi("Geçersiz işlem.", ["action"]);
  } catch (error) {
    return sunucuHatasi(error, "PATCH /admin/eclub-store/api/siparis");
  }
}
