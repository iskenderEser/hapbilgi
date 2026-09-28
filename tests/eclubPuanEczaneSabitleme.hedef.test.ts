import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const oku = (yol: string) => readFileSync(yol, "utf8");

const sabitlemeSql = oku("scripts/sql/eclub_puan_eczane_sabitleme.sql");
const temizlemeSql = oku("scripts/sql/eclub_puan_eczane_test_verisi_temizle.sql");

// ============================================================================
// FAZ 1A: PUANIN KAZANILDIĞI ECZANEYE SABİTLENMESİ SÖZLEŞME VE GÜVENLİK TESTLERİ
// ============================================================================

test("1. Migration Transaction (BEGIN / COMMIT) ve Advisory Lock bütünlüğü", () => {
  assert.match(sabitlemeSql, /^BEGIN;/m, "BEGIN bloğu bulunmalı");
  assert.match(sabitlemeSql, /COMMIT;$/m, "COMMIT bloğu bulunmalı");
  assert.match(
    sabitlemeSql,
    /SELECT pg_advisory_xact_lock\(hashtextextended\('eclub-puan-eczane-sabitleme-lock', 0\)\);/,
    "Eşzamanlı migration yarış koşullarına karşı pg_advisory_xact_lock kullanılmalı"
  );
});

test("2. Niteliksiz test verisi güvenlik kontrolü (sessiz silme engeli)", () => {
  assert.match(
    sabitlemeSql,
    /DO \$\$[\s\S]*?IF EXISTS \(SELECT 1 FROM public\.eclub_kazanilan_puanlar\)[\s\S]*?RAISE EXCEPTION[\s\S]*?END \$\$;/,
    "Migration mevcut veriyi sessizce ezmemeli, temizleme scripti yönlendirmesiyle hata vermelidir"
  );
  assert.match(
    sabitlemeSql,
    /scripts\/sql\/eclub_puan_eczane_test_verisi_temizle\.sql/,
    "Hata mesajında test verisi temizleme dosyasının yolu geçmelidir"
  );
});

test("3. eclub_kazanilan_puanlar tablosuna eczane_id uuid NOT NULL kolonu eklenmesi", () => {
  assert.match(
    sabitlemeSql,
    /ALTER TABLE public\.eclub_kazanilan_puanlar\s+ADD COLUMN IF NOT EXISTS eczane_id uuid;/,
    "eczane_id kolonu tanımlanmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /ALTER TABLE public\.eclub_kazanilan_puanlar\s+ALTER COLUMN eczane_id SET NOT NULL;/,
    "eczane_id kolonu NOT NULL kısıtına sahip olmalıdır"
  );
});

test("4. fk_eclub_kazanilan_puanlar_eczane kısıtının ON DELETE RESTRICT ile tanımlanması", () => {
  assert.match(
    sabitlemeSql,
    /CONSTRAINT fk_eclub_kazanilan_puanlar_eczane\s+FOREIGN KEY \(eczane_id\)\s+REFERENCES public\.eclub_eczaneler\(eczane_id\)\s+ON DELETE RESTRICT;/,
    "Puan kazanılmış eczanenin silinmesini engelleyen ON DELETE RESTRICT kısıtı bulunmalıdır"
  );
});

test("5. Composite indeks: idx_eclub_kazanilan_puanlar_eczane_yayin_cek_tarih tanımlanması", () => {
  assert.match(
    sabitlemeSql,
    /CREATE INDEX IF NOT EXISTS idx_eclub_kazanilan_puanlar_eczane_yayin_cek_tarih\s+ON public\.eclub_kazanilan_puanlar \(eczane_id, yayin_id, cek_karsiligi_var_mi, created_at\);/,
    "Eczane, yayın, çek karşılığı ve tarih bileşik indeksi oluşturulmalıdır"
  );
});

test("6. Tarih indeksi: idx_eclub_kazanilan_puanlar_eczane_tarih tanımlanması", () => {
  assert.match(
    sabitlemeSql,
    /CREATE INDEX IF NOT EXISTS idx_eclub_kazanilan_puanlar_eczane_tarih\s+ON public\.eclub_kazanilan_puanlar \(eczane_id, created_at\);/,
    "Eczane ve tarih sorguları için indeks oluşturulmalıdır"
  );
});

test("7. Tek aktif eczane kuralı: eclub_kisi_eczane tablosunda partial unique index", () => {
  assert.match(
    sabitlemeSql,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_eclub_kisi_eczane_tek_aktif\s+ON public\.eclub_kisi_eczane \(kisi_id\)\s+WHERE aktif_mi = true;/,
    "Bir kişinin aynı anda yalnızca tek bir aktif eczanesi olabileceği DB düzeyinde garanti edilmelidir"
  );
});

