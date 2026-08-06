-- scripts/sql/puan_urun_opsiyonel.sql
--
-- Puan modelinin ürün ekseninden yayın eksenine taşınması — Arıza 2 (05.08.2026).
--
-- SORUN: Puan ve kayıp defterlerinde `urun_id` NOT NULL. Puan yazım katmanı
-- kayıttan önce yayından ürünü çözüyor, çözemezse hiç yazmıyor. Ürünsüz içerik
-- (medikal, İK) 24.07.2026'da meşru hâle geldiği hâlde bu kolonlar güncellenmedi;
-- sonuç olarak medikal ve İK eğitimleri HİÇBİR koşulda puan yazamıyor.
-- Ölçüm (05.08.2026): 26 yayının 8'i bu sebeple puansız — dört varyantta da.
--
-- KARAR: Puan yayına aittir; ürün, yayının varsa taşıdığı bir etikettir.
-- `yayin_id` zaten NOT NULL — kimlik orada. `urun_id` ise §2.5 İlke 2'deki
-- denormalizasyon kısayolu; kısayolun zorunlu olması tasarım hatasıydı.
--
-- KAPSAM DIŞI (bilinçli):
--   * eczanem_puan_kayitlari — Eczanem'de ürün gerçekten zorunludur
--     (kişi+eczane+firma+ürün dörtlü kilidi, barkod/tarife zinciri — İP §7.1).
--   * store_* / eclub_store_* — oradaki ürün mağaza ürünüdür, içerik ürünü değil.
--
-- Mevcut satırlar etkilenmez; NOT NULL kaldırmak veri kaybı yaratmaz ve
-- tekrar koşum güvenlidir (kolon zaten nullable ise komut sessizce geçer).
-- KOŞUM: İskender, Supabase SQL editöründe.

-- ── T-Club (iç müşteri) ─────────────────────────────────────────────────────
ALTER TABLE public.kazanilan_puanlar        ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.yanlis_cevap_kayitlari   ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.ileri_sarma_kayitlari    ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.oneri_kayip_kayitlari    ALTER COLUMN urun_id DROP NOT NULL;

-- ── Challenge Club ──────────────────────────────────────────────────────────
ALTER TABLE public.challenge_kayip_kayitlari ALTER COLUMN urun_id DROP NOT NULL;

-- ── E-Club (dış müşteri) ────────────────────────────────────────────────────
ALTER TABLE public.eclub_kazanilan_puanlar      ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.eclub_dogru_cevap_kayitlari  ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.eclub_yanlis_cevap_kayitlari ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.eclub_oneri_kayip_kayitlari  ALTER COLUMN urun_id DROP NOT NULL;
ALTER TABLE public.eclub_utt_puanlari           ALTER COLUMN urun_id DROP NOT NULL;
