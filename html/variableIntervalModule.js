/*
 * VARIABLE INTERVAL DATA RECEPTION HANDLER
 * Optimized for irregular data arrival (1-8 seconds between updates)
 * 
 * Key differences from fixed-interval systems:
 * - Longer extrapolation windows (8+ seconds)
 * - Larger buffers to survive droughts
 * - Adaptive smoothing based on time gaps
 * - Dead reckoning with confidence scoring
 */

"use strict";

const STATS_REFRESH_MS = 4000;
let statsIntervalId = null;

/**
 * Indicates whether debug output/UI should be enabled.
 * @returns {boolean} True when debug mode is active.
 */
function isDebugEnabled() {
    return window.tar1090Debug === true;
}

/**
 * Converts source timestamps to epoch milliseconds.
 * @param {number|string} sourceNow Source timestamp in seconds.
 * @param {number} [fallbackMs=Date.now()] Fallback when source timestamp is invalid.
 * @returns {number} Epoch timestamp in milliseconds.
 */
function sourceNowToTimestampMs(sourceNow, fallbackMs = Date.now()) {
    const numeric = Number(sourceNow);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallbackMs;
    }

    return Math.round(numeric * 1000);
}

// ============================================================================
// ENHANCED BUFFER FOR VARIABLE INTERVALS
// ============================================================================

class VariableIntervalDataBuffer {
    /**
     * Creates a bounded aircraft buffer and timing-stat tracker.
     * @param {string} aircraftHex Aircraft hex identifier.
     * @param {number} [minBufferSize=3] Minimum buffered samples to keep in reserve.
     * @param {number} [maxBufferSize=5] Maximum buffered samples before dropping oldest.
     */
    constructor(aircraftHex, minBufferSize = 3, maxBufferSize = 5) {
        this.hex = aircraftHex;
        this.buffer = [];
        this.minBufferSize = minBufferSize;
        this.maxBufferSize = maxBufferSize;

        // Track timing characteristics
        this.lastArrivalTime = null;
        this.interArrivalTimes = [];
        this.averageInterval = 0;
        this.maxGapSeen = 0;

        this.stats = {
            totalReceived: 0,
            totalProcessed: 0,
            droughts: 0, // Times buffer went empty
            maxBufferSize: 0
        };
    }

    /**
     * Adds a normalized sample and updates inter-arrival statistics.
     * @param {Object} planeData Normalized aircraft sample.
     * @returns {boolean} Always true for accepted samples.
     */
    addData(planeData) {
        const now = Date.now();

        // Track inter-arrival times
        if (this.lastArrivalTime !== null) {
            const gap = now - this.lastArrivalTime;
            this.interArrivalTimes.push(gap);

            // Keep last 20 intervals for moving average
            if (this.interArrivalTimes.length > 20) {
                this.interArrivalTimes.shift();
            }

            this.averageInterval = this.interArrivalTimes.reduce((a, b) => a + b, 0) / this.interArrivalTimes.length;

            if (gap > this.maxGapSeen) {
                this.maxGapSeen = gap;
            }
        }

        this.lastArrivalTime = now;
        planeData._arrived_at = now;

        // Check for overflow
        if (this.buffer.length >= this.maxBufferSize) {
            log(`[${this.hex}] Buffer overflow - dropping oldest sample`);
            this.buffer.shift(); // Drop oldest to make room
        }

        this.buffer.push(planeData);
        this.stats.totalReceived++;

        if (this.buffer.length > this.stats.maxBufferSize) {
            this.stats.maxBufferSize = this.buffer.length;
        }

        return true; // Always accept with variable intervals (drop old if needed)
    }

    /**
     * Returns the next sample only when the reserve buffer remains above minimum.
     * @returns {Object|null} Next sample or null when unavailable.
     */
    getNextSample() {
        // Keep the minimum reserve so add+process does not pin the buffer at min-1.
        if (this.buffer.length > this.minBufferSize) {
            const sample = this.buffer.shift();
            this.stats.totalProcessed++;
            return sample;
        }

        if (this.buffer.length === 0) {
            this.stats.droughts++;
        }

        return null;
    }

