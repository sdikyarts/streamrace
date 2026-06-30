import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  GameUI: vi.fn().mockReturnValue(null),
}));

vi.mock("../GameUI", () => ({
  default: mocks.GameUI,
}));

import LeadStreamsPage from "./page";

describe("LeadStreamsPage", () => {
  it("renders GameUI with lead-streams mode and an empty artist pool", () => {
    const element = LeadStreamsPage();
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(mocks.GameUI);
    expect(element.props).toMatchObject({
      mode: "lead-streams",
      initialArtists: [],
    });
  });
});
