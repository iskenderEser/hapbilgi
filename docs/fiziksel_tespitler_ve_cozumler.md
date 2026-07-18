# Fiziksel Tespitler ve Çözümler

*18.07.2026 — İskender'in fiziksel test turu kaydı. Kapsam: M3 + upsert aşaması + K-A8 birleşik testi (11 kişilik insan-format dosya, eksikli liste → düzeltilmiş liste → otomatik aktifleşme → firma kilidi) ve T-2/T-3 görsel kontrolü. Her tespit iletildiği anda buraya işlenir; çözüm, tespitin karşısına commit kanıtıyla yazılır.*

**Format:** `F-##` numaralı her kayıt üç bölümdür: **Tespit** (İskender'in ilettiği, olduğu gibi), **Çözüm** (yapılan iş + commit), **Durum** (BEKLİYOR / ÇÖZÜLDÜ / ÇÖZÜM GEREKMEZ — açıklamasıyla).

---

## Tespitler

### F-01 — Talep oluşturmada dosya eklenemedi, uyarı okunamadı, talep yine de listeye girdi (18.07.2026)

**Tespit (İskender):** Hepifarma firmasının ürün müdürü (merve@test2.com) talep oluşturdu, talebe PDF dosya ekledi. Ekranda ~3 saniyelik, okunamayacak kadar kısa bir uyarı göründü — dosyanın girmediği mi yüklenmediği mi anlaşılamadı. Dosya talebe eklenmediği halde talep, talep listesine eklendi.

**Talepler (İskender onayı 18.07.2026):**
1. **Uyarı süresi (genel kural):** Bütün push notification / uyarı mesajları en az 10-15 saniye ekranda kalacak — sistem geneli kural, tek uyarıya özgü değil.
2. **Dosya ekleme sorunu:** PDF'in neden eklenmediği araştırılacak; yükleme başarısızsa kullanıcıya net ve okunabilir bildirilmeli — dosyasız talebin sessizce listeye girmesi kabul edilemez.
3. **Gönderim onay modalı:** "Gönder" komutundan sonra, gönderim gerçekleşmeden ÖNCE onay modalı: ürün, teknik, soru adedi, seçenek sayısı, açıklama (uzunsa özet: baştan 3-4 cümle + "..."), eklenen dosya adları, "Talebi göndermeyi onaylıyor musunuz?" sorusu + Evet/Hayır.
4. **Modal akış kuralı:** Hayır → talep gönderilmez, kullanıcı talep sayfasında kalır (girdiler korunur). Evet → talep listeye işlenir, normal akış çalışır. (Modal, 2. maddenin emniyet ağı: dosya yüklenmemişse kullanıcı modalda dosya adını göremeyip fark eder.)

**Kök neden teşhisi (kod kanıtlı):**
- Dosya yüklemesi storage anahtarına HAM dosya adını yazıyor (`useTalepFormu.ts` — `${talep_id}/${Date.now()}_${dosya.name}`); Supabase Storage, anahtarda Türkçe karakter/özel karakter kabul etmez → "Invalid key" ile reddeder. Sistemin store modülü (`lib/store/storage.ts`) bu sorunu bildiği için güvenli ad üretiyor; talep yüklemesi korumasız.
- Akış önce talebi DB'ye yazıyor, dosyaları sonra yüklüyor; dosya hatasında `continue` + koşulsuz "Talep başarıyla oluşturuldu" — kısmi başarısızlık gizleniyor.
- Toast varsayılanı 4 sn (`HataMesaji.tsx`, `sure = 4000`); tek kaynak, 42 kullanım.

**Çözüm planı (İskender onayı 18.07.2026; "seçenek sayısı" = video başı soru sayısı netleşti):**
1. Toast varsayılanı 4000 → 12000 ms — tüm sistem tek kaynaktan uyar.
2. Storage yolu için güvenli dosya adı (Türkçe→ASCII katlama, boşluk→`_`); orijinal ad DB'de korunur; üç yükleme noktası (form ek dosya, hazır video, talep detay).
3. Dürüst sonuç: yüklenemeyen dosyalar sayılır; kısmi başarısızlıkta kalıcı (elle kapatılan) uyarı — "Talep oluşturuldu ancak şu dosyalar yüklenemedi: [adlar]".
4. Gönderim onay modalı: ürün, teknik (varsa), soru adedi, video başı soru sayısı, açıklama özeti (3-4 cümle + "..."), dosya/video adları, Evet/Hayır; Hayır → form aynen kalır, Evet → normal akış.

**Çözüm (uygulanan — 4 commit, her biri üçlü doğrulama + 1 smoke ile kapandı):**

| Madde | İş | Commit |
|---|---|---|
| 1 | Toast varsayılan süresi 4 sn → 12 sn (`HataMesaji.tsx` tek kaynak, 42 kullanım otomatik uyar) | `bd940de` |
| 2 | `guvenliDosyaAdi` — storage anahtarı için tr→ASCII katlama + boşluk→`_` + izinli karakter süzgeci; üç yükleme noktasına bağlandı (form ek dosya, hazır video, talep detay); orijinal ad DB'de korunur. Smoke: `Ürün Sunumu (Şubat) İçerik.pdf` → `Urun_Sunumu_Subat_Icerik.pdf` | `12bfa8f` |
| 3 | Dürüst sonuç: yüklenemeyenler adıyla KALICI uyarıda (elle kapatılır); "başarıyla oluşturuldu" yalnız tam başarıda. Yan kazanım: eski akışın video hatasında sessiz dönüp ikinci Gönder'de aynı talebi çift yaratma açığı kapandı | `9ec8c2a` |
| 4 | `TalepOnayModal` — validasyon sonrası özet (ürün, teknik varsa, soru adedi, video başı soru sayısı, açıklama özeti ilk 4 cümle + "...", ekli dosya/video adları) + Evet/Hayır; Hayır formu aynen bırakır. Smoke: `aciklamaOzetle` 6 cümle → ilk 4 + "..." | `0f357f3` |

**Durum:** ÇÖZÜLDÜ (kod tarafı) — İskender'in fiziksel test doğrulaması bekleniyor: Türkçe adlı PDF ile talep oluşturma (modal → Evet → dosyanın talebe eklendiği görülmeli).

---

### F-02 — "Test verileri sil" 2 tabloda silme hatası veriyor (18.07.2026)

**Tespit (İskender):** Test verileri sil komutu sonrası bildirim: "2 tabloda silme hatası oluştu. Adım: test-verileri-sil — `eczanem_izleme_kayitlari: column eczanem_izleme_kayitlari.created_at does not exist` | `store_puan_harcamalari: permission denied for table store_puan_harcamalari`". Eczanem'de zaten veri yokken neden çıktığı soruldu.

**Kök neden teşhisi (kod + şema kanıtlı):** İki hata da YAPISAL — tabloda satır olsun olmasın çıkar (veri yokken de çıkması bundan):
1. `eczanem_izleme_kayitlari`'nda `created_at` kolonu HİÇ YOK (kolonları: izleme_id, gonderim_id, musteri_id, yayin_id, tamamlandi_mi, izleme_baslangic, izleme_bitis — `sema.json` doğrulaması). Rota tüm tablolarda `created_at >= 1970` filtresiyle siliyor (`test-verileri-sil/route.ts`); rotadaki "tüm hedef tablolarda created_at mevcut (DB'den doğrulandı)" notu bayatlamış — bu tablo sonradan kapsama girmiş.
2. `store_puan_harcamalari`'nda hata Postgres YETKİ hatası: service_role'ün bu tabloda GRANT'i yok (RLS değil — service_role RLS'i zaten aşar; tablo muhtemelen GRANT verilmeden oluşturulmuş). Kod düzeltmesiyle çözülmez; DB'de GRANT gerekir.

