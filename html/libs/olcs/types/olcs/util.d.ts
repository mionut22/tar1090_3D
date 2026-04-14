import type { Projection } from 'ol/proj';
import type { Source } from 'ol/source';
/**
 * https://caniuse.com/mdn-css_properties_image-rendering_pixelated
 * @return whether the browser supports
 */
export declare function supportsImageRenderingPixelated(): boolean;
/**
 * The value supported by thie browser for the CSS property "image-rendering"
 * @return {string}
 */
export declare function imageRenderingValue(): string;
/**
 * Return the projection of the source that Cesium should use.
 *
 * @param source Source.
 * @return The projection of the source.
 */
export declare function getSourceProjection(source: Source): Projection;
/**
 * Gets a unique ID for an object. This mutates the object so that further calls
 * with the same object as a parameter returns the same value. Unique IDs are generated
 * as a strictly increasing sequence. Adapted from goog.getUid. Similar to OL getUid.
 *
 * @param obj The object to get the unique ID for.
 * @return The unique ID for the object.
 */
export declare function getUid(obj: any): number;
export declare function waitReady<Type>(object: Type): Promise<Type>;
//# sourceMappingURL=util.d.ts.map