    /**
     * Computes extrapolation duration based on worst observed arrival gap.
     * @returns {number} Recommended extrapolation duration in milliseconds.
     */
    getRecommendedExtrapolationMs() {
        // Use max observed gap + 50% safety margin
        const recommended = this.maxGapSeen * 1.5;
        // But never less than 5 seconds, never more than 15 seconds
        return Math.max(5000, Math.min(15000, recommended));
    }

    /**
     * Estimates remaining time until next data point arrival.
     * @returns {number} Estimated milliseconds until next sample.
     */
    getTimeUntilNextDataMs() {
        if (!this.lastArrivalTime) return 0;
        const timeSinceLastArrival = Date.now() - this.lastArrivalTime;
        const predictedNextArrival = Math.max(this.averageInterval, this.maxGapSeen);
        return Math.max(0, predictedNextArrival - timeSinceLastArrival);
    }

    /**
     * Reports qualitative buffer health from current occupancy.
     * @returns {'STARVING'|'LOW'|'MEDIUM'|'HEALTHY'} Health state.
     */
    getHealth() {
        if (this.buffer.length === 0) return 'STARVING';
        if (this.buffer.length < this.minBufferSize) return 'LOW';
        if (this.buffer.length < this.maxBufferSize * 0.6) return 'MEDIUM';
        return 'HEALTHY';
    }

    /**
     * Returns merged runtime stats used for monitoring and adaptive playback decisions.
     * @returns {Object} Snapshot of buffer and timing metrics.
     */
    getStats() {
        return {
            hex: this.hex,
            currentBuffer: this.buffer.length,
            health: this.getHealth(),
            averageIntervalMs: Math.round(this.averageInterval),
            maxGapMs: this.maxGapSeen,
            extrapolationNeededMs: this.getRecommendedExtrapolationMs(),
            timeUntilNextDataMs: this.getTimeUntilNextDataMs(),
            droughts: this.stats.droughts,
            totalReceived: this.stats.totalReceived,
            maxBufferSize: this.maxBufferSize
        };
    }
}

// ============================================================================
// DEAD RECKONING WITH CONFIDENCE SCORING
// ============================================================================

class DeadReckoningCalculator {
    /**
     * Predict position during data gap
     * Returns confidence score (0-1) indicating reliability
    * @param {Object} lastPoint Last known normalized sample.
    * @param {number} timeDeltaMs Prediction horizon from the last sample in milliseconds.
    * @returns {{position:Object, velocity:Object, gs:number, track:number, baro_rate:number, confidence:number, isPredicted:boolean, predictedAtMs:number, originalTimestamp:number}} Predicted state plus confidence.
     */
    predictPositionWithConfidence(lastPoint, timeDeltaMs) {
        const secondsDelta = timeDeltaMs / 1000;

        // Confidence decreases over time (data becomes stale)
        // After 8 seconds, confidence = 0.5; after 12s, confidence = 0.2
        let confidence = Math.max(0, 1.0 - (secondsDelta / 10));

        // Reduce confidence if aircraft speed is very low (stationary planes)
        const gs = lastPoint.gs || 0;
        if (gs < 5) { // < 5 knots (stationary or very slow)
            confidence *= 0.6; // Less reliable prediction
        }

        // Reduce confidence if aircraft is turning (track_rate indicates this)
        if (lastPoint.track_rate && Math.abs(lastPoint.track_rate) > 3) {
            confidence *= 0.8; // Turning = harder to predict
        }

        const heading = (lastPoint.track || lastPoint.true_heading || 0) * Math.PI / 180;
        const speedMps = (gs || 0) / 3.6; // knots to m/s

        // Calculate position delta
        const deltaLat = (speedMps * Math.sin(heading) * secondsDelta) / 111000;
        const deltaLon = (speedMps * Math.cos(heading) * secondsDelta) / (111000 * Math.cos(lastPoint.lat * Math.PI / 180));
        const deltaAlt = (lastPoint.baro_rate || 0) * 0.00508 * secondsDelta;

        return {
            position: {
                lat: lastPoint.lat + deltaLat,
                lon: lastPoint.lon + deltaLon,
                alt: Math.max(0, lastPoint.alt + deltaAlt)
            },
            velocity: {
                vx: speedMps * Math.cos(heading),
                vy: speedMps * Math.sin(heading),
                vz: (lastPoint.baro_rate || 0) * 0.00508
            },
            gs: lastPoint.gs,
            track: lastPoint.track,
            baro_rate: lastPoint.baro_rate,
            confidence: confidence, // 0-1, where 1 = perfect, 0 = worthless
            isPredicted: true,
            predictedAtMs: Date.now(),
            originalTimestamp: lastPoint.timestamp
        };
    }

