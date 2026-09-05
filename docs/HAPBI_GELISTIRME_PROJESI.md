# HapBi Geliştirme Projesi

Aşağıdaki faz sırasından ve teknik plandan sapılmayacak. Her faz sonunda değişiklik özeti, test sonucu ve performans ölçümü paylaşılacak; onayınızdan sonra sonraki faza geçilecek.

## Faz 0 — Mevcut durumun sabitlenmesi

Amaç: Başlangıç noktasını kaybetmeden çalışma sınırını belirlemek.
### Uygulama

- Mevcut çalışma ağacı ve değişiklikler kayıt altına alınacak.
- Kullanıcıya ait veya HapBi dışındaki değişikliklere dokunulmayacak.
- Mevcut motorun bilinen sorulardaki cevapları ve süreleri başlangıç ölçümü olarak kaydedilecek.
- Canlıya kurulmuş dört analitik RPC’nin imzaları doğrulanacak; yeniden kurulmayacak.
- Mevcut üç çağrılı Gemini analitik yolu kaldırılmadan önce referans olarak korunacak.
### Çıkış koşulu

- Değişiklik sınırı kesinleşmiş olacak.
- Başlangıç doğruluk ve süre raporu hazırlanacak.
- Henüz çalışma davranışı değişmeyecek.
## Faz 1 — Kanonik analitik sözleşmenin kurulması

Amaç: Doğal dil, rol kapsamı ve veritabanı yürütmesini birbirinden ayıran tip güvenli sözleşmeyi oluşturmak.
### Dosyalar

- `lib/hapbi/niyet/sozlesme.ts`
- `lib/hapbi/niyet/donem.ts`
### Tanımlanacak yapılar

- `HapbiKanonikSorgu`
- `HapbiVeriAlani`
- `HapbiOlcut`
- `HapbiBoyut`
- `HapbiIslem`
- `HapbiDonem`
- `HapbiFiltre`
- `HapbiCevapTuru`
- `HapbiNetlestirme`
### Kanonik sorgu şu alanları taşıyacak

- veri alanı
- dönem
- ölçütler
- `boyutlar`
- `filtreler`
- işlem
- cevap türü

Rol, firma, takım ve bölge kullanıcı sorusundan alınmayacak.

### Testler

- Geçersiz dönem reddi.
- Yinelenen ölçüt ve boyut reddi.
- Desteklenmeyen veri alanı–ölçüt birleşimi reddi.
- Eksik zorunlu alanların netleştirme sonucuna dönüşmesi.
### Çıkış koşulu

- Sözleşme bağımsız testlerden geçecek.
- Gemini veya veritabanı çağrısı olmayacak.
## Faz 2 — Bluebook uyumlu rol ve kapsam çözücüsü

Amaç: Bütün HapBi rollerinin veri kapsamını tek merkezden belirlemek.
### Dosyalar

- `lib/hapbi/kapsam/rolMatrisi.ts`
- `lib/hapbi/kapsam/cozucu.ts`
- `lib/hapbi/kapsam/yetki.ts`
### Kaynaklar

- `v_auth_kimlik_admin`
- `lib/utils/rolCozucu.ts`
- `lib/utils/roller.ts`
- `lib/uretici/yetenekler.ts`
- firma → takım → bölge hiyerarşisi
- firma modül bayrakları
### Uygulanacak kapsamlar

- utt, kd_utt: kişisel.
- bm: kişisel C-Club ve sorumluluğundaki UTT/KD_UTT T-Club.
- tm: takım.
- pm, jr_pm, kd_pm: takım ve takım ürünleri.
- med_md, eğitim ve İK üretici aileleri: yetenek profiline göre firma veya takım.
- gm, gm_yrd, drk, paz_md, blm_md, grp_pm, sm: firma.
- ik_drk: üretici/İK rolüdür; drk ile karıştırılmayacak.
- Eczacı unvanları ve teknisyen: kişisel E-Club.
- iu ve admin: yalnız açıkça tanımlanmış araç kapsamları.
- Eczanem uygulaması üyesi: HapBi erişimi yok.
### Testler

