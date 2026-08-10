export type IzlemeTuru = "kendi_kendine" | "oneri";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function olayIdGecerliMi(deger: unknown): deger is string {
  return typeof deger === "string" && UUID_RE.test(deger);
}

export const baslatOlayIdGecerliMi = olayIdGecerliMi;

export function izlemeTuruBelirle(oneriId: unknown): IzlemeTuru {
  return typeof oneriId === "string" && oneriId.trim().length > 0 ? "oneri" : "kendi_kendine";
}

export function oynatmaBaslatilmaliMi(girdi: {
  tuketici: boolean;
  izlemeId: string | null;
  baslatiliyor: boolean;
}): boolean {
  return girdi.tuketici && !girdi.izlemeId && !girdi.baslatiliyor;
}
