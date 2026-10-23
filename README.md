# VolVoxGameDev

A browser-based 2D/3D game editor. The app is served as static files and loads
Three.js, Blockly, and MQTT from public CDNs.

## Run locally

From the repository root, start a local HTTP server:

```sh
python -m http.server 8000
```

Open <http://localhost:8000/> in a browser. Opening `index.html` directly as a
`file://` URL is not supported because the app uses JavaScript modules.

## Narrow screens and keyboard use

On narrow screens, the editor panels stack vertically and the page can scroll.
Palette items, scene objects, modeler parts, and custom switches can be focused
with Tab and activated with Enter or Space.

## Save and recover projects

Use the disk and folder buttons in the top toolbar to export a project as JSON
or import a JSON project. Version 1 project files remain supported. The editor
also keeps a local browser autosave while editing and offers to restore it on
the next launch. Autosaves are stored in that browser's local storage and are
not a substitute for exporting a backup. The toolbar reports pending changes,
the most recent autosave, and project recovery/import/export results. If an
operation fails, the status explains the next step; autosave failures commonly
mean the browser's local storage is full or unavailable.

## Checks

The project workflow checks use Node.js's built-in test runner and do not need
external services:

```sh
node --test
```

They verify project JSON export/import and autosave/recovery behavior through
the same persistence helpers used by the app, and request the editor page and
its local modules over HTTP. They do not execute the browser app: Three.js and
Blockly are loaded from public CDNs, and this repository has no browser
automation runtime.
