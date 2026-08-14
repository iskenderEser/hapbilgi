// HBStore sipariş bakiyesi değiştiğinde ortak panel kabuğunu haberdar eder.

export const HBSTORE_BAKIYE_DEGISTI = "hapbilgi:hbstore-bakiye-degisti";

export function hbstoreBakiyesiDegistiBildir(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HBSTORE_BAKIYE_DEGISTI));
  }
}
