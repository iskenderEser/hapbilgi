export default function TClubPageSkeleton({
  aktifSayfa,
}: {
  aktifSayfa: "lig" | "rapor";
}) {
  return (
    <div
      className="min-h-full bg-[linear-gradient(135deg,#f8fbff_0%,#f6f8fb_48%,#fbfcfe_100%)] px-3 py-3 md:px-5"
      aria-busy="true"
      aria-label={`${aktifSayfa === "lig" ? "T-Club Ligi" : "T-Club Raporları"} yükleniyor`}
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="animate-pulse">
          {aktifSayfa === "lig" ? (
            <>
              <div className="mb-3 h-7 w-44 rounded-lg bg-[#dfe8f2]" />
              <div className="mb-4 aspect-[1932/480] w-full rounded-2xl bg-[#dfe8f2]" />
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                <div className="h-9 w-44 rounded-[14px] bg-[#e8eef5]" />
                <div className="h-9 w-72 max-w-full rounded-[14px] bg-[#e8eef5]" />
                <div className="h-9 w-20 rounded-xl bg-[#e8eef5]" />
              </div>
              <div className="h-72 rounded-2xl bg-white shadow-sm" />
            </>
          ) : (
            <>
              <div className="mb-3 h-7 w-44 rounded-lg bg-[#dfe8f2]" />
              <div className="mb-4 h-4 w-64 max-w-[80%] rounded bg-[#e8eef5]" />
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-2xl bg-white shadow-sm" />)}
              </div>
              <div className="h-72 rounded-2xl bg-white shadow-sm" />
            </>
          )}
        </div>
      </div>
      <span className="sr-only">Veriler hazırlanıyor.</span>
    </div>
  );
}
