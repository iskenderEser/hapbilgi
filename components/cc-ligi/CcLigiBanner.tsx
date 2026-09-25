import Image from "next/image";

const DONEMLER = [1, 2, 3, 4] as const;

function DonemLideriKarti({ donem }: { donem: number }) {
  const ustYolId = `donem-lideri-ust-yol-${donem}`;
  const altYolId = `donem-lideri-alt-yol-${donem}`;
  const gumusId = `oyma-gumus-${donem}`;
  const oymaId = `oyma-gumus-etkisi-${donem}`;

  return (
    <div
      aria-label={`${donem}. Dönem Öğrenme Lideri banner alanı`}
      className="relative aspect-square min-w-0 overflow-hidden rounded-2xl border border-[#d6e2ef] shadow-sm"
      style={{
        background: [
          "linear-gradient(90deg, rgba(0,5,18,0.42) 0%, rgba(0,5,18,0) 23%, rgba(0,5,18,0) 77%, rgba(0,5,18,0.42) 100%)",
          "radial-gradient(circle at 42% 24%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 48%)",
          "linear-gradient(140deg, #03142f 0%, #07549c 30%, #163f78 50%, #0862b0 70%, #020d21 100%)",
        ].join(", "),
      }}
    >
      <Image
        src="/cc-ligi-yil-lider-0926.png?v=3"
        alt=""
        fill
        unoptimized
        sizes="(max-width: 640px) 50vw, 25vw"
        className="scale-[0.89] object-contain grayscale saturate-0 brightness-110 contrast-105"
      />
      <svg
        viewBox="0 0 240 240"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <path id={ustYolId} d="M 24 166 Q 120 145 216 166" />
          <path id={altYolId} d="M 47 189 Q 120 178 193 189" />
          <linearGradient id={gumusId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="48%" stopColor="#8c98a7" />
            <stop offset="100%" stopColor="#e5e7eb" />
          </linearGradient>
          <filter id={oymaId} x="-20%" y="-30%" width="140%" height="170%">
            <feDropShadow dx="0" dy="-0.75" stdDeviation="0.35" floodColor="#2f3742" floodOpacity="0.95" />
            <feDropShadow dx="0" dy="0.9" stdDeviation="0.35" floodColor="#ffffff" floodOpacity="0.9" />
          </filter>
        </defs>
        <text
          fill={`url(#${gumusId})`}
          stroke="#414b58"
          strokeWidth="0.28"
          fontFamily="Nunito, sans-serif"
          fontSize="6.5"
          fontWeight="900"
          letterSpacing="0.35"
          filter={`url(#${oymaId})`}
        >
          <textPath href={`#${ustYolId}`} startOffset="50%" textAnchor="middle">
            {donem}. DÖNEM ÖĞRENME LİDERİ
          </textPath>
        </text>
        <text
          fill={`url(#${gumusId})`}
          stroke="#414b58"
          strokeWidth="0.42"
          fontFamily="Nunito, sans-serif"
          fontSize="15.5"
          fontWeight="1000"
          letterSpacing="1.05"
          filter={`url(#${oymaId})`}
        >
          <textPath href={`#${altYolId}`} startOffset="50%" textAnchor="middle">
            AD SOYAD
          </textPath>
        </text>
      </svg>
    </div>
  );
}

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Dönem Öğrenme Liderleri">
        {DONEMLER.map((donem) => (
          <DonemLideriKarti key={donem} donem={donem} />
        ))}
      </div>
    </div>
  );
}
