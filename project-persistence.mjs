import { validateAndNormalizeProject } from './project-format.mjs';

export const PROJECT_AUTOSAVE_KEY = 'vvg_project_autosave_v1';

export function serializeProjectFile(data) {
  return JSON.stringify(data, null, 2);
}

export function parseProjectFile(serialized, options) {
  return validateAndNormalizeProject(JSON.parse(serialized), options);
}

export function saveProjectAutosave(storage, data) {
  storage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(data));
}

export function readProjectAutosave(storage) {
  return storage.getItem(PROJECT_AUTOSAVE_KEY);
}
