import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PROJECT_VERSION,
  validateAndNormalizeProject,
} from '../project-format.mjs';

const options = {
  objectTypes: ['cube', 'player'],
  backgroundIds: ['night', 'day'],
};

test('migrates the existing version 1 project format without dropping fields', () => {
  const source = {
    version: 1,
    app: 'VolVoxGameDev',
    dimension: '3d',
    background: 'night',
    objects3d: [{ type: 'cube', x: 1, customField: 'kept' }],
    objects2d: [],
    customModels: {},
  };

  const normalized = validateAndNormalizeProject(source, options);

  assert.equal(normalized.version, CURRENT_PROJECT_VERSION);
  assert.deepEqual(normalized.objects3d, source.objects3d);
  assert.deepEqual(normalized.objects2d, []);
  assert.equal(normalized.objects3d[0].customField, 'kept');
});

test('accepts legacy files without a version and a missing dimension list', () => {
  const normalized = validateAndNormalizeProject({
    app: 'VolVoxGameDev',
    objects2d: [{ type: 'player' }],
  }, options);

  assert.equal(normalized.version, CURRENT_PROJECT_VERSION);
  assert.deepEqual(normalized.objects3d, []);
  assert.equal(normalized.objects2d.length, 1);
});

test('rejects unsupported versions, unknown objects and malformed values', () => {
  const valid = { objects3d: [{ type: 'cube', x: 0 }], objects2d: [] };

  assert.throws(() => validateAndNormalizeProject({ ...valid, version: 99 }, options), /Unsupported project version/);
  assert.throws(() => validateAndNormalizeProject({ ...valid, objects3d: [{ type: 'alien' }] }, options), /Unknown object type/);
  assert.throws(() => validateAndNormalizeProject({ ...valid, objects3d: [{ type: 'cube', x: Infinity }] }, options), /Invalid objects3d/);
  assert.throws(() => validateAndNormalizeProject({ ...valid, background: 'not-a-background' }, options), /Unknown background/);
  assert.throws(() => validateAndNormalizeProject({ objects3d: null }, options), /objects3d or objects2d/);
});

test('validates custom model parts before accepting custom objects', () => {
  const data = {
    objects3d: [{ type: 'custom_model1' }],
    objects2d: [],
    customModels: {
      model1: {
        name: 'Test model',
        parts: [{ type: 'box', pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1], color: '#38bdf8' }],
      },
    },
  };

  assert.equal(validateAndNormalizeProject(data, options).objects3d.length, 1);
  assert.throws(() => validateAndNormalizeProject({
    ...data,
    customModels: { model1: { name: 'Broken', parts: [{ type: 'unknown' }] } },
  }, options), /Invalid model part/);
});
