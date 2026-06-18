import { describe, expect, it } from "vitest";

import {
  getDatabaseInfo,
  getExpectedDatabaseBranch,
  isDatabaseBranch,
  isDeploymentInfoAllowed,
} from "./deployment-info";

describe("getDatabaseInfo", () => {
  it.each([
    ["ep-round-poetry-adiz3f0j-pooler", "development"],
    ["ep-autumn-breeze-adl44bsc-pooler", "staging"],
    ["ep-hidden-math-adfk34xh-pooler", "production"],
  ])("detects the %s Neon endpoint as %s", (endpoint, selected) => {
    const info = getDatabaseInfo(
      `postgresql://user:pass@${endpoint}.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`,
    );

    expect(info).toMatchObject({
      configured: true,
      selected,
      endpoint,
      databaseName: "neondb",
      pooled: true,
    });
  });

  it("marks a missing database URL", () => {
    expect(getDatabaseInfo(undefined)).toMatchObject({
      configured: false,
      selected: "missing",
    });
  });

  it("marks an invalid database URL", () => {
    expect(getDatabaseInfo("not-a-url")).toMatchObject({
      configured: true,
      selected: "invalid",
    });
  });

  it("marks an unknown database endpoint", () => {
    expect(
      getDatabaseInfo(
        "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/neondb",
      ),
    ).toMatchObject({
      configured: true,
      selected: "unknown",
      pooled: false,
    });
  });
});

describe("getExpectedDatabaseBranch", () => {
  it("uses production for Vercel production", () => {
    expect(getExpectedDatabaseBranch({ vercelEnv: "production" })).toBe(
      "production",
    );
  });

  it("uses production for the main branch", () => {
    expect(getExpectedDatabaseBranch({ gitBranch: "main" })).toBe(
      "production",
    );
  });

  it("uses staging for the staging branch", () => {
    expect(getExpectedDatabaseBranch({ gitBranch: "staging" })).toBe("staging");
  });

  it("uses development for every other branch", () => {
    expect(getExpectedDatabaseBranch({ gitBranch: "feature/profile" })).toBe(
      "development",
    );
  });
});

describe("isDeploymentInfoAllowed", () => {
  it("allows local checks when no token is configured", () => {
    expect(
      isDeploymentInfoAllowed({
        expectedToken: undefined,
        isVercelDeployment: false,
        providedToken: null,
      }),
    ).toBe(true);
  });

  it("blocks Vercel checks when no token is configured", () => {
    expect(
      isDeploymentInfoAllowed({
        expectedToken: undefined,
        isVercelDeployment: true,
        providedToken: null,
      }),
    ).toBe(false);
  });

  it("allows checks with the configured token", () => {
    expect(
      isDeploymentInfoAllowed({
        expectedToken: "secret",
        isVercelDeployment: true,
        providedToken: "secret",
      }),
    ).toBe(true);
  });

  it("blocks checks with the wrong token", () => {
    expect(
      isDeploymentInfoAllowed({
        expectedToken: "secret",
        isVercelDeployment: true,
        providedToken: "wrong",
      }),
    ).toBe(false);
  });
});

describe("isDatabaseBranch", () => {
  it("recognizes known database branch names", () => {
    expect(isDatabaseBranch("development")).toBe(true);
    expect(isDatabaseBranch("staging")).toBe(true);
    expect(isDatabaseBranch("production")).toBe(true);
  });

  it("rejects non-branch status values", () => {
    expect(isDatabaseBranch("unknown")).toBe(false);
    expect(isDatabaseBranch("missing")).toBe(false);
    expect(isDatabaseBranch("invalid")).toBe(false);
  });
});
