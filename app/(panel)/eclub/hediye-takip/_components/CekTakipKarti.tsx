import { CEK_TALEP_DURUM_META } from "@/lib/eclub/store/eclubStoreTipler";
import {
  cekTakipTeslimatiTamamlandiMi,
  type CekTakipIslemi,
  type CekTakipTalebi,
} from "@/lib/eclub/hediyeTakip/cekTakip";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";
import { ogrenmeAraciMetinleri } from "@/lib/ogrenmeAraci/etiketler";

function tarihFormatla(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function kosulMetni(talep: CekTakipTalebi): string {
  if (talep.odul_kosulu.siparis_tipi === "siparissiz_cek") return "Siparişsiz çek";
  if (!talep.odul_kosulu.siparis_verildi_mi) return "Sipariş verilmedi";
  return `${talep.odul_kosulu.siparis_adet} + ${talep.odul_kosulu.siparis_mal_fazlasi}`;
}

function teslimatSunumu(talep: CekTakipTalebi): { etiket: string; sinif: string } {
  if (talep.durum === "iptal") {
    return { etiket: "Uygulanmaz", sinif: "border-slate-200 bg-slate-50 text-slate-500" };
  }
  const kanallar = [talep.teslimat.eposta, talep.teslimat.push];
  const toplam = kanallar.reduce((sayac, kanal) => sayac + kanal.toplam, 0);
  const tamamlanan = kanallar.reduce((sayac, kanal) => sayac + kanal.tamamlanan, 0);
  const basarisiz = kanallar.reduce((sayac, kanal) => sayac + kanal.basarisiz, 0);
  const isleniyor = kanallar.reduce((sayac, kanal) => sayac + kanal.isleniyor, 0);

  if (toplam === 0) return { etiket: "Henüz başlamadı", sinif: "border-slate-200 bg-slate-50 text-slate-600" };
  if (basarisiz > 0) return { etiket: "Teslimat başarısız", sinif: "border-red-200 bg-red-50 text-red-700" };
  if (cekTakipTeslimatiTamamlandiMi(talep)) return { etiket: "Teslim edildi", sinif: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  if (tamamlanan > 0) return { etiket: "Kısmen teslim edildi", sinif: "border-amber-200 bg-amber-50 text-amber-700" };
  if (isleniyor > 0) return { etiket: "Gönderiliyor", sinif: "border-cyan-200 bg-cyan-50 text-cyan-700" };
  return { etiket: "Gönderim bekliyor", sinif: "border-blue-200 bg-blue-50 text-blue-700" };
}

export function CekTakipTeslimatOzeti({ talep }: { talep: CekTakipTalebi }) {
  const sunum = teslimatSunumu(talep);
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${sunum.sinif}`}>
      {sunum.etiket}
    </span>
  );
}

export function CekTakipTeslimTarihi({ talep }: { talep: CekTakipTalebi }) {
  return <span className="whitespace-nowrap font-bold text-[#40556d]">{tarihFormatla(talep.teslimat.basarili_eposta?.tamamlanma_tarihi ?? null)}</span>;
}

export function CekTakipTeslimEdilen({ talep }: { talep: CekTakipTalebi }) {
  const alici = talep.teslimat.basarili_eposta;
  if (!alici) return <span className="text-[#9aa8b8]">—</span>;
  return (
    <span className="block min-w-0">
      <strong className="block text-[#40556d]">{alici.alici_ad_soyad}</strong>
      <span className="mt-0.5 block break-all text-[11px] font-semibold text-[#71859d]">{alici.alici_eposta}</span>
    </span>
  );
}

export function CekTakipDurumRozeti({ talep }: { talep: CekTakipTalebi }) {
  const meta = CEK_TALEP_DURUM_META[talep.durum];
  const etiket = talep.utt && talep.durum === "bm_onayinda" ? "BM Onayı Bekliyor"
    : talep.utt && talep.durum === "tm_onayinda" ? "TM Onayı Bekliyor" : meta.etiket;
  return (
    <span aria-label={`Talep durumu: ${etiket}`} className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold" style={{ color: meta.metin, backgroundColor: meta.arka, borderColor: meta.kenar }}>
      {etiket}
    </span>
  );
}

export { tarihFormatla, kosulMetni };

export function CekTakipIslemButonu({
  talep,
  islemde,
  onIslem,
}: {
  talep: CekTakipTalebi;
  islemde: boolean;
  onIslem: (talepId: string, islem: CekTakipIslemi) => void;
}) {
  const islem = talep.izin_verilen_islemler.includes("tm_onayla") ? "tm_onayla" : talep.izin_verilen_islemler.includes("bm_onayla") ? "bm_onayla" : "bm_onayina_gonder";
  if (!talep.izin_verilen_islemler.includes(islem)) return <span className="text-[#9aa8b8]">—</span>;
  return (
    <button
      type="button"
      onClick={() => onIslem(talep.talep_id, islem)}
      disabled={islemde}
      className={`inline-flex items-center justify-center whitespace-nowrap border font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${islem !== "bm_onayina_gonder" ? "rounded-full px-2.5 py-1 text-[10px] border-[#237ac8] bg-[#237ac8] text-white hover:bg-[#1d69ad]" : "min-h-9 rounded-xl px-3 text-[11px] border-[#bfdbfe] bg-[#eaf4ff] text-[#1d4ed8] hover:bg-[#dbeafe]"}`}
    >
      {islemde ? "İşleniyor..." : islem === "tm_onayla" ? "Onayla" : islem === "bm_onayla" ? "Onayla ve TM’ye Gönder" : "BM Onayına Gönder"}
    </button>
  );
}

export default function CekTakipKarti({
  talep,
  islemde,
  onIslem,
  uttAdi,
  saltOkunur = false,
}: {
  talep: CekTakipTalebi;
  islemde: boolean;
  onIslem: (talepId: string, islem: CekTakipIslemi) => void;
  uttAdi?: string;
  saltOkunur?: boolean;
}) {
  return (
    <article aria-busy={islemde} className={`min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_5px_16px_rgba(31,55,90,0.035)] ${islemde ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 title={talep.urun.urun_adi} className="break-words text-sm font-extrabold text-[#203653] [overflow-wrap:anywhere]">{talep.urun.urun_adi}</h3>
          <p className="mt-0.5 font-mono text-[10px] font-semibold text-[#71859d]">{talep.urun.gorunen_urun_id}</p>
        </div>
        <CekTakipDurumRozeti talep={talep} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
        {uttAdi && <div className="col-span-2"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">UTT Adı</dt><dd className="mt-1 font-extrabold text-[#40556d]">{uttAdi}</dd></div>}
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Talep Tarihi</dt><dd className="mt-1 font-bold text-[#40556d]">{tarihFormatla(talep.created_at)}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Çek Tutarı</dt><dd className="mt-1 font-black text-emerald-700">{talep.cek.tutar_tl.toLocaleString("tr-TR")} TL</dd></div>
        <div className="col-span-2 min-w-0"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Öğrenme Aracı</dt><dd className="mt-1 font-bold text-[#40556d]">{ogrenmeAraciMetinleri(talep.ogrenme_araci.tur).ad}</dd><dd className="break-all font-mono text-[10px] text-[#71859d]">{talep.ogrenme_araci.gorunen_talep_id ?? "—"}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Satış Koşulu</dt><dd className="mt-1 font-bold text-[#40556d]">{kosulMetni(talep)}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Kullanılan Puan</dt><dd className="mt-1 font-black tabular-nums text-[#40556d]">{talep.puan.kullanilan.toLocaleString("tr-TR")}</dd></div>
        <div className="col-span-2 min-w-0"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Talep Eden Eczane</dt><dd className="mt-1 break-words font-bold text-[#40556d] [overflow-wrap:anywhere]">{talep.eczane.eczane_adi}</dd><dd className="break-words text-[11px] text-[#71859d] [overflow-wrap:anywhere]">{talep.uye.ad_soyad} · {eclubKisiRolEtiketi(talep.uye.rol)}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Çek Teslimatı</dt><dd className="mt-1"><CekTakipTeslimatOzeti talep={talep} /></dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Teslim Tarihi</dt><dd className="mt-1"><CekTakipTeslimTarihi talep={talep} /></dd></div>
        <div className="col-span-2"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Teslim Edilen</dt><dd className="mt-1"><CekTakipTeslimEdilen talep={talep} /></dd></div>
        {!saltOkunur && <div className="col-span-2"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">İşlem</dt><dd className="mt-1"><CekTakipIslemButonu talep={talep} islemde={islemde} onIslem={onIslem} /></dd></div>}
      </dl>
    </article>
  );
}
