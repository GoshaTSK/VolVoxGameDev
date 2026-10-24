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
  assert.match(page, /<div class="toolbar-primary">[\s\S]*?<div class="toolbar-center">[\s\S]*?<details class="toolbar-overflow" id="toolbarOverflow" open>/);
  assert.match(page, /<details class="toolbar-overflow" id="toolbarOverflow" open>/);
  assert.match(page, /<summary class="toolbar-overflow-summary" aria-label="Ещё действия"/);
  assert.match(page, /const compactToolbar = window\.matchMedia\('\(max-width: 1480px\)'\);[\s\S]*const syncToolbarOverflow = \(\) => \{ toolbarOverflow\.open = !compactToolbar\.matches; \};[\s\S]*syncToolbarOverflow\(\);[\s\S]*compactToolbar\.addEventListener\('change', syncToolbarOverflow\);/);
  assert.match(page, /<div class="toolbar-overflow-content">[\s\S]*<div class="toolbar-actions" role="group" aria-label="Проект и настройки">[\s\S]*id="btnSave"[\s\S]*id="btnLoad"[\s\S]*id="btnSettings"[\s\S]*<div class="toolbar-group toolbar-tools" role="group" aria-label="Инструменты">/);
  assert.match(page, /id="fileLoad"/);
  assert.match(page, /id="projectStatus" role="status" aria-live="polite" aria-atomic="true"[^>]*title="Автосохранение запускается…" tabindex="0"/);
  assert.match(page, /<div class="toolbar-group" role="group" aria-label="Режим редактора">[\s\S]*data-mode="build"[\s\S]*data-mode="play"/);
  assert.match(page, /data-mode="build" aria-label="Конструирование" title="Конструирование"/);
  assert.match(page, /class="mode-label-short">Строить/);
  assert.match(page, /<div class="toolbar-group" role="group" aria-label="Размерность сцены">[\s\S]*data-dim="3d"[\s\S]*data-dim="2d"/);
  assert.equal([...page.matchAll(/class="dim-btn/g)].length, 2, 'there is exactly one 2D/3D view toggle');
  const tools = page.match(/<div class="toolbar-group toolbar-tools" role="group" aria-label="Инструменты">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(tools, 'tools are present in the inline group and overflow menu');
  assert.match(tools, /id="btnToggleBlocks"[\s\S]*id="btnModeler"[\s\S]*id="btnGames"[\s\S]*id="btnMultiplayer"[\s\S]*id="btnGuide"[\s\S]*id="btnTo2D"[\s\S]*id="btnTo3D"[\s\S]*id="btnClear"/);
  assert.match(page, /id="btnSettings"[^>]*aria-label="Настройки"/);
  assert.match(page, /id="btnSave"[^>]*aria-label="Сохранить проект"/);
  assert.match(page, /id="btnLoad"[^>]*aria-label="Загрузить проект"/);
  for (const id of ['btnSave', 'btnLoad', 'btnSettings', 'btnToggleBlocks', 'btnModeler', 'btnGames', 'btnMultiplayer', 'btnGuide', 'btnTo2D', 'btnTo3D', 'btnClear']) {
    assert.equal([...page.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `${id} exists once`);
  }
  assert.match(page, /#app\{display:grid;grid-template-rows:auto minmax\(0,1fr\);height:100vh;min-height:0\}/);
  assert.match(page, /#topbar\{position:relative;display:flex;align-items:center;[^}]*backdrop-filter:blur\(24px\)/);
  assert.match(page, /\.toolbar-primary\{display:flex;align-items:center;[^}]*flex-wrap:nowrap/);
  assert.match(page, /@media\(max-width:1480px\)\{[\s\S]*?\.toolbar-overflow-summary\{display:flex/);
  assert.match(page, /\.toolbar-overflow-content\{display:flex;align-items:center;gap:6px\}/);
  assert.match(page, /@media\(max-width:380px\)\{[\s\S]*?\.mode-label-short\{display:inline\}/);
  assert.match(page, /\.toolbar-overflow\[open\] \.toolbar-overflow-content\{display:flex;flex-direction:column\}/);
  assert.match(page, /event\.key === 'Escape' && toolbarOverflow\.open/);
  assert.doesNotMatch(page, /toolbar-primary\{flex-wrap:wrap/);
  assert.doesNotMatch(page, /toolbar-tools\{flex:1 1 100%/);
  assert.match(page, /tools\.insertBefore\(openBtn, clearBtn\)/);
  assert.match(page, /class="tool-btn danger-tool" id="btnClear"/);
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
