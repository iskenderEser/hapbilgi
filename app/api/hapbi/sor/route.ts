import { NextResponse } from "next/server";

export const maxDuration = 60;

const headers = { "Cache-Control": "no-store" };

export async function POST() {
  return NextResponse.json(
    {
      error: "hapbi şu anda yanıt veremiyor. Lütfen tekrar deneyin.",
      kod: "HAPBI_MOTORU_KAPALI",
    },
    { status: 503, headers },
  );
}
