import {
  type EndpointBranches,
  getDatabaseInfo,
  getExpectedDatabaseBranch,
  isDatabaseBranch,
  isDeploymentInfoAllowed,
} from "@/lib/deployment-info";

type DeploymentEnvironment = Record<string, string | undefined>;

export function createDeploymentInfoResponse({
  request,
  env = process.env,
  endpointBranches,
}: {
  request: Request;
  env?: DeploymentEnvironment;
  endpointBranches?: EndpointBranches;
}) {
  if (
    !isDeploymentInfoAllowed({
      expectedToken: env.DEPLOYMENT_INFO_TOKEN,
      isVercelDeployment: env.VERCEL === "1",
      providedToken: request.headers.get("x-deployment-info-token"),
    })
  ) {
    return new Response(null, { status: 404 });
  }

  const database = getDatabaseInfo(env.DATABASE_URL, endpointBranches);
  const expectedDatabaseBranch = getExpectedDatabaseBranch({
    vercelEnv: env.VERCEL_ENV,
    gitBranch: env.VERCEL_GIT_COMMIT_REF,
  });
  const selectedDatabaseBranch = database.selected;
  const matchesExpected = isDatabaseBranch(selectedDatabaseBranch)
    ? selectedDatabaseBranch === expectedDatabaseBranch
    : null;

  return Response.json({
    deployment: {
      vercelEnv: env.VERCEL_ENV ?? "local",
      vercelTargetEnv: env.VERCEL_TARGET_ENV ?? null,
      gitBranch: env.VERCEL_GIT_COMMIT_REF ?? null,
      deploymentUrl: env.VERCEL_URL ?? null,
      branchUrl: env.VERCEL_BRANCH_URL ?? null,
    },
    database: {
      ...database,
      expected: expectedDatabaseBranch,
      matchesExpected,
    },
  });
}

export async function GET(request: Request) {
  return createDeploymentInfoResponse({ request });
}
