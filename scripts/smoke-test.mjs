import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dist = new URL('../dist/', import.meta.url).pathname;
const htmlPath = join(dist, 'index.html');
assert.ok(existsSync(htmlPath), 'dist/index.html must exist');
const html = readFileSync(htmlPath, 'utf8');
assert.match(html, /<div id="root"><\/div>/, 'React root must exist');
const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]);
assert.ok(assets.length >= 2, 'Built HTML should reference JS and CSS bundles');
for (const asset of assets) {
  const relative = asset.replace(/^\//, '').replace(/^themediaplanner\//, '');
  assert.ok(existsSync(join(dist, relative)), `Missing built asset: ${relative}`);
}
const jsFiles = readdirSync(join(dist, 'assets')).filter(f => f.endsWith('.js'));
assert.ok(jsFiles.length > 0, 'At least one JS bundle must be generated');
console.log(`Smoke test passed: HTML + ${assets.length} assets + ${jsFiles.length} JS bundle(s).`);
