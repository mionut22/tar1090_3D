import OLStyleIcon from 'ol/style/Icon.js';
import VectorSource, {} from 'ol/source/Vector.js';
import OLClusterSource from 'ol/source/Cluster.js';
import { circular as olCreateCircularPolygon } from 'ol/geom/Polygon.js';
import { boundingExtent, getCenter } from 'ol/extent.js';
import olGeomSimpleGeometry from 'ol/geom/SimpleGeometry.js';
import { convertColorToCesium, olGeometryCloneTo4326, ol4326CoordinateToCesiumCartesian, ol4326CoordinateArrayToCsCartesians } from "./core.js";
import VectorLayerCounterpart, {} from "./core/VectorLayerCounterpart.js";
import { getUid, waitReady } from "./util.js";
import {} from 'ol/style/Style.js';
import { Geometry as OLGeometry } from 'ol/geom.js';
export default class FeatureConverter {
    scene;
    /**
     * Bind once to have a unique function for using as a listener
     */
    boundOnRemoveOrClearFeatureListener_ = this.onRemoveOrClearFeature_.bind(this);
    defaultBillboardEyeOffset_ = new Cesium.Cartesian3(0, 0, 10);
    /**
     * Concrete base class for converting from OpenLayers3 vectors to Cesium
     * primitives.
     * Extending this class is possible provided that the extending class and
     * the library are compiled together by the closure compiler.
     * @param scene Cesium scene.
     * @api
     */
    constructor(scene) {
        this.scene = scene;
        this.scene = scene;
    }
    /**
     * @param evt
     */
    onRemoveOrClearFeature_(evt) {
        const source = evt.target;
        console.assert(source instanceof VectorSource);
        const cancellers = source['olcs_cancellers'];
        if (cancellers) {
            const feature = evt.feature;
            if (feature) {
                // remove
                const id = getUid(feature);
                const canceller = cancellers[id];
                if (canceller) {
                    canceller();
                    delete cancellers[id];
                }
            }
            else {
                // clear
                for (const key in cancellers) {
                    if (cancellers.hasOwnProperty(key)) {
                        cancellers[key]();
                    }
                }
                source['olcs_cancellers'] = {};
            }
        }
    }
    /**
     * @param layer
     * @param feature OpenLayers feature.
     * @param primitive
     */
    setReferenceForPicking(layer, feature, primitive) {
        primitive.olLayer = layer;
        primitive.olFeature = feature;
    }
    /**
     * Basics primitive creation using a color attribute.
     * Note that Cesium has 'interior' and outline geometries.
     * @param layer
     * @param feature OpenLayers feature.
     * @param olGeometry OpenLayers geometry.
     * @param geometry
     * @param color
     * @param opt_lineWidth
     * @return primitive
     */
    createColoredPrimitive(layer, feature, olGeometry, geometry, color, opt_lineWidth) {
        const createInstance = function (geometry, color) {
            const instance = new Cesium.GeometryInstance({
                geometry
            });
            if (color && !(color instanceof Cesium.ImageMaterialProperty)) {
                instance.attributes = {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(color)
                };
            }
            return instance;
        };
        const options = {
            flat: true, // work with all geometries
            renderState: {
                depthTest: {
                    enabled: true
                }
            }
        };
        if (opt_lineWidth !== undefined) {
            options.renderState.lineWidth = opt_lineWidth;
        }
        const instances = createInstance(geometry, color);
        const heightReference = this.getHeightReference(layer, feature, olGeometry);
        let primitive;
        if (heightReference === Cesium.HeightReference.CLAMP_TO_GROUND) {
            if (!('createShadowVolume' in instances.geometry.constructor)) {
                // This is not a ground geometry
                return null;
            }
            primitive = new Cesium.GroundPrimitive({
                geometryInstances: instances
            });
        }
        else {
            primitive = new Cesium.Primitive({
                geometryInstances: instances
            });
        }
        if (color instanceof Cesium.ImageMaterialProperty) {
            // FIXME: we created stylings which are not time related
            // What should we pass here?
            // @ts-ignore
            const dataUri = color.image.getValue().toDataURL();
            primitive.appearance = new Cesium.MaterialAppearance({
                flat: true,
                renderState: {
                    depthTest: {
                        enabled: true,
                    }
                },
                material: new Cesium.Material({
                    fabric: {
                        type: 'Image',
                        uniforms: {
                            image: dataUri
                        }
                    }
                })
            });
        }
        else {
            primitive.appearance = new Cesium.MaterialAppearance({
                ...options,
                material: new Cesium.Material({
                    translucent: color.alpha !== 1,
                    fabric: {
                        type: 'Color',
                        uniforms: {
                            color,
                        }
                    }
                })
            });
            if (primitive instanceof Cesium.Primitive && (feature.get('olcs_shadows') || layer.get('olcs_shadows'))) {
                primitive.shadows = 1;
            }
        }
        this.setReferenceForPicking(layer, feature, primitive);
        return primitive;
    }
    /**
     * Return the fill or stroke color from a plain ol style.
     * @param style
     * @param outline
     * @return {!CSColor}
     */
    extractColorFromOlStyle(style, outline) {
        const fillColor = style.getFill()?.getColor();
        const strokeColor = style.getStroke() ? style.getStroke().getColor() : null;
        let olColor = 'black';
        if (strokeColor && outline) {
            olColor = strokeColor;
        }
        else if (fillColor) {
            olColor = fillColor;
        }
        return convertColorToCesium(olColor);
    }
    /**
     * Return the width of stroke from a plain ol style.
     * @param style
     * @return {number}
     */
    extractLineWidthFromOlStyle(style) {
        // Handling of line width WebGL limitations is handled by Cesium.
        const width = style.getStroke() ? style.getStroke().getWidth() : undefined;
        return width !== undefined ? width : 1;
    }
    /**
     * Create a primitive collection out of two Cesium geometries.
     * Only the OpenLayers style colors will be used.
     */
    wrapFillAndOutlineGeometries(layer, feature, olGeometry, fillGeometry, outlineGeometry, olStyle) {
        const fillColor = this.extractColorFromOlStyle(olStyle, false);
        const outlineColor = this.extractColorFromOlStyle(olStyle, true);
        const primitives = new Cesium.PrimitiveCollection();
        if (olStyle.getFill()) {
            const p1 = this.createColoredPrimitive(layer, feature, olGeometry, fillGeometry, fillColor);
            console.assert(!!p1);
            primitives.add(p1);
        }
        if (olStyle.getStroke() && outlineGeometry) {
            const width = this.extractLineWidthFromOlStyle(olStyle);
            const p2 = this.createColoredPrimitive(layer, feature, olGeometry, outlineGeometry, outlineColor, width);
            if (p2) {
                // Some outline geometries are not supported by Cesium in clamp to ground
                // mode. These primitives are skipped.
                primitives.add(p2);
            }
        }
        return primitives;
    }
    // Geometry converters
    // FIXME: would make more sense to only accept primitive collection.
    /**
     * Create a Cesium primitive if style has a text component.
     * Eventually return a PrimitiveCollection including current primitive.
     */
    addTextStyle(layer, feature, geometry, style, primitive) {
        let primitives;
        if (!(primitive instanceof Cesium.PrimitiveCollection)) {
            primitives = new Cesium.PrimitiveCollection();
            primitives.add(primitive);
        }
        else {
            primitives = primitive;
        }
        if (!style.getText()) {
            return primitives;
        }
        const text = /** @type {!ol.style.Text} */ (style.getText());
        const label = this.olGeometry4326TextPartToCesium(layer, feature, geometry, text);
        if (label) {
            primitives.add(label);
        }
        return primitives;
    }
    /**
     * Add a billboard to a Cesium.BillboardCollection.
     * Overriding this wrapper allows manipulating the billboard options.
     * @param billboards
     * @param bbOptions
     * @param layer
     * @param feature OpenLayers feature.
     * @param geometry
     * @param style
     * @return newly created billboard
     * @api
     */
    csAddBillboard(billboards, bbOptions, layer, feature, geometry, style) {
        if (!bbOptions.eyeOffset) {
            bbOptions.eyeOffset = this.defaultBillboardEyeOffset_;
        }
        const bb = billboards.add(bbOptions);
        this.setReferenceForPicking(layer, feature, bb);
        return bb;
    }
    /**
     * Convert an OpenLayers circle geometry to Cesium.
     * @api
     */
    olCircleGeometryToCesium(layer, feature, olGeometry, projection, olStyle) {
        olGeometry = olGeometryCloneTo4326(olGeometry, projection);
        console.assert(olGeometry.getType() == 'Circle');
        // ol.Coordinate
        const olCenter = olGeometry.getCenter();
        const height = olCenter.length == 3 ? olCenter[2] : 0.0;
        const olPoint = olCenter.slice();
        olPoint[0] += olGeometry.getRadius();
        // Cesium
        const center = ol4326CoordinateToCesiumCartesian(olCenter);
        const point = ol4326CoordinateToCesiumCartesian(olPoint);
        // Accurate computation of straight distance
        const radius = Cesium.Cartesian3.distance(center, point);
        const fillGeometry = new Cesium.CircleGeometry({
            center,
            radius,
            height
        });
        let outlinePrimitive;
        let outlineGeometry;
        if (this.getHeightReference(layer, feature, olGeometry) === Cesium.HeightReference.CLAMP_TO_GROUND) {
            const width = this.extractLineWidthFromOlStyle(olStyle);
            if (width) {
                const circlePolygon = olCreateCircularPolygon(olGeometry.getCenter(), radius);
                const positions = ol4326CoordinateArrayToCsCartesians(circlePolygon.getLinearRing(0).getCoordinates());
                const op = outlinePrimitive = new Cesium.GroundPolylinePrimitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.GroundPolylineGeometry({ positions, width }),
                    }),
                    appearance: new Cesium.PolylineMaterialAppearance({
                        material: this.olStyleToCesium(feature, olStyle, true),
                    }),
                    classificationType: Cesium.ClassificationType.TERRAIN,
                });
                waitReady(outlinePrimitive).then(() => {
                    this.setReferenceForPicking(layer, feature, op._primitive);
                });
            }
        }
        else {
            outlineGeometry = new Cesium.CircleOutlineGeometry({
                center,
                radius,
                extrudedHeight: height,
                height
            });
        }
        const primitives = this.wrapFillAndOutlineGeometries(layer, feature, olGeometry, fillGeometry, outlineGeometry, olStyle);
        if (outlinePrimitive) {
            primitives.add(outlinePrimitive);
        }
        return this.addTextStyle(layer, feature, olGeometry, olStyle, primitives);
    }
    /**
     * Convert an OpenLayers line string geometry to Cesium.
     * @api
     */
    olLineStringGeometryToCesium(layer, feature, olGeometry, projection, olStyle) {
        olGeometry = olGeometryCloneTo4326(olGeometry, projection);
        console.assert(olGeometry.getType() == 'LineString');
        const positions = ol4326CoordinateArrayToCsCartesians(olGeometry.getCoordinates());
        const width = this.extractLineWidthFromOlStyle(olStyle);
        let outlinePrimitive;
        const heightReference = this.getHeightReference(layer, feature, olGeometry);
        const appearance = new Cesium.PolylineMaterialAppearance({
            material: this.olStyleToCesium(feature, olStyle, true)
        });
        if (heightReference === Cesium.HeightReference.CLAMP_TO_GROUND) {
            const geometry = new Cesium.GroundPolylineGeometry({
                positions,
                width,
            });
            const op = outlinePrimitive = new Cesium.GroundPolylinePrimitive({
                appearance,
                geometryInstances: new Cesium.GeometryInstance({
                    geometry
                })
            });
            waitReady(outlinePrimitive).then(() => {
                this.setReferenceForPicking(layer, feature, op._primitive);
            });
        }
        else {
            const geometry = new Cesium.PolylineGeometry({
                positions,
                width,
                vertexFormat: appearance.vertexFormat
            });
            outlinePrimitive = new Cesium.Primitive({
                appearance,
                geometryInstances: new Cesium.GeometryInstance({
                    geometry
                }),
            });
        }
        this.setReferenceForPicking(layer, feature, outlinePrimitive);
        return this.addTextStyle(layer, feature, olGeometry, olStyle, outlinePrimitive);
    }
    /**
     * Convert an OpenLayers polygon geometry to Cesium.
     * @api
     */
    olPolygonGeometryToCesium(layer, feature, olGeometry, projection, olStyle) {
        olGeometry = olGeometryCloneTo4326(olGeometry, projection);
        console.assert(olGeometry.getType() == 'Polygon');
        const heightReference = this.getHeightReference(layer, feature, olGeometry);
        let fillGeometry, outlineGeometry;
        let outlinePrimitive;
        if ((olGeometry.getCoordinates()[0].length == 5) &&
            (feature.get('olcs_polygon_kind') === 'rectangle')) {
            // Create a rectangle according to the longitude and latitude curves
            const coordinates = olGeometry.getCoordinates()[0];
            // Extract the West, South, East, North coordinates
            const extent = boundingExtent(coordinates);
            const rectangle = Cesium.Rectangle.fromDegrees(extent[0], extent[1], extent[2], extent[3]);
            // Extract the average height of the vertices
            let maxHeight = 0.0;
            if (coordinates[0].length == 3) {
                for (let c = 0; c < coordinates.length; c++) {
                    maxHeight = Math.max(maxHeight, coordinates[c][2]);
                }
            }
            const featureExtrudedHeight = feature.get('olcs_extruded_height');
            // Render the cartographic rectangle
            fillGeometry = new Cesium.RectangleGeometry({
                ellipsoid: Cesium.Ellipsoid.WGS84,
                rectangle,
                height: maxHeight,
                extrudedHeight: featureExtrudedHeight,
            });
            outlineGeometry = new Cesium.RectangleOutlineGeometry({
                ellipsoid: Cesium.Ellipsoid.WGS84,
                rectangle,
                height: maxHeight,
                extrudedHeight: featureExtrudedHeight,
            });
        }
        else {
            const rings = olGeometry.getLinearRings();
            const hierarchy = {
                positions: [],
                holes: [],
            };
            const polygonHierarchy = hierarchy;
            console.assert(rings.length > 0);
            for (let i = 0; i < rings.length; ++i) {
                const olPos = rings[i].getCoordinates();
                const positions = ol4326CoordinateArrayToCsCartesians(olPos);
                console.assert(positions && positions.length > 0);
                if (i === 0) {
                    hierarchy.positions = positions;
                }
                else {
                    hierarchy.holes.push({
                        positions,
                        holes: [],
                    });
                }
            }
            const featureExtrudedHeight = feature.get('olcs_extruded_height');
            fillGeometry = new Cesium.PolygonGeometry({
                polygonHierarchy,
                perPositionHeight: true,
                extrudedHeight: featureExtrudedHeight,
            });
            // Since Cesium doesn't yet support Polygon outlines on terrain yet (coming soon...?)
            // we don't create an outline geometry if clamped, but instead do the polyline method
            // for each ring. Most of this code should be removeable when Cesium adds
            // support for Polygon outlines on terrain.
            if (heightReference === Cesium.HeightReference.CLAMP_TO_GROUND) {
                const width = this.extractLineWidthFromOlStyle(olStyle);
                if (width > 0) {
                    const positions = [hierarchy.positions];
                    if (hierarchy.holes) {
                        for (let i = 0; i < hierarchy.holes.length; ++i) {
                            positions.push(hierarchy.holes[i].positions);
                        }
                    }
                    const appearance = new Cesium.PolylineMaterialAppearance({
                        material: this.olStyleToCesium(feature, olStyle, true)
                    });
                    const geometryInstances = [];
                    for (const linePositions of positions) {
                        const polylineGeometry = new Cesium.GroundPolylineGeometry({ positions: linePositions, width });
                        geometryInstances.push(new Cesium.GeometryInstance({
                            geometry: polylineGeometry
                        }));
                    }
                    outlinePrimitive = new Cesium.GroundPolylinePrimitive({
                        appearance,
                        geometryInstances
                    });
                    waitReady(outlinePrimitive).then(() => {
                        this.setReferenceForPicking(layer, feature, outlinePrimitive._primitive);
                    });
                }
            }
            else {
                // Actually do the normal polygon thing. This should end the removable
                // section of code described above.
                outlineGeometry = new Cesium.PolygonOutlineGeometry({
                    polygonHierarchy: hierarchy,
                    perPositionHeight: true,
                    extrudedHeight: featureExtrudedHeight,
                });
            }
        }
        const primitives = this.wrapFillAndOutlineGeometries(layer, feature, olGeometry, fillGeometry, outlineGeometry, olStyle);
        if (outlinePrimitive) {
            primitives.add(outlinePrimitive);
        }
        return this.addTextStyle(layer, feature, olGeometry, olStyle, primitives);
    }
    /**
     * @api
     */
    getHeightReference(layer, feature, geometry) {
        // Read from the geometry
        let altitudeMode = geometry.get('altitudeMode');
        // Or from the feature
        if (altitudeMode === undefined) {
            altitudeMode = feature.get('altitudeMode');
        }
        // Or from the layer
        if (altitudeMode === undefined) {
            altitudeMode = layer.get('altitudeMode');
        }
        let heightReference = Cesium.HeightReference.NONE;
        if (altitudeMode === 'clampToGround') {
            heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
        }
        else if (altitudeMode === 'relativeToGround') {
            heightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
        }
        return heightReference;
    }
    /**
     * Convert a point geometry to a Cesium BillboardCollection.
     * @param {ol.layer.Vector|ol.layer.Image} layer
     * @param {!ol.Feature} feature OpenLayers feature..
     * @param {!ol.geom.Point} olGeometry OpenLayers point geometry.
     * @param {!ol.ProjectionLike} projection
     * @param {!ol.style.Style} style
     * @param {!ol.style.Image} imageStyle
     * @param {!Cesium.BillboardCollection} billboards
     * @param {function(!Cesium.Billboard)=} opt_newBillboardCallback Called when the new billboard is added.
     * @api
     */
    createBillboardFromImage(layer, feature, olGeometry, projection, style, imageStyle, billboards, opt_newBillboardCallback) {
        if (imageStyle instanceof OLStyleIcon) {
            // make sure the image is scheduled for load
            imageStyle.load();
        }
        const image = imageStyle.getImage(1); // get normal density
        const isImageLoaded = function (image) {
            return image.src != '' &&
                image.naturalHeight != 0 &&
                image.naturalWidth != 0 &&
                image.complete;
        };
        const reallyCreateBillboard = (function () {
            if (!image) {
                return;
            }
            if (!(image instanceof HTMLCanvasElement ||
                image instanceof Image ||
                image instanceof HTMLImageElement)) {
                return;
            }
            const center = olGeometry.getCoordinates();
            const position = ol4326CoordinateToCesiumCartesian(center);
            let color;
            const opacity = imageStyle.getOpacity();
            if (opacity !== undefined) {
                color = new Cesium.Color(1.0, 1.0, 1.0, opacity);
            }
            const scale = imageStyle.getScale();
            const heightReference = this.getHeightReference(layer, feature, olGeometry);
            const bbOptions = {
                image,
                color,
                scale,
                heightReference,
                position
            };
            // merge in cesium options from openlayers feature
            Object.assign(bbOptions, feature.get('cesiumOptions'));
            if (imageStyle instanceof OLStyleIcon) {
                const anchor = imageStyle.getAnchor();
                if (anchor) {
                    const xScale = (Array.isArray(scale) ? scale[0] : scale);
                    const yScale = (Array.isArray(scale) ? scale[1] : scale);
                    bbOptions.pixelOffset = new Cesium.Cartesian2((image.width / 2 - anchor[0]) * xScale, (image.height / 2 - anchor[1]) * yScale);
                }
            }
            const bb = this.csAddBillboard(billboards, bbOptions, layer, feature, olGeometry, style);
            if (opt_newBillboardCallback) {
                opt_newBillboardCallback(bb);
            }
        }).bind(this);
        if (image instanceof Image && !isImageLoaded(image)) {
            // Cesium requires the image to be loaded
            let cancelled = false;
            const source = layer.getSource();
            const canceller = function () {
                cancelled = true;
            };
            source.on(['removefeature', 'clear'], this.boundOnRemoveOrClearFeatureListener_);
            let cancellers = source['olcs_cancellers'];
            if (!cancellers) {
                cancellers = source['olcs_cancellers'] = {};
            }
            const fuid = getUid(feature);
            if (cancellers[fuid]) {
                // When the feature change quickly, a canceller may still be present so
                // we cancel it here to prevent creation of a billboard.
                cancellers[fuid]();
            }
            cancellers[fuid] = canceller;
            const listener = function () {
                image.removeEventListener('load', listener);
                if (!billboards.isDestroyed() && !cancelled) {
                    // Create billboard if the feature is still displayed on the map.
                    reallyCreateBillboard();
                }
            };
            image.addEventListener('load', listener);
        }
        else {
            reallyCreateBillboard();
        }
    }
    /**
     * Convert a point geometry to a Cesium BillboardCollection.
     * @param layer
     * @param feature OpenLayers feature..
     * @param olGeometry OpenLayers point geometry.
     * @param projection
     * @param style
     * @param billboards
     * @param opt_newBillboardCallback Called when the new billboard is added.
     * @return primitives
     * @api
     */
    olPointGeometryToCesium(layer, feature, olGeometry, projection, style, billboards, opt_newBillboardCallback) {
        console.assert(olGeometry.getType() == 'Point');
        olGeometry = olGeometryCloneTo4326(olGeometry, projection);
        let modelPrimitive = null;
        const imageStyle = style.getImage();
        if (imageStyle) {
            const olcsModelFunction = olGeometry.get('olcs_model') || feature.get('olcs_model');
            if (olcsModelFunction) {
                modelPrimitive = new Cesium.PrimitiveCollection();
                const olcsModel = olcsModelFunction();
                const options = Object.assign({}, { scene: this.scene }, olcsModel.cesiumOptions);
                if ('fromGltf' in Cesium.Model) {
                    // pre Cesium v107
                    // @ts-ignore
                    const model = Cesium.Model.fromGltf(options);
                    modelPrimitive.add(model);
                }
                else {
                    Cesium.Model.fromGltfAsync(options).then((model) => {
                        modelPrimitive.add(model);
                    });
                }
                if (olcsModel.debugModelMatrix) {
                    modelPrimitive.add(new Cesium.DebugModelMatrixPrimitive({
                        modelMatrix: olcsModel.debugModelMatrix
                    }));
                }
            }
            else {
                this.createBillboardFromImage(layer, feature, olGeometry, projection, style, imageStyle, billboards, opt_newBillboardCallback);
            }
        }
        if (style.getText()) {
            return this.addTextStyle(layer, feature, olGeometry, style, modelPrimitive || new Cesium.Primitive());
        }
        else {
            return modelPrimitive;
        }
    }
    /**
     * Convert an OpenLayers multi-something geometry to Cesium.
     * @param {ol.layer.Vector|ol.layer.Image} layer
     * @param {!ol.Feature} feature OpenLayers feature..
     * @param {!ol.geom.Geometry} geometry OpenLayers geometry.
     * @param {!ol.ProjectionLike} projection
     * @param {!ol.style.Style} olStyle
     * @param {!Cesium.BillboardCollection} billboards
     * @param {function(!Cesium.Billboard)=} opt_newBillboardCallback Called when
     * the new billboard is added.
     * @return {Cesium.Primitive} primitives
     * @api
     */
    olMultiGeometryToCesium(layer, feature, geometry, projection, olStyle, billboards, opt_newBillboardCallback) {
        // Do not reproject to 4326 now because it will be done later.
        switch (geometry.getType()) {
            case 'MultiPoint': {
                const points = geometry.getPoints();
                if (olStyle.getText()) {
                    const primitives = new Cesium.PrimitiveCollection();
                    points.forEach((geom) => {
                        console.assert(geom);
                        const result = this.olPointGeometryToCesium(layer, feature, geom, projection, olStyle, billboards, opt_newBillboardCallback);
                        if (result) {
                            primitives.add(result);
                        }
                    });
                    return primitives;
                }
                else {
                    points.forEach((geom) => {
                        console.assert(geom);
                        this.olPointGeometryToCesium(layer, feature, geom, projection, olStyle, billboards, opt_newBillboardCallback);
                    });
                    return null;
                }
            }
            case 'MultiLineString': {
                const lineStrings = geometry.getLineStrings();
                // FIXME: would be better to combine all child geometries in one primitive
                // instead we create n primitives for simplicity.
                const primitives = new Cesium.PrimitiveCollection();
                lineStrings.forEach((geom) => {
                    const p = this.olLineStringGeometryToCesium(layer, feature, geom, projection, olStyle);
                    primitives.add(p);
                });
                return primitives;
            }
            case 'MultiPolygon': {
                const polygons = geometry.getPolygons();
                // FIXME: would be better to combine all child geometries in one primitive
                // instead we create n primitives for simplicity.
                const primitives = new Cesium.PrimitiveCollection();
                polygons.forEach((geom) => {
                    const p = this.olPolygonGeometryToCesium(layer, feature, geom, projection, olStyle);
                    primitives.add(p);
                });
                return primitives;
            }
            default:
                console.assert(false, `Unhandled multi geometry type${geometry.getType()}`);
        }
    }
    /**
     * Convert an OpenLayers text style to Cesium.
     * @api
     */
    olGeometry4326TextPartToCesium(layer, feature, geometry, style) {
        const text = style.getText();
        if (!text) {
            return null;
        }
        const labels = new Cesium.LabelCollection({ scene: this.scene });
        // TODO: export and use the text draw position from OpenLayers .
        // See src/ol/render/vector.js
        const extentCenter = getCenter(geometry.getExtent());
        if (geometry instanceof olGeomSimpleGeometry) {
            const first = geometry.getFirstCoordinate();
            extentCenter[2] = first.length == 3 ? first[2] : 0.0;
        }
        const options = {};
        options.position = ol4326CoordinateToCesiumCartesian(extentCenter);
        options.text = text;
        options.heightReference = this.getHeightReference(layer, feature, geometry);
        const offsetX = style.getOffsetX();
        const offsetY = style.getOffsetY();
        if (offsetX != 0 || offsetY != 0) {
            const offset = new Cesium.Cartesian2(offsetX, offsetY);
            options.pixelOffset = offset;
        }
        options.font = style.getFont() || '10px sans-serif'; // OpenLayers default
        let labelStyle = undefined;
        if (style.getFill()) {
            options.fillColor = this.extractColorFromOlStyle(style, false);
            labelStyle = Cesium.LabelStyle.FILL;
        }
        if (style.getStroke()) {
            options.outlineWidth = this.extractLineWidthFromOlStyle(style);
            options.outlineColor = this.extractColorFromOlStyle(style, true);
            labelStyle = Cesium.LabelStyle.OUTLINE;
        }
        if (style.getFill() && style.getStroke()) {
            labelStyle = Cesium.LabelStyle.FILL_AND_OUTLINE;
        }
        options.style = labelStyle;
        let horizontalOrigin;
        switch (style.getTextAlign()) {
            case 'left':
                horizontalOrigin = Cesium.HorizontalOrigin.LEFT;
                break;
            case 'right':
                horizontalOrigin = Cesium.HorizontalOrigin.RIGHT;
                break;
            case 'center':
            default:
                horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
        }
        options.horizontalOrigin = horizontalOrigin;
        if (style.getTextBaseline()) {
            let verticalOrigin;
            switch (style.getTextBaseline()) {
                case 'top':
                    verticalOrigin = Cesium.VerticalOrigin.TOP;
                    break;
                case 'middle':
                    verticalOrigin = Cesium.VerticalOrigin.CENTER;
                    break;
                case 'bottom':
                    verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
                    break;
                case 'alphabetic':
                    verticalOrigin = Cesium.VerticalOrigin.TOP;
                    break;
                case 'hanging':
                    verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
                    break;
                default:
                    console.assert(false, `unhandled baseline ${style.getTextBaseline()}`);
            }
            options.verticalOrigin = verticalOrigin;
        }
        const l = labels.add(options);
        this.setReferenceForPicking(layer, feature, l);
        return labels;
    }
    /**
     * Convert an OpenLayers style to a Cesium Material.
     * @api
     */
    olStyleToCesium(feature, style, outline) {
        const fill = style.getFill();
        const stroke = style.getStroke();
        if ((outline && !stroke) || (!outline && !fill)) {
            return null; // FIXME use a default style? Developer error?
        }
        const olColor = outline ? stroke.getColor() : fill.getColor();
        const color = convertColorToCesium(olColor);
        const lineDash = stroke.getLineDash();
        if (outline && lineDash) {
            return Cesium.Material.fromType('PolylineDash', {
                dashPattern: dashPattern(lineDash),
                color
            });
        }
        else {
            return Cesium.Material.fromType('Color', {
                color
            });
        }
    }
    /**
     * Compute OpenLayers plain style.
     * Evaluates style function, blend arrays, get default style.
     * @api
     */
    computePlainStyle(layer, feature, fallbackStyleFunction, resolution) {
        /**
         * @type {ol.FeatureStyleFunction|undefined}
         */
        const featureStyleFunction = feature.getStyleFunction();
        /**
         * @type {ol.style.Style|Array.<ol.style.Style>}
         */
        let style = null;
        if (featureStyleFunction) {
            style = featureStyleFunction(feature, resolution);
        }
        if (!style && fallbackStyleFunction) {
            style = fallbackStyleFunction(feature, resolution);
        }
        if (!style) {
            // The feature must not be displayed
            return null;
        }
        // FIXME combine materials as in cesium-materials-pack?
        // then this function must return a custom material
        // More simply, could blend the colors like described in
        // http://en.wikipedia.org/wiki/Alpha_compositing
        return Array.isArray(style) ? style : [style];
    }
    /**
     */
    getGeometryFromFeature(feature, style, opt_geom) {
        if (opt_geom) {
            return opt_geom;
        }
        const geom3d = feature.get('olcs_3d_geometry');
        if (geom3d && geom3d instanceof OLGeometry) {
            return geom3d;
        }
        if (style) {
            const geomFuncRes = style.getGeometryFunction()(feature);
            if (geomFuncRes instanceof OLGeometry) {
                return geomFuncRes;
            }
        }
        return feature.getGeometry();
    }
    /**
     * Convert one OpenLayers feature up to a collection of Cesium primitives.
     * @api
     */
    olFeatureToCesium(layer, feature, style, context, opt_geom) {
        const geom = this.getGeometryFromFeature(feature, style, opt_geom);
        if (!geom) {
            // OpenLayers features may not have a geometry
            // See http://geojson.org/geojson-spec.html#feature-objects
            return null;
        }
        const proj = context.projection;
        const newBillboardAddedCallback = function (bb) {
            const featureBb = context.featureToCesiumMap[getUid(feature)];
            if (featureBb instanceof Array) {
                featureBb.push(bb);
            }
            else {
                context.featureToCesiumMap[getUid(feature)] = [bb];
            }
        };
        switch (geom.getType()) {
            case 'GeometryCollection':
                const primitives = new Cesium.PrimitiveCollection();
                geom.getGeometriesArray().forEach((geom) => {
                    if (geom) {
                        const prims = this.olFeatureToCesium(layer, feature, style, context, geom);
                        if (prims) {
                            primitives.add(prims);
                        }
                    }
                });
                return primitives;
            case 'Point':
                const bbs = context.billboards;
                const result = this.olPointGeometryToCesium(layer, feature, geom, proj, style, bbs, newBillboardAddedCallback);
                if (!result) {
                    // no wrapping primitive
                    return null;
                }
                else {
                    return result;
                }
            case 'Circle':
                return this.olCircleGeometryToCesium(layer, feature, geom, proj, style);
            case 'LineString':
                return this.olLineStringGeometryToCesium(layer, feature, geom, proj, style);
            case 'Polygon':
                return this.olPolygonGeometryToCesium(layer, feature, geom, proj, style);
            case 'MultiPoint':
                return this.olMultiGeometryToCesium(layer, feature, geom, proj, style, context.billboards, newBillboardAddedCallback) || null;
            case 'MultiLineString':
                return this.olMultiGeometryToCesium(layer, feature, geom, proj, style, context.billboards, newBillboardAddedCallback) || null;
            case 'MultiPolygon':
                return this.olMultiGeometryToCesium(layer, feature, geom, proj, style, context.billboards, newBillboardAddedCallback) || null;
            case 'LinearRing':
                throw new Error('LinearRing should only be part of polygon.');
            default:
                throw new Error(`Ol geom type not handled : ${geom.getType()}`);
        }
    }
    /**
     * Convert an OpenLayers vector layer to Cesium primitive collection.
     * For each feature, the associated primitive will be stored in
     * `featurePrimitiveMap`.
     * @api
     */
    olVectorLayerToCesium(olLayer, olView, featurePrimitiveMap) {
        const proj = olView.getProjection();
        const resolution = olView.getResolution();
        if (resolution === undefined || !proj) {
            console.assert(false, 'View not ready');
            // an assertion is not enough for closure to assume resolution and proj
            // are defined
            throw new Error('View not ready');
        }
        let source = olLayer.getSource();
        if (source instanceof OLClusterSource) {
            source = source.getSource();
        }
        console.assert(source instanceof VectorSource);
        const features = source.getFeatures();
        const counterpart = new VectorLayerCounterpart(proj, this.scene);
        const context = counterpart.context;
        for (let i = 0; i < features.length; ++i) {
            const feature = features[i];
            if (!feature) {
                continue;
            }
            const layerStyle = olLayer.getStyleFunction();
            const styles = this.computePlainStyle(olLayer, feature, layerStyle, resolution);
            if (!styles || !styles.length) {
                // only 'render' features with a style
                continue;
            }
            let primitives = null;
            for (let i = 0; i < styles.length; i++) {
                const prims = this.olFeatureToCesium(olLayer, feature, styles[i], context);
                if (prims) {
                    if (!primitives) {
                        primitives = prims;
                    }
                    else if (prims) {
                        let i = 0, prim;
                        while ((prim = prims.get(i))) {
                            primitives.add(prim);
                            i++;
                        }
                    }
                }
            }
            if (!primitives) {
                continue;
            }
            featurePrimitiveMap[getUid(feature)] = primitives;
            counterpart.getRootPrimitive().add(primitives);
        }
        return counterpart;
    }
    /**
     * Convert an OpenLayers feature to Cesium primitive collection.
     * @api
     */
    convert(layer, view, feature, context) {
        const proj = view.getProjection();
        const resolution = view.getResolution();
        if (resolution == undefined || !proj) {
            return null;
        }
        /**
         * @type {ol.StyleFunction|undefined}
         */
        const layerStyle = layer.getStyleFunction();
        const styles = this.computePlainStyle(layer, feature, layerStyle, resolution);
        if (!styles || !styles.length) {
            // only 'render' features with a style
            return null;
        }
        context.projection = proj;
        /**
         * @type {Cesium.Primitive|null}
         */
        let primitives = null;
        for (let i = 0; i < styles.length; i++) {
            const prims = this.olFeatureToCesium(layer, feature, styles[i], context);
            if (!primitives) {
                primitives = prims;
            }
            else if (prims) {
                let i = 0, prim;
                while ((prim = prims.get(i))) {
                    primitives.add(prim);
                    i++;
                }
            }
        }
        return primitives;
    }
}
/**
 * Transform a canvas line dash pattern to a Cesium dash pattern
 * See https://cesium.com/learn/cesiumjs/ref-doc/PolylineDashMaterialProperty.html#dashPattern
 * @param lineDash
 */
