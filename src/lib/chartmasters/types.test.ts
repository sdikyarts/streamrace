import { describe, expect, it } from "vitest";

import {
  CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE,
  CHARTMASTERS_ALL_CREDITS_SOURCE_URL,
  CHARTMASTERS_SOURCE_NAME,
} from "./types";

describe("ChartMasters runtime constants", () => {
  it("exposes the source identifiers used by ingestion and health checks", () => {
    expect(CHARTMASTERS_SOURCE_NAME).toBe("chartmasters");
    expect(CHARTMASTERS_ALL_CREDITS_SOURCE_TABLE).toBe(
      "spotify_artists_all_credits",
    );
    expect(CHARTMASTERS_ALL_CREDITS_SOURCE_URL).toContain(
      "most-streamed-artists-ever-on-spotify",
    );
  });
});