**Çözüm (uygulanan):**
1. **Kod (`ac94cba`):** `eczanem_izleme_kayitlari` için silme filtresi birincil anahtara alındı (`OZEL_FILTRE_KOLONU` istisna haritası — `izleme_id is not null` tüm satırları siler, PK hiçbir satırda null olamaz); rotadaki bayat "tüm hedef tablolarda created_at mevcut" notu düzeltildi. Üçlü doğrulama temiz; rota canlı DB'ye yazdığı için smoke İskender'in bir sonraki fiziksel koşumuna bırakıldı (bilinçli — canlı DB yazımı Code'a kapalı).
2. **DB (SQL — İskender uyguladı, 18.07.2026):** GRANT kontrol sorgusu service_role'de DELETE GRANT'i olmayan ÜÇ tablo çıkardı: `sistem_ayarlari`, `silinmis_kullanicilar`, `store_puan_harcamalari`. Üçüne birden `GRANT ALL ... TO service_role` atandı — "permission denied" kökten çözüldü; silinmis_kullanicilar (kullanıcı silme arşivi) ve sistem_ayarlari'ndaki olası gizli yetki sorunları da önlendi.

**Durum:** ÇÖZÜLDÜ — doğrulama: İskender "test verileri sil"i tekrar koşacak, iki hata da görünmemeli.

---

### F-03 — Login'de "Şifremi unuttum" ve "Beni hatırla" işlevsiz (18.07.2026)

**Tespit (İskender):** Login sayfasındaki "Şifremi unuttum" ve "Beni hatırla" fonksiyonları kontrol edilsin — "Şifremi unuttum" boşta, geliştirme yapılmamış olabilir; aynısı "Beni hatırla" için de geçerli olabilir.

**Teşhis (kod kanıtlı — tespit doğru, ikisi de salt görsel):**
1. **"Şifremi unuttum"** (`app/login/page.tsx`): `<a href="#">` — ölü link, hiçbir akışa bağlı değil. Koddaki not bunun bilinçli ertelendiğini söylüyor: "İşlevlendirme ayrı iş (§6.4) — link İskender talebiyle geri geldi (13.07.2026)".
2. **"Beni hatırla"**: checkbox hiçbir state'e bağlı değil (onChange yok, değeri okunmuyor). Önemli ayrıntı: Supabase varsayılanı oturumu ZATEN kalıcı tutar (localStorage) — yani bugün kutu işaretlense de işaretlenmese de herkes "hatırlanıyor". Gerçek işlev "işaretsizse tarayıcı kapanınca oturum düşsün" demektir.

**Çözüm planı (İskender onayı 18.07.2026; "Beni hatırla" tercihi: işlevlendir):**
- A) Şifremi unuttum: login'de e-posta formu → `resetPasswordForEmail` (her durumda nötr mesaj — adres var/yok sızdırılmaz) + yeni `/sifre-yenile` sayfası (yeni şifre + tekrar, min 6 politikası, kaydet → login). Supabase panelinde Redirect URL kontrolü İskender'de.
- B) Beni hatırla: işaretli (varsayılan) → bugünkü kalıcı oturum; işaretsiz → tarayıcı kapanınca oturum düşer.

