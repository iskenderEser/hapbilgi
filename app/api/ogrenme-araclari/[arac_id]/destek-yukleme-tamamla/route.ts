import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import {
  bunnyNesneBilgisi,
  bunnyStorageNesneSil,
  bunnyStorageMetinOku,
  bunnyStorageNesneIndir,
  yuklemeMakbuzuDogrula,
  yuklemeYetkisiDogrula,
} from "@/lib/ogrenmeAraci/bunnyStorage";
import { podcastDestekDosyasiDogrula, podcastDestekDosyasiImzasiDogrula, type PodcastDestekDosyasiRolu } from "@/lib/ogrenmeAraci/sozlesme";
import { transkriptDosyasindanMetinCikar } from "@/lib/ogrenmeAraci/transkriptMetinCikarici";
import type { PodcastTranskriptDurumu, PodcastTranskriptMetadata } from "@/lib/ogrenmeAraci/tipler";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest, { params }: { params: Promise<{ arac_id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (![IU_ROLU, ...URETICI_ROLLER].includes(rol)) return rolHatasi("Bu işlem üretim hattı rollerine açıktır.");

    const { arac_id } = await params;
    const body = await request.json();
    const rolDosya = body.dosya_rolu as PodcastDestekDosyasiRolu;
    if (typeof body.dosya_adi !== "string" || typeof body.mime_type !== "string" || typeof body.dosya_boyutu !== "number"
      || typeof body.dosya_yolu !== "string" || typeof body.checksum_sha256 !== "string"
      || typeof body.yukleme_token !== "string" || typeof body.yukleme_makbuzu !== "string") {
      return validasyonHatasi("Podcast destek dosyası beyanı eksik.", ["dosya_adi", "mime_type", "dosya_boyutu"]);
    }
    const karar = podcastDestekDosyasiDogrula({ rol: rolDosya, dosyaAdi: body.dosya_adi, mimeType: body.mime_type, dosyaBoyutu: body.dosya_boyutu });
    if (!arac_id || !["kapak", "transkript"].includes(rolDosya) || !karar.ok) return validasyonHatasi("Podcast destek dosyası beyanı geçersiz.", ["dosya_rolu"]);
    if (rolDosya === "kapak" && !uuidGecerliMi(body.yukleme_girisimi_id)) {
      return validasyonHatasi("Yayın görseli yükleme girişimi geçersiz.", ["yukleme_girisimi_id"]);
    }
    if (!yuklemeYetkisiDogrula({
      token: body.yukleme_token,
      aracId: arac_id,
      kullaniciId: user.id,
      dosyaYolu: body.dosya_yolu,
      dosyaBoyutu: body.dosya_boyutu,
      mimeType: body.mime_type.toLowerCase(),
      checksumSha256: body.checksum_sha256.toLowerCase(),
    })) return NextResponse.json({ hata: "Destek dosyası yükleme yetkisi geçersiz." }, { status: 401 });
    if (!yuklemeMakbuzuDogrula({
      makbuz: body.yukleme_makbuzu,
      aracId: arac_id,
      kullaniciId: user.id,
      dosyaYolu: body.dosya_yolu,
      dosyaBoyutu: body.dosya_boyutu,
      mimeType: body.mime_type.toLowerCase(),
      checksumSha256: body.checksum_sha256.toLowerCase(),
    })) return NextResponse.json({ hata: "Destek dosyası yükleme makbuzu geçersiz." }, { status: 401 });

    const { data: arac } = await db.from("ogrenme_araclari").select("arac_id, talep_id, arac_turu, metadata").eq("arac_id", arac_id).maybeSingle();
    if (!arac || arac.arac_turu !== "podcast") return NextResponse.json({ hata: "Podcast öğrenme aracı bulunamadı." }, { status: 404 });
    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: arac.talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const metadataOnceki = (arac.metadata as Record<string, unknown> | null) ?? {};
    const nesne = await bunnyNesneBilgisi(body.dosya_yolu);
    if (!nesne || nesne.dosyaBoyutu !== body.dosya_boyutu || !podcastDestekDosyasiImzasiDogrula(rolDosya, karar.uzanti, nesne.ilkBaytlar)) {
      if (nesne) {
        await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
          arac_id,
          dosya_yolu: body.dosya_yolu,
          dosya_rolu: rolDosya,
          sebep: "destek_dosyasi_tur_veya_boyut_eslesmedi",
          durum: "bekliyor",
        });
        if (rolDosya === "transkript") {
          await db.from("ogrenme_araclari").update({
            metadata: {
              ...metadataOnceki,
              depolama_temizleme: {
                durum: "bekliyor",
                dosya_rolu: rolDosya,
                dosya_yolu: body.dosya_yolu,
                sebep: "destek_dosyasi_tur_veya_boyut_eslesmedi",
                kayit_tarihi: new Date().toISOString(),
              },
            },
          }).eq("arac_id", arac_id);
        }
      }
      return NextResponse.json({ hata: "Podcast destek dosyasının gerçek türü veya boyutu doğrulanamadı." }, { status: 422 });
    }
    const beyanChecksum = body.checksum_sha256.toLowerCase();
    if (nesne.checksumSha256 && nesne.checksumSha256 !== beyanChecksum) {
      await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
        arac_id,
        dosya_yolu: body.dosya_yolu,
        dosya_rolu: rolDosya,
        sebep: "destek_dosyasi_checksum_eslesmedi",
        durum: "bekliyor",
      });
      if (rolDosya === "transkript") {
        await db.from("ogrenme_araclari").update({
          metadata: {
            ...metadataOnceki,
            depolama_temizleme: {
              durum: "bekliyor",
              dosya_rolu: rolDosya,
              dosya_yolu: body.dosya_yolu,
              sebep: "destek_dosyasi_checksum_eslesmedi",
              kayit_tarihi: new Date().toISOString(),
            },
          },
        }).eq("arac_id", arac_id);
      }
      return NextResponse.json({ hata: "Podcast destek dosyası özeti eşleşmiyor." }, { status: 422 });
    }

    let transkriptMetni = "";
    let transkriptDurumu: PodcastTranskriptDurumu | undefined;
    if (rolDosya === "transkript") {
      const dosyaBaytlari = await bunnyStorageNesneIndir(body.dosya_yolu);
      if (!dosyaBaytlari) {
        await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
          arac_id,
          dosya_yolu: body.dosya_yolu,
          dosya_rolu: rolDosya,
          sebep: "destek_dosyasi_indirilemedi",
          durum: "bekliyor",
        });
        return NextResponse.json({ hata: "Podcast transkript dosyası Storage'dan okunamadı." }, { status: 422 });
      }

      const cikarmaSonucu = await transkriptDosyasindanMetinCikar(karar.uzanti, dosyaBaytlari);
      if (!cikarmaSonucu.ok) {
        await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
          arac_id,
          dosya_yolu: body.dosya_yolu,
          dosya_rolu: rolDosya,
          sebep: cikarmaSonucu.kod,
          durum: "bekliyor",
        });
        return NextResponse.json({ hata: cikarmaSonucu.hata }, { status: 422 });
      }
      transkriptMetni = cikarmaSonucu.metin;
      transkriptDurumu = "manuel_taslak";
    }

    const kolon = rolDosya === "kapak" ? "kapak_yolu" : "transkript_yolu";
    const destekDogrulama = (
      metadataOnceki.podcast_destek_dogrulamasi as Record<string, unknown> | undefined
    ) ?? {};
    const transkriptMetadata: PodcastTranskriptMetadata | undefined = rolDosya === "transkript" ? {
      durum: "manuel_taslak",
      kaynak: "manuel",
      taslak_metin: transkriptMetni,
      onaylanan_metin: null,
      onaylayan_kullanici_id: null,
      onay_tarihi: null,
      son_duzenleme_tarihi: new Date().toISOString(),
      surum: 1,
      bagli_ses_checksum: (metadataOnceki.checksum_sha256 as string | null) ?? null,
      ai_girisim_id: null,
      kullanilan_model: null,
      hata_kodu: null,
    } : undefined;

    const metadata: Record<string, unknown> = {
      ...metadataOnceki,
      [`${rolDosya}_dogrulandi`]: true,
      ...(rolDosya === "transkript" ? {
        transkript_metni: transkriptMetni,
        transkript_metni_dogrulandi: transkriptMetni.length > 0,
        transkript_metni_kaynagi: "storage",
        transkript: transkriptMetadata,
      } : {}),
      podcast_destek_dogrulamasi: {
        ...destekDogrulama,
        [rolDosya]: {
          dosya_imzasi_dogrulandi: true,
          dosya_boyutu_dogrulandi: true,
          mime_turu_dogrulandi: true,
          checksum: {
            dogrulandi: true,
            deger: beyanChecksum,
            edge_makbuzu_dogrulandi: true,
            bunny_basligi_mevcut: nesne.checksumSha256 !== null,
            checksum_bunny_tarafindan_dogrulandi: nesne.checksumSha256 === beyanChecksum,
          },
        },
      },
    };
    const bekleyenYollar = { ...((metadataOnceki.bekleyen_destek_yollari as Record<string, unknown> | null) ?? {}) };
    delete bekleyenYollar[rolDosya];
    metadata.bekleyen_destek_yollari = bekleyenYollar;
    if (rolDosya === "kapak") {
      const { error } = await db.rpc("podcast_kapak_yukleme_tamamla_atomik", {
        p_arac_id: arac_id,
        p_kullanici_id: user.id,
        p_girisim_id: body.yukleme_girisimi_id,
        p_dosya_yolu: body.dosya_yolu,
        p_dogrulama: metadata.podcast_destek_dogrulamasi,
      });
      if (error) {
        const silindi = await bunnyStorageNesneSil(body.dosya_yolu);
        if (!silindi) {
          await db.from("ogrenme_araci_depolama_temizleme_kuyrugu").insert({
            arac_id,
            dosya_yolu: body.dosya_yolu,
            dosya_rolu: "kapak",
            sebep: "gecersiz_kapak_yukleme_girisimi",
            durum: "bekliyor",
          });
        }
        return NextResponse.json({ hata: "Yayın görseli yükleme işlemi artık geçerli değil." }, { status: 409 });
      }
    } else {
      const { error } = await db.from("ogrenme_araclari").update({ [kolon]: body.dosya_yolu, metadata }).eq("arac_id", arac_id);
      if (error) return NextResponse.json({ hata: "Podcast destek dosyası kaydedilemedi." }, { status: 500 });
    }
    return NextResponse.json({
      arac_id,
      dosya_rolu: rolDosya,
      tamamlandi: true,
      ...(rolDosya === "transkript" ? { taslak_metin: transkriptMetni, durum: transkriptDurumu } : {}),
    });
  } catch (error) {
    return sunucuHatasi(error, "POST podcast destek yükleme tamamla");
  }
}
