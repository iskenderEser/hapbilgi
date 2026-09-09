import {
  TUKETICI_ROLLER,
  URETICI_ROLLER,
  YONETICI_ROLLER,
  YONLENDIRICI_ROLLER,
} from "@/lib/utils/roller";

const BI_ROLLERI = new Set([
  ...TUKETICI_ROLLER,
  ...YONLENDIRICI_ROLLER,
  ...URETICI_ROLLER,
  ...YONETICI_ROLLER,
]);

export function biKullanabilirMi(
  kimlikTuru: string | null | undefined,
  rol: string | null | undefined,
): boolean {
  return kimlikTuru === "kullanici" && BI_ROLLERI.has(rol?.trim().toLowerCase() ?? "");
}