    /**
     * For large gaps, generate intermediate waypoints
     * Instead of straight-line dead reckoning, create a smooth path
        * @param {Object} startPoint Starting sample.
        * @param {Object} endPoint Ending sample.
        * @param {number} [intervalMs=500] Desired spacing between generated waypoints.
        * @returns {Object[]} Interpolated intermediate points.
     */
    generateIntermediatePoints(startPoint, endPoint, intervalMs = 500) {
        const points = [];
        const gapMs = endPoint.timestamp - startPoint.timestamp;
        const stepCount = Math.ceil(gapMs / intervalMs);

        for (let i = 1; i < stepCount; i++) {
            const t = i / stepCount; // 0 to 1
            const timeAtPoint = startPoint.timestamp + (t * gapMs);

            // Linear interpolation between points
            const interpolated = {
                timestamp: timeAtPoint,
                lat: startPoint.lat + (endPoint.lat - startPoint.lat) * t,
                lon: startPoint.lon + (endPoint.lon - startPoint.lon) * t,
                alt: startPoint.alt + (endPoint.alt - startPoint.alt) * t,
                gs: startPoint.gs + (endPoint.gs - startPoint.gs) * t,
                track: this.interpolateHeading(startPoint.track, endPoint.track, t),
                baro_rate: startPoint.baro_rate + (endPoint.baro_rate - startPoint.baro_rate) * t
            };

            points.push(interpolated);
        }

        return points;
    }

    /**
     * Interpolates heading across the 0/360 wrap boundary.
     * @param {number} h1 Start heading in degrees.
     * @param {number} h2 End heading in degrees.
     * @param {number} t Interpolation fraction from 0 to 1.
     * @returns {number} Interpolated heading in degrees.
     */
    interpolateHeading(h1, h2, t) {
        let diff = h2 - h1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return (h1 + diff * t + 360) % 360;
    }
}

// ============================================================================
// VARIABLE INTERVAL PLAYBACK CONTROLLER
// ============================================================================

class VariableIntervalPlaybackController {
    /**
     * Creates a playback-rate controller tied to Cesium clock ticks.
     * @param {Cesium.Viewer} cesiumViewer Active Cesium viewer instance.
     */
    constructor(cesiumViewer) {
        this.viewer = cesiumViewer;
        this.clock = cesiumViewer.clock;
        this.targetMultiplier = 1.0;
        this.currentMultiplier = 1.0;
        this.bufferHealth = 'HEALTHY';

        this.lastAdjustmentTime = Date.now();
        this.minimumAdjustmentInterval = 400; // Don't adjust faster than this

        this.healthThresholds = {
            'STARVING': 0.70,  // Significant slowdown
            'LOW': 0.85,       // Moderate slowdown
            'MEDIUM': 0.95,    // Gentle slowdown
            'HEALTHY': 1.0     // Full speed
        };

        this.playbackDelayMs = 1000;
        this.maxAheadMs = 120;

        this.clock.onTick.addEventListener(() => {
            this.enforcePlaybackDelay();
        });
    }

