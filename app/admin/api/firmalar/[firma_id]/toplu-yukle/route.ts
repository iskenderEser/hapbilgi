// app/admin/api/firmalar/[firma_id]/toplu-yukle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import * as XLSX from "xlsx";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const { firma_id } = await params;
    if (!firma_id) return validasyonHatasi("firma_id zorunludur.", ["firma_id"]);

    const adminSupabase = createAdminClient();

    const { data: firma, error: firmaError } = await adminSupabase
      .from("firmalar")
      .select("firma_id")
      .eq("firma_id", firma_id)
      .single();

    if (firmaError || !firma) return hataYaniti("Firma bulunamadı.", "firmalar tablosu SELECT — firma_id kontrolü", firmaError, 404);

    const formData = await request.formData();
    const dosya = formData.get("dosya") as File | null;
    const mod = formData.get("mod") as string | null;

    if (!dosya) return validasyonHatasi("Dosya zorunludur.", ["dosya"]);

    const dosyaAdi = dosya.name.toLowerCase();
    const desteklenenFormat = dosyaAdi.endsWith(".csv") || dosyaAdi.endsWith(".xlsx") || dosyaAdi.endsWith(".xls");
    if (!desteklenenFormat) return validasyonHatasi("Sadece .csv, .xlsx veya .xls uzantılı dosya kabul edilir.", ["dosya"]);

    const buffer = await dosya.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) return validasyonHatasi("Dosya en az 1 veri satırı içermelidir.", ["dosya"]);

    const { data: tumTakimlar, error: takimlarError } = await adminSupabase
      .from("takimlar")
      .select("takim_id, takim_adi")
      .eq("firma_id", firma_id);

    if (takimlarError) return hataYaniti("Takımlar çekilemedi.", "takimlar tablosu SELECT — toplu yükleme", takimlarError);

    const { data: tumBolgeler, error: bolgelerError } = await adminSupabase
      .from("bolgeler")
      .select("bolge_id, bolge_adi, takim_id");

    if (bolgelerError) return hataYaniti("Bölgeler çekilemedi.", "bolgeler tablosu SELECT — toplu yükleme", bolgelerError);

    const takimMap = Object.fromEntries((tumTakimlar ?? []).map(t => [t.takim_adi.toLowerCase().trim(), t.takim_id]));
    const bolgeMap = Object.fromEntries((tumBolgeler ?? []).map(b => [b.bolge_adi.toLowerCase().trim(), b.bolge_id]));

    type SatirSonuc = {
      index: number;
      ad: string;
      soyad: string;
      rol: string;
      eposta: string;
      takim_adi: string;
      bolge_adi: string;
      durum: "hazir" | "hatali";
      hata_mesaji?: string;
      takim_id?: string | null;
      bolge_id?: string | null;
    };

    const satirSonuclari: SatirSonuc[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ad = String(row["ad"] ?? "").trim();
      const soyad = String(row["soyad"] ?? "").trim();
      const eposta = String(row["eposta"] ?? "").trim().toLowerCase();
      const sifre = String(row["sifre"] ?? "").trim();
      const rol = String(row["rol"] ?? "").trim().toLowerCase();
      const takim_adi_raw = String(row["takim_adi"] ?? "").trim();
      const bolge_adi_raw = String(row["bolge_adi"] ?? "").trim();

      const satirBase: Omit<SatirSonuc, "durum" | "hata_mesaji" | "takim_id" | "bolge_id"> = {
        index: i + 1,
        ad,
        soyad,
        rol,
        eposta,
        takim_adi: takim_adi_raw,
        bolge_adi: bolge_adi_raw,
      };

      if (!ad || !soyad || !eposta || !sifre || !rol) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: "Zorunlu alan eksik (ad, soyad, eposta, sifre, rol)" });
        continue;
      }

      if (!eposta.includes("@")) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: "Geçersiz e-posta adresi" });
        continue;
      }

      let takim_id: string | null = null;
      let bolge_id: string | null = null;

      if (["pm", "jr_pm", "kd_pm", "tm"].includes(rol)) {
        if (!takim_adi_raw) {
          satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `${rol} rolü için takim_adi zorunlu` });
          continue;
        }
        takim_id = takimMap[takim_adi_raw.toLowerCase()] ?? null;
        if (!takim_id) {
          satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `"${takim_adi_raw}" takımı bulunamadı` });
          continue;
        }
      } else if (["bm", "utt", "kd_utt"].includes(rol)) {
        if (!bolge_adi_raw) {
          satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `${rol} rolü için bolge_adi zorunlu` });
          continue;
        }
        bolge_id = bolgeMap[bolge_adi_raw.toLowerCase()] ?? null;
        if (!bolge_id) {
          satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `"${bolge_adi_raw}" bölgesi bulunamadı` });
          continue;
        }
      }

      satirSonuclari.push({ ...satirBase, durum: "hazir", takim_id, bolge_id });
    }

    if (mod === "onizle") {
      return NextResponse.json({ satirlar: satirSonuclari }, { status: 200 });
    }

    let basarili = 0;
    let hatali = 0;
    const hatalar: string[] = [];

    for (const satir of satirSonuclari) {
      if (satir.durum === "hatali") {
        hatali++;
        hatalar.push(`Satır ${satir.index} — ${satir.hata_mesaji}`);
        continue;
      }

      const row = rows[satir.index - 1];
      const sifre = String(row["sifre"] ?? "").trim();

      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: satir.eposta,
        password: sifre,
        user_metadata: { rol: satir.rol, ad: satir.ad, soyad: satir.soyad },
        email_confirm: true,
      });

      if (authError || !authData.user) {
        hatalar.push(`Satır ${satir.index} — Auth hatası: ${authError?.message}`);
        hatali++;
        continue;
      }

      const { error: insertError } = await adminSupabase
        .from("kullanicilar")
        .insert({
          kullanici_id: authData.user.id,
          ad: satir.ad,
          soyad: satir.soyad,
          eposta: satir.eposta,
          rol: satir.rol,
          firma_id,
          takim_id: satir.takim_id ?? null,
          bolge_id: satir.bolge_id ?? null,
          aktif_mi: true,
        });

      if (insertError) {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        hatalar.push(`Satır ${satir.index} — DB kayıt hatası: ${insertError.message}`);
        hatali++;
        continue;
      }

      basarili++;
    }

    return NextResponse.json({
      mesaj: `Toplu yükleme tamamlandı. ${basarili} başarılı, ${hatali} hatalı.`,
      basarili,
      hatali,
      hatalar: hatalar.length > 0 ? hatalar : undefined,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/toplu-yukle");
  }
}