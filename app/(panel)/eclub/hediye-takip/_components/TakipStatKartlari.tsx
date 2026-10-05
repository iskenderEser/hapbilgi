import { CheckCircle2, Clock3, Gift, ShoppingBag, Truck } from "lucide-react";
import type { CekTakipStatlari } from "@/lib/eclub/hediyeTakip/cekTakip";
import type { SiparisTakipStatlari } from "@/lib/eclub/hediyeTakip/siparisTakip";
import type { HediyeTakipTuru } from "./HediyeTakipToggle";

const CEK_STATLARI = [
  { etiket: "Toplam Talep", detay: "Tüm çek talepleri", ikon: Gift, renk: "#237ac8", zemin: "#edf6fd" },
  { etiket: "Onay Sürecinde", detay: "Onay adımlarındaki talepler", ikon: Clock3, renk: "#a66215", zemin: "#fff6e8" },
  { etiket: "Teslimat Sürecinde", detay: "Kod ve teslimat bekleyenler", ikon: Truck, renk: "#5367c7", zemin: "#f0f1ff" },
  { etiket: "Tamamlanan", detay: "Teslim edilen çekler", ikon: CheckCircle2, renk: "#16865f", zemin: "#ebf8f2" },
] as const;

const SIPARIS_STATLARI = [
  { etiket: "Sipariş Verilen", detay: "Takibe alınan siparişler", ikon: ShoppingBag, renk: "#237ac8", zemin: "#edf6fd" },
  { etiket: "UTT İncelemesi Bekliyor", detay: "Henüz UTT onayı olmayanlar", ikon: Clock3, renk: "#a66215", zemin: "#fff6e8" },
  { etiket: "BM Onayı Bekliyor", detay: "UTT tarafından kontrol edilenler", ikon: Clock3, renk: "#5367c7", zemin: "#f0f1ff" },
  { etiket: "BM Onayladı", detay: "BM tarafından onaylanan siparişler", ikon: CheckCircle2, renk: "#16865f", zemin: "#ebf8f2" },
] as const;

export default function TakipStatKartlari({
  takipTuru,
  cekStatlari,
  siparisStatlari,
}: {
  takipTuru: HediyeTakipTuru;
  cekStatlari?: CekTakipStatlari;
  siparisStatlari?: SiparisTakipStatlari;
}) {
  const statlar = takipTuru === "cek" ? CEK_STATLARI : SIPARIS_STATLARI;
  const degerler = takipTuru === "cek" && cekStatlari
    ? [cekStatlari.toplam, cekStatlari.onay_surecinde, cekStatlari.teslimat_surecinde, cekStatlari.tamamlanan]
    : takipTuru === "siparis" && siparisStatlari
      ? [siparisStatlari.toplam, siparisStatlari.inceleme_bekliyor, siparisStatlari.utt_onayladi, siparisStatlari.bm_onayladi]
      : null;

  return (
    <section aria-label={`${takipTuru === "cek" ? "Çek" : "Sipariş"} takip özeti`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statlar.map(({ etiket, detay, ikon: Icon, renk, zemin }, index) => (
        <article
          key={etiket}
          className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_6px_18px_rgba(31,55,90,0.035)]"
          style={{ borderLeft: `4px solid ${renk}` }}
        >
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7d8fa5]">{etiket}</span>
            <strong className="mt-1 block text-2xl font-black tracking-tight text-[#1e3450]">{degerler ? degerler[index].toLocaleString("tr-TR") : "—"}</strong>
            <span className="mt-1 hidden truncate text-xs font-semibold text-[#8292a7] sm:block">{detay}</span>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ color: renk, backgroundColor: zemin }}>
            <Icon size={20} />
          </span>
        </article>
      ))}
    </section>
  );
}
