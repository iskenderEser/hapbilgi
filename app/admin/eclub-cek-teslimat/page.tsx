// app/admin/eclub-cek-teslimat/page.tsx
//
// E-Club çek teslimatı ana panele taşındı (/admin → üst bar Çek Teslimatı bölümü).
// Bu eski URL kalıcı olarak ana panele yönlendirir; içerik bileşenleri
// _components/ altında yaşamaya devam eder (ana panel gömer).

import { redirect } from "next/navigation";

export default function AdminEclubCekTeslimatPage() {
  redirect("/admin");
}
