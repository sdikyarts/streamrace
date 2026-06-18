import {
  getDatabaseInfo,
  getExpectedDatabaseBranch,
  isDatabaseBranch,
  isDeploymentInfoAllowed,
} from "@/lib/deployment-info";

export async function GET(request: Request) {
  if (
    !isDeploymentInfoAllowed({
      expectedToken: process.env.DEPLOYMENT_INFO_TOKEN,
      isVercelDeployment: process.env.VERCEL === "1",
      providedToken: request.headers.get("x-deployment-info-token"),
    })
  ) {
    return new Response(null, { status: 404 });
  }

  const database = getDatabaseInfo(process.env.DATABASE_URL);
  const expectedDatabaseBranch = getExpectedDatabaseBranch({
    vercelEnv: process.env.VERCEL_ENV,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF,
  });
  const selectedDatabaseBranch = database.selected;
  const matchesExpected = isDatabaseBranch(selectedDatabaseBranch)
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
