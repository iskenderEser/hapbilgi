// app/admin/api/firmalar/[firma_id]/toplu-yukle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import { firmaYapisiYukle, kullaniciSatirDogrula, turkceKatla } from "@/lib/admin/kullaniciDogrulama";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import * as XLSX from "xlsx";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ firma_id: string }> }
) {
  try {
    const kontrol = await adminGirisKontrol();
    if (!kontrol.gecerli) return kontrol.yanit;

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
    const hamSatirlar: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (hamSatirlar.length === 0) return validasyonHatasi("Dosya en az 1 veri satırı içermelidir.", ["dosya"]);

    // B-25 — insan-format başlık toleransı: başlıklar katlanarak (Türkçe
    // küçük harf + diakritik/boşluk temizliği) makine adlarına eşlenir.
    // "Ad" / "E-posta" / "Takım Adı" gibi insan başlıkları kabul edilir.
    const BASLIK_ESLEME: Record<string, string> = {
      ad: "ad", adi: "ad", isim: "ad",
      soyad: "soyad", soyadi: "soyad", soyisim: "soyad",
      eposta: "eposta", email: "eposta", mail: "eposta", epostaadresi: "eposta",
      sifre: "sifre", parola: "sifre", password: "sifre",
      rol: "rol", gorev: "rol", unvan: "rol",
      takim: "takim_adi", takimadi: "takim_adi", takimad: "takim_adi",
      bolge: "bolge_adi", bolgeadi: "bolge_adi", bolgead: "bolge_adi",
    };

    const rows: Record<string, unknown>[] = hamSatirlar.map((ham) => {
      const satir: Record<string, unknown> = {};
      for (const [baslik, deger] of Object.entries(ham)) {
        const hedef = BASLIK_ESLEME[turkceKatla(baslik)];
        if (hedef) satir[hedef] = deger;
      }
      return satir;
    });

    // Kimlik çekirdeği kolonları dosyada hiç yoksa satır satır "eksik alan"
    // yağdırmak yerine tek, anlaşılır dosya hatası dönülür.
    const bulunanKolonlar = new Set(rows.flatMap((r) => Object.keys(r)));
    const zorunluKolonlar = ["ad", "soyad", "eposta", "sifre", "rol"];
    const eksikKolonlar = zorunluKolonlar.filter((k) => !bulunanKolonlar.has(k));
    if (eksikKolonlar.length > 0) {
      return validasyonHatasi(
        `Dosyada şu kolonlar bulunamadı: ${eksikKolonlar.join(", ")}. Başlık satırını kontrol edin ya da şablonu indirip kullanın.`,
        ["dosya"]
      );
    }

    // Doğrulama kural kitabı TEK KAYNAK: tekli rota ile aynı fonksiyonlar
    // (B-18: rol doğrulaması dahil; B-21: koda gömülü rol listeleri kalktı;
    // B-22: bölgeler firma kapsamında yüklenir).
    const yapiSonuc = await firmaYapisiYukle(adminSupabase, firma_id);
    if (!yapiSonuc.ok) return hataYaniti(yapiSonuc.hata, "firmaYapisiYukle — toplu yükleme", null);
    const yapi = yapiSonuc.yapi;

    // K-A6 — eksik kabul: kimlik çekirdeği tam ama takım/bölge çözülememiş
    // satır "eksik" durumuyla YÜKLENİR (NULL alanla); yalnız kimlik çekirdeği
    // bozuk satırlar "hatali" kalır ve yüklenmez.
    type SatirSonuc = {
      index: number;
      ad: string;
      soyad: string;
      rol: string;
      eposta: string;
      takim_adi: string;
      bolge_adi: string;
      durum: "hazir" | "eksik" | "hatali";
      hata_mesaji?: string;
      uyari_mesaji?: string;
      takim_id?: string | null;
      bolge_id?: string | null;
    };

    const satirSonuclari: SatirSonuc[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const girdi = {
        ad: row["ad"],
        soyad: row["soyad"],
        eposta: row["eposta"],
        sifre: row["sifre"],
        rol: row["rol"],
        takim_adi: row["takim_adi"],
        bolge_adi: row["bolge_adi"],
      };

      const satirBase: Omit<SatirSonuc, "durum" | "hata_mesaji" | "takim_id" | "bolge_id"> = {
        index: i + 1,
        ad: String(row["ad"] ?? "").trim(),
        soyad: String(row["soyad"] ?? "").trim(),
        rol: String(row["rol"] ?? "").trim().toLowerCase(),
        eposta: String(row["eposta"] ?? "").trim().toLowerCase(),
        takim_adi: String(row["takim_adi"] ?? "").trim(),
        bolge_adi: String(row["bolge_adi"] ?? "").trim(),
      };

      const dogrulama = kullaniciSatirDogrula(yapi, girdi);
      if (!dogrulama.ok) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: dogrulama.hata });
        continue;
      }

      satirSonuclari.push({
        ...satirBase,
        durum: dogrulama.eksikAlanlar.length > 0 ? "eksik" : "hazir",
        uyari_mesaji: dogrulama.uyari,
        takim_id: dogrulama.kayit.takim_id,
        bolge_id: dogrulama.kayit.bolge_id,
      });
    }

    if (mod === "onizle") {
      return NextResponse.json({ satirlar: satirSonuclari }, { status: 200 });
    }

    let basarili = 0;
    let eksikli = 0; // başarılı yüklenen ama eksik bilgili (K-A6) satır sayısı
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
      if (satir.durum === "eksik") eksikli++;
    }

    return NextResponse.json({
      mesaj: `Toplu yükleme tamamlandı. ${basarili} başarılı${eksikli > 0 ? ` (${eksikli} tanesi eksik bilgili)` : ""}, ${hatali} hatalı.`,
      basarili,
      eksikli,
      hatali,
      hatalar: hatalar.length > 0 ? hatalar : undefined,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/toplu-yukle");
  }
}