import { CEK_KODU_GORUNUR_DURUMLARI, CEK_TALEP_DURUM_META } from "@/lib/eclub/store/eclubStoreTipler";
import {
  cekTakipTeslimatiTamamlandiMi,
  type CekTakipIslemi,
  type CekTakipTalebi,
  type CekTakipTeslimatKanali,
} from "@/lib/eclub/hediyeTakip/cekTakip";
import { eclubKisiRolEtiketi } from "@/lib/utils/roller";

function tarihFormatla(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kosulMetni(talep: CekTakipTalebi): string {
  if (talep.odul_kosulu.siparis_tipi === "siparissiz_cek") return "Siparişsiz çek";
  if (!talep.odul_kosulu.siparis_verildi_mi) return "Sipariş verilmedi";
  return `${talep.odul_kosulu.siparis_adet} + ${talep.odul_kosulu.siparis_mal_fazlasi}`;
}

const TESLIMAT_ETIKETLERI: Record<CekTakipTeslimatKanali["durum"], string> = {
  yok: "Henüz yok",
  bekliyor: "Bekliyor",
  isleniyor: "İşleniyor",
  kismen_tamamlandi: "Kısmen tamamlandı",
  tamamlandi: "Tamamlandı",
  basarisiz: "Başarısız",
};

export function CekTakipTeslimatOzeti({ talep }: { talep: CekTakipTalebi }) {
  const cekKoduGorunur = CEK_KODU_GORUNUR_DURUMLARI.includes(talep.durum) && Boolean(talep.cek.kod);
  const tamamlandi = cekTakipTeslimatiTamamlandiMi(talep);
  return (
    <div className="space-y-1 text-[11px] font-bold text-[#60758d]">
      <div>Ana eczacı e-postası: {TESLIMAT_ETIKETLERI[talep.teslimat.eposta.durum]}{talep.teslimat.eposta.toplam > 0 ? ` (${talep.teslimat.eposta.tamamlanan}/${talep.teslimat.eposta.toplam})` : ""}</div>
      <div>Aktif E-Club hesapları push: {TESLIMAT_ETIKETLERI[talep.teslimat.push.durum]}{talep.teslimat.push.toplam > 0 ? ` (${talep.teslimat.push.tamamlanan}/${talep.teslimat.push.toplam})` : ""}</div>
      <div>Gönderim tarihi: {tarihFormatla(talep.cek.gonderim_tarihi)}</div>
      {cekKoduGorunur && <div className="break-all font-mono text-emerald-800">Çek kodu: {talep.cek.kod}</div>}
      <div className={tamamlandi ? "text-emerald-700" : "text-[#71859d]"}>
        {tamamlandi ? "Tüm gerekli teslimatlar tamamlandı" : "Teslimat süreci tamamlanmadı"}
      </div>
    </div>
  );
}

export function CekTakipDurumRozeti({ talep }: { talep: CekTakipTalebi }) {
  const meta = CEK_TALEP_DURUM_META[talep.durum];
  return (
    <span className="inline-flex rounded-full border px-2.5 py-1 text-[10px] font-extrabold" style={{ color: meta.metin, backgroundColor: meta.arka, borderColor: meta.kenar }}>
      {meta.etiket}
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
  if (!talep.izin_verilen_islemler.includes("bm_onayina_gonder")) return <span className="text-[#9aa8b8]">—</span>;
  return (
    <button
      type="button"
      onClick={() => onIslem(talep.talep_id, "bm_onayina_gonder")}
      disabled={islemde}
      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-[#bfdbfe] bg-[#eaf4ff] px-3 text-[11px] font-extrabold text-[#1d4ed8] transition hover:bg-[#dbeafe] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {islemde ? "Gönderiliyor..." : "BM Onayına Gönder"}
    </button>
  );
}

export default function CekTakipKarti({
  talep,
  islemde,
  onIslem,
}: {
  talep: CekTakipTalebi;
  islemde: boolean;
  onIslem: (talepId: string, islem: CekTakipIslemi) => void;
}) {
  return (
    <article aria-busy={islemde} className={`rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_5px_16px_rgba(31,55,90,0.035)] ${islemde ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-[#203653]">{talep.urun.urun_adi}</h3>
          <p className="mt-0.5 text-[11px] font-semibold text-[#71859d]">{kosulMetni(talep)}</p>
        </div>
        <CekTakipDurumRozeti talep={talep} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Talep Tarihi</dt><dd className="mt-1 font-bold text-[#40556d]">{tarihFormatla(talep.created_at)}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Çek Tutarı</dt><dd className="mt-1 font-black text-emerald-700">{talep.cek.tutar_tl.toLocaleString("tr-TR")} TL</dd></div>
        <div className="col-span-2"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Eczane / Üye</dt><dd className="mt-1 font-bold text-[#40556d]">{talep.eczane.eczane_adi}</dd><dd className="text-[11px] text-[#71859d]">{talep.uye.ad_soyad} · {eclubKisiRolEtiketi(talep.uye.rol)}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Kullanılan Puan</dt><dd className="mt-1 font-black tabular-nums text-[#40556d]">{talep.puan.kullanilan.toLocaleString("tr-TR")}</dd></div>
        <div><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">İşlem</dt><dd className="mt-1"><CekTakipIslemButonu talep={talep} islemde={islemde} onIslem={onIslem} /></dd></div>
        <div className="col-span-2"><dt className="text-[9px] font-extrabold uppercase tracking-[0.05em] text-[#8a98aa]">Teslimat</dt><dd className="mt-1"><CekTakipTeslimatOzeti talep={talep} /></dd></div>
      </dl>
    </article>
  );
}
