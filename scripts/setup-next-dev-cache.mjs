import fs from "node:fs";
import os from "node:os";
import path from "node:path";

if (process.platform !== "win32") {
  process.exit(0);
}

const projectRoot = process.cwd();
const nextRoot = path.join(projectRoot, ".next");
const devPath = path.join(nextRoot, "dev");
const defaultTarget = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "streamrace", "next-dev")
  : path.join(os.tmpdir(), "streamrace-next-dev");
const targetPath = path.resolve(
  process.env.NEXT_DEV_CACHE_DIR || defaultTarget,
);
const targetRoot = path.dirname(targetPath);
const moduleLinkPath = path.join(targetRoot, "node_modules");
const projectNodeModulesPath = path.join(projectRoot, "node_modules");

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

if (!isInside(projectRoot, devPath) || path.basename(devPath) !== "dev") {
  throw new Error(`Refusing to replace unexpected path: ${devPath}`);
}

function removeDevPath() {
  const current = fs.lstatSync(devPath);

  if (current.isSymbolicLink()) {
    fs.rmSync(devPath, { force: true });
    return;
  }

  fs.rmSync(devPath, { recursive: true, force: true });
}

function ensureJunction(linkPath, target) {
  let shouldCreate = true;

  try {
    const current = fs.lstatSync(linkPath);

    if (!current.isSymbolicLink()) {
      throw new Error(
        `Refusing to replace non-junction path: ${linkPath}`,
      );
    }

    shouldCreate = fs.realpathSync(linkPath) !== fs.realpathSync(target);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  if (!shouldCreate) return;

  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { force: true });
  }

  fs.symlinkSync(target, linkPath, "junction");
  console.log(`[next-dev-cache] ${linkPath} -> ${target}`);
}

fs.mkdirSync(nextRoot, { recursive: true });
fs.mkdirSync(targetRoot, { recursive: true });
fs.mkdirSync(targetPath, { recursive: true });

let shouldCreateJunction = true;

try {
  const current = fs.lstatSync(devPath);

  if (current.isSymbolicLink()) {
    shouldCreateJunction = fs.realpathSync(devPath) !== fs.realpathSync(targetPath);
  } else {
    // .next/dev is generated output. Keep the slower project drive out of the dev loop.
    removeDevPath();
  }
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

if (shouldCreateJunction) {
  if (fs.existsSync(devPath)) {
    removeDevPath();
  }

  fs.symlinkSync(targetPath, devPath, "junction");
  console.log(`[next-dev-cache] .next/dev -> ${targetPath}`);
}

if (fs.existsSync(projectNodeModulesPath)) {
  ensureJunction(moduleLinkPath, projectNodeModulesPath);
}
