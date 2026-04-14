/// <reference path="FeatureConverter.d.ts" />
import { type StyleFunction } from 'ol/style/Style.js';
import LRUCache from 'ol/structs/LRUCache.js';
import type { Credit, Event, ImageryLayerFeatureInfo, ImageryProvider, ImageryTypes, Proxy, Rectangle, Request, TileDiscardPolicy, TilingScheme } from 'cesium';
import RenderFeature from 'ol/render/Feature.js';
export interface MVTOptions {
    urls: string[];
    rectangle: Rectangle;
    credit: Credit;
    styleFunction: StyleFunction;
    cacheSize?: number;
    featureCache?: LRUCache<Promise<RenderFeature[]>>;
    minimumLevel: number;
}
export default class MVTImageryProvider implements ImageryProvider {
    private urls;
    private emptyCanvas_;
    private emptyCanvasPromise_;
    private tilingScheme_;
    private ready_;
    private rectangle_;
    private tileRectangle_;
    readonly tileWidth = 256;
    readonly tileHeight = 256;
    readonly maximumLevel = 20;
    private minimumLevel_;
    get minimumLevel(): number;
    private featureCache;
    private tileCache;
    private tileFunction_;
    private styleFunction_;
    private projection_;
    /**
   * When <code>true</code>, this model is ready to render, i.e., the external binary, image,
   * and shader files were downloaded and the WebGL resources were created.
   */
    get ready(): boolean;
    /**
   * Gets the rectangle, in radians, of the imagery provided by the instance.
   */
    get rectangle(): Rectangle;
    /**
     * Gets the tiling scheme used by the provider.
     */
    get tilingScheme(): TilingScheme;
    /**
     * Gets an event that is raised when the imagery provider encounters an asynchronous error.  By subscribing
     * to the event, you will be notified of the error and can potentially recover from it.  Event listeners
     * are passed an instance of {@link Cesium.TileProviderError}.
     */
    readonly errorEvent: Event;
    /**
     * Gets the credit to display when this imagery provider is active.  Typically this is used to credit
     * the source of the imagery.
     */
    readonly credit: Credit;
    getTileCredits(x: number, y: number, level: number): Credit[];
    /**
     * Gets the proxy used by this provider.
     */
    readonly proxy: Proxy;
    get _ready(): boolean;
    /**
     * Gets the tile discard policy.  If not undefined, the discard policy is responsible
     * for filtering out "missing" tiles via its shouldDiscardImage function.  If this function
     * returns undefined, no tiles are filtered.
     */
    get tileDiscardPolicy(): TileDiscardPolicy;
    /**
     * Gets a value indicating whether or not the images provided by this imagery provider
     * include an alpha channel.  If this property is false, an alpha channel, if present, will
     * be ignored.  If this property is true, any images without an alpha channel will be treated
     * as if their alpha is 1.0 everywhere.  When this property is false, memory usage
     * and texture upload time are reduced.
     */
    get hasAlphaChannel(): boolean;
    /**
     * Asynchronously determines what features, if any, are located at a given longitude and latitude within
     * a tile.
     * This function is optional, so it may not exist on all ImageryProviders.
     * @param x - The tile X coordinate.
     * @param y - The tile Y coordinate.
     * @param level - The tile level.
     * @param longitude - The longitude at which to pick features.
     * @param latitude - The latitude at which to pick features.
     * @return A promise for the picked features that will resolve when the asynchronous
     *                   picking completes.  The resolved value is an array of {@link ImageryLayerFeatureInfo}
     *                   instances.  The array may be empty if no features are found at the given location.
     *                   It may also be undefined if picking is not supported.
     */
    pickFeatures(x: number, y: number, level: number, longitude: number, latitude: number): Promise<ImageryLayerFeatureInfo[]> | undefined;
    constructor(options: MVTOptions);
    private getTileFeatures;
    readFeaturesFromBuffer(buffer: ArrayBuffer): RenderFeature[];
    private getUrl_;
    private getCacheKey_;
    requestImage(x: number, y: number, z: number, request?: Request): Promise<ImageryTypes> | undefined;
    rasterizeFeatures(features: RenderFeature[], styleFunction: StyleFunction, resolution: number): HTMLCanvasElement;
}
//# sourceMappingURL=MVTImageryProvider.d.ts.map