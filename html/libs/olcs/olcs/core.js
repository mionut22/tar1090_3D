import { linear as linearEasing } from 'ol/easing.js';
import olLayerTile from 'ol/layer/Tile.js';
import olLayerImage from 'ol/layer/Image.js';
import { get as getProjection, transformExtent } from 'ol/proj.js';
import olSourceImageStatic from 'ol/source/ImageStatic.js';
import olSourceImageWMS from 'ol/source/ImageWMS.js';
import olSourceTileImage from 'ol/source/TileImage.js';
import olSourceTileWMS from 'ol/source/TileWMS.js';
import olSourceVectorTile from 'ol/source/VectorTile.js';
import olcsCoreOLImageryProvider from "./core/OLImageryProvider.js";
import { getSourceProjection } from "./util.js";
import MVTImageryProvider from "./MVTImageryProvider.js";
import VectorTileLayer from 'ol/layer/VectorTile.js';
import { getCenter as getExtentCenter } from 'ol/extent.js';
/**
 * Compute the pixel width and height of a point in meters using the
 * camera frustum.
 */
export function computePixelSizeAtCoordinate(scene, target) {
    const camera = scene.camera;
    const canvas = scene.canvas;
    const frustum = camera.frustum;
    const distance = Cesium.Cartesian3.magnitude(Cesium.Cartesian3.subtract(camera.position, target, new Cesium.Cartesian3()));
    // @ts-ignore TS2341
    return frustum.getPixelDimensions(canvas.clientWidth, canvas.clientHeight, distance, scene.pixelRatio, new Cesium.Cartesian2());
}
/**
 * Compute bounding box around a target point.
 * @param {!Cesium.Scene} scene
 * @param {!Cesium.Cartesian3} target
 * @param {number} amount Half the side of the box, in pixels.
 * @return {Array<Cesium.Cartographic>} bottom left and top right
 * coordinates of the box
 */
export function computeBoundingBoxAtTarget(scene, target, amount) {
    const pixelSize = computePixelSizeAtCoordinate(scene, target);
    const transform = Cesium.Transforms.eastNorthUpToFixedFrame(target);
    const bottomLeft = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(-pixelSize.x * amount, -pixelSize.y * amount, 0), new Cesium.Cartesian3());
    const topRight = Cesium.Matrix4.multiplyByPoint(transform, new Cesium.Cartesian3(pixelSize.x * amount, pixelSize.y * amount, 0), new Cesium.Cartesian3());
    return Cesium.Ellipsoid.WGS84.cartesianArrayToCartographicArray([bottomLeft, topRight]);
}
export function applyHeightOffsetToGeometry(geometry, height) {
    geometry.applyTransform((input, output, stride) => {
        console.assert(input === output);
        if (stride !== undefined && stride >= 3) {
            for (let i = 0; i < output.length; i += stride) {
                output[i + 2] = output[i + 2] + height;
            }
        }
        return output;
    });
}
export function createMatrixAtCoordinates(coordinates, rotation = 0, translation = Cesium.Cartesian3.ZERO, scale = new Cesium.Cartesian3(1, 1, 1)) {
    const position = ol4326CoordinateToCesiumCartesian(coordinates);
    const rawMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position);
    const quaternion = Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Z, -rotation);
    const rotationMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(translation, quaternion, scale);
    return Cesium.Matrix4.multiply(rawMatrix, rotationMatrix, new Cesium.Matrix4());
}
export function rotateAroundAxis(camera, angle, axis, transform, opt_options) {
    const clamp = Cesium.Math.clamp;
    const defaultValue = Cesium.defaultValue;
    const options = opt_options;
    const duration = defaultValue(options?.duration, 500); // ms
    const easing = defaultValue(options?.easing, linearEasing);
    const callback = options?.callback;
    let lastProgress = 0;
    const oldTransform = new Cesium.Matrix4();
    const start = Date.now();
    const step = function () {
        const timestamp = Date.now();
        const timeDifference = timestamp - start;
        const progress = easing(clamp(timeDifference / duration, 0, 1));
        console.assert(progress >= lastProgress);
        camera.transform.clone(oldTransform);
        const stepAngle = (progress - lastProgress) * angle;
        lastProgress = progress;
        camera.lookAtTransform(transform);
        camera.rotate(axis, stepAngle);
        camera.lookAtTransform(oldTransform);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
        else {
            if (callback) {
                callback();
            }
        }
    };
    window.requestAnimationFrame(step);
}
export function setHeadingUsingBottomCenter(scene, heading, bottomCenter, options) {
    const camera = scene.camera;
    // Compute the camera position to zenith quaternion
    const angleToZenith = computeAngleToZenith(scene, bottomCenter);
    const axis = camera.right;
    const quaternion = Cesium.Quaternion.fromAxisAngle(axis, angleToZenith);
    const rotation = Cesium.Matrix3.fromQuaternion(quaternion);
    // Get the zenith point from the rotation of the position vector
    const vector = new Cesium.Cartesian3();
    Cesium.Cartesian3.subtract(camera.position, bottomCenter, vector);
    const zenith = new Cesium.Cartesian3();
    Cesium.Matrix3.multiplyByVector(rotation, vector, zenith);
    Cesium.Cartesian3.add(zenith, bottomCenter, zenith);
    // Actually rotate around the zenith normal
    const transform = Cesium.Matrix4.fromTranslation(zenith);
    rotateAroundAxis(camera, heading, zenith, transform, options);
}
/**
 * Get the 3D position of the given pixel of the canvas.
 */
export function pickOnTerrainOrEllipsoid(scene, pixel) {
    const ray = scene.camera.getPickRay(pixel);
    const target = scene.globe.pick(ray, scene);
    return target || scene.camera.pickEllipsoid(pixel);
}
/**
 * Get the 3D position of the point at the bottom-center of the screen.
 */
export function pickBottomPoint(scene) {
    const canvas = scene.canvas;
    const bottom = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight);
    return pickOnTerrainOrEllipsoid(scene, bottom);
}
/**
 * Get the 3D position of the point at the center of the screen.
 */
