import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import {
  bunnyNesneBilgisi,
  bunnyStorageMetinOku,
  yuklemeMakbuzuDogrula,
  yuklemeYetkisiDogrula,
} from "@/lib/ogrenmeAraci/bunnyStorage";
import { podcastDestekDosyasiDogrula, podcastDestekDosyasiImzasiDogrula, type PodcastDestekDosyasiRolu } from "@/lib/ogrenmeAraci/sozlesme";
import { uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";

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
      return NextResponse.json({ hata: "Podcast destek dosyası özeti eşleşmiyor." }, { status: 422 });
    }

    let transkriptMetni = "";
    if (rolDosya === "transkript" && karar.uzanti === "txt") {
      const storageMetni = await bunnyStorageMetinOku(body.dosya_yolu);
      if (storageMetni === null) {
        return NextResponse.json({ hata: "Podcast transkript metni Storage dosyasından doğrulanamadı." }, { status: 422 });
      }
      transkriptMetni = storageMetni;
    }

    const kolon = rolDosya === "kapak" ? "kapak_yolu" : "transkript_yolu";
    const destekDogrulama = (
      metadataOnceki.podcast_destek_dogrulamasi as Record<string, unknown> | undefined
    ) ?? {};
    const metadata: Record<string, unknown> = {
      ...metadataOnceki,
      [`${rolDosya}_dogrulandi`]: true,
      ...(rolDosya === "transkript" ? {
        transkript_metni: transkriptMetni,
        transkript_metni_dogrulandi: karar.uzanti === "txt" && transkriptMetni.length > 0,
        transkript_metni_kaynagi: "storage",
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
    const { error } = await db.from("ogrenme_araclari").update({ [kolon]: body.dosya_yolu, metadata }).eq("arac_id", arac_id);
    if (error) return NextResponse.json({ hata: "Podcast destek dosyası kaydedilemedi." }, { status: 500 });
    return NextResponse.json({ arac_id, dosya_rolu: rolDosya, tamamlandi: true });
  } catch (error) {
    return sunucuHatasi(error, "POST podcast destek yükleme tamamla");
  }
}