**Çözüm (uygulanan — 2 commit, üçlü doğrulama temiz):**

| Madde | İş | Commit |
|---|---|---|
| A | "Şifremi unuttum" işlevlendi: login'de sıfırlama görünümü (e-posta öndoldurulur, `resetPasswordForEmail`, nötr mesaj — adres kayıtlı mı sızdırılmaz) + yeni `/sifre-yenile` sayfası (kurtarma oturumu 5 sn toleransla doğrulanır, yeni şifre + tekrar, B-36 politikası min 6, kayıt sonrası signOut → login) | `9241789` |
| B | "Beni hatırla" işlevlendi: varsayılan işaretli (bugünkü kalıcı oturum); işaretsiz girişte kalıcı bayrak + tarayıcı kapanınca ölen işaret çerezi yazılır; AuthProvider açılışta ikisini karşılaştırıp gerekiyorsa oturumu düşürür. Bilinen sınır: tarayıcının "kaldığım yerden devam et" ayarı oturum çerezlerini geri getirebilir | `13c72b2` |

**Durum:** KOD TARAFI BİTTİ — İskender'in fiziksel doğrulaması sonrası ÇÖZÜLDÜ yazılacak. Doğrulama adımları: (1) push sonrası canlıda "Şifremi unuttum" → e-posta → bağlantı → yeni şifre → yeni şifreyle giriş; (2) işaretsiz "Beni hatırla" ile giriş → tarayıcıyı tamamen kapat-aç → login'e düşmeli. Ön koşul: Supabase panelinde Authentication → URL Configuration'da site adresi + `/sifre-yenile` Redirect URL listesinde olmalı (İskender kontrol edecek).
