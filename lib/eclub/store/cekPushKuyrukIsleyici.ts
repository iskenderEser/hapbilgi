import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { pushYayinlaSonuclu } from "@/lib/push/orkestrasyon";

interface CekPushIsi {
  outbox_id: string;
  talep_id: string;
  alici_auth_user_id: string | null;
}

export async function eclubCekPushKuyrugunuTuket(maxIsSayisi = 10) {
  const supabase = createAdminClient();
  let tamamlanan = 0;
  let hatali = 0;

  for (let i = 0; i < maxIsSayisi; i += 1) {
    const { data, error } = await supabase.rpc("eclub_cek_push_isi_al", { p_lease_saniye: 120 });
    if (error) throw new Error(`ECLUB_PUSH_CLAIM:${error.message}`);
    const is = (Array.isArray(data) ? data[0] : data) as CekPushIsi | null;
    if (!is?.outbox_id) break;

    try {
      if (!is.alici_auth_user_id) throw new Error("PUSH_AUTH_YOK");
      const sonuc = await pushYayinlaSonuclu(
        supabase,
        "eclub_cek_teslim",
        [is.alici_auth_user_id],
        { bagId: is.talep_id }
      );
      if (sonuc.gonderilen < 1) {
        throw new Error(
          sonuc.hataKodu
            ?? (sonuc.atlanan > 0
              ? "PUSH_ALICI_UYGUN_DEGIL"
              : sonuc.abonelikSayisi < 1
                ? "PUSH_ABONELIK_YOK"
                : "PUSH_TESLIM_EDILEMEDI")
        );
      }

      const { data: tamamlandi, error: tamamlaHatasi } = await supabase.rpc("eclub_cek_teslimat_tamamla", {
        p_outbox_id: is.outbox_id,
        p_kanal: "push",
      });
      if (tamamlaHatasi) throw new Error(`ECLUB_PUSH_COMPLETE:${tamamlaHatasi.message}`);
      if (!tamamlandi) throw new Error("ECLUB_PUSH_COMPLETE:ISLEM_DURUMU_GECERSIZ");
      tamamlanan += 1;
    } catch (error) {
      const kod = error instanceof Error ? error.message.split(":")[0] : "PUSH_ERROR";
      await supabase.rpc("eclub_cek_teslimat_hata", {
        p_outbox_id: is.outbox_id,
        p_kanal: "push",
        p_hata_kodu: kod,
      });
      hatali += 1;
    }
  }

  return { tamamlanan, hatali };
}
