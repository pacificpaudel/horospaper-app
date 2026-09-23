import { NextRequest, NextResponse } from "next/server";
import { searchCities } from "@/lib/cities";

/** Birth-location dropdown search: GET /api/cities?q=kath */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  return NextResponse.json(
    { cities: searchCities(query) },
    // Static reference data -- let browsers and the CDN reuse answers.
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } },
  );
}
