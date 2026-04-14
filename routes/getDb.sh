#!/bin/bash
/home/ionut/src/3d_tar1090/routes/generate-csvs.sh
/home/ionut/src/3d_tar1090/routes/generate-jsons.py
/home/ionut/src/3d_tar1090/routes/generate-geojson.py
cat /home/ionut/src/3d_tar1090/routes/airports.geojson | jq . > /home/ionut/src/3d_tar1090//html/geojson/airports.geojson

