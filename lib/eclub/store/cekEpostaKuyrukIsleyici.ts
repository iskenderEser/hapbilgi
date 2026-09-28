import "server-only";
import { createAdminClient } from "@/lib/supabase/server";

interface CekEpostaIsi {
  outbox_id: string;
  talep_id: string;
  alici_eposta: string;
  alici_adi?: string | null;
  cek_kodu: string;
  cek_tutari_tl: number;
}

const htmlKacir = (deger: unknown) => String(deger ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export async function eclubCekEpostaKuyrugunuTuket(maxIsSayisi = 10) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ECLUB_CEK_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("ECLUB_EMAIL_ENV_EKSIK");
  const supabase = createAdminClient();
  let tamamlanan = 0;
  let hatali = 0;

  for (let i = 0; i < maxIsSayisi; i += 1) {
    const { data, error } = await supabase.rpc("eclub_cek_eposta_isi_al", { p_lease_saniye: 120 });
    if (error) throw new Error(`ECLUB_EMAIL_CLAIM:${error.message}`);
    const is = (Array.isArray(data) ? data[0] : data) as CekEpostaIsi | null;
    if (!is?.outbox_id) break;

    try {
      const yanit = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `eclub-cek/${is.outbox_id}`,
        },
        body: JSON.stringify({
          from,
          to: [is.alici_eposta],
          subject: "Migros hediye çekiniz hazır",
          html: `<p>Merhaba ${htmlKacir(is.alici_adi || "")},</p><p><strong>${htmlKacir(is.cek_tutari_tl)} TL</strong> değerindeki Migros hediye çekiniz hazırdır.</p><p>Çek kodunuz: <strong>${htmlKacir(is.cek_kodu)}</strong></p><p>Kodu HapBilgi içindeki Çeklerim alanından da görebilirsiniz.</p>`,
        }),
      });
      if (!yanit.ok) throw new Error(`RESEND_${yanit.status}`);
      const { data: tamamlandi, error: tamamlaHatasi } = await supabase.rpc("eclub_cek_teslimat_tamamla", {
        p_outbox_id: is.outbox_id,
        p_kanal: "eposta",
      });
      if (tamamlaHatasi) throw new Error(`ECLUB_EMAIL_COMPLETE:${tamamlaHatasi.message}`);
      if (!tamamlandi) throw new Error("ECLUB_EMAIL_COMPLETE:ISLEM_DURUMU_GECERSIZ");
      tamamlanan += 1;
    } catch (error) {
      const kod = error instanceof Error ? error.message.split(":")[0] : "EMAIL_ERROR";
      await supabase.rpc("eclub_cek_teslimat_hata", {
        p_outbox_id: is.outbox_id,
        p_kanal: "eposta",
        p_hata_kodu: kod,
      });
      hatali += 1;
    }
  }
  return { tamamlanan, hatali };
}
