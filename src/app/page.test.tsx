import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => ({
    type: "img",
    props,
  }),
}));

import Home from "./page";

describe("Home", () => {
  it("renders the starter page shell", () => {
    const element = Home();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe("div");
    expect(element.props).toMatchObject({
      className:
        "flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black",
    });
  });
});
