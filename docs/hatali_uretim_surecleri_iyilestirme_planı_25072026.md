# Hatalı Üretim Süreçleri İyileştirme Planı — 25.07.2026

**Durum:** İskender onayladı (25.07.2026). Uygulama başladı.
**Kapsam:** Üretim zincirinin yarım kaldığı iki bozukluğun kalıcı düzeltmesi.
**Kapsam dışı:** Talep Durum Tablosu mesaj sözlüğü yenilemesi — ayrı iş, bu plan bitince dönülecek (bkz. §6).

---

## 1. Bozukluklar nasıl bulundu

İskender'in 24.07 tarihli `egt_md` fiziksel testinde hazır video akışında bir tuhaflık sezildi.
İzi sürülürken Talep Durum Tablosu'nun durum mesajlarının bilgi vermediği ortaya çıktı; mesaj
tasarımı için yapılan akış keşfi sırasında iki yapısal bozukluk tespit edildi.

### Bozukluk 1 — Hazır zincir yarım kalırsa talep kalıcı kilitlenir

Hazır video + hazır soru seti talebinde, hazır setteki soru adedi talepteki
`soru_seti_buyuklugu` ile uyuşmazsa:

1. `hazirVideoGir` önce videoyu ve onaylı durum kaydını yazar,
2. sonra `hazirSoruSetiGir` parametre kilidine takılıp hata döner,
3. route telafi olarak **yalnız** `talepler.hazir_video_url` alanını geri alır
   (`app/talepler/api/hazir-video/route.ts:79`) — video kaydı ve onaylı durumu DB'de kalır,
4. üretici yeniden yüklediğinde `hazirVideoBul` mevcut videoyu bulur, route sadece adresi
   günceller ve erken döner (`route.ts:56-64`) — **soru seti bir daha asla doğmaz.**

Sonuç: talep soru seti aşamasında asılı kalır. Ne İÜ'ye iş düşer ne yayına alınabilir.
Elle DB müdahalesi olmadan çıkışı yoktur.

Kök neden iki katmanlı: (a) uyumsuz hazır set talep oluşturulurken hiç engellenmiyor —
`app/talepler/api/route.ts` yalnız `soru_seti_buyuklugu`, `secenek_sayisi` ve
`video_basi_soru_sayisi` doğruluyor, hazır set uzunluğunu doğrulamıyor; (b) zincir kurulumu
"eksik halkayı tamamla" değil "baştan kur ya da çık" mantığında.

### Bozukluk 2 — Sıradaki iş doğmazsa kimse haberdar olmaz

Senaryo onaylanınca video kabuğu, video onaylanınca soru seti kabuğu otomatik doğar
(`lib/uretim/surec.ts:44`, `lib/uretim/surec.ts:85`). Bu doğum bir DB hatasıyla başarısız olursa:

- **Senaryo ucunda** sistem kimseye hiçbir şey söylemez; yalnız `console.error` yazar
  (`app/senaryolar/api/durum/route.ts:99-104`). Üretici "onayladım" der ve bekler, İÜ'ye
  bildirim gitmez.
- **Video ucunda** üreticiye `[SİSTEM]` bildirimi gider (`app/videolar/api/durum/route.ts:136`)
  ama onay geri alınmaz — talep yine ölü kalır.

Her iki uçta da ekranda "Video Bekleniyor" / "Soru Seti Bekleniyor" görünür; ortada bekleyen
bir iş yokken bekleniyormuş gibi okunur.

**Ortak sonuç:** ikisi de aynı şeyi üretiyor — üretim hattında *görünen* ama hiç kimsenin
iş listesinde *olmayan* ölü talep.

---

## 2. Adım 0 — Teşhis (İskender koşar, salt okuma)

Etkilenen canlı kayıtları tespit etmek için. Çıktılar Adım 3'ü belirler.

