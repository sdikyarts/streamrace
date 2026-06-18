import { describe, expect, it } from "vitest";

import type { EndpointBranches } from "./deployment-info";
import {
  getDatabaseInfo,
  getExpectedDatabaseBranch,
  isDatabaseBranch,
  isDeploymentInfoAllowed,
} from "./deployment-info";

const testEndpointBranches = {
  "test-development-pooler": "development",
  "test-staging-pooler": "staging",
  "test-production-pooler": "production",
} satisfies EndpointBranches;

describe("getDatabaseInfo", () => {
  it.each([
    ["test-development-pooler", "development"],
    ["test-staging-pooler", "staging"],
    ["test-production-pooler", "production"],
  ] as const)("detects the %s test endpoint as %s", (endpoint, selected) => {
    const info = getDatabaseInfo(
      `postgresql://user:pass@${endpoint}.invalid/testdb?sslmode=require`,
      testEndpointBranches,
    );

    expect(info).toMatchObject({
      configured: true,
      selected,
      endpoint,
      databaseName: "testdb",
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
        "postgresql://user:pass@unknown-database.invalid/testdb",
        testEndpointBranches,
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
