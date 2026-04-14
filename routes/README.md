# Routes

This directory contains route data, generation scripts, and the route service used by tar1090_3D.

## Main Files

- `airlines.csv`, `airports.csv`, `airports.geojson`, `routes.csv`: generated route and airport datasets
- `noroute.json`: fallback data
- `route_server`: route lookup service binary
- `generate-csvs.sh`, `generate-geojson.py`, `generate-jsons.py`: data generation scripts
- `getDb.sh`: helper for obtaining source data
- `systemd/route_server.service`: service unit file

## Notes

- `routes/` is large generated data and is commonly excluded from git in local setups.
- Keep generation scripts and service files versioned.
