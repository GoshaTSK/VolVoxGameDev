export const CURRENT_PROJECT_VERSION = 2;

const MAX_OBJECTS_PER_DIMENSION = 10000;
const MAX_MODELS = 1000;
const MAX_PARTS_PER_MODEL = 500;
const MAX_TEXT_LENGTH = 1_000_000;
const MAX_STL_LENGTH = 12_000_000;
const MODEL_PART_TYPES = new Set([
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'capsule', 'tetra', 'octa', 'stl',
]);
const OBJECT_NUMBER_FIELDS = [
  'x', 'y', 'z', 'ry', 'sx', 'sy', 'sz', 'layer2D', 'hp', 'maxHp',
  'zoneRadius', 'rampAngle',
];
const OBJECT_BOOLEAN_FIELDS = ['solid', 'invulnerable'];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateNumber(value, field, { min = -1e7, max = 1e7 } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${field}`);
  }
}

function validateString(value, field, maxLength = 1000) {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`Invalid ${field}`);
  }
}

function validateVector(value, field) {
  if (!Array.isArray(value) || value.length !== 3) throw new Error(`Invalid ${field}`);
  value.forEach((part, index) => validateNumber(part, `${field}[${index}]`));
}

function validateModel(model, id) {
  if (!isRecord(model)) throw new Error(`Invalid custom model "${id}"`);
  validateString(model.name, `customModels.${id}.name`, 200);
  if (!Array.isArray(model.parts) || model.parts.length > MAX_PARTS_PER_MODEL) {
    throw new Error(`Invalid custom model parts "${id}"`);
  }
  model.parts.forEach((part, index) => {
    const field = `customModels.${id}.parts[${index}]`;
    if (!isRecord(part) || !MODEL_PART_TYPES.has(part.type)) {
      throw new Error(`Invalid model part "${field}"`);
    }
    for (const key of ['pos', 'rot', 'scale']) {
      if (part[key] !== undefined) validateVector(part[key], `${field}.${key}`);
    }
    if (part.color !== undefined && !/^#[\da-f]{6}$/i.test(part.color)) {
      throw new Error(`Invalid model part color "${field}"`);
    }
    if (part.stlData != null) {
      validateString(part.stlData, `${field}.stlData`, MAX_STL_LENGTH);
      if (part.type !== 'stl' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(part.stlData)) {
        throw new Error(`Invalid STL data "${field}"`);
      }
    }
    if (part.stlName != null) validateString(part.stlName, `${field}.stlName`, 255);
  });
}

function validateObjects(list, dimension, objectTypes, customModelIds) {
  if (!Array.isArray(list) || list.length > MAX_OBJECTS_PER_DIMENSION) {
    throw new Error(`Invalid ${dimension} object list`);
  }
  list.forEach((object, index) => {
    const field = `objects${dimension}[${index}]`;
    if (!isRecord(object) || typeof object.type !== 'string') {
      throw new Error(`Invalid object "${field}"`);
    }
    const customId = object.type.startsWith('custom_') ? object.type.slice(7) : '';
    if (!objectTypes.has(object.type) && !customModelIds.has(customId)) {
      throw new Error(`Unknown object type "${object.type}"`);
    }
    for (const key of OBJECT_NUMBER_FIELDS) {
      if (object[key] !== undefined) validateNumber(object[key], `${field}.${key}`);
    }
    for (const key of OBJECT_BOOLEAN_FIELDS) {
      if (object[key] !== undefined && typeof object[key] !== 'boolean') {
        throw new Error(`Invalid ${field}.${key}`);
      }
    }
    for (const [key, limit] of [
      ['texture', 200], ['blocklyXml', MAX_TEXT_LENGTH], ['label', 200],
      ['cloudWeather', 50], ['netId', 200],
    ]) {
      if (object[key] !== undefined && object[key] !== null) {
        validateString(object[key], `${field}.${key}`, limit);
      }
    }
    if (object.color != null && (typeof object.color !== 'string' || !/^#[\da-f]{6}$/i.test(object.color))) {
      throw new Error(`Invalid ${field}.color`);
    }
  });
}

export function validateAndNormalizeProject(data, {
  objectTypes = [],
  backgroundIds = [],
} = {}) {
  if (!isRecord(data)) throw new Error('Project must be a JSON object');
  if (data.app !== undefined && data.app !== 'VolVoxGameDev') {
    throw new Error('Project belongs to another application');
  }
  if (data.version !== undefined && (!Number.isInteger(data.version) || ![1, CURRENT_PROJECT_VERSION].includes(data.version))) {
    throw new Error(`Unsupported project version "${data.version}"`);
  }
  if (!Array.isArray(data.objects3d) && !Array.isArray(data.objects2d)) {
    throw new Error('Project must contain objects3d or objects2d');
  }
  if (data.dimension !== undefined && data.dimension !== '2d' && data.dimension !== '3d') {
    throw new Error('Invalid project dimension');
  }
  if (data.background !== undefined) {
    validateString(data.background, 'background', 100);
    if (backgroundIds.length && !backgroundIds.includes(data.background)) {
      throw new Error(`Unknown background "${data.background}"`);
    }
  }
  if (data.underground !== undefined) {
    if (!isRecord(data.underground)) throw new Error('Invalid underground settings');
    if (data.underground.depth !== undefined) {
      validateNumber(data.underground.depth, 'underground.depth', { min: 0, max: 1000 });
    }
    if (data.underground.texture !== undefined) {
      validateString(data.underground.texture, 'underground.texture', 200);
    }
  }

  const customModels = data.customModels === undefined ? {} : data.customModels;
  if (!isRecord(customModels)) throw new Error('Invalid customModels');
  const modelEntries = Object.entries(customModels);
  if (modelEntries.length > MAX_MODELS) throw new Error('Too many custom models');
  for (const [id, model] of modelEntries) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error(`Invalid custom model id "${id}"`);
    validateModel(model, id);
  }

  const types = new Set(objectTypes);
  const customModelIds = new Set(modelEntries.map(([id]) => id));
  validateObjects(data.objects3d ?? [], '3d', types, customModelIds);
  validateObjects(data.objects2d ?? [], '2d', types, customModelIds);

  return {
    ...data,
    version: CURRENT_PROJECT_VERSION,
    objects3d: data.objects3d ?? [],
    objects2d: data.objects2d ?? [],
    customModels,
  };
}
