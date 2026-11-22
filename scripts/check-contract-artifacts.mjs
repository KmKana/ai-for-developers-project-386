import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Проверка контрактной цепочки: TypeSpec -> OpenAPI -> SDK.
// Артефакты перегенерируются, сравниваются с git, а затем рабочее дерево
// возвращается в исходное состояние (включая накопления до проверки изменений).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = ['api/openapi/openapi.yaml', 'frontend/src/sdk'];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd = root) {
  const result =
    process.platform === 'win32'
      ? spawnSync([command, ...args].join(' '), { cwd, stdio: 'inherit', shell: true })
      : spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} завершился с кодом ${result.status}`);
  }
}

function artifactStatus() {
  const result = spawnSync('git', ['status', '--porcelain', '--', ...artifacts], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git status завершился с кодом ${result.status}`);
  }
  return result.stdout.trim();
}

function ensureInstalled(directory, marker) {
  if (!existsSync(join(root, marker))) {
    console.log(`Устанавливаем зависимости в ${directory}...`);
    run(npmCommand, ['ci'], join(root, directory));
  }
}

function reportDrift(label, status) {
  console.error(`${label}: сгенерированные артефакты расходятся с git:`);
  console.error(status);
  console.error('Запустите npm run generate в api/tsp и npm run generate-sdk в frontend.');
}

let backup = null;
let failed = false;

try {
  ensureInstalled('api/tsp', 'api/tsp/node_modules/@typespec/compiler/package.json');
  ensureInstalled('frontend', 'frontend/node_modules/@hey-api/openapi-ts/package.json');

  const before = artifactStatus();
  if (before) {
    reportDrift('До проверки', before);
    process.exit(1);
  }

  backup = mkdtempSync(join(tmpdir(), 'contract-drift-'));
  cpSync(join(root, artifacts[0]), join(backup, 'openapi.yaml'));
  cpSync(join(root, artifacts[1]), join(backup, 'sdk'), { recursive: true });

  run(npmCommand, ['run', 'generate'], join(root, 'api/tsp'));
  run(npmCommand, ['run', 'generate-sdk'], join(root, 'frontend'));

  const after = artifactStatus();
  if (after) {
    reportDrift('После генерации', after);
    failed = true;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  failed = true;
} finally {
  if (backup) {
    rmSync(join(root, artifacts[0]), { force: true });
    cpSync(join(backup, 'openapi.yaml'), join(root, artifacts[0]));
    rmSync(join(root, artifacts[1]), { recursive: true, force: true });
    cpSync(join(backup, 'sdk'), join(root, artifacts[1]), { recursive: true });
    rmSync(backup, { recursive: true, force: true });
  }
}

if (!failed && artifactStatus()) {
  reportDrift('После восстановления', artifactStatus());
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('OK: OpenAPI и SDK соответствуют TypeSpec и закоммиченным артефактам.');