```sql
-- A) Senaryo onaylı ama video kaydı hiç doğmamış (Bozukluk 2)
select t.talep_no, t.talep_id, sd.senaryo_durum_id, sd.created_at
from senaryo_durumu sd
join senaryolar s on s.senaryo_id = sd.senaryo_id
join talepler   t on t.talep_id  = s.talep_id
left join videolar v on v.senaryo_durum_id = sd.senaryo_durum_id
where sd.durum = 'onaylandi' and v.video_id is null
order by sd.created_at desc;
```

```sql
-- B) Video onaylı ama soru seti hiç doğmamış (Bozukluk 1 + 2)
select t.talep_no, t.talep_id, t.hazir_video, t.hazir_soru_seti,
       t.soru_seti_buyuklugu,
       jsonb_array_length(coalesce(t.hazir_soru_seti_verisi, '[]'::jsonb)) as hazir_soru_adedi,
       v.kaynak, vd.video_durum_id, vd.created_at
from video_durumu vd
join videolar v on v.video_id  = vd.video_id
join talepler t on t.talep_id = v.talep_id
left join soru_setleri ss on ss.video_durum_id = vd.video_durum_id
where vd.durum = 'onaylandi' and ss.soru_seti_id is null
order by vd.created_at desc;
```

```sql
-- C) Hazır video kaydı var ama onaylı durumu yok (zincir 2. adımda kopmuş)
select t.talep_no, t.talep_id, t.hazir_video_url is not null as url_var,
       v.video_id, v.created_at
from videolar v
join talepler t on t.talep_id = v.talep_id
left join video_durumu vd on vd.video_id = v.video_id
where v.kaynak = 'hazir' and vd.video_durum_id is null
order by v.created_at desc;
```

---

## 3. Adım 1 — Bozukluk 1 düzeltmesi (1 commit)

**İlke:** yarım zincir doğmasın; doğduysa yeniden yüklemede kendiliğinden tamamlansın.

| # | Dosya | Değişiklik |
|---|---|---|
| 1.1 | `app/talepler/api/route.ts` | Talep oluşturulurken hazır set uzunluğu doğrulansın (`hazir_soru_seti_verisi.length === soru_seti_buyuklugu`). Kural girdide uygulanır — uyumsuz talep DB'ye hiç girmesin. |
| 1.2 | `lib/uretim/surec.ts` → `hazirVideoGir` | Parametre kontrolü **en başa** alınsın, hiçbir yazma yapılmadan önce. Hata varsa tek satır bile oluşmaz. |
| 1.3 | `lib/uretim/surec.ts` → `hazirVideoGir` | "Eksik halkayı tamamla" mantığına dönsün: video var mı → yoksa aç / varsa adresi güncelle; onaylı durum var mı → yoksa ekle; soru seti var mı → yoksa hazır seti işle ya da İÜ kabuğu aç + bildirim. Var olan halka atlanır, bildirim mükerrer gitmez. |
| 1.4 | `app/talepler/api/hazir-video/route.ts` | "Video zaten var → sadece adresi güncelle ve çık" erken dönüşü kaldırılsın; iş tamamen süreç modülüne bırakılsın. |

**Kazanım:** kilitli kayıt, üretici yeniden yükleyince DB müdahalesi olmadan açılır
(hazır set verisi de uyumluysa).

---

## 4. Adım 2 — Bozukluk 2 düzeltmesi (1 commit)

**İlke:** onay ya tam olur ya hiç olmaz.

