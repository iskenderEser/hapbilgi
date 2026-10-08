import type { SiparisTakipTalebi } from "@/lib/eclub/hediyeTakip/siparisTakip";
import { depoOzetParcalari } from "@/lib/eclub/depo";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";
import { ogrenmeAraciMetinleri } from "@/lib/ogrenmeAraci/etiketler";

const DURUM_ETIKETLERI = {
  inceleme_bekliyor: "UTT İncelemesi Bekliyor",
  utt_onayladi: "BM Onayı Bekliyor",
  bm_onayladi: "BM Onayladı",
  talep_iptal: "Onaya Kapalı",
} as const;

const DURUM_SINIFLARI = {
  inceleme_bekliyor: "border-amber-200 bg-amber-50 text-amber-700",
  utt_onayladi: "border-emerald-200 bg-emerald-50 text-emerald-700",
  bm_onayladi: "border-emerald-200 bg-emerald-50 text-emerald-700",
  talep_iptal: "border-red-200 bg-red-50 text-red-700",
} as const;

function tarih(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function siparisTercihi(talep: SiparisTakipTalebi): string {
  return talep.siparis.tipi === "satis_sartli" ? "Zorunlu" : "Tercihli";
}

const tercihYok = "Tercih bulunmuyor";

interface DepoTercihSatiri {
  depo: string;
  sube: string;
}

function depoTercihSatirlari(talep: SiparisTakipTalebi): DepoTercihSatiri[] {
  const detaylar = talep.depo_tercih_detaylari;
  if (!detaylar?.length) {
    return talep.depo_tercihleri.length
      ? talep.depo_tercihleri.map((depo) => ({ depo, sube: "—" }))
      : [{ depo: tercihYok, sube: tercihYok }];
  }
  return detaylar.map((tercih) => {
    const ozet = depoOzetParcalari(tercih);
    return { depo: ozet.depo, sube: ozet.sube ?? "—" };
  });
}

function TercihListesi({ satirlar, alan }: { satirlar: DepoTercihSatiri[]; alan: keyof DepoTercihSatiri }) {
  return <div className="grid gap-1.5">{satirlar.map((satir, index) => (
    <div key={`${index}-${satir[alan]}`} className="min-h-5 break-words">{satir[alan]}</div>
  ))}</div>;
}

function OnayButonu({ talep, islemde, onOnayla }: { talep: SiparisTakipTalebi; islemde: boolean; onOnayla: (id: string) => void }) {
  if (talep.utt) {
    if (!talep.onaylanabilir_mi) return <span className="text-[#9aa8b8]">—</span>;
    return <button type="button" disabled={islemde} onClick={() => onOnayla(talep.talep_id)} className="inline-flex whitespace-nowrap rounded-full border border-[#237ac8] bg-[#237ac8] px-2.5 py-1 text-[10px] font-extrabold text-white hover:bg-[#1d69ad] disabled:opacity-60">
      {islemde ? "Onaylanıyor..." : "Siparişi Onayla"}
    </button>;
  }
  if (!talep.onaylanabilir_mi) {
    if (talep.bm_onay_tarihi) return <span className="font-extrabold text-emerald-700">BM Onayladı</span>;
    return talep.utt_onay_tarihi
      ? <span className="font-extrabold text-emerald-700">Onaylandı</span>
      : <span className="text-[#9aa8b8]">—</span>;
  }
  return <button type="button" disabled={islemde} onClick={() => onOnayla(talep.talep_id)} className="min-h-9 rounded-xl border border-[#bfdbfe] bg-[#eaf4ff] px-3 text-[11px] font-extrabold text-[#1d4ed8] hover:bg-[#dbeafe] disabled:opacity-60">
    {islemde ? "Onaylanıyor..." : "Siparişi Onayla"}
  </button>;
}

function SiparisDurumu({ talep }: { talep: SiparisTakipTalebi }) {
  return <span title={talep.durum === "talep_iptal" ? "İlgili çek talebi iptal edildiği için sipariş onayına kapalıdır." : undefined} className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${DURUM_SINIFLARI[talep.durum]}`}>
    {DURUM_ETIKETLERI[talep.durum]}
  </span>;
}

function SiparisKarti({ talep, islemde, onOnayla, uttGoster, saltOkunur }: { talep: SiparisTakipTalebi; islemde: boolean; onOnayla: (id: string) => void; uttGoster: boolean; saltOkunur: boolean }) {
  const depoSatirlari = depoTercihSatirlari(talep);
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm">
    <h3 className="break-words text-sm font-extrabold text-[#203653]">{talep.urun.urun_adi}</h3>
    <p className="mt-1 text-xs font-bold text-[#60758d]">{talep.eczane.eczane_adi}{talep.eczane.gln ? ` · GLN ${talep.eczane.gln}` : ""}</p>
    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#40556d]">
      {uttGoster && <div className="col-span-2"><dt className="font-bold text-[#8a98aa]">UTT Adı</dt><dd className="font-extrabold">{talep.utt?.utt_adi ?? "—"}</dd></div>}
      <div><dt className="font-bold text-[#8a98aa]">Talep Tarihi</dt><dd>{tarih(talep.created_at)}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Dönem</dt><dd>{talep.donem_kodu}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Ürün Adı</dt><dd className="font-bold">{talep.urun.urun_adi}</dd><dd className="font-mono text-[10px] text-[#71859d]">{talep.urun.gorunen_urun_id}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Öğrenme Aracı</dt><dd className="font-bold">{ogrenmeAraciMetinleri(talep.ogrenme_araci.tur).ad}</dd><dd className="font-mono text-[10px] text-[#71859d]">{talep.ogrenme_araci.gorunen_talep_id ?? "—"}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Sipariş Tercihi</dt><dd className="font-bold">{siparisTercihi(talep)}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Satış Koşulu</dt><dd className="font-bold">{talep.siparis.adet} + {talep.siparis.mal_fazlasi} MF</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Talep Eden Eczane</dt><dd className="font-bold">{talep.eczane.eczane_adi}</dd><dd className="text-[11px] text-[#71859d]">{talep.uye.ad_soyad} · {eclubKisiRolEtiketi(talep.uye.rol)}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Kullanılan Puan</dt><dd>{talep.siparis.kullanilan_puan.toLocaleString("tr-TR")}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Çek Tutarı</dt><dd>{talep.siparis.cek_tutari_tl.toLocaleString("tr-TR")} TL</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">{talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki depo" : "Güncel depo"}</dt><dd className="mt-1"><TercihListesi satirlar={depoSatirlari} alan="depo" /></dd></div>
      <div><dt className="font-bold text-[#8a98aa]">{talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki şube" : "Güncel şube"}</dt><dd className="mt-1"><TercihListesi satirlar={depoSatirlari} alan="sube" /></dd></div>
      {(uttGoster || saltOkunur) && <div><dt className="font-bold text-[#8a98aa]">Sipariş Durumu</dt><dd className="mt-1"><SiparisDurumu talep={talep} /></dd></div>}
      {!saltOkunur && <div><dt className="font-bold text-[#8a98aa]">İşlem</dt><dd><OnayButonu talep={talep} islemde={islemde} onOnayla={onOnayla} /></dd></div>}
    </dl>
  </article>;
}

export default function SiparisTakipListesi({ talepler, yukleniyor, hata, filtreVar, dahaVar, dahaYukleniyor, islemdekiId, onOnayla, onDahaFazla, onYenidenDene, uttGoster = false, saltOkunur = false }: {
  talepler: SiparisTakipTalebi[];
  yukleniyor: boolean;
  hata: string | null;
  filtreVar: boolean;
  dahaVar: boolean;
  dahaYukleniyor: boolean;
  islemdekiId: string | null;
  onOnayla: (id: string) => void;
  onDahaFazla: () => void;
  onYenidenDene: () => void;
  uttGoster?: boolean;
  saltOkunur?: boolean;
}) {
  if (yukleniyor) return <section aria-live="polite" className="rounded-2xl border bg-white p-10 text-center text-sm text-[#60758d]">Siparişler yükleniyor…</section>;
  if (hata && talepler.length === 0) return <section role="alert" className="rounded-2xl border bg-white p-10 text-center text-sm text-red-700">{hata} <button type="button" className="ml-2 font-bold underline" onClick={onYenidenDene}>Yeniden dene</button></section>;
  if (!talepler.length) return <section className="rounded-2xl border bg-white p-10 text-center text-sm text-[#60758d]">{filtreVar ? "Bu filtrelerde sipariş bulunmuyor." : "Henüz sipariş verilmemiş."}</section>;
  return <div className="min-w-0 space-y-3">
    {hata && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{hata} <button type="button" className="font-bold underline" onClick={onYenidenDene}>Yeniden dene</button></div>}
    <section aria-label="Sipariş takip listesi" className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block"><table className="min-w-full w-max table-auto border-collapse text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] uppercase text-[#71859d]"><tr>
        {[
          ...(uttGoster ? [{ baslik: 'UTT Adı', ortali: false }] : []),
          { baslik: 'Talep Tarihi', ortali: true },
          { baslik: 'Dönem', ortali: true },
          { baslik: 'Ürün Adı', ortali: false },
          { baslik: 'Öğrenme Aracı', ortali: false },
          { baslik: 'Sipariş Tercihi', ortali: true },
          { baslik: 'Satış Koşulu', ortali: true },
          { baslik: 'Talep Eden Eczane', ortali: false },
          { baslik: 'Kullanılan Puan', ortali: true },
          { baslik: 'Çek Tutarı', ortali: true },
          { baslik: 'Depo', ortali: false },
          { baslik: 'Şube', ortali: false },
          ...(uttGoster || saltOkunur ? [{ baslik: 'Sipariş Durumu', ortali: true }] : []),
          ...(!saltOkunur ? [{ baslik: 'İşlem', ortali: false }] : []),
        ].map(({ baslik, ortali }) => <th key={baslik} className={`whitespace-nowrap px-3 py-3 ${ortali ? "text-center" : "text-left"}`}>{baslik}</th>)}
      </tr></thead><tbody className="divide-y divide-[#e8eef5]">{talepler.map((talep) => {
        const depoSatirlari = depoTercihSatirlari(talep);
        return <tr key={talep.talep_id}>
        {uttGoster && <td className="whitespace-nowrap px-3 py-3 font-extrabold">{talep.utt?.utt_adi ?? "—"}</td>}
        <td className="whitespace-nowrap px-3 py-3 text-center font-bold text-[#40556d]">{tarih(talep.created_at)}</td>
        <td className="whitespace-nowrap px-3 py-3 text-center font-bold text-[#40556d]">{talep.donem_kodu}</td>
        <td className="max-w-[220px] px-3 py-3"><strong className="block break-words text-[#203653]">{talep.urun.urun_adi}</strong><div className="font-mono text-[10px] text-[#71859d]">{talep.urun.gorunen_urun_id}</div></td>
        <td className="max-w-[220px] px-3 py-3"><strong className="block text-[#40556d]">{ogrenmeAraciMetinleri(talep.ogrenme_araci.tur).ad}</strong><div className="break-words font-mono text-[10px] text-[#71859d]">{talep.ogrenme_araci.gorunen_talep_id ?? "—"}</div></td>
        <td className="whitespace-nowrap px-3 py-3 text-center font-bold text-[#40556d]">{siparisTercihi(talep)}</td>
        <td className="whitespace-nowrap px-3 py-3 text-center font-bold text-[#40556d]">{talep.siparis.adet} + {talep.siparis.mal_fazlasi} MF</td>
        <td className="max-w-[220px] px-3 py-3"><strong className="block break-words text-[#40556d]">{talep.eczane.eczane_adi}</strong><div className="text-[11px] text-[#71859d]">{talep.uye.ad_soyad} · {eclubKisiRolEtiketi(talep.uye.rol)}</div></td>
        <td className="whitespace-nowrap px-3 py-3 text-center font-black tabular-nums text-[#40556d]">{talep.siparis.kullanilan_puan.toLocaleString("tr-TR")}</td>
        <td className="whitespace-nowrap px-3 py-3 text-center font-black tabular-nums text-emerald-700">{talep.siparis.cek_tutari_tl.toLocaleString("tr-TR")} TL</td>
        <td className="max-w-[220px] px-3 py-3" title={talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki depo tercihi" : "Güncel depo tercihi"}><TercihListesi satirlar={depoSatirlari} alan="depo" /></td>
        <td className="max-w-[220px] px-3 py-3" title={talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki şube tercihi" : "Güncel şube tercihi"}><TercihListesi satirlar={depoSatirlari} alan="sube" /></td>
        {(uttGoster || saltOkunur) && <td className="px-3 py-3 text-center"><SiparisDurumu talep={talep} /></td>}
        {!saltOkunur && <td className="px-3 py-3"><OnayButonu talep={talep} islemde={islemdekiId === talep.talep_id} onOnayla={onOnayla} /></td>}
      </tr>})}</tbody></table></div>
      <div className="grid min-w-0 grid-cols-1 gap-3 bg-[#f8fafc] p-3 lg:hidden">{talepler.map((talep) => <SiparisKarti key={talep.talep_id} talep={talep} islemde={islemdekiId === talep.talep_id} onOnayla={onOnayla} uttGoster={uttGoster} saltOkunur={saltOkunur} />)}</div>
    </section>
    {dahaVar && <div className="flex justify-center"><button type="button" disabled={dahaYukleniyor} onClick={onDahaFazla} className="min-h-10 rounded-xl border border-[#bfd7ec] bg-white px-5 text-xs font-extrabold text-[#237ac8] disabled:opacity-60">{dahaYukleniyor ? "Yükleniyor…" : "Daha fazla yükle"}</button></div>}
  </div>;
}
