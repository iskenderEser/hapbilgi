import type { LigPeriyot } from "@/lib/hbligi_v2/ligRpcCagir";

export function eclubLigPeriyoduParse(searchParams: URLSearchParams): LigPeriyot | null {
  const periyot = (searchParams.get("periyot") ?? "ay") as LigPeriyot["periyot"];
  const yil = Number(searchParams.get("yil"));
  if (!Number.isInteger(yil) || yil < 2024 || yil > 2100) return null;

  if (periyot === "hafta") {
    const hafta = Number(searchParams.get("hafta"));
    return Number.isInteger(hafta) && hafta >= 1 && hafta <= 53
      ? { periyot, yil, hafta, ay: 1, ceyrek: 1 }
      : null;
  }
  if (periyot === "ay") {
    const ay = Number(searchParams.get("ay"));
    return Number.isInteger(ay) && ay >= 1 && ay <= 12
      ? { periyot, yil, ay, ceyrek: 1, hafta: 1 }
      : null;
  }
  if (periyot === "donem") {
    const ceyrek = Number(searchParams.get("ceyrek"));
    return Number.isInteger(ceyrek) && ceyrek >= 1 && ceyrek <= 4
      ? { periyot, yil, ceyrek, ay: 1, hafta: 1 }
      : null;
  }
  if (periyot === "yil") return { periyot, yil, ay: 1, ceyrek: 1, hafta: 1 };
  return null;
}
