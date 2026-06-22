export function getAppEnv() {
  return process.env.APP_ENV ?? "production";
}

function getDatabaseUrlByEnv({
  development,
  production,
  staging,
}: {
  development: string | undefined;
  production: string | undefined;
  staging: string | undefined;
}) {
  switch (getAppEnv()) {
    case "development":
      return development;
    case "staging":
      return staging;
    default:
      return production;
  }
}

export function getRuntimeDatabaseUrl() {
  const env = getAppEnv();
  const url = getDatabaseUrlByEnv({
    development: process.env.DATABASE_URL_DEVELOPMENT,
    staging: process.env.DATABASE_URL_STAGING,
    production: process.env.DATABASE_URL,
  });

  if (!url) throw new Error(`DATABASE_URL not configured for APP_ENV="${env}".`);
  return url;
}

export function getDirectDatabaseUrl() {
  const env = getAppEnv();
  const url = getDatabaseUrlByEnv({
    development: process.env.DIRECT_DATABASE_URL_DEVELOPMENT,
    staging: process.env.DIRECT_DATABASE_URL_STAGING,
    production: process.env.DIRECT_DATABASE_URL,
  });

  if (!url) throw new Error(`DIRECT_DATABASE_URL not configured for APP_ENV="${env}".`);
  return url;
}