    /**
     * Prevents playback time from running too far ahead of newest received sample.
     */
    enforcePlaybackDelay() {
        const latestSampleMs = Number(window.tar1090LatestWatchedSampleTimeMs || 0);
        if (!Number.isFinite(latestSampleMs) || latestSampleMs <= 0) {
            return;
        }

        const targetPlaybackMs = latestSampleMs - this.playbackDelayMs;
        if (targetPlaybackMs <= 0) {
            return;
        }

        const targetTime = Cesium.JulianDate.fromDate(new Date(targetPlaybackMs));
        const deltaSec = Cesium.JulianDate.secondsDifference(this.clock.currentTime, targetTime);
        if (deltaSec > (this.maxAheadMs / 1000)) {
            this.clock.currentTime = targetTime;
        }
    }

    /**
     * Adjusts clock multiplier from buffer-health and data-gap projections.
     * @param {'STARVING'|'LOW'|'MEDIUM'|'HEALTHY'} bufferHealth Current buffer-health state.
     * @param {number} timeUntilNextDataMs Predicted time until next sample.
     * @param {number} recommendedExtrapolationMs Recommended extrapolation window.
     * @returns {{health:string,targetRate:number,currentRate:number,timeUntilNextDataMs:number}|undefined} Current playback-state summary.
     */
    updateClock(bufferHealth, timeUntilNextDataMs, recommendedExtrapolationMs) {
        const now = Date.now();
        if (now - this.lastAdjustmentTime < this.minimumAdjustmentInterval) {
            return; // Don't adjust too rapidly
        }

        this.lastAdjustmentTime = now;
        this.bufferHealth = bufferHealth;

        // Determine appropriate playback speed
        this.targetMultiplier = this.healthThresholds[bufferHealth] || 1.0;

        // Additional adjustment: if we're getting close to data gap, slow down more
        if (timeUntilNextDataMs < 2000 && bufferHealth !== 'HEALTHY') {
            this.targetMultiplier *= 0.9; // Additional 10% slowdown
        }

        // Smooth transition (no jarring jumps)
        const smoothingFactor = 0.07;
        const rawDelta = (this.targetMultiplier - this.currentMultiplier) * smoothingFactor;
        const maxStep = 0.015;
        const boundedDelta = Math.max(-maxStep, Math.min(maxStep, rawDelta));
        this.currentMultiplier += boundedDelta;

        this.clock.multiplier = this.currentMultiplier;
        this.enforcePlaybackDelay();

        return {
            health: bufferHealth,
            targetRate: this.targetMultiplier,
            currentRate: this.currentMultiplier,
            timeUntilNextDataMs: timeUntilNextDataMs
        };
    }

    /**
     * Returns current playback-controller state for diagnostics.
     * @returns {{health:string,targetRate:number,currentRate:number,timeUntilNextDataMs:null}} Playback status snapshot.
     */
    getStatus() {
        return {
            health: this.bufferHealth,
            targetRate: this.targetMultiplier,
            currentRate: this.currentMultiplier,
            timeUntilNextDataMs: null
        };
    }
}

// ============================================================================
// SMART TRAJECTORY BUILDER FOR VARIABLE INTERVALS
// ============================================================================

class VariableIntervalTrajectoryBuilder {
    /**
     * Creates a trajectory builder with dead-reckoning support.
     */
    constructor() {
        this.deadReckoner = new DeadReckoningCalculator();
    }

