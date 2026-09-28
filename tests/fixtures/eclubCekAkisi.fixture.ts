export const ECLUB_CEK_AKISI_FIXTURE = {
  talepId: "10000000-0000-4000-8000-000000000001",
  eczaneId: "10000000-0000-4000-8000-000000000002",
  firmaId: "10000000-0000-4000-8000-000000000003",
  cekKodu: "MIGROS-FAZ6-TEST",
  cekTutariTl: 500,
  kisiler: [
    {
      kisiId: "10000000-0000-4000-8000-000000000011",
      authUserId: "10000000-0000-4000-8000-000000000021",
      rol: "eczaci",
      eposta: "ana.eczaci@example.test",
      aktifMi: true,
    },
    {
      kisiId: "10000000-0000-4000-8000-000000000012",
      authUserId: "10000000-0000-4000-8000-000000000022",
      rol: "teknisyen",
      eposta: "teknisyen@example.test",
      aktifMi: true,
    },
    {
      kisiId: "10000000-0000-4000-8000-000000000013",
      authUserId: "10000000-0000-4000-8000-000000000023",
      rol: "teknisyen",
      eposta: "pasif@example.test",
      aktifMi: false,
    },
  ],
} as const;
