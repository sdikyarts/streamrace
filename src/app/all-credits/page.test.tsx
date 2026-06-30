import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  GameUI: vi.fn().mockReturnValue(null),
}));

vi.mock("../GameUI", () => ({
  default: mocks.GameUI,
}));

import AllCreditsPage from "./page";

describe("AllCreditsPage", () => {
  it("renders GameUI with all-credits mode and an empty artist pool", () => {
    const element = AllCreditsPage();
    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(mocks.GameUI);
    expect(element.props).toMatchObject({
      mode: "all-credits",
      initialArtists: [],
    });
  });
});
