// app/admin/eclub-store/api/siparis/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, yetkiHatasi, rolHatasi, validasyonHatasi, isKuraluHatasi } from "@/lib/utils/hataIsle";
import { ADMIN_ROLLER } from "@/lib/utils/roller";
import { eclubStoreSiparisIptal } from "@/lib/eclub/store/eclubStoreSiparis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { eclubCekEpostaKuyrugunuTuket } from "@/lib/eclub/store/cekEpostaKuyrukIsleyici";

const GECERLI_DURUMLAR = ["beklemede", "hazirlaniyor", "kargoda", "teslim_edildi", "cek_kodlari_gonderildi"];

async function adminKontrol(_supabase: SupabaseClient): Promise<NextResponse | null> {
  // B-26: tek bekçi — adminGirisKontrol (yerel kopya kaldırıldı).
  const kontrol = await adminGirisKontrol();
  return kontrol.gecerli ? null : kontrol.yanit;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const durum = searchParams.get("durum");

    if (searchParams.get("tip") === "cek_talepleri") {
      let talepQuery = adminSupabase
        .from("eclub_store_cek_talepleri")
        .select(`
          talep_id, eczane_id, firma_id, yayin_id, talep_eden_kisi_id, toplanan_puan,
          talep_edilen_cek_tl, siparis_tipi, siparis_verildi_mi, siparis_adet,
          siparis_mal_fazlasi, durum, utt_id, bm_id, cek_kodu, cek_gonderim_tarihi,
          devreden_puan, created_at,
          eclub_eczaneler ( gln ),
          firmalar ( firma_adi ),
          eclub_kisiler ( ad, soyad, rol, telefon ),
          v_yayin_kunye ( urun_adi, urun_id )
        `)
        .order("created_at", { ascending: false });

      if (durum) talepQuery = talepQuery.eq("durum", durum);
      const { data: talepler, error: talepError } = await talepQuery;
      if (talepError) return hataYaniti("Çek talepleri çekilemedi.", "eclub_store_cek_talepleri SELECT", talepError);

      const glnler = [...new Set((talepler ?? []).map((t: any) => {
        const eczane = Array.isArray(t.eclub_eczaneler) ? t.eclub_eczaneler[0] : t.eclub_eczaneler;
        return eczane?.gln as string | undefined;
      }).filter((gln): gln is string => Boolean(gln)))];
      const eczaneMasterMap = new Map<string, { eczane_adi: string; telefon: string | null }>();
      if (glnler.length > 0) {
        const { data: masterlar, error: masterError } = await adminSupabase
          .from("eclub_eczane_master")
          .select("gln, eczane_adi, telefon")
          .in("gln", glnler);
        if (masterError) return hataYaniti("Eczane bilgileri çekilemedi.", "eclub_eczane_master SELECT", masterError);
        for (const m of masterlar ?? []) eczaneMasterMap.set(m.gln, { eczane_adi: m.eczane_adi, telefon: m.telefon ?? null });
      }
      const eczaneIdler = [...new Set((talepler ?? []).map((t: any) => t.eczane_id as string))];
      const eczanePersoneli = new Map<string, Array<{ ad_soyad: string; rol: string; telefon: string | null }>>();
      if (eczaneIdler.length > 0) {
        const { data: uyelikler, error: uyelikError } = await adminSupabase.from("eclub_kisi_eczane").select("eczane_id, kisi_id").in("eczane_id", eczaneIdler).eq("aktif_mi", true);
        if (uyelikError) return hataYaniti("Eczane personeli çekilemedi.", "eclub_kisi_eczane SELECT", uyelikError);
        const kisiIdler = [...new Set((uyelikler ?? []).map((u) => u.kisi_id))];
        const { data: kisiler, error: kisilerError } = kisiIdler.length > 0
          ? await adminSupabase.from("eclub_kisiler").select("kisi_id, ad, soyad, rol, telefon").in("kisi_id", kisiIdler)
          : { data: [], error: null };
        if (kisilerError) return hataYaniti("Eczane personel bilgileri çekilemedi.", "eclub_kisiler SELECT", kisilerError);
        const kisiMap = new Map((kisiler ?? []).map((k) => [k.kisi_id, k]));
        for (const uyelik of uyelikler ?? []) {
          const kisi = kisiMap.get(uyelik.kisi_id); if (!kisi) continue;
          const liste = eczanePersoneli.get(uyelik.eczane_id) ?? [];
          liste.push({ ad_soyad: `${kisi.ad} ${kisi.soyad}`, rol: kisi.rol, telefon: kisi.telefon ?? null });
          eczanePersoneli.set(uyelik.eczane_id, liste);
        }
      }

      const kullaniciIdler = [
        ...new Set(
          (talepler ?? [])
            .flatMap((t: any) => [t.utt_id, t.bm_id])
            .filter(Boolean)
        ),
      ];

      const kullaniciMap = new Map<string, { ad_soyad: string; bolge_adi?: string; takim_adi?: string }>();
      if (kullaniciIdler.length > 0) {
        const { data: kData } = await adminSupabase
          .from("kullanicilar")
          .select("kullanici_id, ad, soyad, bolgeler ( bolge_adi ), takimlar ( takim_adi )")
          .in("kullanici_id", kullaniciIdler);

        for (const k of kData ?? []) {
          const kk = k as any;
          const bolge = Array.isArray(kk.bolgeler) ? kk.bolgeler[0] : kk.bolgeler;
          const takim = Array.isArray(kk.takimlar) ? kk.takimlar[0] : kk.takimlar;
          kullaniciMap.set(kk.kullanici_id, {
            ad_soyad: `${kk.ad} ${kk.soyad}`,
            bolge_adi: bolge?.bolge_adi,
            takim_adi: takim?.takim_adi,
          });
        }
      }

      const zenginTalepler = (talepler ?? []).map((t: any) => {
        const eczane = Array.isArray(t.eclub_eczaneler) ? t.eclub_eczaneler[0] : t.eclub_eczaneler;
        const master = eczane?.gln ? eczaneMasterMap.get(eczane.gln) : undefined;
        const firma = Array.isArray(t.firmalar) ? t.firmalar[0] : t.firmalar;
        const kisi = Array.isArray(t.eclub_kisiler) ? t.eclub_kisiler[0] : t.eclub_kisiler;
        const kunye = Array.isArray(t.v_yayin_kunye) ? t.v_yayin_kunye[0] : t.v_yayin_kunye;
        const utt = t.utt_id ? kullaniciMap.get(t.utt_id) : undefined;
        const bm = t.bm_id ? kullaniciMap.get(t.bm_id) : undefined;
        const personel = eczanePersoneli.get(t.eczane_id) ?? [];
        const eczaci = personel.find((p) => ["eczaci", "ikinci_eczaci", "yardimci_eczaci"].includes(p.rol));
        const teknisyenler = personel.filter((p) => p.rol === "eczane_teknisyeni");

        return {
          talep_id: t.talep_id,
          eczane_id: t.eczane_id,
          eczane_adi: master?.eczane_adi ?? "Eczane",
          gln: eczane?.gln ?? null,
          eczane_tel: master?.telefon ?? null,
          firma_id: t.firma_id,
          firma_adi: firma?.firma_adi ?? "Firma",
          takim_adi: utt?.takim_adi ?? "—",
          bolge_adi: utt?.bolge_adi ?? bm?.bolge_adi ?? "—",
          yayin_id: t.yayin_id,
          urun_adi: kunye?.urun_adi ?? "Migros Hediye Çeki",
          talep_eden_kisi_id: t.talep_eden_kisi_id,
          talep_eden_ad_soyad: kisi ? `${kisi.ad} ${kisi.soyad}` : "—",
          talep_eden_rol: kisi?.rol ?? "eczaci",
          talep_eden_tel: kisi?.telefon ?? null,
          eczaci_ad_soyad: eczaci?.ad_soyad ?? null,
          eczaci_tel: eczaci?.telefon ?? null,
          teknisyen_ad_soyad: teknisyenler.map((p) => p.ad_soyad).join(", ") || null,
          teknisyen_tel: teknisyenler.map((p) => p.telefon).filter(Boolean).join(", ") || null,
          toplanan_puan: t.toplanan_puan,
          talep_edilen_cek_tl: Number(t.talep_edilen_cek_tl ?? 0),
          siparis_tipi: t.siparis_tipi,
          siparis_verildi_mi: t.siparis_verildi_mi,
          siparis_adet: t.siparis_adet ?? 0,
          siparis_mal_fazlasi: t.siparis_mal_fazlasi ?? 0,
          durum: t.durum,
          utt_id: t.utt_id,
          utt_adi: utt?.ad_soyad ?? "—",
          bm_id: t.bm_id,
          bm_adi: bm?.ad_soyad ?? "—",
          bm_onay_tarihi: t.bm_onay_tarihi,
          cek_kodu: t.cek_kodu,
          cek_gonderim_tarihi: t.cek_gonderim_tarihi,
          devreden_puan: t.devreden_puan ?? 0,
          created_at: t.created_at,
        };
      });

      return NextResponse.json({ talepler: zenginTalepler }, { status: 200 });
    }

    let query = adminSupabase
      .from("eclub_store_siparisler")
      .select("siparis_id, kisi_id, urun_id, adet, toplam_puan, durum, kargo_firmasi, kargo_takip_no, adres_snapshot, iptal_sebebi, created_at, eclub_store_urunler ( ad )")
      .order("created_at", { ascending: false });
    if (durum) query = query.eq("durum", durum);

    const { data: siparisler, error } = await query;
    if (error) return hataYaniti("Siparişler çekilemedi.", "eclub_store_siparisler SELECT", error);

    const kisiIdler = [...new Set((siparisler ?? []).map((s) => (s as { kisi_id: string }).kisi_id))];
    const kisiMap = new Map<string, string>();
    if (kisiIdler.length > 0) {
      const { data: kisiler } = await adminSupabase
        .from("eclub_kisiler")
        .select("kisi_id, ad, soyad")
        .in("kisi_id", kisiIdler);
      for (const k of kisiler ?? []) {
        const kk = k as { kisi_id: string; ad: string; soyad: string };
        kisiMap.set(kk.kisi_id, `${kk.ad} ${kk.soyad}`);
      }
    }

    const sonuc = (siparisler ?? []).map((s) => {
      const ss = s as unknown as { siparis_id: string; kisi_id: string; urun_id: string; adet: number; toplam_puan: number; durum: string; kargo_firmasi: string | null; kargo_takip_no: string | null; adres_snapshot: unknown; iptal_sebebi: string | null; created_at: string; eclub_store_urunler: { ad: string } | { ad: string }[] | null };
      const urun = Array.isArray(ss.eclub_store_urunler) ? ss.eclub_store_urunler[0] : ss.eclub_store_urunler;
      return {
        siparis_id: ss.siparis_id,
        kisi_id: ss.kisi_id,
        kisi_ad_soyad: kisiMap.get(ss.kisi_id) ?? "-",
        urun_adi: urun?.ad ?? "-",
        adet: ss.adet,
        toplam_puan: ss.toplam_puan,
        durum: ss.durum,
        kargo_firmasi: ss.kargo_firmasi,
        kargo_takip_no: ss.kargo_takip_no,
        adres_snapshot: ss.adres_snapshot,
        iptal_sebebi: ss.iptal_sebebi,
        created_at: ss.created_at,
      };
    });

    return NextResponse.json({ siparisler: sonuc }, { status: 200 });
  } catch (err) {
    return sunucuHatasi(err, "GET /admin/eclub-store/api/siparis");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const guard = await adminKontrol(supabase);
    if (guard) return guard;

    const { data: { user } } = await supabase.auth.getUser();
    const adminSupabase = createAdminClient();
    const body = await request.json();
    const { siparis_id, talep_id, action } = body;

    if (action === "toplu_cek_kodu_teslim") {
      const { kodlar } = body;
      if (!Array.isArray(kodlar) || kodlar.length === 0) {
        return validasyonHatasi("En az bir çek kodu gönderilmelidir.", ["kodlar"]);
      }
      let basariliAdet = 0;
      for (const k of kodlar) {
        if (!k.talep_id || !k.cek_kodu) continue;
        const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_admin_kod_teslim", {
          p_admin_id: user?.id,
          p_talep_id: k.talep_id,
          p_cek_kodu: String(k.cek_kodu).trim(),
        });
        if (rpcErr) continue;
        const sonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        if (sonuc?.ok) basariliAdet++;
      }
      if (basariliAdet > 0) await eclubCekEpostaKuyrugunuTuket(10).catch(() => undefined);
      return NextResponse.json({
        mesaj: `${basariliAdet} adet çek kodu başarıyla teslim edildi ve "Çek Kodları Gönderildi" durumuna alındı.`,
        basarili_adet: basariliAdet,
      }, { status: 200 });
    }

    if (!siparis_id && !talep_id) return validasyonHatasi("siparis_id veya talep_id zorunludur.", ["siparis_id"]);

    if (action === "durum" || action === "cek_kodu_teslim") {
      const { durum, kargo_firmasi, kargo_takip_no, cek_kodu } = body;
      const hedefDurum = action === "cek_kodu_teslim" ? "cek_kodlari_gonderildi" : durum;
      if (!GECERLI_DURUMLAR.includes(hedefDurum)) return validasyonHatasi(`Geçersiz durum: ${hedefDurum}`, ["durum"]);

      const guncelle: Record<string, unknown> = { durum: hedefDurum, guncellenme_at: new Date().toISOString() };
      if (hedefDurum === "kargoda") {
        if (!kargo_firmasi || !kargo_takip_no) return validasyonHatasi("Kargo için firma ve takip no zorunludur.", ["kargo_firmasi", "kargo_takip_no"]);
        guncelle.kargo_firmasi = kargo_firmasi;
        guncelle.kargo_takip_no = kargo_takip_no;
      }
      if (hedefDurum === "cek_kodlari_gonderildi") {
        if (!cek_kodu || !String(cek_kodu).trim()) return validasyonHatasi("Çek kodu zorunludur.", ["cek_kodu"]);
        const temizKod = String(cek_kodu).trim();
        guncelle.kargo_takip_no = temizKod;

        if (talep_id) {
          const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_admin_kod_teslim", {
            p_admin_id: user?.id,
            p_talep_id: talep_id,
            p_cek_kodu: temizKod,
          });
          if (rpcErr) return hataYaniti("Çek kodu RPC hatası.", "eclub_store_admin_kod_teslim RPC", rpcErr);
          const sonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
          if (!sonuc?.ok) return isKuraluHatasi(sonuc?.hata ?? "Çek kodu kaydedilemedi.");
          await eclubCekEpostaKuyrugunuTuket(1).catch(() => undefined);
        }
      }

      if (siparis_id) {
        const { error } = await adminSupabase
          .from("eclub_store_siparisler")
          .update(guncelle)
          .eq("siparis_id", siparis_id);
        if (error) return hataYaniti("Durum güncellenemedi.", "eclub_store_siparisler UPDATE durum", error);
      }

      return NextResponse.json({ mesaj: "Çek kodları gönderildi ve durum güncellendi." }, { status: 200 });
    }

    if (action === "iptal") {
      if (talep_id) {
        const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("eclub_store_cek_talebi_iptal", {
          p_talep_id: talep_id,
          p_kisi_id: user?.id,
          p_admin_mi: true,
        });
        if (rpcErr) return hataYaniti("Çek talebi iptal edilemedi.", "eclub_store_cek_talebi_iptal RPC", rpcErr);
        const rpcSonuc = Array.isArray(rpcRes) ? rpcRes[0] : rpcRes;
        if (!rpcSonuc?.ok) return isKuraluHatasi(rpcSonuc?.hata ?? "Çek talebi iptal edilemedi.");
        return NextResponse.json({ mesaj: "Çek talebi iptal edildi; devreden puan geri açıldı." }, { status: 200 });
      }
      const sonuc = await eclubStoreSiparisIptal(adminSupabase, {
        siparis_id,
        iptal_eden_kisi_id: user?.id ?? "",
        is_admin: true,
        sebep: body.sebep ?? "Admin tarafından iptal edildi.",
      });
      if (!sonuc.ok) return isKuraluHatasi(sonuc.error ?? "Sipariş iptal edilemedi.");
      return NextResponse.json({ mesaj: "Sipariş iptal edildi (puan iade)." }, { status: 200 });
    }

    return validasyonHatasi(`Geçersiz action: ${action} (geçerli: 'durum', 'iptal')`, ["action"]);
  } catch (err) {
    return sunucuHatasi(err, "PATCH /admin/eclub-store/api/siparis");
  }
}
