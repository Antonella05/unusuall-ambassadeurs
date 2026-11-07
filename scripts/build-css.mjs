// UNUSUALL Ambassadeurs — construit assets/css/app.css
// 1. Regroupe src/site.css (style de unusuall.online) et src/ambassadeurs.css
// 2. Retire les règles qu'aucune page n'utilise (PurgeCSS)
// 3. Compresse en gardant les préfixes utiles aux navigateurs courants (Lightning CSS)
// Lancer : node scripts/build-css.mjs   (à refaire après toute modification de src/ ou des pages)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'amb-css-'));
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) => execFileSync(npx, ['--yes', ...args], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' });

// Classes ajoutées par le script ou par l'état de la page : toujours conservées
const SAFELIST = ['html', 'body', ':root', 'is-in', 'ep-fx', 'active'];

try {
  const full = path.join(tmp, 'full.css');
  const src = ['site.css', 'ambassadeurs.css'].map((f) => fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
  fs.writeFileSync(full, src);
  const config = path.join(tmp, 'purgecss.config.cjs');
  fs.writeFileSync(config, `module.exports = {
  content: ['*.html', 'assets/js/*.js'],
  variables: false, keyframes: true, fontFace: false,
  safelist: { standard: ${JSON.stringify(SAFELIST)}, deep: [/data-theme/, /prefers-/], greedy: [/data-theme/] },
  defaultExtractor: (c) => c.match(/[\\w-/:%.]+(?<!:)/g) || []
};`);
  const purged = path.join(tmp, 'purged.css');
  const min = path.join(tmp, 'min.css');
  run(['purgecss@6.0.0', '--config', config, '--css', full, '--output', purged]);
  run(['lightningcss-cli@1.27.0', '--minify', '--browserslist', purged, '-o', min]);
  fs.mkdirSync(path.join(root, 'assets', 'css'), { recursive: true });
  fs.copyFileSync(min, path.join(root, 'assets', 'css', 'app.css'));
  console.log(`CSS : ${(Buffer.byteLength(src) / 1024).toFixed(0)} Ko -> ${(fs.statSync(min).size / 1024).toFixed(1)} Ko (assets/css/app.css)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
