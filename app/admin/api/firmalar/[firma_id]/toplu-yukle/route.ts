// app/admin/api/firmalar/[firma_id]/toplu-yukle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { hataYaniti, sunucuHatasi, validasyonHatasi } from "@/lib/utils/hataIsle";
import {
  adKatla,
  firmaYapisiYukle,
  kullaniciSatirDogrula,
  kullaniciEksikMi,
  organizasyonKurulumPlani,
  satirUpsertPlani,
  turkceKatla,
  type GuncellemeAlanlari,
  type MevcutKullanici,
} from "@/lib/admin/kullaniciDogrulama";
import { adminGirisKontrol } from "@/lib/utils/adminGirisKontrol";
import { hiyerarsiAdiBicimle, tekillikIhlaliMi } from "@/lib/admin/hiyerarsiTekillik";
import { topluPaketHatalari } from "@/lib/admin/topluPaketButunlugu";
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
    const hamSatirlar: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (hamSatirlar.length === 0) return validasyonHatasi("Dosya en az 1 veri satırı içermelidir.", ["dosya"]);

    // B-25 — insan-format başlık toleransı: başlıklar katlanarak (Türkçe
    // küçük harf + diakritik/boşluk temizliği) makine adlarına eşlenir.
    // "Ad" / "E-posta" / "Takım Adı" gibi insan başlıkları kabul edilir.
    const BASLIK_ESLEME: Record<string, string> = {
      ad: "ad", adi: "ad", isim: "ad",
      soyad: "soyad", soyadi: "soyad", soyisim: "soyad",
      eposta: "eposta", email: "eposta", mail: "eposta", epostaadresi: "eposta",
      telefon: "telefon", tel: "telefon", telefonno: "telefon", telefonnumarasi: "telefon",
      gsm: "telefon", gsmno: "telefon", cep: "telefon", cepno: "telefon",
      ceptelefonu: "telefon", ceptel: "telefon",
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
    // Şifre kolonu dosya düzeyinde zorunlu DEĞİL: tamamlama listeleri şifresiz
    // gelir; yeni kullanıcı satırında şifre zorunluluğunu satirUpsertPlani uygular.
    const zorunluKolonlar = ["ad", "soyad", "eposta", "telefon", "rol"];
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
    const gercekYapi = yapiSonuc.yapi;
    const yapi = {
      ...gercekYapi,
      takimlar: [...gercekYapi.takimlar],
      bolgeler: [...gercekYapi.bolgeler],
    };

    // K-A8 — organizasyonun dosyadan kurulması: dosyada adı geçen ama firmada
    // olmayan takım/bölge "eksik" değil, kurulum planıdır. Önizlemede satırlar
    // sanal yapıyla çözülür ve "oluşturulacak" bilgisi görünür; kaydette önce
    // takım/bölge gerçekten açılır, satırlar sonra bilinen akışla işlenir —
    // kayıt tek dosyayla tamamlanır.
    const kurulum = organizasyonKurulumPlani(
      yapi,
      rows.map((r) => ({ rol: r["rol"], takim_adi: r["takim_adi"], bolge_adi: r["bolge_adi"] }))
    );
    const yeniTakimSet = new Set(kurulum.yeniTakimlar.map((t) => adKatla(t)));
    const yeniBolgeSet = new Set(kurulum.yeniBolgeler.map((b) => adKatla(b.bolge_adi)));
    let olusturulanTakim = 0;
    let olusturulanBolge = 0;

    // Kurulacak organizasyon, önizleme ve kayıt doğrulamasında yalnız sanal
    // yapıya eklenir. Paket bütünü doğrulanmadan DB'ye hiçbir şey yazılmaz.
    for (const takimAdi of kurulum.yeniTakimlar) {
      yapi.takimlar.push({ takim_id: `yeni:${adKatla(takimAdi)}`, takim_adi: takimAdi });
    }
    for (const b of kurulum.yeniBolgeler) {
      const takim = yapi.takimlar.find((t) => adKatla(t.takim_adi) === adKatla(b.takim_adi));
      if (takim) yapi.bolgeler.push({ bolge_id: `yeni:${adKatla(b.bolge_adi)}`, bolge_adi: b.bolge_adi, takim_id: takim.takim_id });
    }

    // Upsert modeli: satırlar firmanın MEVCUT kullanıcılarıyla eşleştirilir
    // (önce e-posta, sonra telefon). Eşleşen güncellenir, eşleşmeyen eklenir,
    // yeni listede olmayan mevcut kullanıcıya DOKUNULMAZ.
    const { data: mevcutData, error: mevcutError } = await adminSupabase
      .from("kullanicilar")
      .select("kullanici_id, ad, soyad, eposta, telefon, rol, takim_id, bolge_id, aktif_mi")
      .eq("firma_id", firma_id);
    if (mevcutError) return hataYaniti("Mevcut kullanıcılar çekilemedi.", "kullanicilar tablosu SELECT — upsert eşleştirme", mevcutError);
    const mevcutlar = (mevcutData ?? []) as MevcutKullanici[];
    const mevcutMap = new Map(mevcutlar.map((m) => [m.kullanici_id, m]));

    // K-A6 — eksik kabul: kimlik çekirdeği tam ama takım/bölge çözülememiş
    // satır "eksik" durumuyla YÜKLENİR (NULL alanla); yalnız kimlik çekirdeği
    // bozuk satırlar "hatali" kalır ve yüklenmez.
    type SatirSonuc = {
      index: number;
      ad: string;
      soyad: string;
      rol: string;
      eposta: string;
      telefon: string;
      takim_adi: string;
      bolge_adi: string;
      durum: "hazir" | "eksik" | "hatali";
      islem?: "yeni" | "guncelle" | "degisiklik-yok";
      degisen?: string[];
      hata_mesaji?: string;
      uyari_mesaji?: string;
      takim_id?: string | null;
      bolge_id?: string | null;
      // guncelle dalının kayıt-anı verisi (önizlemede kullanılmaz)
      hedef_kullanici_id?: string;
      guncelleme?: GuncellemeAlanlari;
      eposta_degisti?: boolean;
      metadata_degisti?: boolean;
    };

    const satirSonuclari: SatirSonuc[] = [];
    // Dosya içi tekillik: aynı telefon, aynı e-posta ya da aynı mevcut
    // kullanıcıya eşleşen ikinci satır görünür hatayla düşer — DB benzersizlik
    // index'ine İngilizce mesajla takılmak ya da aynı kayda çelişen iki
    // güncelleme yazmak yerine önden yakalanır.
    const gorulenTelefonlar = new Map<string, number>();
    const gorulenEpostalar = new Map<string, number>();
    const eslesenKullanicilar = new Map<string, number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const girdi = {
        ad: row["ad"],
        soyad: row["soyad"],
        eposta: row["eposta"],
        telefon: row["telefon"],
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
        telefon: String(row["telefon"] ?? "").trim(),
        takim_adi: String(row["takim_adi"] ?? "").trim(),
        bolge_adi: String(row["bolge_adi"] ?? "").trim(),
      };

      const dogrulama = kullaniciSatirDogrula(yapi, girdi, { sifreZorunlu: false });
      if (!dogrulama.ok) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: dogrulama.hata });
        continue;
      }
      const kayit = dogrulama.kayit;

      const telefonOnceki = gorulenTelefonlar.get(kayit.telefon);
      if (telefonOnceki !== undefined) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `Telefon numarası dosyada mükerrer — satır ${telefonOnceki} ile aynı (${kayit.telefon}).` });
        continue;
      }
      const epostaOnceki = gorulenEpostalar.get(kayit.eposta);
      if (epostaOnceki !== undefined) {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `E-posta dosyada mükerrer — satır ${epostaOnceki} ile aynı (${kayit.eposta}).` });
        continue;
      }

      const plan = satirUpsertPlani(yapi, mevcutlar, kayit);
      if (plan.islem === "hata") {
        satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: plan.hata });
        continue;
      }
      if (plan.islem !== "yeni") {
        const hedefOnceki = eslesenKullanicilar.get(plan.kullanici_id);
        if (hedefOnceki !== undefined) {
          satirSonuclari.push({ ...satirBase, durum: "hatali", hata_mesaji: `Bu satır da satır ${hedefOnceki} ile aynı mevcut kullanıcıya eşleşiyor — satır işlenmedi.` });
          continue;
        }
        eslesenKullanicilar.set(plan.kullanici_id, i + 1);
      }
      gorulenTelefonlar.set(kayit.telefon, i + 1);
      gorulenEpostalar.set(kayit.eposta, i + 1);

      // Satır KANONİK değerleri taşır (rolCoz'dan geçmiş rol kodu, normalize
      // telefon, katlanmış e-posta) — kayıt aşaması ve auth metadata bunları
      // kullanır; ham girdinin (örn. insan-adlı rol) DB'ye sızması biter.
      // K-A8: önizlemede satır, hangi takım/bölgenin bu yüklemeyle
      // oluşturulacağını görünür taşır (yazım hatasından çöp kayıt üretmeye
      // karşı kaydetmeden önce göz onayı).
      const kurulumNotlari: string[] = [];
      if (mod === "onizle") {
        if (satirBase.takim_adi && yeniTakimSet.has(adKatla(satirBase.takim_adi))) {
          kurulumNotlari.push(`"${satirBase.takim_adi}" takımı bu yüklemeyle oluşturulacak.`);
        }
        if (satirBase.bolge_adi && yeniBolgeSet.has(adKatla(satirBase.bolge_adi))) {
          kurulumNotlari.push(`"${satirBase.bolge_adi}" bölgesi bu yüklemeyle oluşturulacak.`);
        }
      }

      const ortak = {
        ...satirBase,
        ad: kayit.ad,
        soyad: kayit.soyad,
        rol: kayit.rol,
        eposta: kayit.eposta,
        telefon: kayit.telefon,
        uyari_mesaji: [dogrulama.uyari, ...kurulumNotlari].filter(Boolean).join(" ") || undefined,
      };

      if (plan.islem === "yeni") {
        satirSonuclari.push({
          ...ortak,
          durum: dogrulama.eksikAlanlar.length > 0 ? "eksik" : "hazir",
          islem: "yeni",
          takim_id: kayit.takim_id,
          bolge_id: kayit.bolge_id,
        });
      } else if (plan.islem === "degisiklik-yok") {
        const mevcut = mevcutMap.get(plan.kullanici_id)!;
        const eksik = kullaniciEksikMi(mevcut.rol, mevcut.takim_id, mevcut.bolge_id, mevcut.telefon);
        satirSonuclari.push({
          ...ortak,
          durum: eksik.eksik ? "eksik" : "hazir",
          islem: "degisiklik-yok",
          hedef_kullanici_id: plan.kullanici_id,
        });
      } else {
        // Güncelleme sonrası duruma göre eksiklik: tamamlama listesi eksiği
        // kapatıyorsa satır "hazir" görünür.
        const eksik = kullaniciEksikMi(plan.son.rol, plan.son.takim_id, plan.son.bolge_id, kayit.telefon);
        satirSonuclari.push({
          ...ortak,
          durum: eksik.eksik ? "eksik" : "hazir",
          islem: "guncelle",
          degisen: plan.degisenAlanlar,
          takim_id: plan.son.takim_id,
          bolge_id: plan.son.bolge_id,
          hedef_kullanici_id: plan.kullanici_id,
          guncelleme: plan.alanlar,
          eposta_degisti: plan.epostaDegisti,
          metadata_degisti: plan.metadataDegisti,
        });
      }
    }

    if (mod === "onizle") {
      return NextResponse.json({ satirlar: satirSonuclari, kurulum }, { status: 200 });
    }

    // ADM-02 — paket kapısı: tek bir hatalı satır varsa takım, bölge, Auth
    // veya kullanıcı yazımına başlanmaz. Dosya ya bütünüyle işlenir ya hiç işlenmez.
    const paketHatalari = topluPaketHatalari(satirSonuclari);
    if (paketHatalari.length > 0) {
      return NextResponse.json({
        hata: `Paket kaydedilmedi: ${paketHatalari.length} hatalı satırın tamamını düzeltin.`,
        adim: "toplu yükleme — paket bütünlüğü doğrulaması",
        hatali: paketHatalari.length,
        hatalar: paketHatalari,
        eklenen: 0,
        guncellenen: 0,
        olusturulanTakim: 0,
        olusturulanBolge: 0,
      }, { status: 422 });
    }

    const olusturulanTakimIdler: string[] = [];
    const olusturulanBolgeIdler: string[] = [];
    const olusturulanKullaniciIdler: string[] = [];
    const tamamlananGuncellemeler: {
      eski: MevcutKullanici;
      epostaDegisti: boolean;
      metadataDegisti: boolean;
    }[] = [];
    const sanalIdEsleme = new Map<string, string>();

    const paketiGeriAl = async (): Promise<string[]> => {
      const telafiHatalari: string[] = [];

      for (const kullaniciId of [...olusturulanKullaniciIdler].reverse()) {
        const { error: dbSilError } = await adminSupabase
          .from("kullanicilar")
          .delete()
          .eq("kullanici_id", kullaniciId)
          .eq("firma_id", firma_id);
        if (dbSilError) telafiHatalari.push(`Kullanıcı DB rollback: ${dbSilError.message}`);
        const { error: authSilError } = await adminSupabase.auth.admin.deleteUser(kullaniciId);
        if (authSilError) telafiHatalari.push(`Kullanıcı Auth rollback: ${authSilError.message}`);
      }

      for (const kayit of [...tamamlananGuncellemeler].reverse()) {
        const { eski } = kayit;
        const { error: dbGeriError } = await adminSupabase
          .from("kullanicilar")
          .update({
            ad: eski.ad,
            soyad: eski.soyad,
            eposta: eski.eposta,
            telefon: eski.telefon,
            rol: eski.rol,
            takim_id: eski.takim_id,
            bolge_id: eski.bolge_id,
            aktif_mi: eski.aktif_mi,
          })
          .eq("kullanici_id", eski.kullanici_id)
          .eq("firma_id", firma_id);
        if (dbGeriError) telafiHatalari.push(`Kullanıcı DB güncelleme rollback: ${dbGeriError.message}`);

        if (kayit.epostaDegisti || kayit.metadataDegisti) {
          const { error: authGeriError } = await adminSupabase.auth.admin.updateUserById(eski.kullanici_id, {
            ...(kayit.epostaDegisti ? { email: eski.eposta } : {}),
            ...(kayit.metadataDegisti ? { user_metadata: { rol: eski.rol, ad: eski.ad, soyad: eski.soyad } } : {}),
          });
          if (authGeriError) telafiHatalari.push(`Kullanıcı Auth güncelleme rollback: ${authGeriError.message}`);
        }
      }

      for (const bolgeId of [...olusturulanBolgeIdler].reverse()) {
        const { error } = await adminSupabase.from("bolgeler").delete().eq("bolge_id", bolgeId);
        if (error) telafiHatalari.push(`Bölge rollback: ${error.message}`);
      }
      for (const takimId of [...olusturulanTakimIdler].reverse()) {
        const { error } = await adminSupabase.from("takimlar").delete().eq("takim_id", takimId);
        if (error) telafiHatalari.push(`Takım rollback: ${error.message}`);
      }
      return telafiHatalari;
    };

    const paketYazmaHatasi = async (mesaj: string, status = 500) => {
      const telafiHatalari = await paketiGeriAl();
      return NextResponse.json({
        hata: mesaj,
        adim: "toplu yükleme — atomik kayıt",
        rollback: telafiHatalari.length === 0 ? "başarılı" : "hatalı",
        ...(telafiHatalari.length > 0 ? { rollback_hatalari: telafiHatalari } : {}),
      }, { status });
    };

    // Paket doğrulandıktan sonra organizasyon gerçekten oluşturulur.
    for (const takimAdi of kurulum.yeniTakimlar) {
      const bicimliTakimAdi = hiyerarsiAdiBicimle(takimAdi);
      const { data: yeniTakim, error: takimInsertError } = await adminSupabase
        .from("takimlar")
        .insert({ firma_id, takim_adi: bicimliTakimAdi })
        .select("takim_id, takim_adi")
        .single();
      if (takimInsertError || !yeniTakim) {
        const mesaj = tekillikIhlaliMi(takimInsertError)
          ? `"${bicimliTakimAdi}" takımı eşzamanlı başka bir işlemde oluşturuldu; paket kaydedilmedi.`
          : `"${bicimliTakimAdi}" takımı oluşturulamadı; paket kaydedilmedi.`;
        return paketYazmaHatasi(mesaj, tekillikIhlaliMi(takimInsertError) ? 422 : 500);
      }
      gercekYapi.takimlar.push(yeniTakim);
      olusturulanTakimIdler.push(yeniTakim.takim_id);
      sanalIdEsleme.set(`yeni:${adKatla(takimAdi)}`, yeniTakim.takim_id);
      olusturulanTakim++;
    }

    for (const b of kurulum.yeniBolgeler) {
      const takim = gercekYapi.takimlar.find((t) => adKatla(t.takim_adi) === adKatla(b.takim_adi));
      if (!takim) return paketYazmaHatasi(`"${b.bolge_adi}" bölgesinin takımı çözülemedi; paket kaydedilmedi.`);
      const bicimliBolgeAdi = hiyerarsiAdiBicimle(b.bolge_adi);
      const { data: yeniBolge, error: bolgeInsertError } = await adminSupabase
        .from("bolgeler")
        .insert({ takim_id: takim.takim_id, bolge_adi: bicimliBolgeAdi })
        .select("bolge_id, bolge_adi, takim_id")
        .single();
      if (bolgeInsertError || !yeniBolge) {
        const mesaj = tekillikIhlaliMi(bolgeInsertError)
          ? `"${bicimliBolgeAdi}" bölgesi eşzamanlı başka bir işlemde oluşturuldu; paket kaydedilmedi.`
          : `"${bicimliBolgeAdi}" bölgesi oluşturulamadı; paket kaydedilmedi.`;
        return paketYazmaHatasi(mesaj, tekillikIhlaliMi(bolgeInsertError) ? 422 : 500);
      }
      gercekYapi.bolgeler.push(yeniBolge);
      olusturulanBolgeIdler.push(yeniBolge.bolge_id);
      sanalIdEsleme.set(`yeni:${adKatla(b.bolge_adi)}`, yeniBolge.bolge_id);
      olusturulanBolge++;
    }

    const gercekId = (id: string | null | undefined): string | null | undefined =>
      id?.startsWith("yeni:") ? sanalIdEsleme.get(id) : id;
    for (const satir of satirSonuclari) {
      satir.takim_id = gercekId(satir.takim_id);
      satir.bolge_id = gercekId(satir.bolge_id);
      if (satir.guncelleme?.takim_id) satir.guncelleme.takim_id = gercekId(satir.guncelleme.takim_id) ?? null;
      if (satir.guncelleme?.bolge_id) satir.guncelleme.bolge_id = gercekId(satir.guncelleme.bolge_id) ?? null;
    }

    let eklenen = 0;
    let guncellenen = 0;
    let degismeyen = 0;
    let eksikli = 0; // işlenen ama eksik bilgili (K-A6) satır sayısı
    const hatali = 0;
    const hatalar: string[] = [];

    for (const satir of satirSonuclari) {
      if (satir.durum === "hatali") {
        return paketYazmaHatasi(`Satır ${satir.index} doğrulama sonrasında hatalı duruma geçti; paket kaydedilmedi.`);
      }

      if (satir.islem === "degisiklik-yok") {
        degismeyen++;
        if (satir.durum === "eksik") eksikli++;
        continue;
      }

      if (satir.islem === "guncelle") {
        // Sıra: önce auth (e-posta/metadata), sonra DB satırı; DB düşerse auth
        // eski değerlere geri döndürülür — silme rotasındaki telafi disipliniyle aynı.
        const authDegisiklik: { email?: string; user_metadata?: Record<string, string> } = {};
        if (satir.eposta_degisti) authDegisiklik.email = satir.eposta;
        if (satir.metadata_degisti) authDegisiklik.user_metadata = { rol: satir.rol, ad: satir.ad, soyad: satir.soyad };

        if (authDegisiklik.email || authDegisiklik.user_metadata) {
          const { error: authGuncelleError } = await adminSupabase.auth.admin.updateUserById(
            satir.hedef_kullanici_id!,
            authDegisiklik
          );
          if (authGuncelleError) {
            return paketYazmaHatasi(`Satır ${satir.index} Auth güncellenemedi; paket kaydedilmedi.`);
          }
        }

        const { error: updateError } = await adminSupabase
          .from("kullanicilar")
          .update(satir.guncelleme!)
          .eq("kullanici_id", satir.hedef_kullanici_id!)
          .eq("firma_id", firma_id);

        if (updateError) {
          if (authDegisiklik.email || authDegisiklik.user_metadata) {
            const eski = mevcutMap.get(satir.hedef_kullanici_id!)!;
            await adminSupabase.auth.admin.updateUserById(satir.hedef_kullanici_id!, {
              ...(authDegisiklik.email ? { email: eski.eposta } : {}),
              ...(authDegisiklik.user_metadata ? { user_metadata: { rol: eski.rol, ad: eski.ad, soyad: eski.soyad } } : {}),
            });
          }
          const mesaj = updateError.code === "23505" && updateError.message.includes("telefon")
            ? `Satır ${satir.index}: Bu telefon numarası başka bir kullanıcıda kayıtlı (${satir.telefon}); paket kaydedilmedi.`
            : `Satır ${satir.index} DB güncellenemedi; paket kaydedilmedi.`;
          return paketYazmaHatasi(mesaj, updateError.code === "23505" ? 422 : 500);
        }

        tamamlananGuncellemeler.push({
          eski: mevcutMap.get(satir.hedef_kullanici_id!)!,
          epostaDegisti: Boolean(authDegisiklik.email),
          metadataDegisti: Boolean(authDegisiklik.user_metadata),
        });
        guncellenen++;
        if (satir.durum === "eksik") eksikli++;
        continue;
      }

      // islem === "yeni"
      const row = rows[satir.index - 1];
      const sifre = String(row["sifre"] ?? "").trim();

      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: satir.eposta,
        password: sifre,
        user_metadata: { rol: satir.rol, ad: satir.ad, soyad: satir.soyad },
        email_confirm: true,
      });

      if (authError || !authData.user) {
        return paketYazmaHatasi(`Satır ${satir.index} Auth hesabı oluşturulamadı; paket kaydedilmedi.`);
      }
      olusturulanKullaniciIdler.push(authData.user.id);

      const { error: insertError } = await adminSupabase
        .from("kullanicilar")
        .insert({
          kullanici_id: authData.user.id,
          ad: satir.ad,
          soyad: satir.soyad,
          eposta: satir.eposta,
          telefon: satir.telefon,
          rol: satir.rol,
          firma_id,
          takim_id: satir.takim_id ?? null,
          bolge_id: satir.bolge_id ?? null,
          // T-7: eksik bilgili kullanıcı PASİF doğar; eksiği kapanınca
          // otomatik aktifleşir (satirUpsertPlani / PUT aynı kural).
          aktif_mi: satir.durum !== "eksik",
        });

      if (insertError) {
        // 23505 = benzersizlik ihlali; telefon index'ine takılan satır Türkçe raporlanır.
        const mesaj = insertError.code === "23505" && insertError.message.includes("telefon")
          ? `Satır ${satir.index}: Bu telefon numarası başka bir kullanıcıda kayıtlı (${satir.telefon}); paket kaydedilmedi.`
          : `Satır ${satir.index} DB kaydı oluşturulamadı; paket kaydedilmedi.`;
        return paketYazmaHatasi(mesaj, insertError.code === "23505" ? 422 : 500);
      }

      eklenen++;
      if (satir.durum === "eksik") eksikli++;
    }

    const ozet = [
      ...(olusturulanTakim > 0 ? [`${olusturulanTakim} takım oluşturuldu`] : []),
      ...(olusturulanBolge > 0 ? [`${olusturulanBolge} bölge oluşturuldu`] : []),
      `${eklenen} eklendi`,
      `${guncellenen} güncellendi`,
      ...(degismeyen > 0 ? [`${degismeyen} değişiklik yok`] : []),
      ...(eksikli > 0 ? [`${eksikli} eksik bilgili`] : []),
      `${hatali} hatalı`,
    ].join(", ");

    return NextResponse.json({
      mesaj: `Toplu yükleme tamamlandı. ${ozet}.`,
      eklenen,
      guncellenen,
      degismeyen,
      eksikli,
      hatali,
      olusturulanTakim,
      olusturulanBolge,
      hatalar: hatalar.length > 0 ? hatalar : undefined,
    }, { status: 200 });

  } catch (err) {
    return sunucuHatasi(err, "POST /admin/api/firmalar/[firma_id]/toplu-yukle");
  }
}
