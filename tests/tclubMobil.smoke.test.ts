import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const KOK = process.cwd();
const oku = (yol: string) => readFile(`${KOK}/${yol}`, "utf8");

test("T-Club sayfaları iskelet ve kısa süreli istemci önbelleği kullanır", async () => {
  const [lig, rapor, ligLoading, raporLoading] = await Promise.all([
    oku("app/(panel)/t-club-ligi/page.tsx"),
    oku("app/(panel)/raporlar/tclub-uretici/page.tsx"),
    oku("app/(panel)/t-club-ligi/loading.tsx"),
    oku("app/(panel)/raporlar/tclub-uretici/loading.tsx"),
  ]);
  assert.match(lig, /LIG_ONBELLEK_SURESI = 60_000/);
  assert.match(lig, /TClubPageSkeleton/);
  assert.match(rapor, /onbellekSuresi: 60_000/);
  assert.match(rapor, /oturumOnbellegi: true/);
  assert.match(ligLoading, /TClubPageSkeleton/);
  assert.match(raporLoading, /TClubPageSkeleton/);
});

test("lig ve üretici raporundaki geniş tablolar mobil kartlara dönüşür", async () => {
  const [ligTablosu, rapor] = await Promise.all([
    oku("components/hbligi/league/CompetitorComparison.tsx"),
    oku("app/(panel)/raporlar/tclub-uretici/page.tsx"),
  ]);
  assert.match(ligTablosu, /space-y-2 md:hidden/);
  assert.match(ligTablosu, /hidden md:block/);
  assert.match(rapor, /space-y-2 md:hidden/);
  assert.match(rapor, /hidden overflow-x-auto[^\n]+md:block/);
});
