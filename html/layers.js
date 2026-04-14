// -*- mode: javascript; indent-tabs-mode: nil; c-basic-offset: 8 -*-
"use strict";

function createBaseLayers() {
    let layers = new ol.Collection();
    let layers_group = new ol.layer.Group({
        layers: layers,
    });

    let world = new ol.Collection();
    let europe = new ol.Collection();

    const tileTransition = onMobile ? 0 : 0;


    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            url: "http://tilegen.ami:8080/sat/{z}/{x}/{y}",
            maxZoom: 20,
        }),
        name: 'esri_streets',
        title: 'Satellite AMI',
        type: 'base',
    }));

    if (1) {
        world.push(new ol.layer.Tile({
            source: new ol.source.OSM({
                url: 'http://tilegen.ami:8080/lstreets/{z}/{x}/{y}',
                attributions: 'AMI TileGen',
                attributionsCollapsible: false,
                maxZoom: 22,
                transition: tileTransition,
            }),
            name: 'AmiMapsStreets',
            title: 'Satellite + Streets AMI',
            type: 'base',
        }));
    }

    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            maxZoom: 17,
            attributionsCollapsible: false,
            transition: tileTransition,
        }),
        name: 'osm',
        title: 'OpenStreetMap',
        type: 'base',
    }));

    if (1) {
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'http://maps.ami/styles/bright',
            properties: {
                type: 'base',
                name: 'AmiMapsBright',
                title: 'Vector Bright AMI',
            },
        }));
    }

    if (1) {
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'http://maps.ami/styles/liberty',
            properties: {
                type: 'base',
                name: 'AmiMapsLiberty',
                title: 'Vector Liberty AMI',
            },
        }));
    }

    if (1) {
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'http://maps.ami/styles/positron',
            properties: {
                type: 'base',
                name: 'AmiMapsPositron',
                title: 'Vector Positron AMI',
            },
        }));
    }

    if (1) {
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'http://maps.ami/styles/dark',
            properties: {
                type: 'base',
                name: 'AmiMapsDark',
                title: 'Vector Dark AMI',
            },
        }));
    }

    if (1) {
        world.push(new olms.MapboxVectorLayer({
            type: 'base',
            name: 'AmiMapsFiord',
            title: 'Vector Fiord AMI',
            styleUrl: 'http://maps.ami/styles/fiord',
            properties: {
                type: 'base',
                name: 'AmiMapsFiord',
                title: 'Vector Fiord AMI',
            },
        }));
    }

    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            url: 'http://tilegen.ami:8080/liberty/{z}/{x}/{y}',
            attributions: 'AMI TileGen',
            attributionsCollapsible: false,
            maxZoom: 22,
            transition: tileTransition,
        }),
        name: 'AmiMapsLiberty (2)',
        title: 'Tile Liberty AMI',
        type: 'base',
    }));

    if (1) {
        world.push(new ol.layer.Tile({
            source: new ol.source.XYZ({
                //url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                url: "http://tilegen.ami:8080/sat/{z}/{y}/{x}",
                attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
                    '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                attributionsCollapsible: false,
                maxZoom: 17,
                transition: tileTransition,
            }),
            name: 'esri',
            title: 'ESRI.com Sat.',
            type: 'base',
        }));
        world.push(new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
                attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
                    '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                attributionsCollapsible: false,
                maxZoom: 16,
                transition: tileTransition,
            }),
            name: 'esri_gray',
            title: 'ESRI.com Gray',
            type: 'base',
        }));
        world.push(new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                attributions: 'Powered by <a href="https://www.esri.com">Esri.com</a>' +
                    '— Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                attributionsCollapsible: false,
                maxZoom: 17,
                transition: tileTransition,
            }),
            name: 'esri_streets',
            title: 'ESRI.com Streets',
            type: 'base',
        }));
    }

    const date = new Date(Date.now() - 86400 * 1000);
    const yesterday = date.getUTCFullYear() + '-' + (date.getUTCMonth() + 1).toString().padStart(2, '0') + '-' + date.getUTCDate().toString().padStart(2, '0');
    world.push(new ol.layer.Tile({
        source: new ol.source.OSM({
            url: 'https://gibs-{a-c}.earthdata.nasa.gov/wmts/epsg3857/best/' +
                'MODIS_Terra_CorrectedReflectance_TrueColor/default/' +
                yesterday + '/' +
                'GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
            attributions: '<a href="https://terra.nasa.gov/about/terra-instruments/modis">MODIS Terra</a> ' +
                yesterday + ' Provided by NASA\'s Global Imagery Browse Services (GIBS), part of NASA\'s Earth Observing System Data and Information System (EOSDIS)',
            maxZoom: 9,
            transition: tileTransition,
        }),
        name: 'gibs',
        title: 'GIBS Clouds ' + yesterday,
        type: 'base',
    }));


    let basemaps = ["dark_all", "dark_nolabels",
        "light_all", "light_nolabels"
    ]


    if (1) {
        let basemap_id = "rastertiles/voyager";
        world.push(new ol.layer.Tile({
            source: new ol.source.OSM({
                "url": "https://{a-d}.basemaps.cartocdn.com/" + basemap_id + "/{z}/{x}/{y}.png",
                "attributions": 'Powered by <a href="https://carto.com">CARTO.com</a>'
                    + ' using data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
                attributionsCollapsible: false,
                maxZoom: 15,
                transition: tileTransition,
            }),
            name: "carto_" + basemap_id,
            title: 'CARTO English',
            type: 'base',
        }));

        for (let i in basemaps) {
            let basemap_id = basemaps[i];

            world.push(new ol.layer.Tile({
                source: new ol.source.OSM({
                    "url": "https://{a-d}.basemaps.cartocdn.com/" + basemap_id + "/{z}/{x}/{y}.png",
                    "attributions": 'Powered by <a href="https://carto.com">CARTO.com</a>'
                        + ' using data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',
                    attributionsCollapsible: false,
                    maxZoom: 15,
                    transition: tileTransition,
                }),
                name: "carto_" + basemap_id,
                title: 'CARTO ' + basemap_id,
                type: 'base',
            }));
        }
    }

    if (loStore['bingKey'] != undefined)
        BingMapsAPIKey = loStore['bingKey'];

    if (BingMapsAPIKey) {
        world.push(new ol.layer.Tile({
            source: new ol.source.BingMaps({
                key: BingMapsAPIKey,
                imagerySet: 'Aerial',
                transition: tileTransition,
            }),
            name: 'bing_aerial',
            title: 'Bing Aerial',
            type: 'base',
        }));
        world.push(new ol.layer.Tile({
            source: new ol.source.BingMaps({
                key: BingMapsAPIKey,
                imagerySet: 'RoadOnDemand',
                transition: tileTransition,
            }),
            name: 'bing_roads',
            title: 'Bing Roads',
            type: 'base',
        }));
    }

    if (loStore['mapboxKey'] != undefined)
        MapboxAPIKey = loStore['mapboxKey'];

    if (MapboxAPIKey) {
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/streets-v10',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_streets',
                title: 'Mapbox Streets',
                type: 'base',
            },
        }));
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/light-v11',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_light',
                title: 'Mapbox Light',
                type: 'base',
            },
        }));
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/dark-v11',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_dark',
                title: 'Mapbox Dark',
                type: 'base',
            },
        }));
        world.push(new olms.MapboxVectorLayer({
            styleUrl: 'mapbox://styles/mapbox/outdoors-v10',
            accessToken: MapboxAPIKey,
            properties: {
                name: 'mapbox_outdoors',
                title: 'Mapbox Outdoors',
                type: 'base',
            },
        }));
    }

    world.push(new ol.layer.Tile({
        source: new ol.source.XYZ({
            "url": "https://map.adsbexchange.com/mapproxy/tiles/1.0.0/openaip/ul_grid/{z}/{x}/{y}.png",
            "attributions": "openAIP.net",
            attributionsCollapsible: false,
            maxZoom: 12,
            transition: tileTransition,
        }),
        name: 'openaip',
        title: 'openAIP TMS',
        type: 'overlay',
        opacity: openAIPOpacity,
        visible: false,
        zIndex: 99,
        maxZoom: 13,
    }));

    if (true) {
        g.getRainviewerLayers = async function (key) {
            const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", { credentials: "omit", });
            const jsonData = await response.json();
            return jsonData[key];
        }

        const rainviewerRadar = new ol.layer.Tile({
            name: 'rainviewer_radar',
            title: 'RainViewer Radar',
            type: 'overlay',
            opacity: rainViewerRadarOpacity,
            visible: false,
            zIndex: 99,
        });
        g.refreshRainviewerRadar = async function () {
            const latestLayer = await g.getRainviewerLayers('radar');
            const rainviewerRadarSource = new ol.source.XYZ({
                url: 'https://tilecache.rainviewer.com' + latestLayer.past[latestLayer.past.length - 1].path + '/512/{z}/{x}/{y}/6/1_1.png',
                attributions: '<a href="https://www.rainviewer.com/api.html" target="_blank">RainViewer.com</a>',
                attributionsCollapsible: false,
                maxZoom: 7,
            });
            rainviewerRadar.setSource(rainviewerRadarSource);
        };

        rainviewerRadar.on('change:visible', function (evt) {
            if (evt.target.getVisible()) {
                g.refreshRainviewerRadar();
                g.refreshRainviewerRadarInterval = window.setInterval(g.refreshRainviewerRadar, 2 * 60 * 1000);
            } else {
                clearInterval(g.refreshRainviewerRadarInterval);
            }
        });

        world.push(rainviewerRadar);
    }

    let createGeoJsonLayer = function (title, name, url, fill, stroke, showLabel = true, Zoom1 = 0, Zoom2 = 20) {
        //        function (title, name, url, fill, stroke, showLabel = true) {
        return new ol.layer.Vector({
            type: 'overlay',
            title: title,
            name: name,
            zIndex: 99,
            visible: true,
            source: new ol.source.Vector({
                url: url,
                transition: tileTransition,
                format: new ol.format.GeoJSON({
                    defaultDataProjection: 'EPSG:4326',
                    projection: 'EPSG:3857'
                })
            }),
            style: function style(feature) {
                const isHovered = feature.get('hovered');
                const international = feature.get('international');
                const scale = international ? 0.18 : 0.12;
                let visible = false;
                if (international) {
                    visible = true; //
                } else {
                    if (OLMap.getView().getZoom() >= 8)
                        visible = true;
                }
                if (!visible) {
                    return null;
                }
                const labelName = feature.get("name");
                const showLabel = isHovered || (labelName && labelName.length <= 10);
                const labelFont = showLabel ? '12px "Open Sans", "Arial Unicode MS", "DejaVu Sans", sans-serif' : '';
                const labelFill = isHovered ? new ol.style.Fill({ color: '#fcf7f7' }) : new ol.style.Fill({ color: '#ffffff' });
                const bgFill = new ol.style.Fill({ color: 'rgba(0, 0, 0, 0.3)' });
                const labelStrokeNarrow = isHovered ? new ol.style.Stroke({ color: '#ffffff', width: 4 }) : new ol.style.Stroke({ color: '#000000', width: 3 });
                const country_code = feature.get("country");
                const flag = '<img width="18" height="12" style="display: block;margin: auto;" src="flags/3x2/' + country_code + '.svg" title="' + feature.get("country") + '"></img>';
                const labelText = showLabel ? feature.get("name").replace(" International", "\nInternational") : '';

                return new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: fill
                    }),
                    stroke: new ol.style.Stroke({
                        color: stroke,
                        width: 1
                    }),
                    image: isHovered ? new ol.style.Icon({
                        src: '/images/airports-sprite.png',
                        scale: scale,
                        anchor: [0.5, 0.5],
                        size: [140, 148],
                        offset: [140, 0],
                        offsetOrigin: 'bottom-left',
                        // opacity: 1,
                    }) : new ol.style.Icon({
                        src: '/images/airports-sprite.png',
                        scale: scale,
                        anchor: [0.5, 0.5],
                        size: [140, 148],
                        offset: [0, 0],
                        offsetOrigin: 'bottom-left',
                        // opacity: 1,
                    }),
                    text: isHovered ? new ol.style.Text({
                        text: labelText,
                        fill: labelFill,
                        backgroundFill: bgFill,
                        stroke: labelStrokeNarrow,
                        textAlign: 'center',
                        textBaseline: labels_top ? 'bottom' : 'top',
                        font: labelFont,
                        padding: [1, 0, -1, 2],
                        offsetY: -27,
                        stroke: new ol.style.Stroke({
                            color: '#000000',
                            width: 1.2
                        })
                    }) : null,
                });
            }
        });
    };
    /*
        layers.push(new ol.layer.Group({
            name: 'custom',
            title: 'Custom',
            layers: custom_layers,
        }));
    */
    if (europe.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'europe',
            title: 'Europe',
            layers: new ol.Collection(europe.getArray().reverse()),
            fold: 'open',
        }));
    }

    if (world.getLength() > 0) {
        layers.push(new ol.layer.Group({
            name: 'world',
            title: 'Maps and Features',
            layers: new ol.Collection(world.getArray().reverse()),
            fold: 'open',
        }));
    }

    world.push(createGeoJsonLayer('World Airports', 'airports',
        'geojson/airports.geojson',
        'rgba(52, 50, 168, 0.3)',
        'rgba(52, 50, 168, 1)', true, 8, 5));


    return layers_group;
}
