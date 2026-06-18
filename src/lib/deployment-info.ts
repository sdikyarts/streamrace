export type DatabaseBranch = "development" | "staging" | "production";
export type SelectedDatabaseBranch =
  | DatabaseBranch
  | "missing"
  | "unknown"
  | "invalid";
export type EndpointBranches = Record<string, DatabaseBranch>;

type DatabaseInfo = {
  configured: boolean;
  selected: SelectedDatabaseBranch;
  endpoint: string | null;
  databaseName: string | null;
  pooled: boolean | null;
};

const neonEndpointBranches: EndpointBranches = {
  "ep-round-poetry-adiz3f0j-pooler": "development",
  "ep-autumn-breeze-adl44bsc-pooler": "staging",
  "ep-hidden-math-adfk34xh-pooler": "production",
};

export function getDatabaseInfo(
  databaseUrl: string | undefined,
  endpointBranches: EndpointBranches = neonEndpointBranches,
): DatabaseInfo {
  if (!databaseUrl) {
    return {
      configured: false,
      selected: "missing" as const,
      endpoint: null,
      databaseName: null,
      pooled: null,
    };
  }

  try {
    const parsed = new URL(databaseUrl);
    const endpoint = parsed.hostname.split(".")[0] || null;

    return {
      configured: true,
      selected: endpoint
        ? (endpointBranches[endpoint] ?? "unknown")
        : "unknown",
      endpoint,
      databaseName: parsed.pathname.replace(/^\//, "") || null,
      pooled: endpoint?.endsWith("-pooler") ?? false,
    };
  } catch {
    return {
      configured: true,
      selected: "invalid" as const,
      endpoint: null,
      databaseName: null,
      pooled: null,
    };
  }
}

export function getExpectedDatabaseBranch({
  vercelEnv,
  gitBranch,
}: {
  vercelEnv?: string;
  gitBranch?: string;
}): DatabaseBranch {
  if (vercelEnv === "production" || gitBranch === "main") {
    return "production";
  }

  if (gitBranch === "staging") {
    return "staging";
  }

  return "development";
}

export function isDatabaseBranch(
  branch: SelectedDatabaseBranch,
): branch is DatabaseBranch {
  return (
    branch === "development" ||
    branch === "staging" ||
    branch === "production"
  );
}

export function isDeploymentInfoAllowed({
  expectedToken,
  isVercelDeployment,
  providedToken,
}: {
  expectedToken?: string;
  isVercelDeployment: boolean;
  providedToken: string | null;
}) {
  if (!expectedToken) {
    return !isVercelDeployment;
  }

  return providedToken === expectedToken;
}
