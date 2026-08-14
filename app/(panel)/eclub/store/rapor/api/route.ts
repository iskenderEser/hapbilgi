import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  const hedef = new URL("/eclub/siparisler/api", request.url);
  hedef.search = request.nextUrl.search;
  return NextResponse.redirect(hedef, 308);
}
