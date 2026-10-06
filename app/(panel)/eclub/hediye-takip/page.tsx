import HediyeTakipIstemcisi from "./_components/HediyeTakipIstemcisi";

export default async function HediyeTakipPage({
  searchParams,
}: {
  searchParams: Promise<{ tur?: string; durum?: string }>;
}) {
  const { tur, durum } = await searchParams;
  return <HediyeTakipIstemcisi ilkTakipTuru={tur === "siparis" ? "siparis" : "cek"} ilkDurum={durum} />;
}
