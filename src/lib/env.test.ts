import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getAppEnv,
  getDirectDatabaseUrl,
  getRuntimeDatabaseUrl,
} from "./env";

const envKeys = [
  "APP_ENV",
  "DATABASE_URL",
  "DATABASE_URL_DEVELOPMENT",
  "DATABASE_URL_STAGING",
  "DIRECT_DATABASE_URL",
  "DIRECT_DATABASE_URL_DEVELOPMENT",
  "DIRECT_DATABASE_URL_STAGING",
] as const;

const originalEnv = new Map(
  envKeys.map((key) => [key, process.env[key]] as const),
);

function clearEnv() {
  for (const key of envKeys) {
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of envKeys) {
    const value = originalEnv.get(key);

    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("environment helpers", () => {
  beforeEach(() => {
    clearEnv();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("defaults APP_ENV to production", () => {
    expect(getAppEnv()).toBe("production");
  });

  it.each([
    ["development", "DATABASE_URL_DEVELOPMENT", "postgres://dev"],
    ["staging", "DATABASE_URL_STAGING", "postgres://staging"],
    ["production", "DATABASE_URL", "postgres://prod"],
  ] as const)("uses the %s runtime database URL", (appEnv, key, value) => {
    process.env.APP_ENV = appEnv;
    process.env[key] = value;

    expect(getRuntimeDatabaseUrl()).toBe(value);
  });

  it.each([
    ["development", "DIRECT_DATABASE_URL_DEVELOPMENT", "postgres://dev-direct"],
    ["staging", "DIRECT_DATABASE_URL_STAGING", "postgres://staging-direct"],
    ["production", "DIRECT_DATABASE_URL", "postgres://prod-direct"],
  ] as const)("uses the %s direct database URL", (appEnv, key, value) => {
    process.env.APP_ENV = appEnv;
    process.env[key] = value;

    expect(getDirectDatabaseUrl()).toBe(value);
  });

  it("throws when the selected runtime database URL is missing", () => {
    process.env.APP_ENV = "staging";

    expect(() => getRuntimeDatabaseUrl()).toThrow(
      'DATABASE_URL not configured for APP_ENV="staging".',
    );
  });

  it("throws when the selected direct database URL is missing", () => {
    process.env.APP_ENV = "development";

    expect(() => getDirectDatabaseUrl()).toThrow(
      'DIRECT_DATABASE_URL not configured for APP_ENV="development".',
    );
  });
});
