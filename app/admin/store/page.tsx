// app/admin/store/page.tsx
//
// M2-b — HBStore yönetimi ana panele taşındı (/admin → üst bar HBStore bölümü).
// Bu eski URL kalıcı olarak ana panele yönlendirir; içerik bileşenleri
// _components/ altında yaşamaya devam eder (ana panel gömer).

import { redirect } from "next/navigation";

export default function AdminStorePage() {
  redirect("/admin");
}
