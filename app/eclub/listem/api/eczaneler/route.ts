// app/eclub/listem/api/eczaneler/route.ts
//
// Dört katmanlı model (master eklendi):
//   Master:  eclub_eczane_master (gln PK, ad/il/ilce, kaynak, onay_durumu) — resmi referans
//   Kimlik:  eclub_eczaneler (gln → master FK) — sisteme dahil edilen eczaneler
//   Kişi-bağ: eclub_kisi_eczane
//   İlişki:  eclub_eczane_firma
//
// GLN-öncelikli akış:
//   GET ?gln=  → master'da ara. Varsa ad/il/ilçe + havuz durumu + kişiler. Yoksa {var:false,master_yok:true}
//   GET        → UTT'nin listesi (aktif ilişkili eczaneleri, ad master'dan)
//   POST       → master'da onaylı GLN varsa havuza bağla; yoksa elle ekleme (master'a bekliyor)
//   PUT        → listeden çıkar (soft) + 5-UTT sinyali

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, veriKontrol, sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import type { SupabaseClient } from "@supabase/supabase-js";

const ECLUB_UTT_ROLLERI = ["utt", "kd_utt"];
const ECLUB_5UTT_ESIK = 5;

function glnGecerliMi(gln: string): boolean {
  return /^\d{13}$/.test(gln);
}

interface UttKontrolBasari { firma_id: string; }
interface UttKontrolHata { hata: NextResponse; }
type UttKontrolSonuc = UttKontrolBasari | UttKontrolHata;

async function uttKontrol(adminSupabase: SupabaseClient, userId: string): Promise<UttKontrolSonuc> {
  const { data: kullanici, error } = await adminSupabase
    .from("kullanicilar")
    .select("rol, firma_id")
    .eq("kullanici_id", userId)
    .single();
  if (error || !kullanici) return { hata: hataYaniti("Kullanıcı sorgulanamadı.", "kullanicilar SELECT", error, 404) };
  const rolKucu = (kullanici.rol ?? "").toLowerCase();
  if (!ECLUB_UTT_ROLLERI.includes(rolKucu)) return { hata: rolHatasi("Bu sayfaya yalnız UTT/KD_UTT erişebilir.") };
  if (!kullanici.firma_id) return { hata: validasyonHatasi("Firma bilgisi bulunamadı.", ["firma_id"]) };
  return { firma_id: kullanici.firma_id as string };
}

interface KisiKayit {
  kisi_id: string; rol: string; ad: string; soyad: string;
  eposta: string; telefon: string; auth_user_id: string | null;
}

