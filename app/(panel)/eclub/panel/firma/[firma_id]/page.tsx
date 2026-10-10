import { redirect } from "next/navigation";

export default async function EskiEclubFirmaPanel({ params, searchParams }: {
  params: Promise<{ firma_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { firma_id } = await params;
  const sorgu = new URLSearchParams();
  for (const [anahtar, deger] of Object.entries(await searchParams)) {
    for (const parca of Array.isArray(deger) ? deger : deger === undefined ? [] : [deger]) {
      sorgu.append(anahtar, parca);
    }
  }
  redirect(`/eclub/ana-sayfa/firma/${encodeURIComponent(firma_id)}${sorgu.size ? `?${sorgu}` : ""}`);
}
