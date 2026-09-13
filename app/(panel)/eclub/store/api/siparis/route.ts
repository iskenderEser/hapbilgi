import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ECLUB_TUKETICI_ROLLERI } from "@/lib/utils/roller";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { eclubStoreSiparisOlustur, eclubStoreSiparisIptal, eclubStoreTeslimAldim } from "@/lib/eclub/store/eclubStoreSiparis";
import { eclubKisiErisimi } from "@/lib/eclub/kisiErisim";
import {
  eclubStoreSiparisAcikMi,
  eclubStoreTakvimDurumu,
} from "@/lib/eclub/store/takvim";

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

    let query = adminSupabase
      .from("eclub_store_siparisler")
      .select(`
        siparis_id, kisi_id, urun_id, adres_id, adres_snapshot, adet,
        puan_birim_fiyat, toplam_puan, durum, kargo_firmasi, kargo_takip_no,
        iptal_sebebi, created_at, guncellenme_at, teslim_alma_at,
        eclub_store_urunler ( ad, gorsel_url )
      `)
      .eq("kisi_id", kisi.kisi_id)
      .order("created_at", { ascending: false });

    if (durum) query = query.eq("durum", durum);

    const { data, error } = await query;
    if (error) return hataYaniti("Siparişler çekilemedi.", "eclub_store_siparisler SELECT", error);

    const { data: aktifUyelikler, error: uyelikError } = await adminSupabase
      .from("eclub_kisi_eczane")
      .select("eczane_id")
      .eq("kisi_id", kisi.kisi_id)
      .eq("aktif_mi", true);
    if (uyelikError) return hataYaniti("Eczane üyeliği alınamadı.", "eclub_kisi_eczane SELECT — çeklerim", uyelikError);
    const eczaneIdler = [...new Set((aktifUyelikler ?? []).map((u) => u.eczane_id))];

    let talepQuery = adminSupabase
      .from("eclub_store_cek_talepleri")
      .select(`
        talep_id, eczane_id, firma_id, yayin_id, talep_eden_kisi_id, toplanan_puan,
        talep_edilen_cek_tl, siparis_tipi, siparis_verildi_mi, siparis_adet,
        siparis_mal_fazlasi, durum, utt_id, bm_id, cek_kodu, cek_gonderim_tarihi,
        devreden_puan, created_at,
        yayin_yonetimi ( baslik ),
        firmalar ( firma_adi )
      `)
      .in("eczane_id", eczaneIdler.length > 0 ? eczaneIdler : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    if (durum) talepQuery = talepQuery.eq("durum", durum);
    const { data: cekTalepleri } = await talepQuery;

    const formatliCekler = (cekTalepleri ?? []).map((t: any) => {
      const baslik = t.yayin_yonetimi?.baslik ?? "Migros Hediye Çeki";
      return {
        siparis_id: t.talep_id,
        talep_id: t.talep_id,
        kisi_id: t.talep_eden_kisi_id,
        urun_id: t.yayin_id,
        adres_id: null,
        adres_snapshot: null,
        adet: t.siparis_adet ?? 1,
        puan_birim_fiyat: t.toplanan_puan,
        toplam_puan: t.toplanan_puan,
        talep_edilen_cek_tl: Number(t.talep_edilen_cek_tl ?? 0),
        siparis_tipi: t.siparis_tipi,
        siparis_verildi_mi: t.siparis_verildi_mi,
        siparis_adet: t.siparis_adet,
        siparis_mal_fazlasi: t.siparis_mal_fazlasi,
        durum: t.durum,
        kargo_firmasi: t.cek_kodu ? "Migros Dijital Kod" : null,
        kargo_takip_no: t.cek_kodu ?? null,
        iptal_sebebi: null,
        created_at: t.created_at,
        guncellenme_at: t.created_at,
        teslim_alma_at: t.cek_gonderim_tarihi,
        eclub_store_urunler: {
          ad: `${baslik} (${t.talep_edilen_cek_tl} TL Hediye Çeki)`,
          gorsel_url: null,
        },
      };
    });

    const tumSiparisler = [...formatliCekler, ...(data ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ siparisler: tumSiparisler, cek_talepleri: cekTalepleri ?? [] }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/store/api/siparis");
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
      return rolHatasi("Aktif E-Club üyeliğiniz bulunmadığı için yeni sipariş oluşturamazsınız.");
    }

    // Sipariş dönemi kontrolü (E-Club Store Günleri)
    if (!eclubStoreSiparisAcikMi()) {
      const durum = eclubStoreTakvimDurumu();
      return isKuraluHatasi(
        `E-Club Store şu an siparişe kapalıdır. Siparişler yalnızca E-Club Store Günleri (${durum.sonrakiDonemEtiketi}) döneminde verilebilir.`
      );
    }

    const body = await request.json();

    if (body.yayin_id) {
      const { yayin_id, siparis_verilsin_mi } = body;
      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_cek_talebi_olustur", {
        p_kisi_id: kisi.kisi_id,
        p_yayin_id: yayin_id,
        p_siparis_verilsin_mi: Boolean(siparis_verilsin_mi),
      });

      if (rpcErr) return hataYaniti("Talep oluşturulamadı.", "eclub_store_cek_talebi_olustur RPC", rpcErr);
      const sonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
      if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "İşlem gerçekleştirilemedi.");

      return NextResponse.json({
        mesaj: Boolean(siparis_verilsin_mi)
          ? "Sipariş ve hediye çeki talebiniz alındı, UTT onayına iletildi."
          : "Hediye çeki talebiniz alındı, UTT onayına iletildi.",
        talep_id: sonuc.talep_id,
        cek_tutari: sonuc.cek_tutari,
        devreden_puan: sonuc.devreden_puan,
      }, { status: 201 });
    }

    const { urun_id, adres_id, adet } = body;

    if (!urun_id || typeof urun_id !== "string") return validasyonHatasi("urun_id zorunludur.", ["urun_id"]);
    if (!adres_id || typeof adres_id !== "string") return validasyonHatasi("adres_id zorunludur.", ["adres_id"]);
    const adetSayi = Number(adet);
    if (!Number.isInteger(adetSayi) || adetSayi <= 0) return validasyonHatasi("adet pozitif tam sayı olmalı.", ["adet"]);

    const sonuc = await eclubStoreSiparisOlustur(adminSupabase, {
      kisi_id: kisi.kisi_id,
      urun_id,
      adres_id,
      adet: adetSayi,
    });

    if (!sonuc.ok) return isKuraluHatasi(sonuc.hata ?? "Sipariş oluşturulamadı.");

    return NextResponse.json({ mesaj: "Sipariş alındı.", siparis_id: sonuc.siparis_id }, { status: 201 });
  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/store/api/siparis");
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
    const { siparis_id, action, sebep } = body;
    if (!siparis_id || typeof siparis_id !== "string") return validasyonHatasi("siparis_id zorunludur.", ["siparis_id"]);

    if (action === "iptal") {
      const { data: cekTalebi, error: cekTalebiError } = await adminSupabase
        .from("eclub_store_cek_talepleri")
        .select("talep_id")
        .eq("talep_id", siparis_id)
        .maybeSingle();
      if (cekTalebiError) return hataYaniti("Çek talebi doğrulanamadı.", "eclub_store_cek_talepleri SELECT — iptal", cekTalebiError);
      if (cekTalebi) {
        const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_cek_talebi_iptal", {
          p_talep_id: siparis_id,
          p_kisi_id: kisi.kisi_id,
          p_admin_mi: false,
        });
        if (rpcErr) return hataYaniti("Çek talebi iptal edilemedi.", "eclub_store_cek_talebi_iptal RPC", rpcErr);
        const rpcSonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        if (!rpcSonuc?.ok) return isKuraluHatasi(rpcSonuc?.hata ?? "Çek talebi iptal edilemedi.");
        return NextResponse.json({ mesaj: "Çek talebi iptal edildi; devreden puan geri açıldı." }, { status: 200 });
      }
      const sonuc = await eclubStoreSiparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_kisi_id: kisi.kisi_id,
        is_admin: false,
        sebep: sebep ?? null,
      });
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      return NextResponse.json({ mesaj: "Sipariş iptal edildi." }, { status: 200 });
    }

    if (action === "teslim_aldim") {
      const sonuc = await eclubStoreTeslimAldim(adminSupabase, siparis_id, kisi.kisi_id);
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Teslim onayı verilemedi.");
      return NextResponse.json({ mesaj: "Sipariş teslim alındı olarak işaretlendi." }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz action: ${action} (geçerli: 'iptal', 'teslim_aldim')`, ["action"]);
  } catch (err) {
    return sunucuHatasi(err, "PATCH /eclub/store/api/siparis");
  }
}
