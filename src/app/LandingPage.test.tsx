// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ArtistSlideshow", () => ({ default: () => null }));

vi.mock("next/link", () => ({
  default: ({ href, children, onMouseEnter, onMouseLeave, style, className }: ComponentProps<'a'>) =>
    createElement("a", { href, onMouseEnter, onMouseLeave, style, className }, children),
}));

import LandingPage from "./LandingPage";

// The button's accessible name matches "START THE RACE" (span text).
// Using getByRole avoids the ambiguity between the <span> and the <button> which
// both have the same textContent in DOM Testing Library's node-text model.
function getStartBtn() {
  return screen.getByRole("button", { name: /START THE RACE/ });
}

describe("LandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the start button and tagline copy", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    expect(getStartBtn()).toBeTruthy();
    expect(screen.getByText(/Not monthly listeners/)).toBeTruthy();
    expect(screen.getByText(/all-time stream race/)).toBeTruthy();
  });

  it("expands mode links when the button is clicked", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    fireEvent.click(getStartBtn());

    expect(screen.getByText("All-Credits Mode")).toBeTruthy();
    expect(screen.getByText("Lead Streams Mode")).toBeTruthy();
    expect(screen.getByText("All-Credits Mode").closest("a")?.getAttribute("href")).toBe("/all-credits");
    expect(screen.getByText("Lead Streams Mode").closest("a")?.getAttribute("href")).toBe("/lead-streams");
  });

  it("collapses the links when the button is clicked a second time", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    const btn = getStartBtn();
    fireEvent.click(btn); // expand
    fireEvent.click(btn); // collapse

    // The expandable div is the last sibling inside the button's parent
    const expandableDiv = btn.parentElement?.querySelector("div:last-child") as HTMLElement | null;
    // collapsed → maxHeight is '0' (or '0px' after browser normalisation); not '300px'
    expect(parseFloat(expandableDiv?.style.maxHeight ?? "1")).toBe(0);
  });

  it("applies hover background-position to the start button on mouseenter/leave", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    const btn = getStartBtn();
    fireEvent.mouseEnter(btn);
    expect((btn as HTMLElement).style.backgroundPosition).toBe("100% 0%");

    fireEvent.mouseLeave(btn);
    expect((btn as HTMLElement).style.backgroundPosition).toBe("0% 0%");
  });

  it("applies hover background-position to the All-Credits link", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    fireEvent.click(getStartBtn());
    const link = screen.getByText("All-Credits Mode").closest("a")!;

    fireEvent.mouseEnter(link);
    expect((link as HTMLElement).style.backgroundPosition).toBe("65% 0%");

    fireEvent.mouseLeave(link);
    expect((link as HTMLElement).style.backgroundPosition).toBe("0% 0%");
  });

  it("applies hover background-position to the Lead Streams link", () => {
    render(createElement(LandingPage, { initialArtists: [] }));

    fireEvent.click(getStartBtn());
    const link = screen.getByText("Lead Streams Mode").closest("a")!;

    fireEvent.mouseEnter(link);
    expect((link as HTMLElement).style.backgroundPosition).toBe("65% 0%");

    fireEvent.mouseLeave(link);
    expect((link as HTMLElement).style.backgroundPosition).toBe("0% 0%");
  });

  it("renders without throwing when initial artists are provided", () => {
    const artists = [
      { url: "https://example.com/a.jpg", name: "Artist A" },
      { url: "https://example.com/b.jpg", name: "Artist B" },
    ];
    expect(() =>
      render(createElement(LandingPage, { initialArtists: artists })),
    ).not.toThrow();
  });
});