export function pickCenterPoint(scene) {
    const canvas = scene.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    return pickOnTerrainOrEllipsoid(scene, center);
}
/**
 * Compute the signed tilt angle on globe, between the opposite of the
 * camera direction and the target normal. Return undefined if there is no
 */
export function computeSignedTiltAngleOnGlobe(scene) {
    const camera = scene.camera;
    const ray = new Cesium.Ray(camera.position, camera.direction);
    let target = scene.globe.pick(ray, scene);
    if (!target) {
        // no tiles in the area were loaded?
        const ellipsoid = Cesium.Ellipsoid.WGS84;
        const obj = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (obj) {
            target = Cesium.Ray.getPoint(ray, obj.start);
        }
    }
    if (!target) {
        return undefined;
    }
    const normal = new Cesium.Cartesian3();
    Cesium.Ellipsoid.WGS84.geocentricSurfaceNormal(target, normal);
    const angleBetween = signedAngleBetween;
    const angle = angleBetween(camera.direction, normal, camera.right) - Math.PI;
    return Cesium.Math.convertLongitudeRange(angle);
}
/**
 * Compute the ray from the camera to the bottom-center of the screen.
 */
export function bottomFovRay(scene) {
    const camera = scene.camera;
    // @ts-ignore TS2341
    const fovy2 = camera.frustum.fovy / 2;
    const direction = camera.direction;
    const rotation = Cesium.Quaternion.fromAxisAngle(camera.right, fovy2);
    const matrix = Cesium.Matrix3.fromQuaternion(rotation);
    const vector = new Cesium.Cartesian3();
    Cesium.Matrix3.multiplyByVector(matrix, direction, vector);
    return new Cesium.Ray(camera.position, vector);
}
/**
 * Compute the angle between two Cartesian3.
 */
export function signedAngleBetween(first, second, normal) {
    // We are using the dot for the angle.
    // Then the cross and the dot for the sign.
    const a = new Cesium.Cartesian3();
    const b = new Cesium.Cartesian3();
    const c = new Cesium.Cartesian3();
    Cesium.Cartesian3.normalize(first, a);
    Cesium.Cartesian3.normalize(second, b);
    Cesium.Cartesian3.cross(a, b, c);
    const cosine = Cesium.Cartesian3.dot(a, b);
    const sine = Cesium.Cartesian3.magnitude(c);
    // Sign of the vector product and the orientation normal
    const sign = Cesium.Cartesian3.dot(normal, c);
    const angle = Math.atan2(sine, cosine);
    return sign >= 0 ? angle : -angle;
}
/**
 * Compute the rotation angle around a given point, needed to reach the
 * zenith position.
 * At a zenith position, the camera direction is going througth the earth
 * center and the frustrum bottom ray is going through the chosen pivot
 * point.
 * The bottom-center of the screen is a good candidate for the pivot point.
 */
export function computeAngleToZenith(scene, pivot) {
    // This angle is the sum of the angles 'fy' and 'a', which are defined
    // using the pivot point and its surface normal.
    //        Zenith |    camera
    //           \   |   /
    //            \fy|  /
    //             \ |a/
    //              \|/pivot
    const camera = scene.camera;
    // @ts-ignore TS2341
    const fy = camera.frustum.fovy / 2;
    const ray = bottomFovRay(scene);
    const direction = Cesium.Cartesian3.clone(ray.direction);
    Cesium.Cartesian3.negate(direction, direction);
    const normal = new Cesium.Cartesian3();
    Cesium.Ellipsoid.WGS84.geocentricSurfaceNormal(pivot, normal);
    const left = new Cesium.Cartesian3();
    Cesium.Cartesian3.negate(camera.right, left);
    const a = signedAngleBetween(normal, direction, left);
    return a + fy;
}
/**
 * Convert an OpenLayers extent to a Cesium rectangle.
 * @param {ol.Extent} extent Extent.
 * @param {ol.ProjectionLike} projection Extent projection.
 * @return {Cesium.Rectangle} The corresponding Cesium rectangle.
 */
export function extentToRectangle(extent, projection) {
    if (extent && projection) {
        const ext = transformExtent(extent, projection, 'EPSG:4326');
        return Cesium.Rectangle.fromDegrees(ext[0], ext[1], ext[2], ext[3]);
    }
    else {
        return null;
    }
}
export function sourceToImageryProvider(olMap, source, viewProj, olLayer) {
    const skip = source.get('olcs_skip');
    if (skip) {
        return null;
    }
    let provider = null;
    // Convert ImageWMS to TileWMS
    if (source instanceof olSourceImageWMS && source.getUrl()) {
        const sourceProps = {
            'olcs_proxy': source.get('olcs_proxy'),
            'olcs_extent': source.get('olcs_extent'),
            'olcs_projection': source.get('olcs_projection'),
            'olcs.imagesource': source
        };
        const imageLoadFunction = source.getImageLoadFunction();
        const tileLoadFunction = source.get('olcs_tileLoadFunction') || function tileLoadFunction(tile, src) {
            // An imageLoadFunction takes an ImageWrapperm which has a getImage method.
            // A tile also has a getImage method.
            // We incorrectly passe a tile as an ImageWrapper and hopes for the best.
            imageLoadFunction(tile, src);
        };
        source = new olSourceTileWMS({
            url: source.getUrl(),
            attributions: source.getAttributions(),
            projection: source.getProjection(),
            tileLoadFunction,
            params: source.getParams()
        });
        source.setProperties(sourceProps);
    }
    if (source instanceof olSourceTileImage) {
        let projection = getSourceProjection(source);
        if (!projection) {
            // if not explicit, assume the same projection as view
            projection = viewProj;
        }
        if (isCesiumProjection(projection)) {
            provider = new olcsCoreOLImageryProvider(olMap, source, viewProj);
        }
        // Projection not supported by Cesium
        else {
            return null;
        }
    }
    else if (source instanceof olSourceImageStatic) {
        let projection = getSourceProjection(source);
        if (!projection) {
            projection = viewProj;
        }
        if (isCesiumProjection(projection)) {
            const rectangle = Cesium.Rectangle.fromDegrees(source.getImageExtent()[0], source.getImageExtent()[1], source.getImageExtent()[2], source.getImageExtent()[3], new Cesium.Rectangle());
            provider = new Cesium.SingleTileImageryProvider({
                url: source.getUrl(),
                rectangle
            });
        }
        // Projection not supported by Cesium
        else {
            return null;
        }
    }
    else if (source instanceof olSourceVectorTile && olLayer instanceof VectorTileLayer) {
        let projection = getSourceProjection(source);
        if (!projection) {
            projection = viewProj;
        }
        if (skip === false) {
            // MVT is experimental, it should be whitelisted to be synchronized
            const fromCode = projection.getCode().split(':')[1];
            // @ts-ignore TS2341
            const urls = source.urls.map(u => u.replace(fromCode, '3857'));
            const extent = olLayer.getExtent();
            const rectangle = extentToRectangle(extent, projection);
            const minimumLevel = source.get('olcs_minimumLevel');
            const attributionsFunction = source.getAttributions();
            const styleFunction = olLayer.getStyleFunction();
            let credit;
            if (extent && attributionsFunction) {
                const center = getExtentCenter(extent);
                credit = attributionsFunctionToCredits(attributionsFunction, 0, center, extent)[0];
            }
            provider = new MVTImageryProvider({
                credit,
                rectangle,
                minimumLevel,
                styleFunction,
                urls
            });
            return provider;
        }
        return null; // FIXME: it is disabled by default right now
    }
    else {
        // sources other than TileImage|Imageexport function are currently not supported
        return null;
    }
    return provider;
}
/**
 * Creates Cesium.ImageryLayer best corresponding to the given ol.layer.Layer.
 * Only supports raster layers and export function images
 */
