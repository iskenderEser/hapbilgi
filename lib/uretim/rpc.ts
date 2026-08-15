import { hataYaniti } from "@/lib/utils/hataIsle";
import { uretimRpcHttpDurumu } from "@/lib/uretim/rpcTemel";

export { uretimRpcHttpDurumu, uuidGecerliMi } from "@/lib/uretim/rpcTemel";

export function uretimRpcHataYaniti(
  kullaniciMesaji: string,
  adim: string,
  error: { code?: string; message?: string } | null,
) {
  return hataYaniti(kullaniciMesaji, adim, error, uretimRpcHttpDurumu(error?.code));
}
