"use client";

import { Dialog } from "radix-ui";

const SOZLESME_BASLIKLARI = [
  "KVKK Aydınlatma Metni",
  "Açık Rıza Onay Metni",
  "Gizlilik ve Çerez Politikası",
  "Mesafeli Satış Sözleşmesi",
] as const;

const BAGLANTI_SINIFI =
  "rounded-sm text-center underline-offset-4 hover:text-gray-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-400";

export default function GirisAltBilgileri() {
  return (
    // Masaüstünde eski telif satırının yüksekliği korunur; giriş formu yer değiştirmez.
    <div className="relative mt-20 md:mt-10 md:h-6">
      <div className="bg-white pb-8 md:absolute md:inset-x-0 md:top-10">
        <section
          aria-label="Sözleşmeler ve şirket bilgileri"
          className="grid grid-cols-2 items-start gap-x-6 text-center text-xs leading-relaxed text-gray-400"
        >
          <ul aria-label="Sözleşmeler" className="m-0 flex list-none flex-col gap-2 p-0">
            {SOZLESME_BASLIKLARI.map((baslik) => (
              <li key={baslik}>
                <Dialog.Root>
                  <Dialog.Trigger asChild>
                    <button type="button" className={BAGLANTI_SINIFI}>
                      {baslik}
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
                    <Dialog.Content
                      aria-describedby={undefined}
                      className="fixed left-1/2 top-1/2 z-50 flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-gray-600 shadow-xl"
                      style={{ fontFamily: "'Nunito', sans-serif" }}
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-4">
                        <Dialog.Title className="m-0 text-base font-semibold">
                          {baslik}
                        </Dialog.Title>
                        <Dialog.Close
                          aria-label="Kapat"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400"
                        >
                          <span aria-hidden="true">×</span>
                        </Dialog.Close>
                      </div>
                      {/* Onaylı yasal metinler iletilene kadar içerik bilinçli olarak boştur. */}
                      <div className="min-h-48 overflow-y-auto" />
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              </li>
            ))}
          </ul>

          <address aria-label="Şirket iletişim bilgileri" className="flex min-w-0 flex-col items-center gap-2 not-italic">
            <p className="m-0">Mill Danışmanlık</p>
            <p className="m-0">
              <span className="block whitespace-nowrap">Göktürk / İstanbul</span>
            </p>
            <a href="tel:05324333145" className={BAGLANTI_SINIFI}>
              0532 433 3145
            </a>
            <a href="mailto:info@mill.tr" className={BAGLANTI_SINIFI}>
              info@mill.tr
            </a>
          </address>
        </section>

        <div className="mt-6 text-center text-xs text-gray-400">
          © 2026 HapBilgi · Tüm hakları saklıdır.
        </div>
      </div>
    </div>
  );
}