    /**
     * Build optimized trajectory handling variable gaps
     * Combines real data with dead reckoning during droughts
        * @param {Object[]} bufferSamples Buffered normalized samples.
        * @param {number} timeSinceLastSampleMs Milliseconds since latest sample timestamp.
        * @returns {Object[]} Trajectory samples, including interpolated/predicted entries.
     */
    buildTrajectory(bufferSamples, timeSinceLastSampleMs) {
        const trajectory = [];

        if (bufferSamples.length < 2) {
            return trajectory; // Need at least 2 points to interpolate
        }

        const now = Date.now();

        // Add all buffer samples with smooth interpolation
        for (let i = 0; i < bufferSamples.length - 1; i++) {
            const current = bufferSamples[i];
            const next = bufferSamples[i + 1];

            trajectory.push({
                timestamp: current.timestamp,
                lat: current.lat,
                lon: current.lon,
                alt: current.alt,
                gs: current.gs,
                track: current.track,
                baro_rate: current.baro_rate,
                confidence: 1.0, // Real measured data
                isReal: true
            });

            // Check if there's a gap between samples
            const gapMs = next.timestamp - current.timestamp;

            // If gap > 1.5 seconds, fill it with interpolated points
            if (gapMs > 1500) {
                const intermediatePoints = this.deadReckoner.generateIntermediatePoints(
                    current, next, 200 // Generate point every 200ms
                );

                trajectory.push(...intermediatePoints.map(p => ({
                    ...p,
                    confidence: 0.8, // Interpolated from real data
                    isReal: false
                })));
            }
        }

        // Add last sample
        const lastSample = bufferSamples[bufferSamples.length - 1];
        trajectory.push({
            timestamp: lastSample.timestamp,
            lat: lastSample.lat,
            lon: lastSample.lon,
            alt: lastSample.alt,
            gs: lastSample.gs,
            track: lastSample.track,
            baro_rate: lastSample.baro_rate,
            confidence: 1.0,
            isReal: true
        });

        // Extend into future with dead reckoning (8 seconds ahead)
        if (timeSinceLastSampleMs < 8000) {
            const predictedDuration = 8000 - timeSinceLastSampleMs;
            const predictedSteps = Math.ceil(predictedDuration / 200);

            for (let step = 1; step <= predictedSteps; step++) {
                const predictTime = timeSinceLastSampleMs + (step * 200);
                const predicted = this.deadReckoner.predictPositionWithConfidence(
                    lastSample,
                    predictTime
                );

                trajectory.push({
                    timestamp: now + (step * 200),
                    ...predicted
                });
            }
        }

        return trajectory;
    }
}

// ============================================================================
// GLOBAL AIRCRAFT MANAGER FOR VARIABLE INTERVALS
// ============================================================================

