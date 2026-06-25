import { getArtistImages } from "@/lib/artist-images";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    artists: await getArtistImages(),
  });
}
