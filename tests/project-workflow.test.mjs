import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { after, before } from 'node:test';
import {
  parseProjectFile,
  PROJECT_AUTOSAVE_KEY,
  readProjectAutosave,
  saveProjectAutosave,
  serializeProjectFile,
} from '../project-persistence.mjs';

const validationOptions = {
  objectTypes: ['cube', 'player'],
  backgroundIds: ['night', 'day'],
};
const project = {
  version: 2,
  app: 'VolVoxGameDev',
  dimension: '2d',
  background: 'night',
  underground: { depth: 8, texture: 'stone' },
  objects3d: [{ type: 'cube', x: 1.5, y: -2, z: 3, blocklyXml: '<xml />' }],
  objects2d: [{ type: 'player', x: 4, y: 5, solid: true }],
  customModels: {},
};

test('saved project JSON imports with scene data intact', () => {
  const serialized = serializeProjectFile(project);
  const loaded = parseProjectFile(serialized, validationOptions);

  assert.equal(JSON.parse(serialized).app, 'VolVoxGameDev');
  assert.deepEqual(loaded, project);
});

test('autosave persists and restores a project; invalid recovery data is rejected', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(readProjectAutosave(storage), null);
  saveProjectAutosave(storage, project);
  assert.deepEqual(parseProjectFile(readProjectAutosave(storage), validationOptions), project);

  values.set(PROJECT_AUTOSAVE_KEY, '{invalid json');
  assert.throws(
    () => parseProjectFile(readProjectAutosave(storage), validationOptions),
    SyntaxError,
  );
});

let server;
let origin;
before(async () => {
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const files = new Map([
      ['/', ['index.html', 'text/html; charset=utf-8']],
      ['/guide.html', ['guide.html', 'text/html; charset=utf-8']],
      ['/project-format.mjs', ['project-format.mjs', 'text/javascript; charset=utf-8']],
      ['/project-persistence.mjs', ['project-persistence.mjs', 'text/javascript; charset=utf-8']],
    ]);
    const entry = files.get(pathname);
    if (!entry) {
      response.writeHead(404).end();
      return;
    }
    const [filename, contentType] = entry;
    response.writeHead(200, { 'content-type': contentType });
    response.end(await readFile(new URL(`../${filename}`, import.meta.url)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve, reject) => {
  server.close(error => error ? reject(error) : resolve());
}));

test('editor page and local workflow modules are served over HTTP', async () => {
  const [pageResponse, guideResponse, formatResponse, persistenceResponse] = await Promise.all([
    fetch(origin),
    fetch(`${origin}/guide.html`),
    fetch(`${origin}/project-format.mjs`),
    fetch(`${origin}/project-persistence.mjs`),
  ]);
  assert.deepEqual(
    [pageResponse.status, guideResponse.status, formatResponse.status, persistenceResponse.status],
    [200, 200, 200, 200],
  );

  const page = await pageResponse.text();
  assert.match(page, /<main id="main">/);
  assert.match(page, /id="btnSave"/);
  assert.match(page, /id="btnLoad"/);
  assert.match(page, /id="fileLoad"/);
  assert.match(page, /id="projectStatus" role="status" aria-live="polite"/);
  const toolbarGroups = [...page.matchAll(/<div class="toolbar-group[^"]*" role="group" aria-label="([^"]+)">([\s\S]*?)(?=<div class="toolbar-group|<\/header>)/g)];
  assert.deepEqual(toolbarGroups.map(([, label]) => label), ['Режим редактора', 'Размерность сцены', 'Проект', 'Инструменты']);
  assert.match(toolbarGroups[0][2], /data-mode="build"/);
  assert.match(toolbarGroups[1][2], /data-dim="3d"/);
  assert.match(toolbarGroups[2][2], /id="btnSave"[\s\S]*id="btnLoad"[\s\S]*id="projectStatus"/);
  assert.match(toolbarGroups[3][2], /id="btnToggleBlocks"[\s\S]*id="btnSettings"[\s\S]*id="btnGames"[\s\S]*id="btnClear"/);
  assert.match(page, /@media\(max-width:1100px\)\{[\s\S]*?#topbar\{[^}]*flex-wrap:wrap/);
  assert.match(page, /\.toolbar-tools\{flex:1 1 100%;border-left:0;padding-left:0\}/);
  assert.match(page, /clearBtn\.parentElement\.insertBefore\(openBtn, clearBtn\)/);
  assert.match(page, /setProjectStatus\(`Автосохранено/);
  assert.match(page, /reader\.onerror =/);
  assert.match(page, /Автосохранение не удалось/);
  assert.match(page, /Не удалось импортировать проект/);
  assert.match(page, /Не удалось экспортировать проект/);
  assert.match(page, /id="canvas"/);
  assert.match(page, /id="blocklyDiv"/);
  assert.match(page, /from '\.\/project-persistence\.mjs'/);
  assert.match(await persistenceResponse.text(), /export function readProjectAutosave/);
});
