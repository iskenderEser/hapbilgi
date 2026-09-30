import Link from "next/link";

export default function DavetBekliyorPage() {
  return <main className="flex min-h-screen items-center justify-center bg-white p-6"><div className="max-w-sm space-y-4 text-center"><h1 className="text-lg font-bold">Üyelik davetinizi tamamlayın</h1><p className="text-sm text-gray-600">E-postanıza gönderilen şifre oluşturma bağlantısını kullanın. Bağlantınız yoksa veya süresi dolduysa temsilcinizden daveti yeniden göndermesini isteyin.</p><Link href="/login" className="text-sm font-semibold text-[#bc2d0d]">Giriş sayfası</Link></div></main>;
}