export function tileLayerToImageryLayer(olMap, olLayer, viewProj) {
    if (!(olLayer instanceof olLayerTile) && !(olLayer instanceof olLayerImage) &&
        !(olLayer instanceof VectorTileLayer)) {
        return null;
    }
    const source = olLayer.getSource();
    if (!source) {
        return null;
    }
    let provider = source.get('olcs_provider');
    if (!provider) {
        provider = sourceToImageryProvider(olMap, source, viewProj, olLayer);
    }
    if (!provider) {
        return null;
    }
    const layerOptions = {};
    const forcedExtent = (olLayer.get('olcs_extent'));
    const ext = forcedExtent || olLayer.getExtent();
    if (ext) {
        layerOptions.rectangle = extentToRectangle(ext, viewProj);
    }
    const cesiumLayer = new Cesium.ImageryLayer(provider, layerOptions);
    return cesiumLayer;
}
/**
 * Synchronizes the layer rendering properties (opacity, visible)
 * to the given Cesium ImageryLayer.
 */
export function updateCesiumLayerProperties(olLayerWithParents, csLayer) {
    let opacity = 1;
    let visible = true;
    [olLayerWithParents.layer].concat(olLayerWithParents.parents).forEach((olLayer) => {
        const layerOpacity = olLayer.getOpacity();
        if (layerOpacity !== undefined) {
            opacity *= layerOpacity;
        }
        const layerVisible = olLayer.getVisible();
        if (layerVisible !== undefined) {
            visible = visible && layerVisible;
        }
    });
    csLayer.alpha = opacity;
    csLayer.show = visible;
}
/**
 * Convert a 2D or 3D OpenLayers coordinate to Cesium.
 */
export function ol4326CoordinateToCesiumCartesian(coordinate) {
    const coo = coordinate;
    return coo.length > 2 ?
        Cesium.Cartesian3.fromDegrees(coo[0], coo[1], coo[2]) :
        Cesium.Cartesian3.fromDegrees(coo[0], coo[1]);
}
/**
 * Convert an array of 2D or 3D OpenLayers coordinates to Cesium.
 */
export function ol4326CoordinateArrayToCsCartesians(coordinates) {
    console.assert(coordinates !== null);
    const toCartesian = ol4326CoordinateToCesiumCartesian;
    const cartesians = [];
    for (let i = 0; i < coordinates.length; ++i) {
        cartesians.push(toCartesian(coordinates[i]));
    }
    return cartesians;
}
/**
 * Reproject an OpenLayers geometry to EPSG:4326 if needed.
 * The geometry will be cloned only when original projection is not EPSG:4326
 * and the properties will be shallow copied.
 */
export function olGeometryCloneTo4326(geometry, projection) {
    console.assert(projection);
    const proj4326 = getProjection('EPSG:4326');
    const proj = getProjection(projection);
    if (proj.getCode() !== proj4326.getCode()) {
        const properties = geometry.getProperties();
        geometry = geometry.clone();
        geometry.transform(proj, proj4326);
        geometry.setProperties(properties);
    }
    return geometry;
}
/**
 * Convert an OpenLayers color to Cesium.
 */
export function convertColorToCesium(olColor) {
    olColor = olColor || 'black';
    if (Array.isArray(olColor)) {
        return new Cesium.Color(Cesium.Color.byteToFloat(olColor[0]), Cesium.Color.byteToFloat(olColor[1]), Cesium.Color.byteToFloat(olColor[2]), olColor[3]);
    }
    else if (typeof olColor == 'string') {
        return Cesium.Color.fromCssColorString(olColor);
    }
    else if (olColor instanceof CanvasPattern || olColor instanceof CanvasGradient) {
        // Render the CanvasPattern/CanvasGradient into a canvas that will be sent to Cesium as material
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.height = 256;
        ctx.fillStyle = olColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return new Cesium.ImageMaterialProperty({
            image: canvas
        });
    }
    console.assert(false, 'impossible');
}
/**
 * Convert an OpenLayers url to Cesium.
 */
export function convertUrlToCesium(url) {
    let subdomains = '';
    const re = /\{(\d|[a-z])-(\d|[a-z])\}/;
    const match = re.exec(url);
    if (match) {
        url = url.replace(re, '{s}');
        const startCharCode = match[1].charCodeAt(0);
        const stopCharCode = match[2].charCodeAt(0);
        let charCode;
        for (charCode = startCharCode; charCode <= stopCharCode; ++charCode) {
            subdomains += String.fromCharCode(charCode);
        }
    }
    return {
        url,
        subdomains
    };
}
/**
 * Animate the return to a top-down view from the zenith.
 * The camera is rotated to orient to the North.
 */
