# Standart kontroller

Tasarım kaynağı: [Bluebook §13](../../docs/BLUEBOOK.MD) ve [onaylı görsel](../../docs/tasarim/SADE_KONTROL_AILELERI.html).

| Standart yapı | Ortak kontrol |
|---|---|
| Kişi seçimi | `SadeKisiSecimi` |
| Firma/takım/bölge gibi kapsam seçimi | `SadeSecim` |
| Tablo içi seçim | `SadeTabloSecimi` |
| Zaman seçimi | `SadeZamanToggle` |
| Yayın türü / kısa kapsam filtresi | `SadeKapsulFiltre` |
| Altı çizgili sekme | `SadeSekmeler` |
| Çoklu kişi seçimi | `SadeKisiCokluSecimi` |
| Çoklu eczane/kapsam seçimi | `SadeCokluAliciSecimi` |
| Form seçimi | `SadeFormSecimi` |

Görsel kontroller `SadeKontroller.tsx`, kişi seçimleri `KisiKontroller.tsx` üzerinden alınır. Ölçüler, font, ok ve yüzeyler `sade-kontroller.module.css` içindedir. Sayfalar `className` ile yalnız yerleşimi düzenler; yükseklik, font, renk ve köşe ekleyerek standardı değiştirmez.

Seçeneklerde `deger`, `etiket`, isteğe bağlı `altBilgi` ve `disabled` bulunur. Veriyi, yetkiyi, kapsam zincirini ve kayıt işlemini çağıran sayfa yönetir. Ortak kontrol izin verilmeyen seçenekleri kendiliğinden eklemez; üst kapsam değiştiğinde geçersiz alt seçimi temizlemek sayfanın sorumluluğudur. BM seçeneklerine bölge alt bilgisi verilmez.

Tekli ve çoklu seçimlerin menüleri dışarı tıklama/Escape ile kapanır, odak seçim butonuna döner. Tekli seçim araması Türkçe harfleri destekler; aşağı/yukarı ve Home/End tuşları seçenekler arasında gezinir. Çoklu seçim onay kutularında Tab/Space kullanılır, seçim sırasında menü açık kalır. Sekmeler ilişkili içerikleri `icerik` ile alır; panel ilişkisi ve klavye gezintisi birlikte yönetilir.

`SadeFormSecimi` üst etiketiyle native select üretir; `name`, `required`, `value`, `onChange` ve form kaydı korunur. Dokunmatik cihazlarda form yazısı 16 px olur. Zaman seçenekleri `PERIYOTLAR` kaynağından gelir. Lig sarmalayıcılarında eski API değerlerine dönüşüm korunmuştur.

Mevcut `PeriyotButonlari`, `TemsilciSecici`, `YayinTuruFiltresi` yeni kontrolleri kullanır. Radix `Select` mevcut kullanım sözleşmesini koruyarak ortak form görünümünü ve okunu kullanır. `size` eski çağrılar için korunur; standart form yüksekliği her iki değerde de 40 px'tir.

Sayfalarda ayrı tanımlanmış kontroller henüz taşınmadı. Mevcut ortak kaynakları kullanan sayfalarda da eski görünüm sınıfları kalabilir; sayfa geçişinde kaldırılmalıdır. İşlem butonu `Button`, Bluebook'ta bu altı aileden ayrı bir standardı tanımlanana kadar değiştirilmez.

Davranış doğrulaması: `node --import ./tests/_alias.mjs --test tests/sadeKontroller.hedef.test.ts`.

## İsim listeleri — 9 Ekim 2026

`SadeKisiSecimi` tekli kişi filtresi ve atama, `SadeKisiCokluSecimi` çoklu alıcı seçimi içindir. `baslik` kapsamı anlatır; `kisiler` içinde `deger`, unvansız `adSoyad`, isteğe bağlı `rol`, `altBilgi`, `disabled` bulunur. İsim biçimi `kisiGorunenAdi` tarafından tek yerde belirlenir. Yalnız eczacı grubunda Ecz., eczane teknisyeninde Ecz.Tekn. öneki gösterilir.

Boş seçim kapsülde başlığı gösterir; menüdeki boş seçeneğin adı `bosSecenekEtiketi` ile verilir. Mevcut kapsamda boş/tümünü seçme yoksa `false` kullanılır. `baslikGoster` otomatik seçili kişinin kapsamını değiştirmeden başlangıç başlığını gösterir. Tekli seçimden sonra yalnız isim görünür; işlem bilgisi menüde ayrı satırdadır. Çoklu seçim N kişi seçildi olarak gösterilir. Karşılaştırma seçimleri başlıktaki1/2 ile ayırt edilir.

## Yükseklik — 9 Ekim 2026

Dökülen liste pilleri (kişi/kapsam, tablo, çoklu alıcı ve form seçimleri) 40 px yüksekliğinde; metin 11 px / 800 olur. Tarih alanları da 40 px ile aynı satırdaki seçimlere uyar. Ölçü `sade-kontroller.module.css` içindeki `--selection-height` değişkeninden gelir. Toggle dış kapsülü 40 px, iç butonları 30 px olarak kalır. Dokunmatik form seçimlerindeki 16 px erişilebilirlik istisnası korunur. BM Öneri Takibi'ndeki yerel deneme kaldırılmıştır.
