export function getAppEnv() {
  return process.env.APP_ENV ?? "production";
}

export function getRuntimeDatabaseUrl() {
  const env = getAppEnv();

  const url =
    env === "development"
      ? process.env.DATABASE_URL_DEVELOPMENT
      : env === "staging"
        ? process.env.DATABASE_URL_STAGING
        : process.env.DATABASE_URL;

  if (!url) throw new Error(`DATABASE_URL not configured for APP_ENV="${env}".`);
  return url;
}

export function getDirectDatabaseUrl() {
  const env = getAppEnv();

  const url =
    env === "development"
      ? process.env.DIRECT_DATABASE_URL_DEVELOPMENT
      : env === "staging"
        ? process.env.DIRECT_DATABASE_URL_STAGING
        : process.env.DIRECT_DATABASE_URL;

  if (!url) throw new Error(`DIRECT_DATABASE_URL not configured for APP_ENV="${env}".`);
  return url;
}
