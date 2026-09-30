import { DavetSifreKarti } from "@/components/auth/DavetSifreKarti";

export default async function SifreOlusturPage({ searchParams }: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  return <DavetSifreKarti token={typeof token === "string" ? token : null} />;
}