export function resetToNorthZenith(map, scene) {
    return new Promise((resolve, reject) => {
        const camera = scene.camera;
        const pivot = pickBottomPoint(scene);
        if (!pivot) {
            reject('Could not get bottom pivot');
            return;
        }
        const currentHeading = map.getView().getRotation();
        if (currentHeading === undefined) {
            reject('The view is not initialized');
            return;
        }
        const angle = computeAngleToZenith(scene, pivot);
        // Point to North
        setHeadingUsingBottomCenter(scene, currentHeading, pivot);
        // Go to zenith
        const transform = Cesium.Matrix4.fromTranslation(pivot);
        const axis = camera.right;
        const options = {
            callback: () => {
                const view = map.getView();
                normalizeView(view);
                resolve(undefined);
            }
        };
        rotateAroundAxis(camera, -angle, axis, transform, options);
    });
}
/**
 * @param {!Cesium.Scene} scene
 * @param {number} angle in radian
 * @return {Promise<undefined>}
 * @api
 */
export function rotateAroundBottomCenter(scene, angle) {
    return new Promise((resolve, reject) => {
        const camera = scene.camera;
        const pivot = pickBottomPoint(scene);
        if (!pivot) {
            reject('could not get bottom pivot');
            return;
        }
        const options = { callback: () => resolve(undefined) };
        const transform = Cesium.Matrix4.fromTranslation(pivot);
        const axis = camera.right;
        rotateAroundAxis(camera, -angle, axis, transform, options);
    });
}
/**
 * Set the OpenLayers view to a specific rotation and
 * the nearest resolution.
 */
export function normalizeView(view, angle = 0) {
    const resolution = view.getResolution();
    view.setRotation(angle);
    // @ts-ignore TS2341
    if (view.constrainResolution) {
        // @ts-ignore TS2341
        view.setResolution(view.constrainResolution(resolution));
    }
    else {
        view.setResolution(view.getConstrainedResolution(resolution));
    }
}
/**
 * Check if the given projection is managed by Cesium (WGS84 or Mercator Spheric)
 */
export function isCesiumProjection(projection) {
    const is3857 = projection.getCode() === 'EPSG:3857';
    const is4326 = projection.getCode() === 'EPSG:4326';
    return is3857 || is4326;
}
export function attributionsFunctionToCredits(attributionsFunction, zoom, center, extent) {
    if (!attributionsFunction) {
        return [];
    }
    let attributions = attributionsFunction({
        viewState: { zoom, center, projection: undefined, resolution: undefined, rotation: undefined },
        extent,
    });
    if (!Array.isArray(attributions)) {
        attributions = [attributions];
    }
    return attributions.map(html => new Cesium.Credit(html, true));
}
/**
 * calculate the distance between camera and centerpoint based on the resolution and latitude value
 */
export function calcDistanceForResolution(resolution, latitude, scene, projection) {
    const canvas = scene.canvas;
    const camera = scene.camera;
    // @ts-ignore TS2341
    const fovy = camera.frustum.fovy; // vertical field of view
    console.assert(!isNaN(fovy));
    const metersPerUnit = projection.getMetersPerUnit();
    // number of "map units" visible in 2D (vertically)
    const visibleMapUnits = resolution * canvas.clientHeight;
    // The metersPerUnit does not take latitude into account, but it should
    // be lower with increasing latitude -- we have to compensate.
    // In 3D it is not possible to maintain the resolution at more than one point,
    // so it only makes sense to use the latitude of the "target" point.
    const relativeCircumference = Math.cos(Math.abs(latitude));
    // how many meters should be visible in 3D
    const visibleMeters = visibleMapUnits * metersPerUnit * relativeCircumference;
    // distance required to view the calculated length in meters
    //
    //  fovy/2
    //    |\
    //  x | \
    //    |--\
    // visibleMeters/2
    const requiredDistance = (visibleMeters / 2) / Math.tan(fovy / 2);
    // NOTE: This calculation is not absolutely precise, because metersPerUnit
    // is a great simplification. It does not take ellipsoid/terrain into account.
    return requiredDistance;
}
/**
 * calculate the resolution based on a distance(camera to position) and latitude value
 */
export function calcResolutionForDistance(distance, latitude, scene, projection) {
    // See the reverse calculation (calcDistanceForResolution) for details
    const canvas = scene.canvas;
    const camera = scene.camera;
    // @ts-ignore TS2341
    const fovy = camera.frustum.fovy; // vertical field of view
    console.assert(!isNaN(fovy));
    const metersPerUnit = projection.getMetersPerUnit();
    const visibleMeters = 2 * distance * Math.tan(fovy / 2);
    const relativeCircumference = Math.cos(Math.abs(latitude));
    const visibleMapUnits = visibleMeters / metersPerUnit / relativeCircumference;
    const resolution = visibleMapUnits / canvas.clientHeight;
    return resolution;
}
/**
 * Constrain the camera so that it stays close to the bounding sphere of the map extent.
 * Near the ground the allowed distance is shorter.
 */