- Bütün rol kodları tek tek çalıştırılacak.
- Kullanıcının soru içinde başka rol veya firma yazması kapsamı değiştirmeyecek.
- Eksik takım/bölge/firma bağı erişim genişletmeyecek.
- drk firma kapsamı ve ik_drk üretici kapsamı ayrı doğrulanacak.
### Çıkış koşulu

- Her rolün kapsamı Bluebook ile birebir eşleşecek.
- Gemini rol veya kapsam belirlemeyecek.
## Faz 3 — Deterministik doğal dil derleyicisi

Amaç: Sayısal soruların veri ve sorgu planını Gemini kullanmadan çıkarmak.
### Dosyalar

- `lib/hapbi/niyet/sozluk.ts`
- `lib/hapbi/niyet/derleyici.ts`
- `lib/hapbi/niyet/normalizasyon.ts`
### Çözülecek bileşenler

- Dönem ifadeleri.
- Veri alanı.
- Ölçüt.
- Analiz boyutu.
- İşlem.
- Açık varlık adları.
- Sayısal veya yorum cevabı ayrımı.
### Desteklenecek dönem ifadeleri

- bu hafta
- 36. hafta
- bu ay
- 3. ay
- 3. çeyrek
- üçüncü çeyrek
- 3. dönem
- `Q3`
- `3Q`
- quarter 3
- kuartır 3
- 2026 yılı
### Desteklenecek işlem ifadeleri

- kaç
- `kim`
- `hangisi`
- en yüksek
- en düşük
- ilk iki
- aradaki fark
- dağılım
- kırılım
- katkı
- karşılaştır
- detaylandır
### Kural

- Derleyici güvenli şekilde çözemediği alanı tahmin etmeyecek.
- Yalnız eksik alan için netleştirme sorusu üretecek.
- Sayısal soru Gemini’ye yönlendirilmeyecek.
### Testler

- Aynı niyetin farklı doğal dil biçimleri.
- Yazım hataları ve yaygın kısaltmalar.
- Dönemsiz soru.
- Birden fazla anlam taşıyan soru.
- Takip mesajı olmadan “bu ürün” gibi belirsiz ifadeler.
### Çıkış koşulu

- Altın soru setindeki sayısal sorular kanonik sorguya dönüşecek.
- Model çağrısı kesin olarak sıfır olacak.
## Faz 4 — Deterministik sorgu tarifleri

Amaç: Kanonik sorguyu önceden tanımlanmış çalıştırma tarifine bağlamak.
### Dosyalar

- `lib/hapbi/niyet/tarifler.ts`
- `lib/hapbi/niyet/tarifSecici.ts`
### İlk tarifler

- `lig_lideri`
- `ilk_iki_ve_fark`
- `kisisel_puan_ve_sira`
- `en_yuksek_urun`
- `urun_utt_katkisi`
- `en_iyi_urun_ve_utt_katkisi`
- `kisi_urun_dagilimi`
- `takim_urun_dagilimi`
- `firma_takim_dagilimi`
- `takim_bm_kapsami_dagilimi`
- `kayip_kisi_dagilimi`
- `kayip_urun_dagilimi`
- `donem_karsilastirmasi`
- `uretim_dagilimi`
### Örnek

{
  tarif: "en_iyi_urun_ve_utt_katkisi",
  veriAlani: "tclub",
  donem: { tur: "ceyrek", yil: 2026, ceyrek: 3 },
  olcut: "net_puan",
  cevapTuru: "sayisal"
}
### Testler

- Her tarifin doğru veri alanını seçmesi.
- Her tarifin izinli boyut ve ölçütlerle sınırlı kalması.
- Rolün tarifi değiştirmemesi; yalnız kapsamı daraltması.
- Desteklenmeyen tarifin netleştirme veya açık ret üretmesi.
### Çıkış koşulu

- Gemini araç veya tarif seçmeyecek.
- Her desteklenen sayısal niyet tek ve kararlı bir tarife bağlanacak.
## Faz 5 — Tek okumalı analitik yürütücü

