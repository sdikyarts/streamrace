import { describe, expect, it } from "vitest";

import {
  ALL_CREDITS_SOURCE_TABLE,
  ALL_CREDITS_SOURCE_URL,
  SOURCE_NAME,
} from "./types";

describe("Source runtime constants", () => {
  it("exposes the source identifiers used by ingestion and health checks", () => {
    expect(SOURCE_NAME).toBe("chartmasters");
    expect(ALL_CREDITS_SOURCE_TABLE).toBe(
      "spotify_artists_all_credits",
    );
    expect(ALL_CREDITS_SOURCE_URL).toContain(
      "most-streamed-artists-ever-on-spotify",
    );
  });
});