export function limitCameraToBoundingSphere(camera, boundingSphere, ratio) {
    let blockLimiter = false;
    return function () {
        if (!blockLimiter) {
            const position = camera.position;
            const carto = Cesium.Cartographic.fromCartesian(position);
            if (Cesium.Cartesian3.distance(boundingSphere.center, position) > boundingSphere.radius * ratio(carto.height)) {
                // @ts-ignore TS2339: FIXME, there is no flying property in Camera
                const currentlyFlying = camera.flying;
                if (currentlyFlying === true) {
                    // There is a flying property and its value is true
                    return;
                }
                else {
                    blockLimiter = true;
                    const unblockLimiter = () => (blockLimiter = false);
                    camera.flyToBoundingSphere(boundingSphere, {
                        complete: unblockLimiter,
                        cancel: unblockLimiter,
                    });
                }
            }
        }
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9vbGNzL2NvcmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFDLE1BQU0sSUFBSSxZQUFZLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFDcEQsT0FBTyxXQUFXLE1BQU0sa0JBQWtCLENBQUM7QUFDM0MsT0FBTyxZQUFZLE1BQU0sbUJBQW1CLENBQUM7QUFDN0MsT0FBTyxFQUFDLEdBQUcsSUFBSSxhQUFhLEVBQXVCLGVBQWUsRUFBQyxNQUFNLFlBQVksQ0FBQztBQUN0RixPQUFPLG1CQUFtQixNQUFNLDBCQUEwQixDQUFDO0FBQzNELE9BQU8sZ0JBQWdCLE1BQU0sdUJBQXVCLENBQUM7QUFDckQsT0FBTyxpQkFBaUIsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RCxPQUFPLGVBQWUsTUFBTSxzQkFBc0IsQ0FBQztBQUNuRCxPQUFPLGtCQUFrQixNQUFNLHlCQUF5QixDQUFDO0FBRXpELE9BQU8seUJBQXlCLE1BQU0sMEJBQTBCLENBQUM7QUFDakUsT0FBTyxFQUFDLG1CQUFtQixFQUFDLE1BQU0sUUFBUSxDQUFDO0FBQzNDLE9BQU8sa0JBQWtCLE1BQU0sc0JBQXNCLENBQUM7QUFDdEQsT0FBTyxlQUFlLE1BQU0sd0JBQXdCLENBQUM7QUFDckQsT0FBTyxFQUFjLFNBQVMsSUFBSSxlQUFlLEVBQUMsTUFBTSxjQUFjLENBQUM7QUFtRHZFOzs7R0FHRztBQUNILE1BQU0sVUFBVSw0QkFBNEIsQ0FBQyxLQUFZLEVBQUUsTUFBa0I7SUFDM0UsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUM1QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDL0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQ25FLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN2RCxvQkFBb0I7SUFDcEIsT0FBTyxPQUFPLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDbEksQ0FBQztBQUdEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLFVBQVUsMEJBQTBCLENBQUMsS0FBWSxFQUFFLE1BQWtCLEVBQUUsTUFBYztJQUN6RixNQUFNLFNBQVMsR0FBRyw0QkFBNEIsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDOUQsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVwRSxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FDN0MsU0FBUyxFQUNULElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQ3RFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFFN0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQzNDLFNBQVMsRUFDVCxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQ3BFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFFN0IsT0FBTyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsQ0FDM0QsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBRUQsTUFBTSxVQUFVLDJCQUEyQixDQUFDLFFBQWtCLEVBQUUsTUFBYztJQUM1RSxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNoRCxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsQ0FBQztRQUNqQyxJQUFJLE1BQU0sS0FBSyxTQUFTLElBQUksTUFBTSxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDL0MsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQztZQUN6QyxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELE1BQU0sVUFBVSx5QkFBeUIsQ0FDckMsV0FBdUIsRUFDdkIsUUFBUSxHQUFHLENBQUMsRUFDWixXQUFXLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQ3BDLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFeEMsTUFBTSxRQUFRLEdBQUcsaUNBQWlDLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDaEUsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN0RSxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hGLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsc0NBQXNDLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM3RyxPQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxjQUFjLEVBQUUsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztBQUNsRixDQUFDO0FBRUQsTUFBTSxVQUFVLGdCQUFnQixDQUFDLE1BQWMsRUFBRSxLQUFhLEVBQUUsSUFBZ0IsRUFBRSxTQUFrQixFQUNoRyxXQUFvQztJQUN0QyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztJQUNoQyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDO0lBRXpDLE1BQU0sT0FBTyxHQUEyQixXQUFXLENBQUM7SUFDcEQsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLO0lBQzVELE1BQU0sTUFBTSxHQUFHLFlBQVksQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQzNELE1BQU0sUUFBUSxHQUFHLE9BQU8sRUFBRSxRQUFRLENBQUM7SUFFbkMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLE1BQU0sWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRTFDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUN6QixNQUFNLElBQUksR0FBRztRQUNYLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixNQUFNLGNBQWMsR0FBRyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3pDLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRSxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxZQUFZLENBQUMsQ0FBQztRQUV6QyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNyQyxNQUFNLFNBQVMsR0FBRyxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsR0FBRyxLQUFLLENBQUM7UUFDcEQsWUFBWSxHQUFHLFFBQVEsQ0FBQztRQUN4QixNQUFNLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFckMsSUFBSSxRQUFRLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDakIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLENBQUM7YUFBTSxDQUFDO1lBQ04sSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDYixRQUFRLEVBQUUsQ0FBQztZQUNiLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQyxDQUFDO0lBQ0YsTUFBTSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JDLENBQUM7QUFFRCxNQUFNLFVBQVUsMkJBQTJCLENBQ3ZDLEtBQVksRUFDWixPQUFlLEVBQ2YsWUFBd0IsRUFDeEIsT0FBZ0M7SUFFbEMsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUM1QixtREFBbUQ7SUFDbkQsTUFBTSxhQUFhLEdBQUcsb0JBQW9CLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ2hFLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDMUIsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ3hFLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRTNELGdFQUFnRTtJQUNoRSxNQUFNLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUN2QyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNsRSxNQUFNLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUN2QyxNQUFNLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDMUQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQztJQUVwRCwyQ0FBMkM7SUFDM0MsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekQsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2hFLENBQUM7QUFHRDs7R0FFRztBQUNILE1BQU0sVUFBVSx3QkFBd0IsQ0FBQyxLQUFZLEVBQUUsS0FBaUI7SUFDdEUsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0MsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzVDLE9BQU8sTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3JELENBQUM7QUFHRDs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsS0FBWTtJQUMxQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FDaEMsTUFBTSxDQUFDLFdBQVcsR0FBRyxDQUFDLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDO0lBQ2pELE9BQU8sd0JBQXdCLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFHRDs7R0FFRztBQUNILE1BQU0sVUFBVSxlQUFlLENBQUMsS0FBWTtJQUMxQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FDaEMsTUFBTSxDQUFDLFdBQVcsR0FBRyxDQUFDLEVBQ3RCLE1BQU0sQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0IsT0FBTyx3QkFBd0IsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDakQsQ0FBQztBQUdEOzs7R0FHRztBQUNILE1BQU0sVUFBVSw2QkFBNkIsQ0FBQyxLQUFZO0lBQ3hELE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDNUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlELElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUUxQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDWixvQ0FBb0M7UUFDcEMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7UUFDekMsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbEUsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNSLE1BQU0sR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQy9DLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ1osT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUUvRCxNQUFNLFlBQVksR0FBRyxrQkFBa0IsQ0FBQztJQUN4QyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDN0UsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2xELENBQUM7QUFHRDs7R0FFRztBQUNILE1BQU0sVUFBVSxZQUFZLENBQUMsS0FBWTtJQUN2QyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLG9CQUFvQjtJQUNwQixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDdEMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNuQyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3RFLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZELE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUMzRCxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2pELENBQUM7QUFHRDs7R0FFRztBQUNILE1BQU0sVUFBVSxrQkFBa0IsQ0FBQyxLQUFpQixFQUFFLE1BQWtCLEVBQUUsTUFBa0I7SUFDMUYsc0NBQXNDO0lBQ3RDLDJDQUEyQztJQUMzQyxNQUFNLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNsQyxNQUFNLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNsQyxNQUFNLENBQUMsR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNsQyxNQUFNLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDdEMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFakMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTVDLHdEQUF3RDtJQUN4RCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDdkMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BDLENBQUM7QUFHRDs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLEtBQVksRUFBRSxLQUFpQjtJQUNsRSxzRUFBc0U7SUFDdEUsZ0RBQWdEO0lBQ2hELDRCQUE0QjtJQUM1QixzQkFBc0I7SUFDdEIscUJBQXFCO0lBQ3JCLG9CQUFvQjtJQUNwQix3QkFBd0I7SUFDeEIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUM1QixvQkFBb0I7SUFDcEIsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0lBQ25DLE1BQU0sR0FBRyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDekQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBRS9DLE1BQU0sTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3ZDLE1BQU0sQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUU5RCxNQUFNLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUNyQyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRTdDLE1BQU0sQ0FBQyxHQUFHLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEQsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ2hCLENBQUM7QUFHRDs7Ozs7R0FLRztBQUNILE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxNQUFjLEVBQUUsVUFBMEI7SUFDMUUsSUFBSSxNQUFNLElBQUksVUFBVSxFQUFFLENBQUM7UUFDekIsTUFBTSxHQUFHLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDN0QsT0FBTyxNQUFNLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0RSxDQUFDO1NBQU0sQ0FBQztRQUNOLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLFVBQVUsdUJBQXVCLENBQ25DLEtBQVUsRUFDVixNQUFjLEVBQ2QsUUFBb0IsRUFDcEIsT0FBa0I7SUFFcEIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUNyQyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQ1QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3BCLDhCQUE4QjtJQUM5QixJQUFJLE1BQU0sWUFBWSxnQkFBZ0IsSUFBSSxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztRQUMxRCxNQUFNLFdBQVcsR0FBRztZQUNsQixZQUFZLEVBQUUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7WUFDdEMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQ3hDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7WUFDaEQsa0JBQWtCLEVBQUUsTUFBTTtTQUMzQixDQUFDO1FBQ0YsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztRQUN4RCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsSUFBSSxTQUFTLGdCQUFnQixDQUFDLElBQWUsRUFBRSxHQUFXO1lBQ3BILDJFQUEyRTtZQUMzRSxxQ0FBcUM7WUFDckMseUVBQXlFO1lBQ3pFLGlCQUFpQixDQUFDLElBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN0QyxDQUFDLENBQUM7UUFDRixNQUFNLEdBQUcsSUFBSSxlQUFlLENBQUM7WUFDM0IsR0FBRyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUU7WUFDcEIsWUFBWSxFQUFFLE1BQU0sQ0FBQyxlQUFlLEVBQUU7WUFDdEMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUU7WUFDbEMsZ0JBQWdCO1lBQ2hCLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxFQUFFO1NBQzNCLENBQUMsQ0FBQztRQUNILE1BQU0sQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksTUFBTSxZQUFZLGlCQUFpQixFQUFFLENBQUM7UUFDeEMsSUFBSSxVQUFVLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLHNEQUFzRDtZQUNwRCxVQUFVLEdBQUcsUUFBUSxDQUFDO1FBQ3hCLENBQUM7UUFFRCxJQUFJLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDbkMsUUFBUSxHQUFHLElBQUkseUJBQXlCLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBQ0QscUNBQXFDO2FBQ2hDLENBQUM7WUFDSixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO1NBQU0sSUFBSSxNQUFNLFlBQVksbUJBQW1CLEVBQUUsQ0FBQztRQUNqRCxJQUFJLFVBQVUsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDaEIsVUFBVSxHQUFHLFFBQVEsQ0FBQztRQUN4QixDQUFDO1FBQ0QsSUFBSSxrQkFBa0IsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sU0FBUyxHQUFjLE1BQU0sQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUNyRCxNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQzFCLE1BQU0sQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDMUIsTUFBTSxDQUFDLGNBQWMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUMxQixNQUFNLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQzFCLElBQUksTUFBTSxDQUFDLFNBQVMsRUFBRSxDQUN6QixDQUFDO1lBQ0YsUUFBUSxHQUFHLElBQUksTUFBTSxDQUFDLHlCQUF5QixDQUFDO2dCQUM5QyxHQUFHLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDcEIsU0FBUzthQUNWLENBQUMsQ0FBQztRQUNMLENBQUM7UUFDRCxxQ0FBcUM7YUFDaEMsQ0FBQztZQUNKLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7U0FBTSxJQUFJLE1BQU0sWUFBWSxrQkFBa0IsSUFBSSxPQUFPLFlBQVksZUFBZSxFQUFFLENBQUM7UUFDdEYsSUFBSSxVQUFVLEdBQUcsbUJBQW1CLENBQUMsTUFBTSxDQUFDLENBQUM7UUFFN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLFVBQVUsR0FBRyxRQUFRLENBQUM7UUFDeEIsQ0FBQztRQUNELElBQUksSUFBSSxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQ3JCLG1FQUFtRTtZQUNqRSxNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELG9CQUFvQjtZQUNwQixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDL0QsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sU0FBUyxHQUFHLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztZQUN4RCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFDckQsTUFBTSxvQkFBb0IsR0FBRyxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEQsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDakQsSUFBSSxNQUFNLENBQUM7WUFDWCxJQUFJLE1BQU0sSUFBSSxvQkFBb0IsRUFBRSxDQUFDO2dCQUNuQyxNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3ZDLE1BQU0sR0FBRyw2QkFBNkIsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JGLENBQUM7WUFFRCxRQUFRLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQztnQkFDaEMsTUFBTTtnQkFDTixTQUFTO2dCQUNULFlBQVk7Z0JBQ1osYUFBYTtnQkFDYixJQUFJO2FBQ0wsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLENBQUMsNkNBQTZDO0lBQzVELENBQUM7U0FBTSxDQUFDO1FBQ04sZ0ZBQWdGO1FBQ2hGLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2xCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsdUJBQXVCLENBQUMsS0FBVSxFQUFFLE9BQWtCLEVBQUUsUUFBb0I7SUFFMUYsSUFBSSxDQUFDLENBQUMsT0FBTyxZQUFZLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLFlBQVksWUFBWSxDQUFDO1FBQzNFLENBQUMsQ0FBQyxPQUFPLFlBQVksZUFBZSxDQUFDLEVBQUUsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDbkMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ1osT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQ0QsSUFBSSxRQUFRLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUMzQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDZCxRQUFRLEdBQUcsdUJBQXVCLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUNELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU0sWUFBWSxHQUE0QixFQUFFLENBQUM7SUFFakQsTUFBTSxZQUFZLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7SUFDbEQsTUFBTSxHQUFHLEdBQUcsWUFBWSxJQUFJLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNoRCxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ1IsWUFBWSxDQUFDLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVELE1BQU0sV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUM7SUFDcEUsT0FBTyxXQUFXLENBQUM7QUFDckIsQ0FBQztBQUdEOzs7R0FHRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxrQkFBb0MsRUFBRSxPQUFxQjtJQUNyRyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7SUFDaEIsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQ2hGLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxQyxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMvQixPQUFPLElBQUksWUFBWSxDQUFDO1FBQzFCLENBQUM7UUFDRCxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUMsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDL0IsT0FBTyxHQUFHLE9BQU8sSUFBSSxZQUFZLENBQUM7UUFDcEMsQ0FBQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7SUFDeEIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUM7QUFDekIsQ0FBQztBQUdEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGlDQUFpQyxDQUFDLFVBQXNCO0lBQ3RFLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQztJQUN2QixPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBR0Q7O0dBRUc7QUFDSCxNQUFNLFVBQVUsbUNBQW1DLENBQUMsV0FBeUI7SUFDM0UsT0FBTyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDLENBQUM7SUFDckMsTUFBTSxXQUFXLEdBQUcsaUNBQWlDLENBQUM7SUFDdEQsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDNUMsVUFBVSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBQ0QsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUdEOzs7O0dBSUc7QUFDSCxNQUFNLFVBQVUscUJBQXFCLENBQXFCLFFBQVcsRUFBRSxVQUEwQjtJQUMvRixPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRTNCLE1BQU0sUUFBUSxHQUFHLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM1QyxNQUFNLElBQUksR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDdkMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssUUFBUSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFDMUMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQzVDLFFBQVEsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFPLENBQUM7UUFDakMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbkMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBQ0QsT0FBTyxRQUFRLENBQUM7QUFDbEIsQ0FBQztBQUdEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLG9CQUFvQixDQUFDLE9BQTBGO0lBQzdILE9BQU8sR0FBRyxPQUFPLElBQUksT0FBTyxDQUFDO0lBQzdCLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQzNCLE9BQU8sSUFBSSxNQUFNLENBQUMsS0FBSyxDQUNuQixNQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFDcEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQ3BDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUNwQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQ2IsQ0FBQztJQUNKLENBQUM7U0FBTSxJQUFJLE9BQU8sT0FBTyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBQ3RDLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsRCxDQUFDO1NBQU0sSUFBSSxPQUFPLFlBQVksYUFBYSxJQUFJLE9BQU8sWUFBWSxjQUFjLEVBQUUsQ0FBQztRQUNqRixnR0FBZ0c7UUFDaEcsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoRCxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7UUFDbkMsR0FBRyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7UUFDeEIsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELE9BQU8sSUFBSSxNQUFNLENBQUMscUJBQXFCLENBQUM7WUFDdEMsS0FBSyxFQUFFLE1BQU07U0FDZCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0QsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUdEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLEdBQVc7SUFDNUMsSUFBSSxVQUFVLEdBQUcsRUFBRSxDQUFDO0lBQ3BCLE1BQU0sRUFBRSxHQUFHLDJCQUEyQixDQUFDO0lBQ3ZDLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDM0IsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUNWLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM3QixNQUFNLGFBQWEsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sWUFBWSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUMsSUFBSSxRQUFRLENBQUM7UUFDYixLQUFLLFFBQVEsR0FBRyxhQUFhLEVBQUUsUUFBUSxJQUFJLFlBQVksRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDO1lBQ3BFLFVBQVUsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlDLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTztRQUNMLEdBQUc7UUFDSCxVQUFVO0tBQ1gsQ0FBQztBQUNKLENBQUM7QUFHRDs7O0dBR0c7QUFDSCxNQUFNLFVBQVUsa0JBQWtCLENBQUMsR0FBUSxFQUFFLEtBQVk7SUFDdkQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNyQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQzVCLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxNQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNyQyxPQUFPO1FBQ1QsQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuRCxJQUFJLGNBQWMsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxNQUFNLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUN0QyxPQUFPO1FBQ1QsQ0FBQztRQUNELE1BQU0sS0FBSyxHQUFHLG9CQUFvQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVqRCxpQkFBaUI7UUFDakIsMkJBQTJCLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUxRCxlQUFlO1FBQ2YsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEQsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztRQUMxQixNQUFNLE9BQU8sR0FBMkI7WUFDdEMsUUFBUSxFQUFFLEdBQUcsRUFBRTtnQkFDYixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQzNCLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDcEIsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3JCLENBQUM7U0FDRixDQUFDO1FBQ0YsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDN0QsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBR0Q7Ozs7O0dBS0c7QUFDSCxNQUFNLFVBQVUsd0JBQXdCLENBQUMsS0FBWSxFQUFFLEtBQWE7SUFDbEUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUNyQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQzVCLE1BQU0sS0FBSyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWCxNQUFNLENBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNyQyxPQUFPO1FBQ1QsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUEyQixFQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUMsQ0FBQztRQUM3RSxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4RCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDO1FBQzFCLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdELENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUdEOzs7R0FHRztBQUNILE1BQU0sVUFBVSxhQUFhLENBQUMsSUFBVSxFQUFFLEtBQUssR0FBRyxDQUFDO0lBQ2pELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN4QyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXhCLG9CQUFvQjtJQUNwQixJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzdCLG9CQUFvQjtRQUNwQixJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQzNELENBQUM7U0FBTSxDQUFDO1FBQ04sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUNoRSxDQUFDO0FBQ0gsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGtCQUFrQixDQUFDLFVBQXNCO0lBQ3ZELE1BQU0sTUFBTSxHQUFHLFVBQVUsQ0FBQyxPQUFPLEVBQUUsS0FBSyxXQUFXLENBQUM7SUFDcEQsTUFBTSxNQUFNLEdBQUcsVUFBVSxDQUFDLE9BQU8sRUFBRSxLQUFLLFdBQVcsQ0FBQztJQUNwRCxPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUM7QUFDMUIsQ0FBQztBQUVELE1BQU0sVUFBVSw2QkFBNkIsQ0FDekMsb0JBQXdDLEVBQ3hDLElBQVksRUFDWixNQUFrQixFQUNsQixNQUFjO0lBR2hCLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1FBQzFCLE9BQU8sRUFBRSxDQUFDO0lBQ1osQ0FBQztJQUNELElBQUksWUFBWSxHQUFHLG9CQUFvQixDQUFDO1FBQ3RDLFNBQVMsRUFBRSxFQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUM7UUFDNUYsTUFBTTtLQUNQLENBQUMsQ0FBQztJQUNILElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7UUFDakMsWUFBWSxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDaEMsQ0FBQztJQUVELE9BQU8sWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNqRSxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLFVBQVUseUJBQXlCLENBQ3JDLFVBQWtCLEVBQ2xCLFFBQWdCLEVBQ2hCLEtBQVksRUFDWixVQUFzQjtJQUV4QixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDNUIsb0JBQW9CO0lBQ3BCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMseUJBQXlCO0lBQzNELE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUVwRCxtREFBbUQ7SUFDbkQsTUFBTSxlQUFlLEdBQUcsVUFBVSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUM7SUFFekQsdUVBQXVFO0lBQ3ZFLDhEQUE4RDtJQUM5RCw4RUFBOEU7SUFDOUUsb0VBQW9FO0lBQ3BFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFM0QsMENBQTBDO0lBQzFDLE1BQU0sYUFBYSxHQUFHLGVBQWUsR0FBRyxhQUFhLEdBQUcscUJBQXFCLENBQUM7SUFFOUUsNERBQTREO0lBQzVELEVBQUU7SUFDRixVQUFVO0lBQ1YsUUFBUTtJQUNSLFNBQVM7SUFDVCxVQUFVO0lBQ1Ysa0JBQWtCO0lBQ2xCLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFbEUsMEVBQTBFO0lBQzFFLDhFQUE4RTtJQUU5RSxPQUFPLGdCQUFnQixDQUFDO0FBQzFCLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQU0sVUFBVSx5QkFBeUIsQ0FBQyxRQUFnQixFQUFFLFFBQWdCLEVBQUUsS0FBWSxFQUFFLFVBQXNCO0lBQ2hILHNFQUFzRTtJQUN0RSxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQzVCLE1BQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7SUFDNUIsb0JBQW9CO0lBQ3BCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMseUJBQXlCO0lBQzNELE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUVwRCxNQUFNLGFBQWEsR0FBRyxDQUFDLEdBQUcsUUFBUSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3hELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDM0QsTUFBTSxlQUFlLEdBQUcsYUFBYSxHQUFHLGFBQWEsR0FBRyxxQkFBcUIsQ0FBQztJQUM5RSxNQUFNLFVBQVUsR0FBRyxlQUFlLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUV6RCxPQUFPLFVBQVUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsTUFBTSxVQUFVLDJCQUEyQixDQUFDLE1BQWMsRUFBRSxjQUE4QixFQUFFLEtBQWlDO0lBQzNILElBQUksWUFBWSxHQUFHLEtBQUssQ0FBQztJQUN6QixPQUFPO1FBQ0wsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2xCLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDakMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDMUQsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxHQUFHLGNBQWMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUM5RyxrRUFBa0U7Z0JBQ2xFLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQ3RDLElBQUksZUFBZSxLQUFLLElBQUksRUFBRSxDQUFDO29CQUM3QixtREFBbUQ7b0JBQ25ELE9BQU87Z0JBQ1QsQ0FBQztxQkFBTSxDQUFDO29CQUNOLFlBQVksR0FBRyxJQUFJLENBQUM7b0JBQ3BCLE1BQU0sY0FBYyxHQUFHLEdBQUcsRUFBRSxDQUFDLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxDQUFDO29CQUNwRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFO3dCQUN6QyxRQUFRLEVBQUUsY0FBYzt3QkFDeEIsTUFBTSxFQUFFLGNBQWM7cUJBQ3ZCLENBQUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDLENBQUM7QUFDSixDQUFDIn0=