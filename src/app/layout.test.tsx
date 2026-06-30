import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-sans" }),
  Geist_Mono: () => ({ variable: "geist-mono" }),
}));

vi.mock("next/font/local", () => {
  let count = 0;
  const names = ["helvetica", "burst"];
  return {
    default: () => ({ variable: names[count++ % names.length] }),
  };
});

import RootLayout, { metadata } from "./layout";

describe("RootLayout", () => {
  it("exports default metadata", () => {
    expect(metadata).toMatchObject({
      title: "StreamRace",
      description: "Not monthly listeners. The all-time stream race.",
    });
  });

  it("renders html and body wrappers around children", () => {
    const element = RootLayout({ children: "content" });

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe("html");
    expect(element.props).toMatchObject({
      lang: "en",
      className: "geist-sans geist-mono helvetica burst h-full antialiased",
      suppressHydrationWarning: true,
    });
  });
});
