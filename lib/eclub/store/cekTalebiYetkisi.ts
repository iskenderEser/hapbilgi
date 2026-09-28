export const ECLUB_CEK_TALEBI_OLUSTURAN_ROL = "eczaci" as const;

/** Hediye çeki talebini yalnız eczanenin ana eczacısı oluşturabilir. */
export function eclubCekTalebiOlusturabilirMi(rol: unknown): boolean {
  return typeof rol === "string"
    && rol.trim().toLowerCase() === ECLUB_CEK_TALEBI_OLUSTURAN_ROL;
}
