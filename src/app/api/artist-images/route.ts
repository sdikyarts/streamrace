import { getArtistImages } from "@/lib/artist-images";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(
      {
        artists: await getArtistImages(),
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Failed to load artist images.", error);
    return Response.json(
      { artists: [], error: "Failed to load artist images" },
      { status: 503 },
    );
  }
}
