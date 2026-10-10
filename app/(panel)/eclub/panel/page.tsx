import { redirect } from "next/navigation";

export default async function EskiEclubPanel({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sorgu = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(await searchParams)) {
    for (const parca of Array.isArray(deger) ? deger : deger === undefined ? [] : [deger]) {
      sorgu.append(anahtar, parca);
    }
  }
  redirect(`/eclub/ana-sayfa${sorgu.size ? `?${sorgu}` : ""}`);
}
