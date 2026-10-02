import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { TUKETICI_ROLLER } from "@/lib/utils/roller";
import { getYayindakiVideolar } from "@/lib/video/yayindakiVideolar";
import { gecerliTurBaslangiclari } from "@/lib/tclub/tur/kayit";
import { sunucuHatasi, validasyonHatasi, yetkiHatasi, rolHatasi } from "@/lib/utils/hataIsle";
import { uttEczanemErisimi } from "@/lib/eczanem/erisim";

type Inceleme = {
  inceleme_id: string;
  utt_id: string;
  yayin_id: string;
  arac_id: string;
  arac_turu: string;
  tur_baslangici: string;
  basladi_at: string;
  son_etkinlik_at: string;
  dogrulanan_saniye: number;
  son_konum_saniye: number;
  sayfa_sureleri: Record<string, number>;
  tamamlandi_at: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return yetkiHatasi();
    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (!TUKETICI_ROLLER.includes(rol)) return rolHatasi("Yalnız UTT/KD_UTT yayın inceleyebilir.");

    const body = await request.json();
    const { yayin_id, islem } = body;
    const eczanem = body.kanal === "eczanem";
    if (typeof yayin_id !== "string" || !/^[0-9a-f-]{36}$/i.test(yayin_id) || !["baslat", "ilerle", "tamamla"].includes(islem))
      return validasyonHatasi("Yayın veya inceleme işlemi geçersiz.", ["yayin_id", "islem"]);

    if (islem === "baslat" && !eczanem) {
      const katalog = await getYayindakiVideolar(user.id, rol, db);
      const izinli = katalog.some((y) => y.yayin_id === yayin_id && y.arac_id && y.hedef_roller.some((r) => r === "eczaci" || r === "eczane_teknisyeni"));
      if (!izinli) return NextResponse.json({ hata: "Yayın E-Club inceleme kapsamında değil." }, { status: 403 });
    }
    const { data: detay, error: detayHatasi } = await db.from("v_yayin_detay")
      .select("arac_id, arac_turu, arac_sure_saniye, video_suresi_saniye, arac_sayfa_sayisi, yayin_tarihi, durum, firma_id, takim_id, hedef_roller")
      .eq("yayin_id", yayin_id).single();
    if (detayHatasi || !detay || detay.durum !== "yayinda")
      return NextResponse.json({ hata: "Yayın bilgisi doğrulanamadı." }, { status: 422 });
    if (eczanem) {
      const erisim = await uttEczanemErisimi(db, user.id);
      if (!erisim.ok || !erisim.acik || !erisim.firmaIdler.includes(detay.firma_id)
        || (detay.takim_id && detay.takim_id !== erisim.takimId)
        || !detay.hedef_roller?.includes("eczanem"))
        return NextResponse.json({ hata: "Yayın Eczanem inceleme kapsamında değil." }, { status: 403 });
    }

    const turler = await gecerliTurBaslangiclari(db, [yayin_id], true);
    const turBaslangici = turler[yayin_id]?.baslangic_tarihi ?? detay.yayin_tarihi;
    const { data: mevcut, error: okumaHatasi } = await db.from("eclub_utt_yayin_incelemeleri")
      .select("*").eq("utt_id", user.id).eq("yayin_id", yayin_id)
      .eq("tur_baslangici", turBaslangici).maybeSingle();
    if (okumaHatasi) return NextResponse.json({ hata: "İnceleme kaydı okunamadı. Veritabanı güncellemesini kontrol edin." }, { status: 500 });

    if (islem === "baslat") {
      if (mevcut) {
        if (mevcut.arac_id !== detay.arac_id || mevcut.arac_turu !== detay.arac_turu)
          return NextResponse.json({ hata: "Yayının öğrenme aracı değişmiş; inceleme kaydı yenilenmeli." }, { status: 409 });
        return NextResponse.json({ inceleme_id: mevcut.inceleme_id, tamamlandi: !!mevcut.tamamlandi_at });
      }
      const { data: olusan, error } = await db.from("eclub_utt_yayin_incelemeleri")
        .insert({ utt_id: user.id, yayin_id, arac_id: detay.arac_id, arac_turu: detay.arac_turu, tur_baslangici: turBaslangici })
        .select("inceleme_id").single();
      if (error) return NextResponse.json({ hata: "İnceleme başlatılamadı." }, { status: 500 });
      return NextResponse.json({ inceleme_id: olusan.inceleme_id, tamamlandi: false });
    }

    const inceleme = mevcut as Inceleme | null;
    if (!inceleme || inceleme.tamamlandi_at || inceleme.arac_id !== detay.arac_id || inceleme.arac_turu !== detay.arac_turu) return NextResponse.json({ hata: "Aktif inceleme bulunamadı." }, { status: 409 });
    if (body.inceleme_id !== inceleme.inceleme_id) return NextResponse.json({ hata: "İnceleme kimliği uyuşmuyor." }, { status: 403 });
    if (body.sekme_aktif !== true) return NextResponse.json({ hata: "Arka planda inceleme süresi sayılmaz." }, { status: 422 });

    const simdi = new Date();
    const gecen = Math.max(0, Math.min(15, (simdi.getTime() - new Date(inceleme.son_etkinlik_at).getTime()) / 1000));
    const tur = detay.arac_turu;
    const guncelleme: Record<string, unknown> = { son_etkinlik_at: simdi.toISOString() };
    let tamamlanabilir = false;

    if (tur === "video" || tur === "podcast") {
      const sure = Number(detay.arac_sure_saniye ?? detay.video_suresi_saniye);
      const konum = Number(body.konum_saniye);
      if (!Number.isFinite(sure) || sure <= 0 || !Number.isFinite(konum) || konum < 0 || konum > sure + 2)
        return validasyonHatasi("İçerik süresi veya oynatma konumu geçersiz.", ["konum_saniye"]);
      const artis = konum - Number(inceleme.son_konum_saniye);
      const oynatma = body.oynuyor === true;
      const dogrulanan = Number(inceleme.dogrulanan_saniye) + (oynatma && gecen >= 0.5 && artis > 0 && artis <= gecen + 1 ? Math.min(artis, gecen) : 0);
      guncelleme.dogrulanan_saniye = dogrulanan;
      guncelleme.son_konum_saniye = konum;
      tamamlanabilir = body.sona_ulasti === true && konum >= sure - 2 && dogrulanan >= sure * 0.9;
    } else if (tur === "gorsel") {
      const dogrulanan = Number(inceleme.dogrulanan_saniye) + (islem === "ilerle" ? Math.min(gecen, 2) : 0);
      guncelleme.dogrulanan_saniye = dogrulanan;
      tamamlanabilir = body.kullanici_onayi === true && dogrulanan >= 3;
    } else if (tur === "flip_pdf") {
      const toplam = Number(detay.arac_sayfa_sayisi);
      const sayfalar = Array.isArray(body.sayfalar) ? [...new Set(body.sayfalar.map(Number))] as number[] : [];
      if (!Number.isInteger(toplam) || toplam < 1 || sayfalar.length < 1 || sayfalar.length > 2 || sayfalar.some((n) => !Number.isInteger(n) || n < 1 || n > toplam))
        return validasyonHatasi("PDF sayfa bilgisi geçersiz.", ["sayfalar"]);
      const sureler = { ...(inceleme.sayfa_sureleri ?? {}) };
      if (islem === "ilerle") for (const sayfa of sayfalar) sureler[String(sayfa)] = Math.min(3600, Number(sureler[String(sayfa)] ?? 0) + Math.min(gecen, 2));
      guncelleme.sayfa_sureleri = sureler;
      tamamlanabilir = Array.from({ length: toplam }, (_, i) => Number(sureler[String(i + 1)] ?? 0) >= 2).every(Boolean);
    } else {
      return NextResponse.json({ hata: "Öğrenme aracı türü desteklenmiyor." }, { status: 422 });
    }

    if (islem === "tamamla") {
      if (!tamamlanabilir) return NextResponse.json({ hata: "Yayın henüz tamamlanmadı." }, { status: 422 });
      guncelleme.tamamlandi_at = simdi.toISOString();
    }
    const { error: yazmaHatasi } = await db.from("eclub_utt_yayin_incelemeleri")
      .update(guncelleme).eq("inceleme_id", inceleme.inceleme_id).eq("utt_id", user.id).is("tamamlandi_at", null);
    if (yazmaHatasi) return NextResponse.json({ hata: "İnceleme ilerlemesi kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ tamamlandi: islem === "tamamla", tamamlanabilir, dogrulanan_saniye: guncelleme.dogrulanan_saniye ?? inceleme.dogrulanan_saniye });
  } catch (error) {
    return sunucuHatasi(error, "POST E-Club UTT yayın incelemesi");
  }
}
