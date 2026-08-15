const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidGecerliMi(deger: unknown): deger is string {
  return typeof deger === "string" && UUID_DESENI.test(deger);
}

export function uretimRpcHttpDurumu(kod?: string): number {
  return kod === "42501" ? 403
    : kod === "P0002" ? 404
    : kod === "23505" ? 409
    : kod === "22023" || kod === "23514" ? 422
    : 500;
}
