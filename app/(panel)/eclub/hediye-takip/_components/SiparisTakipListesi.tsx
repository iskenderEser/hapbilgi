import type { SiparisTakipTalebi } from "@/lib/eclub/hediyeTakip/siparisTakip";

const DURUM_ETIKETLERI = {
  inceleme_bekliyor: "UTT İncelemesi Bekliyor",
  utt_onayladi: "UTT Onayladı",
  talep_iptal: "Çek Talebi İptal",
} as const;

function tarih(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

function kosul(talep: SiparisTakipTalebi): string {
  return talep.siparis.tipi === "satis_sartli" ? "Sipariş zorunlu" : "İsteğe bağlı sipariş · çek tutarı artırılmış";
}

function OnayButonu({ talep, islemde, onOnayla }: { talep: SiparisTakipTalebi; islemde: boolean; onOnayla: (id: string) => void }) {
  if (!talep.onaylanabilir_mi) return <span className="text-[#70839b]">{talep.utt_onay_tarihi ? `Onay: ${tarih(talep.utt_onay_tarihi)}` : "—"}</span>;
  return <button type="button" disabled={islemde} onClick={() => onOnayla(talep.talep_id)} className="min-h-9 rounded-xl border border-[#bfdbfe] bg-[#eaf4ff] px-3 text-[11px] font-extrabold text-[#1d4ed8] hover:bg-[#dbeafe] disabled:opacity-60">
    {islemde ? "Onaylanıyor..." : "Siparişi Onayla"}
  </button>;
}

function SiparisKarti({ talep, islemde, onOnayla }: { talep: SiparisTakipTalebi; islemde: boolean; onOnayla: (id: string) => void }) {
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-sm">
    <h3 className="break-words text-sm font-extrabold text-[#203653]">{talep.urun.urun_adi}</h3>
    <p className="mt-1 text-xs font-bold text-[#60758d]">{talep.eczane.eczane_adi}{talep.eczane.gln ? ` · GLN ${talep.eczane.gln}` : ""}</p>
    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#40556d]">
      <div><dt className="font-bold text-[#8a98aa]">Talep / Dönem</dt><dd>{tarih(talep.created_at)} · {talep.donem_kodu}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Talep Eden</dt><dd>{talep.uye.ad_soyad}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Koşul / Barem</dt><dd>{kosul(talep)} · {talep.siparis.adet} + {talep.siparis.mal_fazlasi} MF</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Puan / Çek</dt><dd>{talep.siparis.kullanilan_puan.toLocaleString("tr-TR")} puan · {talep.siparis.cek_tutari_tl.toLocaleString("tr-TR")} TL</dd></div>
      <div className="col-span-2"><dt className="font-bold text-[#8a98aa]">{talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki depo / şube tercihleri" : "Güncel depo / şube tercihleri"}</dt><dd className="break-words">{talep.depo_tercihleri.join(", ") || "Tercih bulunmuyor"}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">Durum</dt><dd>{DURUM_ETIKETLERI[talep.durum]}</dd></div>
      <div><dt className="font-bold text-[#8a98aa]">UTT İşlemi</dt><dd><OnayButonu talep={talep} islemde={islemde} onOnayla={onOnayla} /></dd></div>
    </dl>
  </article>;
}

export default function SiparisTakipListesi({ talepler, yukleniyor, hata, filtreVar, dahaVar, dahaYukleniyor, islemdekiId, onOnayla, onDahaFazla, onYenidenDene }: {
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
}) {
  if (yukleniyor) return <section aria-live="polite" className="rounded-2xl border bg-white p-10 text-center text-sm text-[#60758d]">Siparişler yükleniyor…</section>;
  if (hata && talepler.length === 0) return <section role="alert" className="rounded-2xl border bg-white p-10 text-center text-sm text-red-700">{hata} <button type="button" className="ml-2 font-bold underline" onClick={onYenidenDene}>Yeniden dene</button></section>;
  if (!talepler.length) return <section className="rounded-2xl border bg-white p-10 text-center text-sm text-[#60758d]">{filtreVar ? "Bu filtrelerde sipariş bulunmuyor." : "Henüz sipariş verilmemiş."}</section>;
  return <div className="space-y-3">
    {hata && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{hata} <button type="button" className="font-bold underline" onClick={onYenidenDene}>Yeniden dene</button></div>}
    <section aria-label="Sipariş takip listesi" className="overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white shadow-sm">
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1160px] text-left text-xs"><thead className="bg-[#f8fafc] text-[10px] uppercase text-[#71859d]"><tr>
        {['Talep / Dönem', 'Ürün / Eczane', 'Talep Eden', 'Koşul / Barem', 'Puan / Çek', 'Depo / Şube', 'Durum', 'UTT İşlemi'].map((baslik) => <th key={baslik} className="px-3 py-3">{baslik}</th>)}
      </tr></thead><tbody className="divide-y divide-[#e8eef5]">{talepler.map((talep) => <tr key={talep.talep_id}>
        <td className="whitespace-nowrap px-3 py-3">{tarih(talep.created_at)}<div>{talep.donem_kodu}</div></td>
        <td className="px-3 py-3"><strong>{talep.urun.urun_adi}</strong><div>{talep.eczane.eczane_adi}</div><div className="text-[10px] text-[#8a98aa]">{talep.eczane.gln ? `GLN ${talep.eczane.gln}` : ""}</div></td>
        <td className="px-3 py-3">{talep.uye.ad_soyad}</td>
        <td className="px-3 py-3">{kosul(talep)}<div className="font-bold">{talep.siparis.adet} + {talep.siparis.mal_fazlasi} MF</div></td>
        <td className="px-3 py-3">{talep.siparis.kullanilan_puan.toLocaleString("tr-TR")} puan<div className="font-bold">{talep.siparis.cek_tutari_tl.toLocaleString("tr-TR")} TL</div></td>
        <td className="max-w-48 px-3 py-3" title={talep.depo_tercihleri_onay_anlik_mi ? "Onay anındaki depo / şube tercihleri" : "Güncel depo / şube tercihleri"}>{talep.depo_tercihleri.join(", ") || "Tercih bulunmuyor"}</td>
        <td className="px-3 py-3 font-bold">{DURUM_ETIKETLERI[talep.durum]}</td>
        <td className="px-3 py-3"><OnayButonu talep={talep} islemde={islemdekiId === talep.talep_id} onOnayla={onOnayla} /></td>
      </tr>)}</tbody></table></div>
      <div className="grid min-w-0 grid-cols-1 gap-3 bg-[#f8fafc] p-3 lg:hidden">{talepler.map((talep) => <SiparisKarti key={talep.talep_id} talep={talep} islemde={islemdekiId === talep.talep_id} onOnayla={onOnayla} />)}</div>
    </section>
    {dahaVar && <div className="flex justify-center"><button type="button" disabled={dahaYukleniyor} onClick={onDahaFazla} className="min-h-10 rounded-xl border border-[#bfd7ec] bg-white px-5 text-xs font-extrabold text-[#237ac8] disabled:opacity-60">{dahaYukleniyor ? "Yükleniyor…" : "Daha fazla yükle"}</button></div>}
  </div>;
}