const globalVariableIntervalManager = {
    aircraft: {},
    trajectoryBuilder: new VariableIntervalTrajectoryBuilder(),
    playbackController: null,
    lastDisplayUpdateMs: 0,

    /**
     * Lazily initializes per-aircraft processing state.
     * @param {string} hex Aircraft hex identifier.
     * @returns {{buffer: VariableIntervalDataBuffer, lastRealData: Object|null, trajectory: Object[], lastProcessed: Object|null}} Aircraft state container.
     */
    initializeAircraft(hex) {
        if (!this.aircraft[hex]) {
            this.aircraft[hex] = {
                buffer: new VariableIntervalDataBuffer(hex),
                lastRealData: null,
                trajectory: [],
                lastProcessed: null
            };
        }
        return this.aircraft[hex];
    },

    /**
     * Normalizes and enqueues a newly received aircraft sample.
     * @param {string} hex Aircraft hex identifier.
     * @param {Object} planeData Raw incoming aircraft payload.
     * @returns {Object} Updated buffer statistics.
     */
    addData(hex, planeData) {
        // Normalize data structure
        const normalized = {
            hex: hex,
            timestamp: sourceNowToTimestampMs(planeData.now),
            lat: planeData.lat,
            lon: planeData.lon,
            alt: planeData.alt_baro !== 'ground'
                ? planeData.alt_baro / 3.281
                : 0,
            gs: planeData.gs || 0,
            track: planeData.track || 0,
            baro_rate: planeData.baro_rate || 0,
            track_rate: planeData.track_rate || 0,
            // Store original for reference
            original: planeData
        };

        const ac = this.initializeAircraft(hex);
        ac.buffer.addData(normalized);
        ac.lastRealData = normalized;

        return ac.buffer.getStats();
    },

    /**
     * Dequeues and processes the next available sample for an aircraft.
     * @param {string} hex Aircraft hex identifier.
     * @returns {{sample:Object, trajectory:Object[], bufferStats:Object}|null} Processing result or null when no sample is ready.
     */
    processAircraft(hex) {
        const ac = this.aircraft[hex];
        if (!ac) return null;

        const sample = ac.buffer.getNextSample();
        if (!sample) return null;

        // Build trajectory that includes dead reckoning
        const timeSinceLastSampleMs = Date.now() - sample.timestamp;
        ac.trajectory = this.trajectoryBuilder.buildTrajectory(
            [sample],
            timeSinceLastSampleMs
        );

        ac.lastProcessed = sample;
        return {
            sample: sample,
            trajectory: ac.trajectory,
            bufferStats: ac.buffer.getStats()
        };
    },

    /**
     * Get statistics for display/monitoring
        * @returns {Object[]} Stats for all tracked aircraft.
     */
    getAllStats() {
        return Object.entries(this.aircraft).map(([hex, ac]) => ({
            hex: hex,
            ...ac.buffer.getStats()
        }));
    },

    /**
     * Renders debug stats for all tracked aircraft into the info box.
     */
    displayAllStats() {
        if (!isDebugEnabled()) {
            return;
        }

        const now = Date.now();
        if (now - this.lastDisplayUpdateMs < STATS_REFRESH_MS) return;
        this.lastDisplayUpdateMs = now;

        const stats = this.getAllStats();
        let html = '<div style="font-family: monospace; font-size: 11px;">';

        for (const stat of stats) {
            const color = this.getHealthColor(stat.health);
            const textColor = this.getHealthTextColor(stat.health);
            html += `
        <div style="background: ${color}; color: ${textColor}; padding: 3px; margin: 2px 0; border: 1px solid rgba(255,255,255,0.25); border-radius: 4px;">
          <b>${stat.hex}</b> |
          Buf: ${stat.currentBuffer}/${stat.maxBufferSize} |
          Avg Interval: ${stat.averageIntervalMs}ms |
          Max Gap: ${stat.maxGapMs}ms |
          Extrapolate: ${stat.extrapolationNeededMs}ms |
          Health: ${stat.health}
        </div>
      `;
        }

        if (this.playbackController) {
            const pbStatus = this.playbackController.getStatus?.() || {};
            html += `
        <div style="background: #21282b; padding: 3px; margin: 2px 0; border: 1px solid #999;">
          <b>Playback</b> | Rate: ${pbStatus.currentRate?.toFixed(2) || 'N/A'}x | 
          Target: ${pbStatus.targetRate?.toFixed(2) || 'N/A'}x
        </div>
      `;
        }

        html += '</div>';

        const infoBox = document.getElementById('infoBox');
        if (infoBox) {
            infoBox.innerHTML = html;
            infoBox.classList.add('visible');
            infoBox.classList.add('live');
            if (window.__infoBoxHideTimer) {
                clearTimeout(window.__infoBoxHideTimer);
                window.__infoBoxHideTimer = null;
            }
        }
    },

    /**
     * Maps health state to debug card background color.
     * @param {'STARVING'|'LOW'|'MEDIUM'|'HEALTHY'} health Health state.
     * @returns {string} CSS color value.
     */
    getHealthColor(health) {
        const colors = {
            'HEALTHY': '#0f5132',
            'MEDIUM': '#664d03',
            'LOW': '#7f2a00',
            'STARVING': '#7a0f1d'
        };
        return colors[health] || '#1f2937';
    },

    /**
     * Maps health state to readable text color for debug UI.
     * @param {'STARVING'|'LOW'|'MEDIUM'|'HEALTHY'} health Health state.
     * @returns {string} CSS color value.
     */
    getHealthTextColor(health) {
        const textColors = {
            'HEALTHY': '#d1fae5',
            'MEDIUM': '#fff3bf',
            'LOW': '#ffe8cc',
            'STARVING': '#ffe3e3'
        };
        return textColors[health] || '#f3f4f6';
    }
};

