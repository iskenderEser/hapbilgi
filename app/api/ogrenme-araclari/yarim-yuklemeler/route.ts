import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { bunnyStorageNesneSil } from "@/lib/ogrenmeAraci/bunnyStorage";
import { bunnyVideoDurumu, bunnyVideoSil } from "@/lib/video/bunnyYukleme";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

const YARIM_DURUMLAR = ["yukleme_bekliyor", "dogrulama_bekliyor"];

interface VideoOturumu {
  yukleme_id: string;
  kullanici_id: string;
  talep_id: string;
  gorev_id: string | null;
  arac_id: string | null;
  kaynak: "hazir" | "iu";
  video_guid: string;
  embed_url: string;
  baslik: string;
  dosya_adi: string;
  mime_type: string;
  dosya_boyutu: number;
  durum: "yukleme_bekliyor" | "dogrulama_bekliyor" | "iptal_hatasi";
  created_at: string;
}

async function oturum() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const db = createAdminClient();
  const rol = await rolCozucu(db, user.id);
  if (![IU_ROLU, ...URETICI_ROLLER].includes(rol)) return null;
  return { user, db, rol };
}

export async function GET() {
  try {
    const kimlik = await oturum();
    if (!kimlik) return yetkiHatasi();
    const { db, user } = kimlik;

    const { data: durumlar } = await db
      .from("ogrenme_araci_durumu")
      .select("arac_id, durum, created_at")
      .in("durum", YARIM_DURUMLAR)
      .order("created_at", { ascending: false })
      .limit(500);
    const adayIdler = [...new Set((durumlar ?? []).map((d) => d.arac_id))];
    const sonDurumlar = new Map<string, { durum: string; created_at: string }>();
    if (adayIdler.length) {
      const { data: tumDurumlar } = await db
        .from("ogrenme_araci_durumu")
        .select("arac_id, durum, created_at")
        .in("arac_id", adayIdler)
        .order("created_at", { ascending: false });
      for (const d of tumDurumlar ?? []) if (!sonDurumlar.has(d.arac_id)) sonDurumlar.set(d.arac_id, d);
    }

    const gercekAdaylar = adayIdler.filter((id) => YARIM_DURUMLAR.includes(sonDurumlar.get(id)?.durum ?? ""));
    let araclar: Array<Record<string, unknown>> = [];
    if (gercekAdaylar.length) {
      const { data } = await db
        .from("ogrenme_araclari")
        .select("arac_id, talep_id, iu_id, arac_turu, kaynak, dosya_yolu, kapak_yolu, transkript_yolu, metadata, created_at, taslak_mi, talepler!inner(uretici_id, urun_adi, talep_no, taslak_mi)")
        .in("arac_id", gercekAdaylar);
      araclar = (data ?? []) as Array<Record<string, unknown>>;
    }
    const aracIdler = araclar.map((a) => String(a.arac_id));
    const gorevMap = new Map<string, string>();
    if (aracIdler.length) {
      const { data: gorevler } = await db.from("uretim_gorevleri").select("gorev_id, arac_id, atanan_iu_id").in("arac_id", aracIdler);
      for (const g of gorevler ?? []) if (g.atanan_iu_id === user.id && g.arac_id) gorevMap.set(g.arac_id, g.gorev_id);
    }

    const storage = araclar.flatMap((a) => {
      if (a.arac_turu === "video") return [];
      const talepHam = a.talepler as Record<string, unknown> | Array<Record<string, unknown>> | null;
      const talep = Array.isArray(talepHam) ? talepHam[0] : talepHam;
      // Taslak talepler (talepler.taslak_mi = true veya ogrenme_araclari.taslak_mi = true)
      // global "Yarım kalan yükleme" penceresinden çıkarılır. Bu taslakların kurtarılması
      // mevcut podcast taslak restorasyonuyla yapılır.
      if (talep?.taslak_mi === true || a.taslak_mi === true) return [];
      const kaynak = String(a.kaynak);
      const sahip = (kaynak === "hazir" && talep?.uretici_id === user.id)
        || (kaynak === "iu" && a.iu_id === user.id);
      if (!sahip) return [];
      const metadata = (a.metadata as Record<string, unknown> | null) ?? {};
      const beyan = (metadata.yukleme_beyani as Record<string, unknown> | null) ?? {};
      const son = sonDurumlar.get(String(a.arac_id));
      const tamamlananParcalar: Array<"ana" | "kapak" | "transkript"> = [];
      const anaTamamlandi = son?.durum === "dogrulama_bekliyor"
        && Boolean(a.dosya_yolu && metadata.depolama_dogrulamasi);
      if (anaTamamlandi) {
        tamamlananParcalar.push("ana");
        if (a.arac_turu === "podcast" || a.arac_turu === "flip_pdf") {
          if (a.kapak_yolu && metadata.kapak_dogrulandi === true) tamamlananParcalar.push("kapak");
        }
        if (a.arac_turu === "podcast") {
          if (a.transkript_yolu && metadata.transkript_dogrulandi === true) tamamlananParcalar.push("transkript");
        }
      }
      const bekleyenDestek = (metadata.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {};
      const kapakTamamlandi = tamamlananParcalar.includes("kapak");
      const kapakYarim = ["podcast", "flip_pdf"].includes(String(a.arac_turu)) && !kapakTamamlandi && (
        metadata.kapak_bekleniyor === true
        || Boolean(bekleyenDestek.kapak)
        || (Boolean(a.kapak_yolu) && metadata.kapak_dogrulandi !== true)
      ) && metadata.kapak_iptal_edildi !== true;

      const transkriptTamamlandi = tamamlananParcalar.includes("transkript");
      const transkriptYarim = a.arac_turu === "podcast" && !transkriptTamamlandi && (
        Boolean(bekleyenDestek.transkript)
        || (Boolean(a.transkript_yolu) && metadata.transkript_dogrulandi !== true)
      );

      return [{
        tur: "storage" as const,
        kimlik: String(a.arac_id),
        arac_id: String(a.arac_id),
        talep_id: String(a.talep_id),
        gorev_id: gorevMap.get(String(a.arac_id)) ?? null,
        arac_turu: String(a.arac_turu),
        kaynak,
        durum: son?.durum ?? "yukleme_bekliyor",
        dosya_adi: String(beyan.dosya_adi ?? "Dosya"),
        baslik: String(talep?.urun_adi ?? `Talep #${talep?.talep_no ?? ""}`),
        tamamlanan_parcalar: tamamlananParcalar,
        kapak_yarim: kapakYarim,
        transkript_yarim: transkriptYarim,
        kapak_yukleme_girisimi_id: typeof (metadata.kapak_yukleme_girisimi as Record<string, unknown> | undefined)?.id === "string"
          ? String((metadata.kapak_yukleme_girisimi as Record<string, unknown>).id)
          : null,
        podcast_sure_hazir: Number.isSafeInteger(metadata.sure_saniye_beyani)
          && Number(metadata.sure_saniye_beyani) > 0,
        podcast_transkript_bilgisi_hazir: transkriptTamamlandi
          ? Object.hasOwn(metadata, "transkript_metni_dogrulandi")
          : !transkriptYarim,
        created_at: son?.created_at ?? String(a.created_at),
      }];
    });

    let video: VideoOturumu[] = [];
    const videoSonucu = await db
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("yukleme_id, kullanici_id, talep_id, gorev_id, arac_id, kaynak, video_guid, embed_url, baslik, dosya_adi, mime_type, dosya_boyutu, durum, created_at")
      .eq("kullanici_id", user.id)
      .order("created_at", { ascending: false });
    // Geçiş SQL'i henüz kurulmadıysa mevcut yükleme akışını bozma.
    if (!videoSonucu.error || !["42P01", "PGRST205"].includes(videoSonucu.error.code ?? "")) video = (videoSonucu.data ?? []) as VideoOturumu[];

    return NextResponse.json({
      yuklemeler: [
        ...storage,
        ...video.map((v) => ({
          tur: "video" as const,
          kimlik: v.yukleme_id,
          ...v,
          arac_turu: "video",
        })),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    });
  } catch (error) {
    return sunucuHatasi(error, "GET yarım öğrenme aracı yüklemeleri");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const kimlik = await oturum();
    if (!kimlik) return yetkiHatasi();
    const { db, user } = kimlik;
    const body = await request.json();
    if (!['storage', 'video'].includes(body.tur) || typeof body.kimlik !== "string") {
      return validasyonHatasi("Yükleme türü veya kimliği geçersiz.", ["tur", "kimlik"]);
    }

    if (body.tur === "video") {
      const { data: kayit } = await db
        .from("ogrenme_araci_video_yukleme_oturumlari")
        .select("yukleme_id, kullanici_id, video_guid")
        .eq("yukleme_id", body.kimlik)
        .maybeSingle();
      if (!kayit) return NextResponse.json({ mesaj: "Yarım yükleme zaten temizlenmiş." });
      if (kayit.kullanici_id !== user.id) return yetkiHatasi();
      if (!await bunnyVideoSil(kayit.video_guid)) {
        await db.from("ogrenme_araci_video_yukleme_oturumlari").update({ durum: "iptal_hatasi", son_hata: "Video dosyası silinemedi", updated_at: new Date().toISOString() }).eq("yukleme_id", body.kimlik);
        return NextResponse.json({ hata: "Video dosyası temizlenemedi; kayıt güvenli biçimde korunuyor." }, { status: 502 });
      }
      const { error } = await db.from("ogrenme_araci_video_yukleme_oturumlari").delete().eq("yukleme_id", body.kimlik).eq("kullanici_id", user.id);
      if (error) return NextResponse.json({ hata: "Video temizlendi ancak yükleme kaydı kapatılamadı." }, { status: 500 });
      return NextResponse.json({ mesaj: "Yarım kalan video yüklemesi iptal edildi." });
    }

    const { data: arac } = await db
      .from("ogrenme_araclari")
      .select("arac_id, talep_id, iu_id, kaynak, dosya_yolu, kapak_yolu, transkript_yolu, metadata, talepler!inner(uretici_id)")
      .eq("arac_id", body.kimlik)
      .maybeSingle();
    if (!arac) return NextResponse.json({ mesaj: "Yarım yükleme zaten temizlenmiş." });
    const talepHam = arac.talepler as { uretici_id?: string } | Array<{ uretici_id?: string }> | null;
    const talep = Array.isArray(talepHam) ? talepHam[0] : talepHam;
    if (!((arac.kaynak === "hazir" && talep?.uretici_id === user.id) || (arac.kaynak === "iu" && arac.iu_id === user.id))) return yetkiHatasi();

    const metadata = (arac.metadata as Record<string, unknown> | null) ?? {};
    await db.from("ogrenme_araclari").update({ metadata: { ...metadata, yarim_yukleme_iptali: { durum: "isleniyor", tarih: new Date().toISOString() } } }).eq("arac_id", arac.arac_id);
    const bekleyenDestek = (metadata.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {};
    const yollar = [...new Set([
      arac.dosya_yolu, arac.kapak_yolu, arac.transkript_yolu,
      bekleyenDestek.kapak, bekleyenDestek.transkript,
    ].filter((yol): yol is string => typeof yol === "string" && yol.length > 0))];
    const silmeler = await Promise.all(yollar.map((yol) => bunnyStorageNesneSil(yol)));
    if (silmeler.some((ok) => !ok)) {
      await db.from("ogrenme_araclari").update({ metadata: { ...metadata, yarim_yukleme_iptali: { durum: "hata", tarih: new Date().toISOString() } } }).eq("arac_id", arac.arac_id);
      return NextResponse.json({ hata: "Depolama temizliği tamamlanamadı; kayıt güvenli biçimde korunuyor." }, { status: 502 });
    }
    const { error: rpcError } = await db.rpc("ogrenme_araci_yarim_yukleme_iptal", { p_arac_id: arac.arac_id, p_kullanici_id: user.id });
    if (rpcError) return NextResponse.json({ hata: "Dosyalar temizlendi ancak veritabanı kayıtları kapatılamadı.", detay: rpcError.message }, { status: 500 });
    return NextResponse.json({ mesaj: "Yarım kalan yükleme başarıyla iptal edildi." });
  } catch (error) {
    return sunucuHatasi(error, "DELETE yarım öğrenme aracı yüklemesi");
  }
}

export async function POST(request: NextRequest) {
  try {
    const kimlik = await oturum();
    if (!kimlik) return yetkiHatasi();
    const { db, user } = kimlik;
    const body = await request.json();
    if (body.islem === "gorselsiz_devam") {
      if (!uuidGecerliMi(body.arac_id)) {
        return validasyonHatasi("arac_id zorunludur.", ["arac_id"]);
      }
      const girisimId = typeof body.yukleme_girisimi_id === "string" ? body.yukleme_girisimi_id : null;
      if (girisimId && !uuidGecerliMi(girisimId)) {
        return validasyonHatasi("Yayın görseli yükleme girişimi geçersiz.", ["yukleme_girisimi_id"]);
      }
      const { data: iptalSonucu, error: iptalHatasi } = await db.rpc("ogrenme_araci_kapak_yukleme_iptal_atomik", {
        p_arac_id: body.arac_id,
        p_kullanici_id: user.id,
        p_girisim_id: girisimId,
      });
      if (iptalHatasi) {
        const durum = iptalHatasi.code === "42501" ? 403 : iptalHatasi.code === "23514" ? 409 : 500;
        return NextResponse.json({ hata: "Görselsiz devam kararı kaydedilemedi." }, { status: durum });
      }
      const sonuc = iptalSonucu as { temizlenecek_yollar?: unknown } | null;
      const silinecekYollar = Array.isArray(sonuc?.temizlenecek_yollar)
        ? sonuc.temizlenecek_yollar.filter((yol): yol is string => typeof yol === "string" && yol.length > 0)
        : [];
      await Promise.all(silinecekYollar.map((yol) => bunnyStorageNesneSil(yol)));
      return NextResponse.json({ basari: true, mesaj: "Yayın görseli yüklemesinden vazgeçildi; içerik görselsiz devam edecek." });
    }

    if (typeof body.yukleme_id !== "string" || !["aktarim_tamamlandi", "baglandi"].includes(body.islem)) {
      return validasyonHatasi("Video yükleme işlemi geçersiz.", ["yukleme_id", "islem"]);
    }
    const { data: kayit } = await db
      .from("ogrenme_araci_video_yukleme_oturumlari")
      .select("*")
      .eq("yukleme_id", body.yukleme_id)
      .eq("kullanici_id", user.id)
      .maybeSingle();
    if (!kayit) return NextResponse.json({ tamamlandi: true, zaten_kapali: true });

    if (body.islem === "aktarim_tamamlandi") {
      const durum = await bunnyVideoDurumu(kayit.video_guid);
      if (!durum.ok || durum.bunnyDurum < 1 || durum.hatali) {
        return NextResponse.json({ hata: "Video aktarımının tamamlandığı doğrulanamadı." }, { status: 422 });
      }
      const { error } = await db.from("ogrenme_araci_video_yukleme_oturumlari").update({ durum: "dogrulama_bekliyor", son_hata: null, updated_at: new Date().toISOString() }).eq("yukleme_id", kayit.yukleme_id);
      if (error) return NextResponse.json({ hata: "Video aktarım durumu kaydedilemedi." }, { status: 500 });
      return NextResponse.json({ tamamlandi: true, durum: "dogrulama_bekliyor" });
    }

    // URL'nin talebe yazılması yalnız arka plan işlemeyi başlatır. Oturum,
    // ortak araç gerçekten doğrulanıp süre yazılmadan kapatılamaz.
    let bagli = false;
    if (kayit.arac_id) {
      const { data: video } = await db.from("ogrenme_araclari")
        .select("dosya_yolu, metadata_dogrulandi, sure_saniye")
        .eq("arac_id", kayit.arac_id).eq("talep_id", kayit.talep_id)
        .eq("arac_turu", "video").maybeSingle();
      bagli = video?.dosya_yolu === kayit.embed_url
        && video?.metadata_dogrulandi === true && Number(video?.sure_saniye) > 0;
    }
    if (!bagli) return NextResponse.json({ hata: "Video henüz üretim kaydına bağlanmadı." }, { status: 409 });
    const { error } = await db.from("ogrenme_araci_video_yukleme_oturumlari").delete().eq("yukleme_id", kayit.yukleme_id).eq("kullanici_id", user.id);
    if (error) return NextResponse.json({ hata: "Tamamlanan yükleme kaydı kapatılamadı." }, { status: 500 });
    return NextResponse.json({ tamamlandi: true });
  } catch (error) {
    return sunucuHatasi(error, "POST yarım video yüklemesi");
  }
}
