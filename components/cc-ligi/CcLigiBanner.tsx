import Image from "next/image";

export default function CcLigiBanner() {
  return (
    <div className="mb-4 space-y-4">
      <div
        aria-label="Yılın Öğrenme Lideri banner alanı"
        className="relative mx-auto aspect-square w-[279px] max-w-full overflow-hidden rounded-2xl border border-[#dfe7f0] bg-white shadow-sm xl:w-[312px]"
        style={{
          background: [
            "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0) 27%, rgba(0,0,0,0) 73%, rgba(0,0,0,0.62) 100%)",
            "radial-gradient(circle at 50% 46%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0) 68%)",
            "linear-gradient(140deg, #14171a 0%, #50555b 30%, #30343a 50%, #5d636a 70%, #101214 100%)",
          ].join(", "),
        }}
      >
        <Image
          src="/cc-ligi-yil-lider-0926.png?v=3"
          alt="C-Club yılın öğrenme lideri"
          width={240}
          height={240}
          priority
          unoptimized
          className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 object-contain xl:h-[269px] xl:w-[269px]"
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 xl:h-[269px] xl:w-[269px]">
          <div className="absolute left-[22.75%] top-[7%] h-[49.5%] w-[54.5%] overflow-hidden rounded-full">
            <Image
                src="/iskendereser-seffaf.png"
              alt="İskender Eser"
              fill
              priority
              sizes="150px"
                className="scale-[1.18] object-contain object-top"
            />
          </div>
        </div>
        <svg
          viewBox="0 0 240 240"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 overflow-visible xl:h-[269px] xl:w-[269px]"
        >
          <defs>
            <path id="yil-lideri-ust-yol" d="M 24 166 Q 120 145 216 166" />
            <path id="yil-lideri-alt-yol" d="M 47 189 Q 120 178 193 189" />
            <linearGradient id="oyma-altin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#704000" />
              <stop offset="48%" stopColor="#b9780b" />
              <stop offset="100%" stopColor="#e7b746" />
            </linearGradient>
            <filter id="oyma-etkisi" x="-20%" y="-30%" width="140%" height="170%">
              <feDropShadow dx="0" dy="-0.75" stdDeviation="0.35" floodColor="#5b3000" floodOpacity="0.95" />
              <feDropShadow dx="0" dy="0.9" stdDeviation="0.35" floodColor="#ffe49a" floodOpacity="0.9" />
            </filter>
          </defs>
          <text
            fill="url(#oyma-altin)"
            stroke="#6a3900"
            strokeWidth="0.28"
            fontFamily="Nunito, sans-serif"
            fontSize="6.7"
            fontWeight="900"
            letterSpacing="0.45"
            filter="url(#oyma-etkisi)"
          >
            <textPath href="#yil-lideri-ust-yol" startOffset="50%" textAnchor="middle">2026 YILININ ÖĞRENME LİDERİ</textPath>
          </text>
          <text
            fill="url(#oyma-altin)"
            stroke="#623400"
            strokeWidth="0.42"
            fontFamily="Nunito, sans-serif"
            fontSize="15.5"
            fontWeight="1000"
            letterSpacing="1.05"
            filter="url(#oyma-etkisi)"
          >
            <textPath href="#yil-lideri-alt-yol" startOffset="50%" textAnchor="middle">İSKENDER ESER</textPath>
          </text>
        </svg>
      </div>
      <div
        aria-label="Dönem Öğrenme Liderleri banner alanı"
        className="relative aspect-[30/7] w-full overflow-hidden rounded-2xl border border-[#dfe7f0] bg-white shadow-sm"
        style={{
          background: [
            "linear-gradient(90deg, rgba(0,5,18,0.42) 0%, rgba(0,5,18,0) 18%, rgba(0,5,18,0) 82%, rgba(0,5,18,0.42) 100%)",
            "radial-gradient(ellipse at 32% 18%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 38%)",
            "linear-gradient(140deg, #03142f 0%, #07549c 30%, #163f78 50%, #0862b0 70%, #020d21 100%)",
          ].join(", "),
        }}
      >
        <Image
          src="/cclub-ligi-0926-gumus-seffaf.png"
          alt="C-Club dönem öğrenme liderleri"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 992px"
          className="object-contain object-center"
        />
      </div>
    </div>
  );
}
