import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { EndpointBranches } from "@/lib/deployment-info";

import { createDeploymentInfoResponse, GET } from "./route";

const testEndpointBranches = {
  "test-production-pooler": "production",
} satisfies EndpointBranches;

const envKeys = [
  "DATABASE_URL",
  "DEPLOYMENT_INFO_TOKEN",
  "VERCEL",
  "VERCEL_BRANCH_URL",
  "VERCEL_ENV",
  "VERCEL_GIT_COMMIT_REF",
  "VERCEL_TARGET_ENV",
  "VERCEL_URL",
] as const;

const originalEnv = new Map(
  envKeys.map((key) => [key, process.env[key]] as const),
);

function clearRouteEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

function restoreRouteEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeRequest(token?: string) {
  return new Request("https://example.test/api/deployment-info", {
    headers: token ? { "x-deployment-info-token": token } : undefined,
  });
}

describe("GET /api/deployment-info", () => {
  beforeEach(() => {
    clearRouteEnv();
  });

  afterAll(() => {
    restoreRouteEnv();
  });

  it("blocks Vercel deployments when no token is configured", async () => {
    process.env.VERCEL = "1";

    const response = await GET(makeRequest());

    expect(response.status).toBe(404);
  });

  it("blocks requests with the wrong token", async () => {
    process.env.VERCEL = "1";
    process.env.DEPLOYMENT_INFO_TOKEN = "secret";

    const response = await GET(makeRequest("wrong"));

    expect(response.status).toBe(404);
  });

  it("reports production deployment and dummy database details", async () => {
    const response = createDeploymentInfoResponse({
      request: makeRequest("secret"),
      endpointBranches: testEndpointBranches,
      env: {
        VERCEL: "1",
        DEPLOYMENT_INFO_TOKEN: "secret",
        VERCEL_ENV: "production",
        VERCEL_TARGET_ENV: "production",
        VERCEL_GIT_COMMIT_REF: "main",
        VERCEL_URL: "streamrace.vercel.app",
        VERCEL_BRANCH_URL: "streamrace-git-main.vercel.app",
        DATABASE_URL:
          "postgresql://user:pass@test-production-pooler.invalid/testdb?sslmode=require",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deployment: {
        vercelEnv: "production",
        vercelTargetEnv: "production",
        gitBranch: "main",
        deploymentUrl: "streamrace.vercel.app",
        branchUrl: "streamrace-git-main.vercel.app",
      },
      database: {
        configured: true,
        selected: "production",
        expected: "production",
        matchesExpected: true,
        endpoint: "test-production-pooler",
        databaseName: "testdb",
        pooled: true,
      },
    });
  });

  it("reports a local missing database as unmatched", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      deployment: {
        vercelEnv: "local",
        vercelTargetEnv: null,
        gitBranch: null,
        deploymentUrl: null,
        branchUrl: null,
      },
      database: {
        configured: false,
        selected: "missing",
        expected: "development",
        matchesExpected: null,
      },
    });
  });
});