export function dashPattern(lineDash) {
    if (lineDash.length < 2) {
        lineDash = [1, 1];
    }
    const segments = lineDash.length % 2 === 0 ? lineDash : [...lineDash, ...lineDash];
    const total = segments.reduce((a, b) => a + b, 0);
    const div = total / 16;
    // create a 16 bit binary string
    let binaryString = segments.map((segment, index) => {
        // we alternate between 1 and 0
        const digit = index % 2 === 0 ? '1' : '0';
        // We scale the segment length to fit 16 slots.
        let count = Math.round(segment / div);
        if (index === 0 && count === 0) {
            // We need to start with a 1
            count = 1;
        }
        return digit.repeat(count);
    }).join('');
    // We rounded so it might be that the string is too short or too long.
    // We try to fix it by padding or truncating the string.
    if (binaryString.length < 16) {
        binaryString = binaryString.padEnd(16, '0');
    }
    else if (binaryString.length > 16) {
        binaryString = binaryString.substring(0, 16);
    }
    if (binaryString[15] === '1') {
        // We need to really finish with a 0
        binaryString = binaryString.substring(0, 15) + '0';
    }
    console.assert(binaryString.length === 16);
    return parseInt(binaryString, 2);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRmVhdHVyZUNvbnZlcnRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9vbGNzL0ZlYXR1cmVDb252ZXJ0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxXQUFXLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxZQUFZLEVBQUUsRUFBd0IsTUFBTSxxQkFBcUIsQ0FBQztBQUN6RSxPQUFPLGVBQWUsTUFBTSxzQkFBc0IsQ0FBQztBQUNuRCxPQUFPLEVBQUMsUUFBUSxJQUFJLHVCQUF1QixFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDdkUsT0FBTyxFQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDdkQsT0FBTyxvQkFBb0IsTUFBTSwyQkFBMkIsQ0FBQztBQUM3RCxPQUFPLEVBQUMsb0JBQW9CLEVBQUUscUJBQXFCLEVBQUUsaUNBQWlDLEVBQUUsbUNBQW1DLEVBQUMsTUFBTSxRQUFRLENBQUM7QUFDM0ksT0FBTyxzQkFBc0IsRUFBRSxFQUErQixNQUFNLCtCQUErQixDQUFDO0FBQ3BHLE9BQU8sRUFBQyxNQUFNLEVBQUUsU0FBUyxFQUFDLE1BQU0sUUFBUSxDQUFDO0FBTXpDLE9BQU8sRUFBMkMsTUFBTSxtQkFBbUIsQ0FBQztBQUk1RSxPQUFPLEVBQUMsUUFBUSxJQUFJLFVBQVUsRUFBNEksTUFBTSxZQUFZLENBQUM7QUFvRDdMLE1BQU0sQ0FBQyxPQUFPLE9BQU8sZ0JBQWdCO0lBaUJiO0lBZnRCOztPQUVHO0lBQ0ssb0NBQW9DLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUUvRSwwQkFBMEIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUVyRTs7Ozs7OztPQU9HO0lBQ0gsWUFBc0IsS0FBWTtRQUFaLFVBQUssR0FBTCxLQUFLLENBQU87UUFDaEMs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