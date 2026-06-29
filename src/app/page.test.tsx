import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import Home from "./page";
import LandingPage from "./LandingPage";

describe("Home", () => {
  it("renders the landing page without blocking on artist images", () => {
    const element = Home();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(LandingPage);
    expect(element.props).toMatchObject({
      initialArtists: [],
    });
  });
});
