import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { eclubYonetimKapsaminiGetir } from "@/lib/eclub/yonetimKapsami";
import { uttEczaneFirmaBaglari } from "@/lib/eclub/uttEczane";
import { hataYaniti, rolHatasi, sunucuHatasi, yetkiHatasi } from "@/lib/utils/hataIsle";
import { YONLENDIRICI_ROLLER } from "@/lib/utils/roller";

interface EczaneMaster {
  eczane_adi: string;
  il: string | null;
  ilce: string | null;
}

interface EczaneKimlik {
  eczane_id: string;
  gln: string;
  eclub_eczane_master?: EczaneMaster | EczaneMaster[];
}

interface KisiKimlik {
  kisi_id: string;
  rol: string;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
}

interface KisiBagi {
  eczane_id: string;
  eclub_kisiler?: KisiKimlik | KisiKimlik[];
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return yetkiHatasi();

    const admin = createAdminClient();
    const { data: kullanici, error: kullaniciHatasi } = await admin
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, rol, firma_id, takim_id, bolge_id, aktif_mi")
      .eq("kullanici_id", user.id)
      .single();

    if (kullaniciHatasi || !kullanici) {
      return hataYaniti("Kullanıcı bulunamadı.", "kullanicilar SELECT — BM E-Club Takımım", kullaniciHatasi, 404);
    }
    if (!kullanici.aktif_mi || !YONLENDIRICI_ROLLER.includes((kullanici.rol ?? "").toLowerCase())) {
      return rolHatasi("Bu görünüm yalnız BM ve TM rollerine açıktır.");
    }

    const kapsam = await eclubYonetimKapsaminiGetir(admin, kullanici);
    const uttIdler = kapsam.uttler.map((utt) => utt.utt_id);
    if (uttIdler.length === 0) {
      return NextResponse.json({ uttler: [] }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const [uyelikSonuclari, takimAdiSonucu] = await Promise.all([
      Promise.all(kapsam.uttler.map(async (utt) => ({
        uttId: utt.utt_id,
        baglar: (await uttEczaneFirmaBaglari(admin, utt.utt_id))
          .filter((bag) => bag.firmaId === kullanici.firma_id),
      }))),
      admin.from("eclub_takim_adlari").select("utt_id, takim_adi").in("utt_id", uttIdler),
    ]);
    if (takimAdiSonucu.error) {
      return hataYaniti("Takım adları alınamadı.", "eclub_takim_adlari SELECT — BM kapsamı", takimAdiSonucu.error);
    }

    const eczaneIdler = [...new Set(uyelikSonuclari.flatMap((sonuc) => sonuc.baglar.map((bag) => bag.eczaneId)))];
    const takimAdlari = new Map((takimAdiSonucu.data ?? []).map((satir) => [String(satir.utt_id), String(satir.takim_adi)]));
    if (eczaneIdler.length === 0) {
      return NextResponse.json({
        uttler: kapsam.uttler.map((utt) => ({ ...utt, ozel_takim_adi: takimAdlari.get(utt.utt_id) ?? null, eczaneler: [] })),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const [eczaneSonucu, kisiSonucu] = await Promise.all([
      admin
        .from("eclub_eczaneler")
        .select("eczane_id, gln, eclub_eczane_master ( eczane_adi, il, ilce )")
        .in("eczane_id", eczaneIdler),
      admin
        .from("eclub_kisi_eczane")
        .select("eczane_id, eclub_kisiler ( kisi_id, rol, ad, soyad, eposta, telefon )")
        .in("eczane_id", eczaneIdler)
        .eq("aktif_mi", true),
    ]);
    if (eczaneSonucu.error) return hataYaniti("Eczaneler alınamadı.", "eclub_eczaneler SELECT — BM kapsamı", eczaneSonucu.error);
    if (kisiSonucu.error) return hataYaniti("Eczane kadroları alınamadı.", "eclub_kisi_eczane SELECT — BM kapsamı", kisiSonucu.error);

    const kisilerByEczane = new Map<string, KisiKimlik[]>();
    for (const bag of (kisiSonucu.data ?? []) as KisiBagi[]) {
      const kimlikRaw = bag.eclub_kisiler;
      const kimlik = Array.isArray(kimlikRaw) ? kimlikRaw[0] : kimlikRaw;
      if (!kimlik) continue;
      const liste = kisilerByEczane.get(bag.eczane_id) ?? [];
      liste.push(kimlik);
      kisilerByEczane.set(bag.eczane_id, liste);
    }

    const eczaneMap = new Map(((eczaneSonucu.data ?? []) as EczaneKimlik[]).map((eczane) => {
      const masterRaw = eczane.eclub_eczane_master;
      const master = Array.isArray(masterRaw) ? masterRaw[0] : masterRaw;
      return [eczane.eczane_id, {
        eczane_id: eczane.eczane_id,
        gln: eczane.gln,
        eczane_adi: master?.eczane_adi ?? "—",
        il: master?.il ?? null,
        ilce: master?.ilce ?? null,
        kisiler: (kisilerByEczane.get(eczane.eczane_id) ?? [])
          .sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`, "tr")),
      }];
    }));

    const uyelikMap = new Map(uyelikSonuclari.map((sonuc) => [sonuc.uttId, sonuc.baglar]));
    const uttler = kapsam.uttler.map((utt) => ({
      ...utt,
      ozel_takim_adi: takimAdlari.get(utt.utt_id) ?? null,
      eczaneler: (uyelikMap.get(utt.utt_id) ?? [])
        .map((bag) => eczaneMap.get(bag.eczaneId))
        .filter((eczane): eczane is NonNullable<typeof eczane> => Boolean(eczane))
        .sort((a, b) => a.eczane_adi.localeCompare(b.eczane_adi, "tr")),
    }));

    return NextResponse.json({ uttler }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return sunucuHatasi(err, "GET /eclub/eczanelerim/api");
  }
}