Amaç: Aynı soru için veri kaynağını tekrar tekrar çağırmadan bütün hesaplamayı tamamlamak.
### Dosyalar

- `lib/hapbi/analitik/yurutucu.ts`
- `lib/hapbi/analitik/istekOnbellegi.ts`
- `lib/hapbi/analitik/toplayici.ts`
- `lib/hapbi/analitik/tarifYurutuculeri.ts`
### Kullanılacak canlı RPC’ler

- `get_hapbi_tclub_analitik_v1`
- `get_hapbi_cclub_analitik_v1`
- `get_hapbi_eclub_analitik_v1`
- `get_hapbi_uretim_analitik_v1`
### Yürütme anahtarı

kullanıcı + yetkili kapsam + veri alanı + dönem
Aynı anahtar bir istek içinde yalnız bir defa RPC çağıracak.
### Ürün–UTT örneği

1. Yetkili T-Club olguları tek RPC ile alınacak.
2. Ürün bazında net puan toplanacak.
3. En yüksek ürün seçilecek.
4. Aynı olgularda seçilen ürünün UTT katkıları toplanacak.
5. En yüksek katkılı UTT seçilecek.
6. İkinci Gemini veya ikinci analitik araç çağrısı yapılmayacak.
### Testler

- Toplamlar.
- Sıralama ve eşitlik.
- İlk iki ve fark.
- Ürün → UTT katkısı.
- Firma → takım → BM kapsamı → UTT kırılımı.
- Eksik veri ile gerçek sıfır ayrımı.
- Tek RPC çağrısı sayacı.
### Çıkış koşulu

- Bileşik sayısal sorgular tek veri okumasıyla tamamlanacak.
- Sonuçlar bilinen canlı ekran değerleriyle eşleşecek.
## Faz 6 — Kanıt ve doğrudan cevap üretimi

Amaç: Sayısal cevabı Gemini olmadan güvenli biçimde yayımlamak.
### Dosyalar

- `lib/hapbi/yanit/dogrudan.ts`
- `lib/hapbi/yanit/sablonlar.ts`
- `lib/hapbi/yanit/kanit.ts`
### Uygulama

- Her ölçüm için kararlı kanıt kimliği üretilecek.
- Kişi–ürün–ölçüt–değer ilişkisi korunacak.
- Kaynak bağlantısı doğrudan veri alanından üretilecek.
- Dönem etiketi kanıt kaynağına eklenecek.
- Yanıt rolün erişim düzeyine uygun dille yazılacak.
### Örnek

3. çeyrekte şirket genelinde en yüksek net puanı üreten ürün
Semeril’dir (393 puan). Bu ürüne en fazla katkıyı Berk Kılıç
sağlamıştır (211 puan).
### Bu yolun zorunlu değerleri

model = deterministik
model çağrısı = 0
token = 0
kaynak = zorunlu
kanıt = zorunlu
### Testler

- Yanlış kişiye doğru sayı bağlama reddi.
- Yanlış ürüne kişi katkısı bağlama reddi.
- Kaynaksız sayı reddi.
- Dönem numarasının performans sayısı sanılmaması.
- Eşit puanda tek lider üretilmemesi.
### Çıkış koşulu

- Sayısal altın soru seti Gemini’siz doğru cevaplanacak.
## Faz 7 — Tek çağrılı yorum katmanı

Amaç: Gemini’yi yalnız yorum ve öneri işinde kullanmak.
### Dosyalar

- `lib/hapbi/yanit/yorumPaketi.ts`
- `lib/hapbi/yanit/yorum.ts`
### İşleyiş

1. Soru kod tarafından çözülecek.
2. Rol kapsamı sunucuda belirlenecek.
3. SQL ve toplulaştırma kod tarafından tamamlanacak.
4. Doğrulanmış kısa JSON paketi oluşturulacak.
5. Gemini yalnız bir kez çağrılacak.
6. Cevap kanıtlara karşı doğrulanacak.
### Gemini’ye verilmeyecekler

- SQL erişimi.
- Araç seçme yetkisi.
- Rol veya kapsam seçme yetkisi.
- Ham büyük veri.
- Bütün araç şemaları.
- Üç turlu function-calling döngüsü.
### Gemini’ye verilecekler