| # | Dosya | Değişiklik |
|---|---|---|
| 2.1 | `app/senaryolar/api/durum/route.ts` | Onayda video kabuğu açılamazsa: az önce yazılan `senaryo_durumu` satırı silinsin, üreticiye "Onay tamamlanamadı — sıradaki iş açılamadı, lütfen tekrar deneyin." hatası dönsün. |
| 2.2 | `app/videolar/api/durum/route.ts` | Normal hatta aynı desen — soru seti kabuğu açılamazsa onay geri alınsın. |
| 2.3 | `lib/uretim/surec.ts` → `hazirSoruSetiGir` | Set eklendikten sonra durum kaydı başarısız olursa fonksiyon kendi eklediği seti temizlesin; çağıran yalnız `video_durumu`'nu geri alsın (FK güvenli sıra). |
| 2.4 | Her iki route | Temizlik de başarısız olursa mevcut `[SİSTEM]` bildirim deseni korunsun — sessizlik hiçbir dalda kalmasın. |

**Kazanım:** üretici "onayladım" deyip beklemez; ya iş ilerler ya da anında hata görüp tekrar
dener. Ölü talep üretilmez.

---

## 5. Adım 3 — Canlı kayıt onarımı

Adım 0 çıktısına göre belirlenir.

- Kayıt Adım 1 ile kendiliğinden açılıyorsa SQL'e gerek yok.
- Açılmıyorsa onarım SQL'i **tek tek** verilir, İskender koşar (riskli canlı DB kuralı).

---

## Doğrulama ve commit disiplini

- Bir bozukluk = bir commit. Her commit sonrası `tsc` + `npm run denetim` + `npm run lint:mimari`.
- Adım 1 smoke: 1 mutlu yol (hazır video + hazır set yükleme → set otomatik onaylı) +
  1 red (uyumsuz set adedi → talep oluşturulamaz).
- Adım 2 için smoke yok; hata dalını tetiklemek canlı DB kesintisi gerektirir. Kod okuması yeterli.
- Şema değişikliği yok, migration yok.

---

## 6. Bu plan bitince dönülecek iş — Durum mesajı sözlüğü

Talep Durum Tablosu'nun Durum sütunundaki mesajlar bilgi vermiyor: "Devam Ediyor" hem
"İÜ'nün elinde" hem "iptal edildi" anlamına geliyor; "Durduruldu" planlanmış yayını da yutuyor;
"Video Bekleniyor" normal kolda hiç çıkmıyor, hazır kolda ise üreticinin kendi işini gösteriyor.

Üretici rolü için üzerinde mutabık kalınan sözlük (uygulama bu plandan sonra):

| Mesaj | Ne zaman | Top |
|---|---|---|
| `İçerik Üreticisine İletildi` | İş İÜ tarafına geçti, henüz elini sürmedi (`iu_id` NULL) | İÜ |
| `İçerik Üreticisi Hazırlıyor` | Bir İÜ üzerinde çalışıyor (`iu_id` dolu, teslim yok) | İÜ |
| `İçerik Üreticisi Düzeltiyor` | Revizyon istendi, düzeltiliyor | İÜ |
| `Sizde: Onay Bekliyor` | İÜ teslim etti | Üretici |
| `Sizde: Video Yükle` | Hazır video, yükleme üreticide | Üretici |
| `Sizde: Yayına Al` | Set onaylı, yayın kaydı yok | Üretici |
| `Planlandı · 28 Tem` | İleri tarihli yayın, sistem 07:00'de açacak | Sistem |
| `Yayında` | Canlı | — |
| `Yayın Durduruldu` | Yayın durduruldu | Üretici |
| `İptal Ettiniz` | İş iptal edildi | — |
| `Sistem Hatası` | Zincir kurulamadı | Yönetim |

Kararlar: ön ek kalır (K1); "Üstlenilmedi" yerine "İçerik Üreticisine İletildi" (K2);
iptal satırı tabloda kalır, etiketi "İptal Ettiniz" (K3); dil *siz* formunda.

Açık soru: rol adı bugün her yerde "İçerik Uzmanı" (`lib/utils/roller.ts:229`). Durum
mesajları "İçerik Üreticisi" diyecekse rol adının da değişip değişmeyeceği kararı bekliyor.

Sonrasında aynı çalışma İU rolü için ayrıca yapılacak.
