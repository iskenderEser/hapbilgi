// app/admin/eclub-store/page.tsx
//
// M2-b — E-Club Store yönetimi ana panele taşındı (/admin → üst bar E-Club Store bölümü).
// Bu eski URL kalıcı olarak ana panele yönlendirir; içerik bileşenleri
// _components/ altında yaşamaya devam eder (ana panel gömer).

import { redirect } from "next/navigation";

export default function AdminEclubStorePage() {
  redirect("/admin");
}
