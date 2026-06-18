type DatabaseBranch = "development" | "staging" | "production";

const neonEndpointBranches: Record<string, DatabaseBranch> = {
  "ep-round-poetry-adiz3f0j-pooler": "development",
  "ep-autumn-breeze-adl44bsc-pooler": "staging",
  "ep-hidden-math-adfk34xh-pooler": "production",
};

function getDatabaseInfo() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      configured: false,
      selected: "missing",
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
      selected: endpoint ? (neonEndpointBranches[endpoint] ?? "unknown") : "unknown",
      endpoint,
      databaseName: parsed.pathname.replace(/^\//, "") || null,
      pooled: endpoint?.endsWith("-pooler") ?? false,
    };
  } catch {
    return {
      configured: true,
      selected: "invalid",
      endpoint: null,
      databaseName: null,
      pooled: null,
    };
  }
}

function getExpectedDatabaseBranch(): DatabaseBranch {
  const vercelEnv = process.env.VERCEL_ENV;
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF;

  if (vercelEnv === "production" || gitBranch === "main") {
    return "production";
  }

  if (gitBranch === "staging") {
    return "staging";
  }

  return "development";
}

function isAllowed(request: Request) {
  const expectedToken = process.env.DEPLOYMENT_INFO_TOKEN;
  const isVercelDeployment = process.env.VERCEL === "1";

  if (!expectedToken) {
    return !isVercelDeployment;
  }

  return request.headers.get("x-deployment-info-token") === expectedToken;
}

export async function GET(request: Request) {
  if (!isAllowed(request)) {
    return new Response(null, { status: 404 });
  }

  const database = getDatabaseInfo();
  const expectedDatabaseBranch = getExpectedDatabaseBranch();
  const selectedDatabaseBranch = database.selected;
  const matchesExpected =
    selectedDatabaseBranch === "development" ||
    selectedDatabaseBranch === "staging" ||
    selectedDatabaseBranch === "production"
      ? selectedDatabaseBranch === expectedDatabaseBranch
      : null;

  return Response.json({
    deployment: {
      vercelEnv: process.env.VERCEL_ENV ?? "local",
      vercelTargetEnv: process.env.VERCEL_TARGET_ENV ?? null,
      gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
      branchUrl: process.env.VERCEL_BRANCH_URL ?? null,
    },
    database: {
      ...database,
      expected: expectedDatabaseBranch,
      matchesExpected,
    },
  });
}
