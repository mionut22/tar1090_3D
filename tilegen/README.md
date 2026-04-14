# Tilegen

This directory contains tile generation assets, configuration, and service files.

## Main Files

- `tilegen`: tile generation executable
- `lstreets.json`: style/config used for rendering
- `systemd/tilegen.service`: service unit file

## Dependency

`mbgl-render` is required for rendering map tiles.

GitHub: <https://github.com/consbio/mbgl-render>

## Map Source

Maps rendered by this setup are created with OpenFreeMap.

Reference: <https://openfreemap.org/>

## Notes

- Keep generated tile outputs out of git unless explicitly needed.
- Version style/config files and service definitions.