async function eczaneKisileri(
  adminSupabase: SupabaseClient,
  eczane_id: string
): Promise<{ eczaci: KisiKayit | null; teknisyenler: KisiKayit[] }> {
  const { data: baglar } = await adminSupabase
    .from("eclub_kisi_eczane")
    .select("kisi_id, aktif_mi, eclub_kisiler ( kisi_id, rol, ad, soyad, eposta, telefon, auth_user_id )")
    .eq("eczane_id", eczane_id)
    .eq("aktif_mi", true);

  let eczaci: KisiKayit | null = null;
  const teknisyenler: KisiKayit[] = [];
  for (const b of baglar ?? []) {
    const kRaw = (b as { eclub_kisiler?: KisiKayit | KisiKayit[] }).eclub_kisiler;
    const k = Array.isArray(kRaw) ? kRaw[0] : kRaw;
    if (!k) continue;
    const kayit: KisiKayit = {
      kisi_id: k.kisi_id, rol: k.rol, ad: k.ad, soyad: k.soyad,
      eposta: k.eposta, telefon: k.telefon, auth_user_id: k.auth_user_id ?? null,
    };
    if (k.rol === "eczaci") { if (!eczaci) eczaci = kayit; }
    else teknisyenler.push(kayit);
  }
  return { eczaci, teknisyenler };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    const gln = request.nextUrl.searchParams.get("gln");

    // ─── GLN SORGU: önce master'da ara ───────────────────────────────────
    if (gln !== null) {
      const glnTemiz = gln.trim();
      if (!glnGecerliMi(glnTemiz)) return validasyonHatasi("GLN 13 haneli sayı olmalıdır.", ["gln"]);

      const { data: master, error: masterError } = await adminSupabase
        .from("eclub_eczane_master")
        .select("gln, eczane_adi, il, ilce, onay_durumu")
        .eq("gln", glnTemiz)
        .maybeSingle();

      if (masterError) return hataYaniti("GLN sorgulanamadı.", "eclub_eczane_master SELECT — gln", masterError);

      // Master'da yok → resmi listede değil, elle ekleme (admin onayı) gerekir
      if (!master) return NextResponse.json({ var: false, master_yok: true }, { status: 200 });

      // Master'da var ama onay bekliyor (elle eklenmiş, admin onaylamamış)
      if (master.onay_durumu === "bekliyor")
        return NextResponse.json({ var: false, onay_bekliyor: true, eczane_adi: master.eczane_adi }, { status: 200 });

      // Master'da onaylı → havuzda dahil mi bak
      const { data: havuz } = await adminSupabase
        .from("eclub_eczaneler")
        .select("eczane_id")
        .eq("gln", glnTemiz)
        .maybeSingle();

      let eczaci: KisiKayit | null = null;
      let teknisyenler: KisiKayit[] = [];
      let listede = false;
      let eczane_id: string | null = null;

      if (havuz) {
        eczane_id = havuz.eczane_id;
        const kisiler = await eczaneKisileri(adminSupabase, havuz.eczane_id);
        eczaci = kisiler.eczaci;
        teknisyenler = kisiler.teknisyenler;

        const { data: iliski } = await adminSupabase
          .from("eclub_eczane_firma")
          .select("id")
          .eq("eczane_id", havuz.eczane_id)
          .eq("firma_id", k.firma_id)
          .eq("aktif_mi", true)
          .maybeSingle();
        listede = !!iliski;
      }

      return NextResponse.json({
        var: true,
        listede,
        eczane: { eczane_id, gln: master.gln, eczane_adi: master.eczane_adi, il: master.il, ilce: master.ilce },
        eczaci,
        teknisyenler,
      }, { status: 200 });
    }

    // ─── LİSTE: UTT'nin aktif ilişkili eczaneleri (ad master'dan) ─────────
    const { data: iliskiler, error: iliskiError } = await adminSupabase
      .from("eclub_eczane_firma")
      .select("eczane_id, created_at, eclub_eczaneler ( eczane_id, gln, eclub_eczane_master ( eczane_adi, il, ilce ) )")
      .eq("baglayan_utt_id", user.id)
      .eq("aktif_mi", true)
      .order("created_at", { ascending: false });

    if (iliskiError) return hataYaniti("Liste çekilemedi.", "eclub_eczane_firma SELECT — baglayan_utt_id", iliskiError);

    type MasterAd = { eczane_adi: string; il: string; ilce: string | null };
    type HavuzKimlik = { eczane_id: string; gln: string; eclub_eczane_master?: MasterAd | MasterAd[] };

    const sonuc = [];
    for (const il of iliskiler ?? []) {
      const eRaw = (il as { eclub_eczaneler?: HavuzKimlik | HavuzKimlik[] }).eclub_eczaneler;
      const e = Array.isArray(eRaw) ? eRaw[0] : eRaw;
      if (!e) continue;
      const mRaw = e.eclub_eczane_master;
      const m = Array.isArray(mRaw) ? mRaw[0] : mRaw;
      const { eczaci, teknisyenler } = await eczaneKisileri(adminSupabase, e.eczane_id);
      sonuc.push({
        eczane_id: e.eczane_id,
        gln: e.gln,
        eczane_adi: m?.eczane_adi ?? "-",
        il: m?.il ?? null,
        ilce: m?.ilce ?? null,
        created_at: (il as { created_at: string }).created_at,
        eczaci_var: !!eczaci,
        teknisyen_sayisi: teknisyenler.length,
        toplam_kisi: (eczaci ? 1 : 0) + teknisyenler.length,
      });
    }

    return NextResponse.json({ eczaneler: sonuc }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/listem/api/eczaneler");
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    const body = await request.json();
    const { gln, eczane_adi, il, ilce } = body;

    if (!gln || typeof gln !== "string") return validasyonHatasi("GLN zorunludur.", ["gln"]);
    const glnTemiz = gln.trim();
    if (!glnGecerliMi(glnTemiz)) return validasyonHatasi("GLN 13 haneli sayı olmalıdır.", ["gln"]);

    // Master durumu
    const { data: master, error: masterError } = await adminSupabase
      .from("eclub_eczane_master")
      .select("gln, eczane_adi, onay_durumu")
      .eq("gln", glnTemiz)
      .maybeSingle();

    if (masterError) return hataYaniti("GLN kontrolü yapılamadı.", "eclub_eczane_master SELECT — gln", masterError);

    // ── Master'da YOK → elle ekleme (admin onayına gider), havuza bağlanmaz ──
    if (!master) {
      if (!eczane_adi || typeof eczane_adi !== "string" || eczane_adi.trim().length === 0)
        return validasyonHatasi("Yeni eczane için eczane adı zorunludur.", ["eczane_adi"]);
      if (!il || typeof il !== "string" || il.trim().length === 0)
        return validasyonHatasi("İl zorunludur.", ["il"]);
      if (eczane_adi.length > 200) return validasyonHatasi("Eczane adı 200 karakterden uzun olamaz.", ["eczane_adi"]);

      const { error: masterInsertError } = await adminSupabase
        .from("eclub_eczane_master")
        .insert({
          gln: glnTemiz,
          eczane_adi: eczane_adi.trim(),
          il: il.trim(),
          ilce: (typeof ilce === "string" && ilce.trim()) ? ilce.trim() : null,
          kaynak: "elle",
          onay_durumu: "bekliyor",
          ekleyen_utt_id: user.id,
        });

      if (masterInsertError) return hataYaniti("Eczane kaydı oluşturulamadı.", "eclub_eczane_master INSERT — elle", masterInsertError);

      return NextResponse.json({
        mesaj: "Eczane admin onayına gönderildi. Onaylanınca listenize ekleyebilirsiniz.",
        onay_bekliyor: true,
      }, { status: 201 });
    }

    // ── Master'da var ama onay bekliyor → henüz eklenemez ──
    if (master.onay_durumu === "bekliyor")
      return validasyonHatasi("Bu eczane admin onayı bekliyor, henüz eklenemez.", ["gln"]);

    // ── Master'da onaylı → havuza dahil et + firmaya bağla ──
    let eczane_id: string;
    const { data: havuz } = await adminSupabase
      .from("eclub_eczaneler")
      .select("eczane_id")
      .eq("gln", glnTemiz)
      .maybeSingle();

    if (havuz) {
      eczane_id = havuz.eczane_id;
    } else {
      const { data: yeniHavuz, error: havuzError } = await adminSupabase
        .from("eclub_eczaneler")
        .insert({ gln: glnTemiz })
        .select("eczane_id")
        .single();
      if (havuzError || !yeniHavuz) return hataYaniti("Eczane havuza dahil edilemedi.", "eclub_eczaneler INSERT", havuzError);
      eczane_id = yeniHavuz.eczane_id;
    }

    // Firmaya bağla (ilişki)
    const { data: iliski } = await adminSupabase
      .from("eclub_eczane_firma")
      .select("id, aktif_mi")
      .eq("eczane_id", eczane_id)
      .eq("firma_id", k.firma_id)
      .maybeSingle();

    if (iliski?.aktif_mi) return validasyonHatasi("Bu eczane zaten listenizde.", ["gln"]);

    if (iliski && !iliski.aktif_mi) {
      const { error: reErr } = await adminSupabase
        .from("eclub_eczane_firma")
        .update({ aktif_mi: true, baglayan_utt_id: user.id })
        .eq("id", iliski.id);
      if (reErr) return hataYaniti("Eczane listeye eklenemedi.", "eclub_eczane_firma UPDATE — yeniden aktif", reErr);
    } else {
      const { error: ilErr } = await adminSupabase
        .from("eclub_eczane_firma")
        .insert({ eczane_id, firma_id: k.firma_id, baglayan_utt_id: user.id });
      if (ilErr) return hataYaniti("Eczane listeye eklenemedi.", "eclub_eczane_firma INSERT", ilErr);
    }

    return NextResponse.json({ mesaj: "Eczane listenize eklendi.", eczane: { eczane_id, gln: master.gln, eczane_adi: master.eczane_adi } }, { status: 201 });

  } catch (err) {
    return sunucuHatasi(err, "POST /eclub/listem/api/eczaneler");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const adminSupabase = createAdminClient();
    const k = await uttKontrol(adminSupabase, user.id);
    if ("hata" in k) return k.hata;

    const body = await request.json();
    const { eczane_id, islem } = body;

    if (!eczane_id) return validasyonHatasi("eczane_id zorunludur.", ["eczane_id"]);
    if (islem !== "listeden_cikar") return validasyonHatasi("Geçersiz işlem.", ["islem"]);

    const { data: iliski, error: iliskiError } = await adminSupabase
      .from("eclub_eczane_firma")
      .select("id")
      .eq("eczane_id", eczane_id)
      .eq("baglayan_utt_id", user.id)
      .eq("aktif_mi", true)
      .maybeSingle();

    const iliskiKontrol = veriKontrol(iliski, "eclub_eczane_firma SELECT — ilişki kontrolü", "Bu eczane listenizde bulunamadı.");
    if (!iliskiKontrol.gecerli) return iliskiKontrol.yanit;
    if (iliskiError) return hataYaniti("İlişki sorgulanamadı.", "eclub_eczane_firma SELECT", iliskiError, 404);

    const { error: updateError } = await adminSupabase
      .from("eclub_eczane_firma")
      .update({ aktif_mi: false })
      .eq("id", (iliski as { id: string }).id);

    if (updateError) return hataYaniti("Eczane listeden çıkarılamadı.", "eclub_eczane_firma UPDATE — pasif", updateError);

    const { count: pasifSayisi } = await adminSupabase
      .from("eclub_eczane_firma")
      .select("id", { count: "exact", head: true })
      .eq("eczane_id", eczane_id)
      .eq("aktif_mi", false);

    return NextResponse.json({
      mesaj: "Eczane listenizden çıkarıldı.",
      admin_sinyali: (pasifSayisi ?? 0) >= ECLUB_5UTT_ESIK,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "PUT /eclub/listem/api/eczaneler");
  }
}