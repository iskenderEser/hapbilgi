'use client';

import { SadeKontrolButonu, SadeKontrolGrubu } from "@/components/kontrol/SadeKontroller";

import styles from '@/app/(panel)/raporlar/utt/utt-report.module.css';
import { useAuth } from '@/app/providers/AuthProvider';
import RaporPeriyotSecici from '@/components/raporlar/RaporPeriyotSecici';
import TemsilciSecici from '@/components/raporlar/TemsilciSecici';
import { PeriyotButonlari } from '@/components/ui/periyot-butonlari';
import { YenileButonu } from '@/components/ui/yenile-butonu';
import { useRapor } from '@/hooks/useRapor';
import { useRaporModulDurumu } from '@/hooks/useRaporModulDurumu';
import { raporBolumleriniSec } from '@/lib/rapor/paylasilan/eclubDurumu';
import type { DavranisHucre } from '@/lib/rapor/utt/getUttDavranis';
import type { UttKatki } from '@/lib/rapor/utt/getUttKatki';
import { type Periyot } from '@/lib/utils/raporUtils';
import { TUR_RAPOR_ADI, TUR_SIRA, type IcerikTuru } from '@/lib/video/icerikTuru';
import { ArrowLeft, BookOpenCheck, CheckCheck, CircleHelp, Clock3, FastForward, Repeat2, Send, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const ARACLAR = [{ key: 'tumu', label: 'Tümü' }, { key: 'video', label: 'Videolar' }, { key: 'podcast', label: 'Podcastler' }, { key: 'gorsel', label: 'Dijital Broşürler' }, { key: 'flip_pdf', label: 'Literatürler' }];
const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const oran = (pay: number, toplam: number) => toplam > 0 ? `%${fmt(pay / toplam * 100)}` : '—';
const sure = (n: number) => `${Math.floor(n / 60)} dk ${n % 60} sn`;
const DAVRANIS_SEKMELERI = [
  { key: 'tumu', ad: 'Tümü' },
  { key: 'kazandiranlar', ad: 'Kazandıranlar' },
  { key: 'kaybettirenler', ad: 'Kaybettirenler' },
] as const;
const GRUPLAR = [
  { key: 'kazandiranlar', ad: 'Kazandıranlar' },
  { key: 'kaybettirenler', ad: 'Kaybettirenler' },
];
const BOLUMLER = [
  { grup: 'kazandiranlar', ad: 'Yayın Tamamlama', icon: BookOpenCheck, aciklama: 'Yayın tamamlama performansı', rows: [['Yayın Tamamlama Puanı', 'tamamlama_puani'], ['Başlatılan oturum sayısı', 'baslayan'], ['Tamamlanan oturum sayısı', 'tamamlanan'], ['Puan alınan oturum sayısı', 'ilk_tamamlama'], ['Yarım kalan oturum sayısı', 'yarim']], agirlik: 'tamamlama' },
  { grup: 'kazandiranlar', ad: 'Cevaplama', icon: CheckCheck, aciklama: 'Doğru cevap performansı', rows: [['Cevaplama Puanı', 'cevaplama_puani'], ['Cevaplanan soru', 'cevaplanan'], ['Doğru cevap', 'dogru'], ['Doğru cevap oranı', 'dogru_oran'], ['Cevaplanmadan kalan soru', 'cevapsiz_soru']], agirlik: 'dogru' },
  { grup: 'kazandiranlar', ad: 'Öneri', icon: Send, aciklama: 'Önerileri tamamlama performansı', rows: [['Öneri Puanı', 'oneri_puani'], ['Gelen öneri', 'oneri_gelen'], ['Süresinde tamamlanan', 'oneri_zamaninda'], ['Bekleyen', 'oneri_bekleyen'], ['İleri sarılarak tamamlanan', 'oneri_sarilan']] },
  { grup: 'kazandiranlar', ad: 'Extra', icon: Repeat2, aciklama: 'Tekrar izleme performansı', rows: [['Extra Puanı', 'extra_puani'], ['Toplam Extra tamamlanan yayın sayısı', 'extra_tamamlanan_yayin'], ['Extra puan kazandıran toplam yayın sayısı', 'extra_puan_kazandiran_yayin'], ['İlk izlemeden sonra ikinci kez tamamlanmış yayınlar', 'tekrar_asama_2'], ['İlk izlemeden sonra bir kez tamamlanmış yayınlar', 'tekrar_asama_1']] },
  { grup: 'kazandiranlar', ad: 'E-Club', icon: Users, aciklama: 'Eclub üyelerinin öğrenme performansı', rows: [['Gönderilen öneri', 'eclub_gelen'], ['Ulaşılan farklı üye', 'eclub_uye'], ['Süresinde tamamlanan', 'eclub_zamaninda'], ['Bekleyen', 'eclub_bekleyen'], ['Süresi geçtikten sonra tamamlanan', 'eclub_gec'], ['Tamamlanmadan süresi dolan', 'eclub_doldu'], ['Dönemde UTT kazanımı oluşturan tamamlama', 'eclub_kazanim']] },
  { grup: 'kaybettirenler', ad: 'İleri sarma', icon: FastForward, aciklama: 'İçerik atlama davranışının süresi ve oturumlara dağılımı.', rows: [['İleri Sarma Puan Kaybı', 'ileri_sarma_kaybi'], ['İleri sarılan yayın sayısı', 'sarilan_oturum'], ['Onaylanan atlama', 'atlama'], ['Toplam atlanan süre', 'atlanan_saniye'], ['Atlanan süre / ilgili araçların toplam süresi', 'atlama_oran']] },
  { grup: 'kaybettirenler', ad: 'Yanlış cevap', icon: CircleHelp, aciklama: 'Cevaplama hatalarının sıklığı ve soruların puan ağırlığı.', rows: [['Yanlış Cevap Puan Kaybı', 'yanlis_cevap_kaybi'], ['Yanlış cevap', 'yanlis'], ['Yanlış cevap oranı', 'yanlis_oran']], agirlik: 'yanlis' },
  { grup: 'kaybettirenler', ad: 'Öneri kaybı', icon: Clock3, aciklama: 'Süresi geçen öneriler ile gerçekten ceza kaydı oluşan olaylar.', rows: [['Öneri Puan Kaybı', 'oneri_kaybi'], ['Tamamlanmadan süresi dolan öneri sayısı', 'oneri_doldu'], ['Süresi geçtikten sonra tamamlanan öneri sayısı', 'oneri_gec'], ['Puan kaybettiren öneri sayısı', 'oneri_ceza']] },
];

export default function DavranisRaporu({ rol }: { rol: 'utt' | 'bm' | 'tm' | 'yonetici' }) {
  const { kullanici, yukleniyor } = useAuth();
  const yonetici = rol === 'yonetici';
  const takimRolu = rol === 'tm' || yonetici;
  const [takimId, setTakimId] = useState('');
  const [gorunum, setGorunum] = useState<'rapor' | 'karsilastirma'>('rapor');
  const [ikinciId, setIkinciId] = useState('');
  const karsilastirma = rol !== 'utt' && gorunum === 'karsilastirma';
  const [bmId, setBmId] = useState('');
  const [temsilciId, setTemsilciId] = useState('');
  const takimGorunumu = takimRolu && !bmId;
  const bolgeGorunumu = (rol === 'bm' || (takimRolu && !!bmId)) && !temsilciId;
  const [periyot, setPeriyot] = useState<Periyot>('bu_hafta');
  const [kategori, setKategori] = useState<IcerikTuru>('urun');
  const [arac, setArac] = useState<string>('tumu');
  const [davranis, setDavranis] = useState<(typeof DAVRANIS_SEKMELERI)[number]['key']>('tumu');
  const aktifTemsilciId = takimRolu && karsilastirma ? '' : temsilciId;
  const ilkKisiId = takimRolu ? bmId : temsilciId;
  const raporSorgusu = rol !== 'utt' ? `${periyot}&temsilci=${encodeURIComponent(aktifTemsilciId)}${takimRolu ? `&bm=${encodeURIComponent(bmId)}` : ''}${yonetici ? `&takim=${encodeURIComponent(takimId)}` : ''}${karsilastirma ? `&karsilastir=${encodeURIComponent(ikinciId)}` : ''}` : periyot;
  const { eclubAcik, hata: modulHatasi, yenile: modulYenile } = useRaporModulDurumu(`/raporlar/api/${rol}`, kullanici?.id, raporSorgusu);
  const { data: yanit, loading, yenileniyor, error, yenile } = useRapor<{ hucreler: DavranisHucre[]; baslangic: string; bitis: string; katki: UttKatki; karsilastirma?: { hucreler: DavranisHucre[]; katki: UttKatki; temsilciId: string; bmId?: string; temsilciSayisi?: number; kisiBasiNetPuan?: number | null }; temsilciSayisi?: number; kisiBasiNetPuan?: number | null; takimId?: string; takimlar?: Array<{ id: string; ad: string }>; bmId?: string; bmler?: Array<{ kullanici_id: string; ad: string; soyad: string; altBilgi?: string }>; temsilciId?: string; temsilciler?: Array<{ kullanici_id: string; ad: string; soyad: string }> }>(`/raporlar/api/${rol}`, raporSorgusu, kullanici?.id, { onbellekSuresi: rol !== 'utt' ? 30_000 : 0, yenileParametresi: rol !== 'utt' });
  const raporuYenile = () => { yenile(); void modulYenile(); };
  const takimVerisiHazir = !yonetici || !takimId || yanit?.takimId === takimId;
  const raporHatasi = error ?? modulHatasi;
  const gorunurBolumler = raporBolumleriniSec(BOLUMLER, eclubAcik === true);
  // Yeni temsilci yüklenirken önceki kişinin verilerini yeni isim altında göstermeyiz.
  const data = (yonetici && takimId && yanit?.takimId !== takimId) || (karsilastirma && (takimRolu ? yanit?.karsilastirma?.bmId : yanit?.karsilastirma?.temsilciId) !== ikinciId) || (rol !== 'utt' && yanit?.temsilciId !== aktifTemsilciId) || (takimRolu && yanit?.bmId !== bmId) ? null : yanit;
  const hucreler = data?.hucreler.filter(h => h.kategori === kategori && h.arac === arac) ?? [];
  const d: Record<string, number> = {};
  // Farklı üyeler araçlar arasında tekrar edebilir; sunucu birleşik hücreyi sağlar.
  for (const h of hucreler) for (const [k, v] of Object.entries(h.degerler)) d[k] = (d[k] ?? 0) + v;
  const goster = (key: string, veriler = d) => key.endsWith('_kaybi') ? ((veriler[key] ?? 0) > 0 ? `−${fmt(veriler[key])}` : '0')
    : key === 'dogru_oran' ? oran(veriler.dogru ?? 0, veriler.cevaplanan ?? 0)
    : key === 'yanlis_oran' ? oran(veriler.yanlis ?? 0, veriler.cevaplanan ?? 0)
    : key === 'atlama_oran' ? (veriler.suresi_bilinmeyen_oturum ? '—' : oran(veriler.atlanan_saniye ?? 0, veriler.sarilan_arac_saniye ?? 0))
    : key === 'atlanan_saniye' ? sure(veriler[key] ?? 0) : fmt(veriler[key] ?? 0);
  const ikinciD: Record<string, number> = {};
  for (const h of data?.karsilastirma?.hucreler.filter(h => h.kategori === kategori && h.arac === arac) ?? []) for (const [key, value] of Object.entries(h.degerler)) ikinciD[key] = (ikinciD[key] ?? 0) + value;
  const karsilastirmaKisileri = !takimVerisiHazir ? [] : takimRolu ? yanit?.bmler ?? [] : yanit?.temsilciler ?? [];
  const isim = (id: string, varsayilan: string) => { const kisi = karsilastirmaKisileri.find(k => k.kullanici_id === id); return kisi ? `${kisi.ad} ${kisi.soyad}` : varsayilan; };
  const ilkAd = isim(ilkKisiId, takimRolu ? 'Bölge Müdürü 1' : 'Temsilci 1');
  const ikinciAd = isim(ikinciId, takimRolu ? 'Bölge Müdürü 2' : 'Temsilci 2');
  const karsilastirmaSecildi = !!ilkKisiId && !!ikinciId;
  const bekliyor = yukleniyor || (!data && loading);
  return <div className={styles.page} style={{ fontFamily: "'Nunito', sans-serif" }}>
    <div className={styles.container}>
      <Link href="/ana-sayfa" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#7890aa]"><ArrowLeft size={14} /> Ana Sayfa</Link>
      <header className={styles.header}>
        <div><h1 className="text-2xl font-extrabold tracking-tight text-[#10213d]">T-Club Raporları</h1><p className="mt-1 text-xs font-semibold text-[#78889d]">{karsilastirma ? takimRolu ? 'İki bölgenin temsilcilerinin öğrenme davranışlarını karşılaştırın.' : 'Bölgenizdeki iki temsilcinin öğrenme davranışlarını karşılaştırın.' : takimGorunumu ? yonetici ? 'Seçili takımın lig sonucunu oluşturan öğrenme davranışları.' : 'Takımınızın lig sonucunu oluşturan öğrenme davranışları.' : bolgeGorunumu ? 'Bölgenizin lig sonucunu oluşturan öğrenme davranışları.' : rol !== 'utt' ? 'Seçili temsilcinin lig sonucunu oluşturan öğrenme davranışları.' : 'Lig sonucunu oluşturan öğrenme davranışlarınız.'}</p></div>
        <YenileButonu onYenile={raporuYenile} yenileniyor={loading || yenileniyor} />
      </header>
      {yonetici && (yanit?.takimlar?.length ?? 0) > 1 && <div className="mb-5 flex min-w-0 justify-end"><SadeKontrolGrubu tur="kapsul" aria-label="Rapor takımı" className="min-w-0 max-w-full">
        {yanit?.takimlar?.map(takim => <SadeKontrolButonu key={takim.id} type="button" aria-pressed={(takimId || yanit?.takimId) === takim.id} onClick={() => { setTakimId(takim.id); setBmId(''); setTemsilciId(''); setIkinciId(''); }}>{takim.ad}</SadeKontrolButonu>)}
      </SadeKontrolGrubu></div>}
      {yonetici && yanit?.takimlar?.length === 0 && <p className="mb-5 text-sm text-[#667e98]">Firma kapsamında takım bulunamadı.</p>}
      {karsilastirma ? <section className="mb-5 grid grid-cols-2 gap-2" aria-label={takimRolu ? 'Karşılaştırılan bölgeler' : 'Karşılaştırılan temsilciler'} aria-busy={loading || yenileniyor}>
        {[{ ad: ilkAd, puan: data?.katki.netPuan, sayi: data?.temsilciSayisi, ortalama: data?.kisiBasiNetPuan }, { ad: ikinciAd, puan: data?.karsilastirma?.katki.netPuan, sayi: data?.karsilastirma?.temsilciSayisi, ortalama: data?.karsilastirma?.kisiBasiNetPuan }].map((k, i) => <div key={i} className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 md:p-5" style={{ borderLeft: `3px solid ${i ? '#7c5ce7' : '#237ac8'}` }}>
          <h2 className="mb-2 truncate text-xs font-bold text-gray-400" title={k.ad}>{k.ad}</h2>
          <div className="text-2xl font-extrabold leading-none text-gray-900 tabular-nums md:text-3xl">{k.puan != null ? fmt(k.puan) : '—'}</div>
          <p className="mt-1.5 text-xs text-gray-500">{takimRolu ? 'Bölge Net Puanı' : 'Net Puan'}</p>
          {takimRolu && <div className="mt-2 space-y-1 text-xs text-[#667e98]"><p>Temsilci sayısı: <strong>{k.sayi != null ? fmt(k.sayi) : '—'}</strong></p><p>Temsilci başına net puan: <strong>{k.ortalama != null ? fmt(k.ortalama) : '—'}</strong></p></div>}
        </div>)}
      </section> : <>
      <section className={`mb-5 grid grid-cols-1 gap-2 ${takimGorunumu ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`} aria-label={takimGorunumu ? 'Takım net puanı ve katkısı' : bolgeGorunumu ? 'Bölge net puanı ve katkıları' : 'Net puan katkınız'} aria-busy={loading || yenileniyor}>
        {(takimGorunumu ? [{ key: 'takim' as const, ad: 'Takım Net Puanı', renk: '#237ac8' }, { key: 'firma' as const, ad: 'Firma Katkısı', renk: '#059669' }] : [{ key: 'bolge' as const, ad: bolgeGorunumu ? 'Bölge Net Puanı' : 'Bölge Katkısı', renk: '#237ac8' }, { key: 'takim' as const, ad: 'Takım Katkısı', renk: '#7c5ce7' }, { key: 'firma' as const, ad: 'Firma Katkısı', renk: '#059669' }]).map(kart => {
          const katki = data?.katki?.[kart.key];
          const netKart = (takimGorunumu && kart.key === 'takim') || (bolgeGorunumu && kart.key === 'bolge');
          return <div key={kart.key} className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 md:p-5" style={{ borderLeft: `3px solid ${kart.renk}` }}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{kart.ad}</h2>
            <div className="text-2xl font-extrabold leading-none text-gray-900 tabular-nums md:text-3xl">{netKart ? (data ? fmt(data.katki.netPuan) : '—') : katki?.yuzde != null ? `%${fmt(katki.yuzde)}` : '—'}</div>
            <p className="mt-1.5 min-h-4 text-xs text-gray-500 tabular-nums">{netKart ? takimGorunumu ? yonetici ? 'Seçili takımdaki temsilcilerin toplamı' : 'Takımınızdaki temsilcilerin toplamı' : 'Bölgenizdeki temsilcilerin toplamı' : katki && data ? `${fmt(data.katki.netPuan)} / ${fmt(katki.toplam)} net puan` : '\u00a0'}</p>
          </div>;
        })}
      </section>
      </>}
      {rol !== 'utt' && <SadeKontrolGrubu role="tablist" aria-label="Rapor görünümü" tur="sekme" className={styles.controlTabs}>
        {([{ key: 'rapor', ad: 'Rapor' }, { key: 'karsilastirma', ad: 'Karşılaştırma' }] as const).map(m => <SadeKontrolButonu key={m.key} type="button" role="tab" aria-selected={gorunum === m.key} onClick={() => setGorunum(m.key)}>{m.ad}</SadeKontrolButonu>)}
      </SadeKontrolGrubu>}
      <SadeKontrolGrubu role="tablist" aria-label="Eğitim kategorisi" tur="sekme" className={styles.controlTabs}>
        {TUR_SIRA.map(t => <SadeKontrolButonu key={t} role="tab" aria-selected={kategori === t} onClick={() => setKategori(t)}>{TUR_RAPOR_ADI[t]}</SadeKontrolButonu>)}
      </SadeKontrolGrubu>
      <div className={`${styles.filters} ${rol !== 'utt' ? styles.filtersWithScope : ''}`}>
        <PeriyotButonlari ariaLabel="Yayın türü" secenekler={ARACLAR} deger={arac} onDegistir={setArac} />
        <RaporPeriyotSecici deger={periyot} onDegistir={setPeriyot} />
      </div>
        {rol !== 'utt' && <div className={styles.scopeRow}>
          {takimRolu && !karsilastirma && <div className={styles.scopePicker}><TemsilciSecici temsilciler={takimVerisiHazir ? yanit?.bmler ?? [] : []} disabled={!takimVerisiHazir} deger={bmId} onDegistir={id => { setBmId(id); setTemsilciId(''); }} genelAdi="Tüm Bölgeler" etiket="Bölge Müdürleri" adOneki="BM " aramaEtiketi="Bölge müdürü adıyla ara" /></div>}
          {karsilastirma ? <>
            <div className={styles.scopePicker}><TemsilciSecici temsilciler={karsilastirmaKisileri.filter(k => k.kullanici_id !== ikinciId)} deger={ilkKisiId} onDegistir={takimRolu ? id => { setBmId(id); setTemsilciId(''); } : setTemsilciId} genelAdi={takimRolu ? 'Bölge Müdürü 1' : 'Temsilci 1'} etiket={takimRolu ? 'Bölge Müdürü 1' : 'Temsilci 1'} adOneki={takimRolu ? 'BM ' : ''} aramaEtiketi={takimRolu ? 'Bölge müdürü adıyla ara' : 'Temsilci adıyla ara'} /></div>
            <div className={styles.scopePicker}><TemsilciSecici temsilciler={karsilastirmaKisileri.filter(k => k.kullanici_id !== ilkKisiId)} deger={ikinciId} onDegistir={setIkinciId} genelAdi={takimRolu ? 'Bölge Müdürü 2' : 'Temsilci 2'} etiket={takimRolu ? 'Bölge Müdürü 2' : 'Temsilci 2'} adOneki={takimRolu ? 'BM ' : ''} aramaEtiketi={takimRolu ? 'Bölge müdürü adıyla ara' : 'Temsilci adıyla ara'} /></div>
          </> : <>
          <div className={styles.scopePicker}><TemsilciSecici temsilciler={takimRolu && yanit?.bmId !== bmId ? [] : yanit?.temsilciler ?? []} deger={temsilciId} onDegistir={setTemsilciId} genelAdi="Tüm Temsilciler" etiket="Temsilciler" disabled={takimRolu && (!bmId || yanit?.bmId !== bmId)} /></div></>}

        </div>}
      <SadeKontrolGrubu role="tablist" aria-label="Davranış grubu" tur="sekme">
        {DAVRANIS_SEKMELERI.map((sekme, index) => <SadeKontrolButonu key={sekme.key} type="button" role="tab" id={`davranis-tab-${sekme.key}`} aria-selected={davranis === sekme.key} aria-controls="rapor-davranis-panel" tabIndex={davranis === sekme.key ? 0 : -1} onClick={() => setDavranis(sekme.key)} onKeyDown={event => {
            const yon = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!yon && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const hedef = event.key === 'Home' ? 0 : event.key === 'End' ? DAVRANIS_SEKMELERI.length - 1
              : (index + yon + DAVRANIS_SEKMELERI.length) % DAVRANIS_SEKMELERI.length;
            setDavranis(DAVRANIS_SEKMELERI[hedef].key);
            event.currentTarget.parentElement?.querySelectorAll('button')[hedef]?.focus();
          }}>{sekme.ad}</SadeKontrolButonu>)}
      </SadeKontrolGrubu>
      {raporHatasi && <div role="alert" className="mt-5 mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{raporHatasi}<button onClick={raporuYenile} className="ml-3 font-bold underline">Tekrar dene</button></div>}
      {karsilastirma && !karsilastirmaSecildi && <p className="mt-5 rounded-xl border border-[#dbe5ef] bg-white p-5 text-sm text-[#667e98]">{takimRolu ? 'Karşılaştırmak için iki bölge müdürü seçiniz.' : 'Karşılaştırmak için iki temsilci seçiniz.'}</p>}
      {(!karsilastirma || karsilastirmaSecildi) && (bekliyor || data) && <div className="pt-5" id="rapor-davranis-panel" role="tabpanel" aria-labelledby={`davranis-tab-${davranis}`} aria-busy={loading || yenileniyor}>
        {GRUPLAR.filter(grup => davranis === 'tumu' || grup.key === davranis).map(grup => <section key={grup.key} aria-label={grup.ad} className={styles.behaviorGroup}>
          {davranis === 'tumu' && <h2 className={styles.behaviorGroupTitle}>{grup.ad}</h2>}
          <div className={styles.analysisGrid}>
            {gorunurBolumler.filter(b => b.grup === grup.key).map(b => bekliyor
              ? <div key={b.ad} className={`${styles.panel} h-64 animate-pulse bg-slate-50`} />
              : <section key={b.ad} className={`${styles.panel} ${styles.behaviorCard}`}>
          <div className={styles.sectionHeader}><div><h3 className="text-base font-extrabold text-[#203653]">{b.ad}</h3><p className="mt-1 text-xs font-bold leading-5 text-[#7b8da3]">{b.aciklama}</p></div><span className={styles.sectionIcon}><b.icon size={18} /></span></div>
          {karsilastirma ? <table className={styles.comparisonTable}>
            <thead><tr><th scope="col"><span className="sr-only">Ölçüt</span></th><th scope="col">{ilkAd}</th><th scope="col">{ikinciAd}</th></tr></thead>
            <tbody>{b.rows.map(([ad, key]) => <tr key={key}><th scope="row">{ad}</th><td>{goster(key)}</td><td>{goster(key, ikinciD)}</td></tr>)}</tbody>
          </table> : <dl>{b.rows.map(([ad, key]) => <div key={key} className={styles.behaviorRow}><dt>{ad}</dt><dd>{goster(key)}</dd></div>)}</dl>}

          {b.agirlik && <div className={styles.weights}><p className="mb-2 text-[11px] font-bold text-[#7b8da3]">{b.agirlik === 'tamamlama' ? 'Tamamlanan öğrenme araçlarının puan ağırlığı sayısı' : b.agirlik === 'dogru' ? 'Doğru cevap sayıları ve puanları' : 'Yanlış cevap sayıları ve puanları'}</p><div className={karsilastirma ? styles.comparisonWeights : undefined}>{(karsilastirma ? [{ ad: ilkAd, degerler: d }, { ad: ikinciAd, degerler: ikinciD }] : [{ ad: '', degerler: d }]).map((k, i) => <div key={i}>{karsilastirma && <p className="mb-2 text-xs font-bold text-[#203653]">{k.ad}</p>}<div className="flex flex-wrap gap-2">{Object.entries(k.degerler).filter(([k, v]) => k.startsWith(`${b.agirlik}_agirlik_`) && v > 0).sort(([a], [z]) => Number(a.split('_').at(-1)) - Number(z.split('_').at(-1))).map(([k, v]) => <span key={k} className={styles.weightPill}>{b.agirlik === 'tamamlama' ? `${k.split('_').at(-1)} puanlık · ${fmt(v)} yayın` : `${fmt(v)} cevap ${k.split('_').at(-1)}'er puanlık`}</span>)}{!Object.keys(k.degerler).some(k => k.startsWith(`${b.agirlik}_agirlik_`)) && <span className="text-xs text-[#8a9aaf]">Bu seçimde kayıt yok.</span>}</div></div>)}</div></div>}
              </section>)}
          </div>
        </section>)}
      </div>}
    </div>
  </div>;
}