test("8. tg_eclub_kazanilan_puanlar_eczane_sabitle fonksiyonu SECURITY DEFINER ve search_path koruması", () => {
  assert.match(
    sabitlemeSql,
    /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_eczane_sabitle\(\)[\s\S]*?RETURNS trigger[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/,
    "Trigger fonksiyonu SECURITY DEFINER ve açık search_path ile tanımlanmalıdır"
  );
});

test("9. Trigger fonksiyonunda eclub_kisi_eczane FOR SHARE kilit mekanizması", () => {
  assert.match(
    sabitlemeSql,
    /FROM public\.eclub_kisi_eczane ke[\s\S]*?WHERE ke\.kisi_id = NEW\.kisi_id[\s\S]*?AND ke\.aktif_mi = true[\s\S]*?FOR SHARE/,
    "Puan yazılırken aktif eczane satırı yarış koşullarına karşı FOR SHARE ile kilitlenmelidir"
  );
});

test("10. Kişinin aktif eczanesi yoksa trigger'ın hata fırlatması", () => {
  assert.match(
    sabitlemeSql,
    /IF v_kayitlar IS NULL OR cardinality\(v_kayitlar\) = 0 THEN[\s\S]*?RAISE EXCEPTION 'eclub_kazanilan_puanlar: Kişinin aktif bir eczane kaydı bulunamadı\.'/,
    "Aktif eczane bulunamadığında açık hata fırlatılmalıdır"
  );
});

test("11. Kişinin birden fazla aktif eczanesi varsa trigger'ın hata fırlatması", () => {
  assert.match(
    sabitlemeSql,
    /IF cardinality\(v_kayitlar\) > 1 THEN[\s\S]*?RAISE EXCEPTION 'eclub_kazanilan_puanlar: Kişi için birden fazla aktif eczane kaydı mevcut/,
    "Birden fazla aktif kayıt çelişkisinde açık hata fırlatılmalıdır"
  );
});

test("12. İstemciden gönderilen tutarsız/spoof NEW.eczane_id kontrolü", () => {
  assert.match(
    sabitlemeSql,
    /IF NEW\.eczane_id IS NOT NULL AND NEW\.eczane_id <> v_aktif_eczane_id THEN[\s\S]*?RAISE EXCEPTION 'eclub_kazanilan_puanlar: Geçersiz eczane_id/,
    "İstemci uyuşmayan bir eczane_id gönderirse işlem reddedilmelidir"
  );
  assert.match(
    sabitlemeSql,
    /NEW\.eczane_id := v_aktif_eczane_id;/,
    "NEW.eczane_id sunucu tarafında aktif eczane ile kesinleştirilmelidir"
  );
});

test("13. tg_eclub_kazanilan_puanlar_degismezlik BEFORE UPDATE trigger immutability garantisi", () => {
  assert.match(
    sabitlemeSql,
    /CREATE OR REPLACE FUNCTION public\.tg_eclub_kazanilan_puanlar_degismezlik\(\)[\s\S]*?RETURNS trigger[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/,
    "Değişmezlik trigger fonksiyonu SECURITY DEFINER ve search_path korumalı olmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /IF NEW\.eczane_id IS DISTINCT FROM OLD\.eczane_id THEN[\s\S]*?RAISE EXCEPTION 'eclub_kazanilan_puanlar: eczane_id değiştirilemez/,
    "Kazanılmış puanın eczane_id kolonu UPDATE ile değiştirilemez olmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /CREATE TRIGGER trg_eclub_kazanilan_puanlar_degismezlik\s+BEFORE UPDATE ON public\.eclub_kazanilan_puanlar/,
    "Trigger BEFORE UPDATE olayına bağlanmalıdır"
  );
});

test("14. eclub_store_onceki_deviri_hazirla RPC'sinde puanların doğrudan kp.eczane_id ile toplanması", () => {
  const rpcBlok = sabitlemeSql.match(
    /CREATE OR REPLACE FUNCTION public\.eclub_store_onceki_deviri_hazirla[\s\S]*?\$f\$;/
  )?.[0];
  assert.ok(rpcBlok, "eclub_store_onceki_deviri_hazirla RPC tanımı bulunmalıdır");
  assert.match(
    rpcBlok,
    /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.eczane_id = p_eczane_id/,
    "Puanlar doğrudan kp.eczane_id ile filtrelenmelidir"
  );
  assert.doesNotMatch(
    rpcBlok,
    /JOIN public\.eclub_kisi_eczane[\s\S]*?aktif_mi\s*=\s*true/,
    "Devir hesaplamasında dinamik eclub_kisi_eczane aktif_mi join'i OLMAMALIDIR"
  );
});

test("15. get_eclub_eczane_store_ozet RPC'sinde puanların doğrudan kp.eczane_id ile toplanması", () => {
  const rpcBlok = sabitlemeSql.match(
    /CREATE FUNCTION public\.get_eclub_eczane_store_ozet[\s\S]*?\$f\$;/
  )?.[0];
  assert.ok(rpcBlok, "get_eclub_eczane_store_ozet RPC tanımı bulunmalıdır");
  assert.match(
    rpcBlok,
    /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.eczane_id = v_eczane/,
    "Store özetinde puanlar doğrudan kp.eczane_id ile filtrelenmelidir"
  );
  assert.doesNotMatch(
    rpcBlok,
    /JOIN public\.eclub_kisi_eczane[\s\S]*?aktif_mi\s*=\s*true/,
    "Store özetinde dinamik eclub_kisi_eczane aktif_mi join'i OLMAMALIDIR"
  );
});

test("16. eclub_store_cek_talebi_olustur RPC'sinde puanların doğrudan kp.eczane_id ile toplanması", () => {
  const rpcBlok = sabitlemeSql.match(
    /CREATE OR REPLACE FUNCTION public\.eclub_store_cek_talebi_olustur[\s\S]*?\$f\$;/
  )?.[0];
  assert.ok(rpcBlok, "eclub_store_cek_talebi_olustur RPC tanımı bulunmalıdır");
  assert.match(
    rpcBlok,
    /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?WHERE kp\.eczane_id = v_eczane/,
    "Çek talebi oluştururken bakiye kontrolü doğrudan kp.eczane_id ile yapılmalıdır"
  );
  assert.doesNotMatch(
    rpcBlok,
    /JOIN public\.eclub_kisi_eczane[\s\S]*?aktif_mi\s*=\s*true/,
    "Çek talebi bakiye kontrolünde dinamik eclub_kisi_eczane aktif_mi join'i OLMAMALIDIR"
  );
});

test("17. get_eclub_utt_rapor RPC'sinde puanların doğrudan kp.eczane_id = t.eczane_id ile toplanması", () => {
  const rpcBlok = sabitlemeSql.match(
    /CREATE OR REPLACE FUNCTION public\.get_eclub_utt_rapor[\s\S]*?\$function\$;/
  )?.[0];
  assert.ok(rpcBlok, "get_eclub_utt_rapor RPC tanımı bulunmalıdır");
  assert.match(
    rpcBlok,
    /FROM public\.eclub_kazanilan_puanlar kp[\s\S]*?JOIN kapsam_eczaneler ke ON ke\.eczane_id = kp\.eczane_id/,
    "Puanlar doğrudan kp.eczane_id ile kapsam eczanelere bağlanmalıdır"
  );
  assert.match(
    rpcBlok,
    /LEFT JOIN puan p[\s\S]*?AND p\.eczane_id = t\.eczane_id/,
    "Puan toplamı satır ile eczane_id üzerinden birleştirilmelidir"
  );
});

test("18. get_eclub_utt_rapor içinde geçmişte puan kazanmış fakat şu an aktif olmayan kişilerin raporda yer alması", () => {
  const rpcBlok = sabitlemeSql.match(
    /CREATE OR REPLACE FUNCTION public\.get_eclub_utt_rapor[\s\S]*?\$function\$;/
  )?.[0];
  assert.ok(rpcBlok, "get_eclub_utt_rapor RPC tanımı bulunmalıdır");
  assert.match(
    rpcBlok,
    /UNION[\s\S]*?FROM kapsam_eczaneler ke[\s\S]*?JOIN public\.eclub_kazanilan_puanlar kp[\s\S]*?ON kp\.eczane_id = ke\.eczane_id[\s\S]*?AND kp\.created_at >= p_baslangic[\s\S]*?AND kp\.created_at < p_bitis/,
    "Dönem içinde puan kazanmış ancak artık aktif olmayan veya transfer olmuş personel rapora dahil edilmelidir"
  );
});

test("19. RPC Yetki Matrisi ve Least Privilege (service_role koruması)", () => {
  // get_eclub_utt_rapor
  assert.match(
    sabitlemeSql,
    /REVOKE ALL ON FUNCTION public\.get_eclub_utt_rapor\(uuid, timestamp with time zone, timestamp with time zone\) FROM PUBLIC, anon, authenticated;/,
    "get_eclub_utt_rapor PUBLIC, anon ve authenticated rollerinden geri alınmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /GRANT EXECUTE ON FUNCTION public\.get_eclub_utt_rapor\(uuid, timestamp with time zone, timestamp with time zone\) TO service_role;/,
    "get_eclub_utt_rapor yalnızca service_role'e verilmelidir"
  );

  // Store RPC'leri
  assert.match(
    sabitlemeSql,
    /REVOKE ALL ON FUNCTION public\.get_eclub_eczane_store_ozet\(uuid\) FROM PUBLIC, anon, authenticated;/,
    "get_eclub_eczane_store_ozet yetkileri daraltılmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /GRANT EXECUTE ON FUNCTION public\.get_eclub_eczane_store_ozet\(uuid\) TO service_role;/,
    "get_eclub_eczane_store_ozet yalnızca service_role'e verilmelidir"
  );

  assert.match(
    sabitlemeSql,
    /REVOKE ALL ON FUNCTION public\.eclub_store_onceki_deviri_hazirla\(uuid, uuid, text\) FROM PUBLIC, anon, authenticated;/,
    "eclub_store_onceki_deviri_hazirla yetkileri daraltılmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /GRANT EXECUTE ON FUNCTION public\.eclub_store_onceki_deviri_hazirla\(uuid, uuid, text\) TO service_role;/,
    "eclub_store_onceki_deviri_hazirla yalnızca service_role'e verilmelidir"
  );

  assert.match(
    sabitlemeSql,
    /REVOKE ALL ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\) FROM PUBLIC, anon, authenticated;/,
    "eclub_store_cek_talebi_olustur yetkileri daraltılmalıdır"
  );
  assert.match(
    sabitlemeSql,
    /GRANT EXECUTE ON FUNCTION public\.eclub_store_cek_talebi_olustur\(uuid, uuid, boolean\) TO service_role;/,
    "eclub_store_cek_talebi_olustur yalnızca service_role'e verilmelidir"
  );
});

test("20. eclub_puan_eczane_test_verisi_temizle.sql bağımlılık sırası ve kapsam güvenliği", () => {
  assert.match(temizlemeSql, /^BEGIN;/m, "Temizleme transaction korumalı olmalıdır");
  assert.match(temizlemeSql, /COMMIT;$/m, "Temizleme COMMIT ile sonlanmalıdır");
  assert.match(
    temizlemeSql,
    /SELECT pg_advisory_xact_lock\(hashtextextended\('eclub-test-veri-temizle-lock', 0\)\);/,
    "Temizleme esnasında advisory xact lock alınmalıdır"
  );

  // Silme sırası: FK bağımlılığına göre
  const posKuyruk = temizlemeSql.indexOf("DELETE FROM public.eclub_store_cek_eposta_kuyrugu;");
  const posBildirim = temizlemeSql.indexOf("DELETE FROM public.eclub_bildirimler");
  const posDevir = temizlemeSql.indexOf("DELETE FROM public.eclub_store_puan_devirleri;");
  const posCek = temizlemeSql.indexOf("DELETE FROM public.eclub_store_cek_talepleri;");
  const posPuan = temizlemeSql.indexOf("DELETE FROM public.eclub_kazanilan_puanlar;");

  assert.ok(posKuyruk !== -1 && posKuyruk < posCek, "E-posta kuyruğu çek taleplerinden önce silinmeli");
  assert.ok(posBildirim !== -1 && posBildirim < posCek, "İlgili bildirimler çek taleplerinden önce silinmeli");
  assert.ok(posDevir !== -1 && posDevir < posCek, "Dönem devirleri çek taleplerinden önce silinmeli");
  assert.ok(posCek !== -1 && posCek < posPuan, "Çek talepleri kazanılan puanlardan önce silinmeli");

  // Dokunulmaması gereken tablolar: Eczanem, T-Club, C-Club, kullanıcılar
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.eczanem_/i, "Eczanem tablolarına dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.tclub_/i, "T-Club tablolarına dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.cclub_/i, "C-Club tablolarına dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.auth/i, "Auth tablolarına dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.kisiler/i, "Kişiler tablosuna dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.eclub_eczaneler/i, "Eczaneler ana tablosuna dokunulmamalıdır");
  assert.doesNotMatch(temizlemeSql, /DELETE FROM public\.eclub_kisi_eczane/i, "Kişi-eczane eşleşme tablosuna dokunulmamalıdır");
});