- Kullanıcının sorusu.
- Çözülmüş kapsam etiketi.
- Dönem.
- Doğrulanmış bulgular.
- Seçilmiş kanıtlar.
- Yorum sınırları.
### Testler

- model_cagrisi === 1.
- Yeni sayı üretme reddi.
- Kanıtsız neden üretme reddi.
- Puanı satış başarısı veya mesleki yeterlilik saymama.
- Firma dışı yorum üretmeme.
### Çıkış koşulu

- Yorum sorularında tek model çağrısı.
- Sayısal sorularda model çağrısı hâlâ sıfır.
## Faz 8 — Yeni motorun bütünleştirilmesi

Amaç: Doğrudan ve yorum yollarını tek kararlı motor altında birleştirmek.
### Değiştirilecek dosyalar

- `lib/hapbi/motor.ts`
- `lib/hapbi/soruPlani.ts`
- `lib/hapbi/gemini.ts`
- `app/api/hapbi/sor/route.ts`
### Yeni akış

kimlik
→ rol/kapsam
→ deterministik derleyici
→ netleştirme veya tarif
→ tek veri okuma
→ kanıt
→ doğrudan cevap / tek Gemini yorumu
### Kaldırılacak davranış

Gemini araç seçsin
→ ilk sorguyu çalıştırsın
→ sonucu okuyup ikinci sorguyu seçsin
→ üçüncü çağrıda cevap yazsın
### Kural

- Analitik sorular hiçbir koşulda eski function-calling yoluna düşmeyecek.
- Platform bilgisi veya eğitim içeriği gibi alanlar da önce kodla doğru kaynağa bağlanacak.
- Gemini gerekiyorsa yalnız hazırlanmış kaynak paketini açıklayacak.
### Çıkış koşulu

- Motor seviyesinde sayısal yol 0, yorum yolu en fazla 1 model çağrısı kullanacak.
## Faz 9 — Takipli konuşmanın kanonik sorguyla çalışması

Amaç: Kullanıcının önceki cevaba doğal biçimde devam edebilmesi.
### Saklanacak bağlam

- veri alanı
- dönem
- ölçütler
- `boyutlar`
- `filtreler`
- işlem
- sorgu tarifi
- gerçek varlık kimlikleri
### Saklanmayacak bağlam

- önceki sayılar
- önceki toplamlar
- ham veritabanı satırları
- başka kullanıcının kapsamı
### Örnek zincir

En yüksek ürün hangisi?
→ Semeril

Buna en çok katkı sağlayan UTT?
→ Semeril kimliği korunur, veri yeniden okunur.

Bu UTT’nin ürün dağılımı?
→ UTT kimliği korunur, yeni tarif çalıştırılır.
### Testler

- En az üç mesaj takip derinliği.
- Dönem değişikliği.
- Boyut değişikliği.
- Kullanıcı değişiminde bağlamın temizlenmesi.
- Sayfa değişiminde geçersiz bağlamın kullanılmaması.
- Önceki sayının canlı kaynak yerine kullanılmaması.
### Çıkış koşulu

- Takipli sayısal sorular da Gemini’siz çalışacak.
## Faz 10 — Güvenlik ve hata kapıları

Amaç: Hızlandırmanın yetki veya doğruluk açığı oluşturmaması.
### Kontroller

- İstemciden rol ve organizasyon kapsamı alınmaması.
- Soru metnindeki rol/firma/takım bilgisinin yetki kaynağı olmaması.
- Filtre kimliklerinin doğrulanmış varlıklardan gelmesi.
- drk ve diğer yöneticilerin yalnız kendi firmalarını görmesi.
- ik_drk ile drk ayrımının korunması.
- Eczanem uygulaması üyesinin reddedilmesi.
- Eksik verinin sıfır sayılmaması.
- RPC hatasının “veri yok” cevabına dönüşmemesi.
- HapBi üzerinden yazma, onay, sipariş veya yayın işlemi yapılmaması.
### Çıkış koşulu

