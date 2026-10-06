import { BmOneriSecimiProvider } from "@/components/yayin/BmOneriSecimi";

export default function EgitimYayinlariLayout({ children }: { children: React.ReactNode }) {
  return <BmOneriSecimiProvider>{children}</BmOneriSecimiProvider>;
}
