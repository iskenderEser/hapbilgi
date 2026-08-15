export const BILDIRIM_ROZETLERI_DEGISTI = "hapbilgi:bildirim-rozetleri-degisti";

export function bildirimRozetleriniYenile(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BILDIRIM_ROZETLERI_DEGISTI));
}