- Yetki yükseltme ve firma dışı erişim testlerinin tamamı geçecek.
## Faz 11 — Otomatik test matrisi

Amaç: Mimariyi yalnız birkaç örnek rolle değil Bluebook’un tamamıyla doğrulamak.
### Test grupları

1. Bütün rol kodları ve kapsamları.
2. T-Club, C-Club, E-Club ve üretim.
3. Kişi, BM kapsamı, takım, firma, ürün, kategori, araç ve yayın.
4. Toplam, sıralama, fark, dağılım, katkı, karşılaştırma ve detay.
5. Sayısal, yorum, netleştirme, takip ve yetki reddi.
6. drk yönetici kapsamı.
7. ik_drk üretici kapsamı.
8. Mevcut 94 HapBi regresyon testi.
9. Yeni performans ve çağrı sayısı testleri.
### Zorunlu iddialar

sayisal.modelCagrisi === 0
sayisal.tokenSayisi === 0
yorum.modelCagrisi <= 1
rpcAyniKaynakCagrisi === 1
yanlisKapsamSayisi === 0
kanitsizSayiSayisi === 0
### Çıkış koşulu

- Bütün otomatik testler başarılı olmadan canlı geçiş yapılmayacak.
## Faz 12 — Canlı rol ve performans testi

Amaç: Gerçek Supabase ve gerçek Gemini koşullarında sonucu doğrulamak.
### Canlı sayısal test

- UTT
- BM
- TM
- PM ailesi
- med_md
- Eğitim ailesi
- İK ailesi
- GM
- DRK ve diğer yönetici ailesi
Rol vekâleti yapılmayacak. Canlı DRK hesabı yoksa DRK yerel/integrasyon testinden geçecek ancak canlı doğrulama “hesap bekliyor” olarak raporlanacak.
### Ölçülecek değerler

- `kimlik_ms`
- `niyet_ms`
- `kapsam_ms`
- `veritabani_ms`
- `toplulastirma_ms`
- `gemini_ms`
- `toplam_ms`
- `model_cagrisi`
- `token`
### Kabul hedefleri

| Yol | Gemini | Hedef |
|---|---:|---:|
| Sayısal | 0 | p95 < 1 saniye |
| Yorum | En fazla 1 | p95 < 5 saniye |
| Netleştirme | 0 | p95 < 200 ms |
| Yetki reddi | 0 | p95 < 200 ms |

### Çıkış koşulu

- Doğruluk ve kapsam hatası sıfır.
- Performans hedefleri sağlanmış.
- Sayısal sorular Gemini’ye gitmemiş.
## Faz 13 — Geçiş, temizlik ve Bluebook

Amaç: Yeni motoru güvenli biçimde etkinleştirmek ve eski yanlış mimariyi kaldırmak.
### Uygulama sırası

1. Yeni motor mevcut motorun yanında çalıştırılacak.
2. Aynı sorular eski ve yeni motorla karşılaştırılacak.
3. Yeni motorun doğruluk ve süre raporu sunulacak.
4. Onaydan sonra API route yeni motora geçirilecek.
5. Eski çok çağrılı analitik planlayıcı kaldırılacak.
6. Kullanılmayan araç tanımları ve test yardımcıları temizlenecek.
7. TypeScript, ESLint, regresyon ve canlı test tekrar çalıştırılacak.
8. Commit listesi sunulacak.
Bluebook’ta değiştirilmesi gereken mevcut hükümler ayrıca fark metni olarak sunulacak:
- “Gemini doğal dil amacını ve doğru aracı seçer.”
- “Serbest sorular çok araçlı Gemini döngüsünde işlenir.”
- “Üç model ve iki araç çağrısı üst sınırı.”
### Yeni hüküm

- Sayısal ve analitik sorgu planı deterministik kod tarafından hazırlanır.
- Sayısal cevap Gemini kullanılmadan oluşturulur.
- Yorum ve öneri, hazır kanıt paketi üzerinden en fazla tek Gemini çağrısıyla üretilir.
Bluebook değişikliği sizin açık onayınız olmadan uygulanmayacak.

