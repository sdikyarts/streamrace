const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

type TokenResponse = {
  access_token: string;
  expires_in: number;
};

type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  popularity: number;
};

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as TokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

// Fetches up to 50 artists by Spotify ID in one request.
export async function fetchArtistsByIds(ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  if (ids.length > 50) throw new Error("fetchArtistsByIds accepts at most 50 IDs at a time.");

  const token = await getAccessToken();
  const url = `${API_BASE}/artists?ids=${ids.join(",")}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Spotify artists request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { artists: (SpotifyArtist | null)[] };

  return data.artists.filter((a): a is SpotifyArtist => a !== null);
}
