import VectorSource from 'ol/source/Vector.js';
import VectorLayerCounterpart, { type OlFeatureToCesiumContext } from './core/VectorLayerCounterpart';
import type { CircleGeometry, CircleOutlineGeometry, Primitive, Billboard, Label, Scene, Geometry as CSGeometry, Color as CSColor, GroundPrimitive, PrimitiveCollection, ImageMaterialProperty, BillboardCollection, GroundPolylinePrimitive, HeightReference, LabelCollection, Material } from 'cesium';
import type VectorLayer from 'ol/layer/Vector.js';
import type ImageLayer from 'ol/layer/Image.js';
import type { Feature, View } from 'ol';
import type Text from 'ol/style/Text.js';
import { type default as Style, type StyleFunction } from 'ol/style/Style.js';
import type { ProjectionLike } from 'ol/proj.js';
import { Geometry as OLGeometry, type Circle, type LineString, type Point, type Polygon } from 'ol/geom.js';
import type ImageStyle from 'ol/style/Image.js';
type PrimitiveLayer = VectorLayer<any> | ImageLayer<any>;
declare module 'cesium' {
    interface Primitive {
        olLayer: PrimitiveLayer;
        olFeature: Feature;
    }
    interface GroundPolylinePrimitive {
        olLayer: PrimitiveLayer;
        olFeature: Feature;
        _primitive: Primitive;
    }
    interface GroundPrimitive {
        olLayer: PrimitiveLayer;
        olFeature: Feature;
    }
    interface Label {
        olLayer: PrimitiveLayer;
        olFeature: Feature;
    }
    interface Billboard {
        olLayer: PrimitiveLayer;
        olFeature: Feature;
    }
}
export default class FeatureConverter {
    protected scene: Scene;
    /**
     * Bind once to have a unique function for using as a listener
     */
    private boundOnRemoveOrClearFeatureListener_;
    private defaultBillboardEyeOffset_;
    /**
     * Concrete base class for converting from OpenLayers3 vectors to Cesium
     * primitives.
     * Extending this class is possible provided that the extending class and
     * the library are compiled together by the closure compiler.
     * @param scene Cesium scene.
     * @api
     */
    constructor(scene: Scene);
    /**
     * @param evt
     */
    private onRemoveOrClearFeature_;
    /**
     * @param layer
     * @param feature OpenLayers feature.
     * @param primitive
     */
    protected setReferenceForPicking(layer: PrimitiveLayer, feature: Feature, primitive: GroundPolylinePrimitive | GroundPrimitive | Primitive | Label | Billboard): void;
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
    protected createColoredPrimitive(layer: PrimitiveLayer, feature: Feature, olGeometry: OLGeometry, geometry: CSGeometry | CircleGeometry, color: CSColor | ImageMaterialProperty, opt_lineWidth?: number): Primitive | GroundPrimitive;
    /**
     * Return the fill or stroke color from a plain ol style.
     * @param style
     * @param outline
     * @return {!CSColor}
     */
    protected extractColorFromOlStyle(style: Style | Text, outline: boolean): CSColor | ImageMaterialProperty;
    /**
     * Return the width of stroke from a plain ol style.
     * @param style
     * @return {number}
     */
    protected extractLineWidthFromOlStyle(style: Style | Text): number;
    /**
     * Create a primitive collection out of two Cesium geometries.
     * Only the OpenLayers style colors will be used.
     */
    protected wrapFillAndOutlineGeometries(layer: PrimitiveLayer, feature: Feature, olGeometry: OLGeometry, fillGeometry: CSGeometry | CircleGeometry, outlineGeometry: CSGeometry | CircleOutlineGeometry, olStyle: Style): PrimitiveCollection;
    /**
     * Create a Cesium primitive if style has a text component.
     * Eventually return a PrimitiveCollection including current primitive.
     */
    protected addTextStyle(layer: PrimitiveLayer, feature: Feature, geometry: OLGeometry, style: Style, primitive: Primitive | PrimitiveCollection | GroundPolylinePrimitive): PrimitiveCollection;
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
    csAddBillboard(billboards: BillboardCollection, bbOptions: Parameters<BillboardCollection['add']>[0], layer: PrimitiveLayer, feature: Feature, geometry: OLGeometry, style: Style): Billboard;
    /**
     * Convert an OpenLayers circle geometry to Cesium.
     * @api
     */
    olCircleGeometryToCesium(layer: PrimitiveLayer, feature: Feature, olGeometry: Circle, projection: ProjectionLike, olStyle: Style): PrimitiveCollection;
    /**
     * Convert an OpenLayers line string geometry to Cesium.
     * @api
     */
    olLineStringGeometryToCesium(layer: PrimitiveLayer, feature: Feature, olGeometry: LineString, projection: ProjectionLike, olStyle: Style): PrimitiveCollection;
    /**
     * Convert an OpenLayers polygon geometry to Cesium.
     * @api
     */
    olPolygonGeometryToCesium(layer: PrimitiveLayer, feature: Feature, olGeometry: Polygon, projection: ProjectionLike, olStyle: Style): PrimitiveCollection;
    /**
     * @api
     */
    getHeightReference(layer: PrimitiveLayer, feature: Feature, geometry: OLGeometry): HeightReference;
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
    createBillboardFromImage(layer: PrimitiveLayer, feature: Feature, olGeometry: Point, projection: ProjectionLike, style: Style, imageStyle: ImageStyle, billboards: BillboardCollection, opt_newBillboardCallback: (bb: Billboard) => void): void;
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
    olPointGeometryToCesium(layer: PrimitiveLayer, feature: Feature, olGeometry: Point, projection: ProjectionLike, style: Style, billboards: BillboardCollection, opt_newBillboardCallback?: (bb: Billboard) => void): PrimitiveCollection;
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
    olMultiGeometryToCesium(layer: PrimitiveLayer, feature: Feature, geometry: OLGeometry, projection: ProjectionLike, olStyle: Style, billboards: BillboardCollection, opt_newBillboardCallback: (bb: Billboard) => void): PrimitiveCollection;
    /**
     * Convert an OpenLayers text style to Cesium.
     * @api
     */
    olGeometry4326TextPartToCesium(layer: PrimitiveLayer, feature: Feature, geometry: OLGeometry, style: Text): LabelCollection;
    /**
     * Convert an OpenLayers style to a Cesium Material.
     * @api
     */
    olStyleToCesium(feature: Feature, style: Style, outline: boolean): Material;
    /**
     * Compute OpenLayers plain style.
     * Evaluates style function, blend arrays, get default style.
     * @api
     */
    computePlainStyle(layer: PrimitiveLayer, feature: Feature, fallbackStyleFunction: StyleFunction, resolution: number): Style[];
    /**
     */
    protected getGeometryFromFeature(feature: Feature, style: Style, opt_geom?: OLGeometry): OLGeometry | undefined;
    /**
     * Convert one OpenLayers feature up to a collection of Cesium primitives.
     * @api
     */
    olFeatureToCesium(layer: PrimitiveLayer, feature: Feature, style: Style, context: OlFeatureToCesiumContext, opt_geom?: OLGeometry): PrimitiveCollection;
    /**
     * Convert an OpenLayers vector layer to Cesium primitive collection.
     * For each feature, the associated primitive will be stored in
     * `featurePrimitiveMap`.
     * @api
     */
    olVectorLayerToCesium(olLayer: VectorLayer<VectorSource>, olView: View, featurePrimitiveMap: Record<number, PrimitiveCollection>): VectorLayerCounterpart;
    /**
     * Convert an OpenLayers feature to Cesium primitive collection.
     * @api
     */
    convert(layer: VectorLayer<VectorSource>, view: View, feature: Feature, context: OlFeatureToCesiumContext): PrimitiveCollection;
}
/**
 * Transform a canvas line dash pattern to a Cesium dash pattern
 * See https://cesium.com/learn/cesiumjs/ref-doc/PolylineDashMaterialProperty.html#dashPattern
 * @param lineDash
 */
export declare function dashPattern(lineDash: number[]): number;
export {};
//# sourceMappingURL=FeatureConverter.d.ts.map