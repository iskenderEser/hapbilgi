import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { pushYayinlaSonuclu } from "@/lib/push/orkestrasyon";

interface BildirimIsi {
  outbox_id: string;
  claim_token: string;
  talep_id: string;
  alici_auth_user_id: string | null;
  alici_eposta: string | null;
  mesaj: string;
}

const htmlKacir = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export async function odulSiparisBildirimleriniTuket(kanal: "eposta" | "push", limit = 10) {
  const db = createAdminClient();
  let tamamlanan = 0; let hatali = 0;
  const baslangic = Date.now();
  for (let i = 0; i < limit && Date.now() - baslangic < 25_000; i++) {
    const { data, error } = await db.rpc("eclub_odul_siparis_isi_al", { p_kanal: kanal });
    if (error) throw new Error(`ODUL_CLAIM:${error.message}`);
    const is = (Array.isArray(data) ? data[0] : data) as BildirimIsi | null;
    if (!is?.outbox_id) break;
    let hataKodu: string | null = null;
    try {
      // Claim RPC'si gönderim anında ana eczacının aynı eczanede aktifliğini doğrular.
      if (!is.alici_auth_user_id) throw new Error("ALICI_ECZANE_BAGI_YOK");
      if (kanal === "eposta") {
        if (!process.env.RESEND_API_KEY || !process.env.ECLUB_CEK_EMAIL_FROM) throw new Error("EMAIL_ENV_EKSIK");
        if (!is.alici_eposta || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(is.alici_eposta)) throw new Error("ALICI_EPOSTA_YOK");
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(20_000), headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json",
            "Idempotency-Key": `eclub-odul-siparis/${is.outbox_id}`,
          }, body: JSON.stringify({ from: process.env.ECLUB_CEK_EMAIL_FROM, to: [is.alici_eposta],
            subject: "HapBilgi ödül siparişiniz Okundu", text: is.mesaj,
            html: `<p>${htmlKacir(is.mesaj)}</p><p>Siparişinizi HapBilgi Çek Taleplerim ekranından takip edebilirsiniz.</p>`,
          }),
        });
        if (!r.ok) throw new Error(`RESEND_${r.status}`);
      } else {
        const sonuc = await pushYayinlaSonuclu(db, "eclub_odul_siparis_okundu", [is.alici_auth_user_id], { bagId: is.talep_id });
        if (sonuc.gonderilen < 1) throw new Error(sonuc.hataKodu ?? (sonuc.abonelikSayisi === 0 ? "PUSH_ABONELIK_YOK" : "PUSH_TESLIM_EDILEMEDI"));
      }
    } catch (error) { hataKodu = error instanceof Error ? error.message.split(":")[0] : "BILDIRIM_HATASI"; }
    const { data: bitti, error: bitisError } = await db.rpc("eclub_odul_siparis_isi_bitir", {
      p_outbox_id: is.outbox_id, p_token: is.claim_token, p_hata: hataKodu,
    });
    if (bitisError || !bitti) throw new Error("ODUL_IS_BITIRME_HATASI");
    if (hataKodu) hatali++; else tamamlanan++;
  }
  return { tamamlanan, hatali };
}
