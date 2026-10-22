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

## Save and recover projects

Use the disk and folder buttons in the top toolbar to export a project as JSON
or import a JSON project. Version 1 project files remain supported. The editor
also keeps a local browser autosave while editing and offers to restore it on
the next launch. Autosaves are stored in that browser's local storage and are
not a substitute for exporting a backup.

## Checks

The project-format validation tests use Node.js's built-in test runner:

```sh
node --test tests/project-format.test.mjs
```
