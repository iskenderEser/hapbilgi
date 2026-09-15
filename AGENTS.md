<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Zorunlu KVKK yurt dışı veri aktarımı kontrolü

Her yeni çalışma oturumunun başında `docs/hukuki/KVKK_YURTDISI_VERI_AKTARIMI_TAKIP.md` dosyasını oku. Dosyadaki durum `TAMAMLANDI` değilse kullanıcıya bir kez şu soruyu yönelt: “Supabase ile Türkiye KVKK Standart Sözleşme-2 sürecinde yeni bir gelişme var mı?” Kullanıcının verdiği güncel bilgiyi takip dosyasına işle. İmzalı sözleşme ve KVKK bildirim kaydı görülmeden durumu `TAMAMLANDI` olarak değiştirme. Bu kontrol, kullanıcının asıl talebi üzerindeki çalışmayı engellemez.

## İkinci zorunlu hatırlatma: E-Club çek teslimatı

E-Club'da puan karşılığı çekler eczacıya e-posta ile gönderilir; ayrıca çek bilgisi, E-Club üyesi olan ve ilgili eczanede çalışan herkesin HapBilgi hesabına push notification olarak gönderilir. Bu davranışı ilgili her geliştirme ve incelemede tekrar irdele; mevcut uygulamanın bu iş kuralını gerçekten sağladığını kod ve veri akışı üzerinden doğrulamadan doğru kabul etme.
