import { execSync, spawnSync } from 'node:child_process'

let branch = ''
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
} catch { /* not in a git repo or git unavailable */ }

const isProd = branch === 'main' || branch === 'staging'
console.log(`[build] branch="${branch || '(unknown)'}" → ${isProd ? 'production' : 'dev'} build`)

const result = spawnSync('npm', ['run', isProd ? 'build:prod' : 'build:dev'], {
  stdio: 'inherit',
  shell: true,
})
process.exit(result.status ?? 1)