// ============================================================================
// INTEGRATION WITH EXISTING postData
// ============================================================================

/**
 * NEW REPLACEMENT for postData() function
 * Handles variable interval reception
 * @param {string} jsonData Serialized incoming payload.
 */
function postDataVariableInterval(jsonData) {
    try {
        const payload = JSON.parse(jsonData);
        const trackedHex = payload.callsign || payload.hex;

        if (!trackedHex) {
            log('[ERROR] No callsign/hex in data');
            return;
        }

        // The stream usually provides a payload with an aircraft array.
        // Extract the tracked plane object so downstream logic receives plane fields.
        let trackedPlane = payload;
        if (Array.isArray(payload.aircraft)) {
            trackedPlane = payload.aircraft.find((p) => p && p.hex === trackedHex) || payload.aircraft[0];
            if (!trackedPlane) {
                log(`[${trackedHex}] No aircraft entries in payload`);
                return;
            }
            trackedPlane.now = payload.now;
        }

        if (!trackedPlane.hex) {
            trackedPlane.hex = trackedHex;
        }
        const trackedPlaneHex = (trackedPlane.hex || '').toLowerCase();

        // Add to intelligent buffer
        const bufferStats = globalVariableIntervalManager.addData(trackedHex, trackedPlane);

        if (bufferStats) {
            // log(`[${trackedHex}] Received. Buffer: ${bufferStats.currentBuffer}/${bufferStats.maxBufferSize}, ` +
            //     `Interval: ${bufferStats.averageIntervalMs}ms, Health: ${bufferStats.health}`);
        }

        // Process if buffer ready
        const result = globalVariableIntervalManager.processAircraft(trackedHex);
        if (result) {
            // Update 3D visualization with new trajectory
            processWatchedAircraft(result.sample.original);

            // Keep nearby non-watched aircraft in the 3D scene when using variable interval ingestion.
            if (Array.isArray(payload.aircraft)) {
                const watchedRef = (result.sample && result.sample.original && result.sample.original.lat != null && result.sample.original.lon != null)
                    ? { lat: result.sample.original.lat, lon: result.sample.original.lon }
                    : (trackedPlane && trackedPlane.lat != null && trackedPlane.lon != null)
                        ? { lat: trackedPlane.lat, lon: trackedPlane.lon }
                        : null;

                for (let i = 0; i < payload.aircraft.length; i++) {
                    const plane = payload.aircraft[i];
                    const planeHex = (plane && plane.hex) ? plane.hex.toLowerCase() : '';
                    if (!planeHex || planeHex === trackedPlaneHex) {
                        continue;
                    }

                    plane.now = payload.now;
                    processOtherAircraft(plane, watchedRef);
                }
            }

            update3dView();
            startPlayback();

            // Update playback speed based on buffer health
            if (globalVariableIntervalManager.playbackController) {
                globalVariableIntervalManager.playbackController.updateClock(
                    result.bufferStats.health,
                    result.bufferStats.timeUntilNextDataMs,
                    result.bufferStats.extrapolationNeededMs
                );
            }
        }

    } catch (e) {
        log(`[ERROR] postDataVariableInterval: ${e}`);
    }
}

// ============================================================================
// MONITORING LOOP
// ============================================================================

/**
 * Starts periodic debug-stat rendering for variable-interval processing.
 */
function startVariableIntervalMonitoring() {
    if (statsIntervalId !== null) {
        clearInterval(statsIntervalId);
        statsIntervalId = null;
    }

    statsIntervalId = setInterval(() => {
        globalVariableIntervalManager.displayAllStats();
    }, STATS_REFRESH_MS);
}

/**
 * Stops periodic debug-stat rendering for variable-interval processing.
 */
function stopVariableIntervalMonitoring() {
    if (statsIntervalId !== null) {
        clearInterval(statsIntervalId);
        statsIntervalId = null;
    }
}
