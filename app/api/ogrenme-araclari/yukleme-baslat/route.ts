import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { rolCozucu } from "@/lib/utils/rolCozucu";
import { rolHatasi, sunucuHatasi, validasyonHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { IU_ROLU, URETICI_ROLLER } from "@/lib/utils/roller";
import { ogrenmeAraciAcikMi } from "@/lib/ogrenmeAraci/bayraklar";
import { bunnyNesneYoluOlustur, bunnyUploadBilgisi, yuklemeYetkisiOlustur } from "@/lib/ogrenmeAraci/bunnyStorage";
import { dosyaBeyaniDogrula, yeniOgrenmeAraciTuruMu } from "@/lib/ogrenmeAraci/sozlesme";
import { iuOgrenmeAraciGorevYetkisiniDogrula, uretimAraciYetkisiniDogrula } from "@/lib/ogrenmeAraci/yetki";
import { uuidGecerliMi } from "@/lib/uretim/rpc";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const db = createAdminClient();
    const rol = await rolCozucu(db, user.id);
    if (![IU_ROLU, ...URETICI_ROLLER].includes(rol)) return rolHatasi("Bu işlem üretim hattı rollerine açıktır.");

    const body = await request.json();
    const { talep_id, arac_turu, kaynak, dosya_adi, mime_type, dosya_boyutu, checksum_sha256 } = body;
    if (!talep_id || !yeniOgrenmeAraciTuruMu(arac_turu) || !["iu", "hazir"].includes(kaynak)) {
      return validasyonHatasi("Talep, araç türü ve kaynak bilgisi geçersiz.", ["talep_id", "arac_turu", "kaynak"]);
    }
    if (!ogrenmeAraciAcikMi(arac_turu)) {
      return NextResponse.json({ hata: "Bu öğrenme aracı henüz kullanıma açık değil." }, { status: 423 });
    }
    if ((kaynak === "iu" && rol !== IU_ROLU) || (kaynak === "hazir" && !URETICI_ROLLER.includes(rol))) {
      return rolHatasi("Öğrenme aracı kaynağı kullanıcı rolüyle eşleşmiyor.");
    }
    if (kaynak === "iu" && !uuidGecerliMi(body.gorev_id)) {
      return validasyonHatasi("İçerik üreticisi yüklemesi için geçerli görev kimliği zorunludur.", ["gorev_id"]);
    }
    if (typeof dosya_adi !== "string" || typeof mime_type !== "string" || typeof dosya_boyutu !== "number") {
      return validasyonHatasi("Dosya beyanı eksik.", ["dosya_adi", "mime_type", "dosya_boyutu"]);
    }
    if (typeof checksum_sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(checksum_sha256)) {
      return validasyonHatasi("SHA-256 dosya özeti zorunludur.", ["checksum_sha256"]);
    }
    const dosyaKarari = dosyaBeyaniDogrula({
      aracTuru: arac_turu,
      dosyaAdi: dosya_adi,
      mimeType: mime_type,
      dosyaBoyutu: dosya_boyutu,
    });
    if (!dosyaKarari.ok) return validasyonHatasi(dosyaKarari.hata, ["dosya_adi", "mime_type", "dosya_boyutu"]);

    const yetki = await uretimAraciYetkisiniDogrula({ db, talepId: talep_id, kullaniciId: user.id, rol });
    if (!yetki.ok) return NextResponse.json({ hata: yetki.hata }, { status: yetki.status });

    const mevcutAracId = typeof body.arac_id === "string" && body.arac_id ? body.arac_id : null;
    if (kaynak === "iu") {
      const gorevYetkisi = await iuOgrenmeAraciGorevYetkisiniDogrula({
        db, gorevId: body.gorev_id, talepId: talep_id, kullaniciId: user.id, aracId: mevcutAracId,
      });
      if (!gorevYetkisi.ok) return NextResponse.json({ hata: gorevYetkisi.hata }, { status: gorevYetkisi.status });
    }

    const { data: talep, error: talepError } = await db
      .from("talepler")
      .select("ogrenme_araci_turu")
      .eq("talep_id", talep_id)
      .single();
    if (talepError || !talep) return NextResponse.json({ hata: "Talep araç sözleşmesi okunamadı." }, { status: 500 });
    if (talep.ogrenme_araci_turu !== arac_turu) {
      return NextResponse.json({ hata: "Yüklenen araç türü talepteki sabit araç türüyle eşleşmiyor." }, { status: 422 });
    }

    const aracId = mevcutAracId ?? randomUUID();
    let yuklemeGirisimiId: string = randomUUID();
    if (mevcutAracId) {
      const { data: oncekiArac } = await db.from("ogrenme_araclari")
        .select("metadata").eq("arac_id", mevcutAracId).maybeSingle();
      const { data: oncekiDurum } = await db.from("ogrenme_araci_durumu")
        .select("durum").eq("arac_id", mevcutAracId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const oncekiBeyan = ((oncekiArac?.metadata as { yukleme_beyani?: Record<string, unknown> } | null)?.yukleme_beyani ?? {});
      if (["yukleme_bekliyor", "dogrulama_bekliyor"].includes(oncekiDurum?.durum ?? "")
        && typeof oncekiBeyan.yukleme_girisimi_id === "string") {
        yuklemeGirisimiId = oncekiBeyan.yukleme_girisimi_id;
      }
    }
    const dosyaYolu = bunnyNesneYoluOlustur({
      firmaId: yetki.firmaId,
      talepId: talep_id,
      aracId,
      aracTuru: arac_turu,
      uzanti: dosyaKarari.uzanti,
      girisimId: ["gorsel", "flip_pdf"].includes(arac_turu) ? yuklemeGirisimiId : undefined,
    });
    const upload = bunnyUploadBilgisi();
    const yuklemeYetkisi = yuklemeYetkisiOlustur({
      aracId,
      kullaniciId: user.id,
      dosyaYolu,
      dosyaBoyutu: dosya_boyutu,
      mimeType: mime_type.toLowerCase(),
      checksumSha256: checksum_sha256.toLowerCase(),
    });
    if (!upload || !yuklemeYetkisi) {
      return NextResponse.json({ hata: "Öğrenme aracı yükleme hizmeti yapılandırılmamış." }, { status: 503 });
    }

    let satirlar: { arac_id: string; arac_durum_id: string }[] | null = null;
    const tamamlananParcalar: string[] = [];
    let rpcError: { code?: string } | null = null;
    if (mevcutAracId) {
      const { data: mevcut } = await db.from("ogrenme_araclari").select("arac_id, talep_id, arac_turu, kaynak, iu_id, dosya_yolu, kapak_yolu, transkript_yolu, metadata").eq("arac_id", mevcutAracId).maybeSingle();
      const { data: sonDurum } = await db.from("ogrenme_araci_durumu").select("arac_durum_id, durum").eq("arac_id", mevcutAracId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const yarimYukleme = sonDurum && ["yukleme_bekliyor", "dogrulama_bekliyor"].includes(sonDurum.durum);
      const ayniKayit = mevcut
        && mevcut.talep_id === talep_id
        && mevcut.arac_turu === arac_turu
        && mevcut.kaynak === kaynak
        && (kaynak === "hazir" || mevcut.iu_id === user.id);
      const revizyon = ayniKayit && mevcut?.kaynak === "iu" && mevcut.iu_id === user.id && sonDurum?.durum === "revizyon bekleniyor";
      if (!ayniKayit || (!yarimYukleme && !revizyon)) {
        return NextResponse.json({ hata: "Öğrenme aracı devam veya revizyon yüklemesi geçersiz." }, { status: 409 });
      }
      const oncekiBeyan = ((mevcut?.metadata as { yukleme_beyani?: Record<string, unknown> } | null)?.yukleme_beyani ?? {});
      if (yarimYukleme && typeof oncekiBeyan.yukleme_girisimi_id === "string") {
        yuklemeGirisimiId = oncekiBeyan.yukleme_girisimi_id;
      }
      if (yarimYukleme && oncekiBeyan.dosya_boyutu !== undefined) {
        if (
          oncekiBeyan.dosya_boyutu !== dosya_boyutu
          || String(oncekiBeyan.mime_type ?? "").toLowerCase() !== mime_type.toLowerCase()
          || String(oncekiBeyan.checksum_sha256 ?? "").toLowerCase() !== checksum_sha256.toLowerCase()
        ) {
          return NextResponse.json({ hata: "Devam için yarım kalan yüklemedeki aynı dosyayı seçmelisiniz." }, { status: 409 });
        }
      }
      const mevcutMetadata = (mevcut?.metadata as Record<string, unknown> | null) ?? {};
      const anaTamamlandi = sonDurum?.durum === "dogrulama_bekliyor"
        && Boolean(mevcut?.dosya_yolu && mevcutMetadata.depolama_dogrulamasi);
      if (anaTamamlandi) {
        tamamlananParcalar.push("ana");
        if (mevcut?.arac_turu === "podcast" || mevcut?.arac_turu === "flip_pdf") {
          if (mevcut.kapak_yolu && mevcutMetadata.kapak_dogrulandi === true) tamamlananParcalar.push("kapak");
        }
        if (mevcut?.arac_turu === "podcast") {
          if (mevcut.transkript_yolu && mevcutMetadata.transkript_dogrulandi === true) tamamlananParcalar.push("transkript");
        }
        satirlar = [{ arac_id: mevcutAracId, arac_durum_id: sonDurum.arac_durum_id }];
      } else {
        const yenilenenMetadata: Record<string, unknown> = {
          ...mevcutMetadata,
          ...(revizyon && ["gorsel", "flip_pdf"].includes(arac_turu) && mevcut?.dosya_yolu !== dosyaYolu
            ? { onceki_ana_dosya_yolu: mevcut?.dosya_yolu }
            : {}),
          yukleme_beyani: { dosya_adi, mime_type: mime_type.toLowerCase(), dosya_boyutu, checksum_sha256: checksum_sha256.toLowerCase(), gorev_id: kaynak === "iu" ? body.gorev_id : null, yukleme_girisimi_id: yuklemeGirisimiId },
        };
        delete yenilenenMetadata.podcast_dogrulama_islem_anahtari;
        const { error: yenilemeHatasi } = await db.from("ogrenme_araclari").update({
          dosya_yolu: dosyaYolu, kapak_yolu: null, transkript_yolu: null,
          mime_type: null, dosya_boyutu: null, checksum_sha256: null, sure_saniye: null,
          sayfa_sayisi: null, genislik: null, yukseklik: null,
          metadata: yenilenenMetadata,
          metadata_dogrulandi: false,
        }).eq("arac_id", mevcutAracId);
        if (yenilemeHatasi) return NextResponse.json({ hata: "Öğrenme aracı yükleme kaydı yeniden açılamadı." }, { status: 500 });
        if (sonDurum?.durum === "yukleme_bekliyor") {
          satirlar = [{ arac_id: mevcutAracId, arac_durum_id: sonDurum.arac_durum_id }];
        } else {
          const { data: yeniDurum, error: durumHatasi } = await db
            .from("ogrenme_araci_durumu")
            .insert({
              arac_id: mevcutAracId,
              durum: "yukleme_bekliyor",
              degistiren_id: user.id,
              notlar: yarimYukleme ? "Yarım kalan öğrenme aracı yüklemesine devam edildi" : "Öğrenme aracı revizyon yüklemesi başladı",
            })
            .select("arac_durum_id")
            .single();
          if (durumHatasi || !yeniDurum) return NextResponse.json({ hata: "Öğrenme aracı yükleme durumu yeniden açılamadı." }, { status: 500 });
          satirlar = [{ arac_id: mevcutAracId, arac_durum_id: yeniDurum.arac_durum_id }];
        }
      }
    } else {
      const rpcSonucu = await db.rpc("ogrenme_araci_yukleme_baslat", {
      p_arac_id: aracId,
      p_talep_id: talep_id,
      p_iu_id: yetki.iuId,
      p_arac_turu: arac_turu,
      p_kaynak: kaynak,
      p_dosya_yolu: dosyaYolu,
      p_yukleme_beyani: {
        dosya_adi,
        mime_type: mime_type.toLowerCase(),
        dosya_boyutu,
        checksum_sha256: checksum_sha256.toLowerCase(),
        gorev_id: kaynak === "iu" ? body.gorev_id : null,
        yukleme_girisimi_id: yuklemeGirisimiId,
      },
      p_degistiren_id: user.id,
      });
      satirlar = rpcSonucu.data;
      rpcError = rpcSonucu.error;
    }
    if (rpcError) {
      const status = rpcError.code === "23505" ? 409 : 500;
      return NextResponse.json({ hata: status === 409 ? "Bu talebin öğrenme aracı zaten oluşturulmuş." : "Yükleme kaydı açılamadı." }, { status });
    }
    const kayit = satirlar?.[0];
    if (!kayit) return NextResponse.json({ hata: "Yükleme kaydı oluşturuldu ancak sonuç alınamadı." }, { status: 500 });

    if (["podcast", "flip_pdf"].includes(arac_turu) && typeof body.kapak_secildi === "boolean") {
      const { data: mData } = await db.from("ogrenme_araclari").select("metadata").eq("arac_id", kayit.arac_id).maybeSingle();
      const meta = (mData?.metadata as Record<string, unknown> | null) ?? {};
      await db.from("ogrenme_araclari").update({
        metadata: { ...meta, kapak_bekleniyor: body.kapak_secildi },
      }).eq("arac_id", kayit.arac_id);
    }

    return NextResponse.json({
      arac_id: kayit.arac_id,
      arac_durum_id: kayit.arac_durum_id,
      yukleme_girisimi_id: yuklemeGirisimiId,
      tamamlanan_parcalar: tamamlananParcalar,
      yukleme: {
        endpoint: upload.endpoint,
        method: "PUT",
        son_kullanma: yuklemeYetkisi.sonKullanma,
        headers: {
          "Content-Type": mime_type.toLowerCase(),
          "x-arac-id": aracId,
          "x-kullanici-id": user.id,
          "x-dosya-yolu": dosyaYolu,
          "x-dosya-boyutu": String(dosya_boyutu),
          "x-checksum-sha256": checksum_sha256.toLowerCase(),
          "x-yukleme-token": yuklemeYetkisi.token,
        },
      },
    }, { status: 201 });
  } catch (error) {
    return sunucuHatasi(error, "POST /api/ogrenme-araclari/yukleme-baslat");
  }
}
