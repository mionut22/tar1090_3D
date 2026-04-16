import json
import math

EARTH_RADIUS_NM = 3440.065

def _to_radians(lat, lon):
    return math.radians(lat), math.radians(lon)

def _angular_distance(lat1, lon1, lat2, lon2):
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    a = (
        math.sin(dlat / 2) * math.sin(dlat / 2)
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(dlon / 2)
        * math.sin(dlon / 2)
    )
    return 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def _initial_bearing_radians(lat1, lon1, lat2, lon2):
    lat1_rad, lon1_rad = _to_radians(lat1, lon1)
    lat2_rad, lon2_rad = _to_radians(lat2, lon2)
    dlon = lon2_rad - lon1_rad

    y = math.sin(dlon) * math.cos(lat2_rad)
    x = (
        math.cos(lat1_rad) * math.sin(lat2_rad)
        - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon)
    )
    return math.atan2(y, x)

def _intermediate_point(lat1, lon1, lat2, lon2, fraction):
    if fraction <= 0:
        return lat1, lon1
    if fraction >= 1:
        return lat2, lon2

    lat1_rad, lon1_rad = _to_radians(lat1, lon1)
    lat2_rad, lon2_rad = _to_radians(lat2, lon2)
    angular_distance = _angular_distance(lat1, lon1, lat2, lon2)

    if angular_distance == 0:
        return lat1, lon1

    sin_distance = math.sin(angular_distance)
    weight_a = math.sin((1 - fraction) * angular_distance) / sin_distance
    weight_b = math.sin(fraction * angular_distance) / sin_distance

    x = weight_a * math.cos(lat1_rad) * math.cos(lon1_rad) + weight_b * math.cos(lat2_rad) * math.cos(lon2_rad)
    y = weight_a * math.cos(lat1_rad) * math.sin(lon1_rad) + weight_b * math.cos(lat2_rad) * math.sin(lon2_rad)
    z = weight_a * math.sin(lat1_rad) + weight_b * math.sin(lat2_rad)

    lat = math.atan2(z, math.sqrt(x * x + y * y))
    lon = math.atan2(y, x)
    return math.degrees(lat), math.degrees(lon)

def _local_course_on_leg(origin_lat, origin_lon, dest_lat, dest_lon, along_track_nm, leg_distance_nm):
    if leg_distance_nm <= 0:
        return calculate_bearing(origin_lat, origin_lon, dest_lat, dest_lon)

    step_nm = min(25.0, max(5.0, leg_distance_nm * 0.05))
    start_nm = max(0.0, along_track_nm - step_nm)
    end_nm = min(leg_distance_nm, along_track_nm + step_nm)

    if end_nm <= start_nm:
        end_nm = min(leg_distance_nm, start_nm + 1.0)
    if end_nm <= start_nm:
        return calculate_bearing(origin_lat, origin_lon, dest_lat, dest_lon)

    start_fraction = start_nm / leg_distance_nm
    end_fraction = end_nm / leg_distance_nm
    start_point = _intermediate_point(origin_lat, origin_lon, dest_lat, dest_lon, start_fraction)
    end_point = _intermediate_point(origin_lat, origin_lon, dest_lat, dest_lon, end_fraction)

    return calculate_bearing(start_point[0], start_point[1], end_point[0], end_point[1])

def _great_circle_leg_metrics(aircraft_lat, aircraft_lon, origin_lat, origin_lon, dest_lat, dest_lon):
    leg_distance_rad = _angular_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    leg_distance_nm = leg_distance_rad * EARTH_RADIUS_NM

    if leg_distance_nm == 0:
        aircraft_to_origin = calculate_distance(aircraft_lat, aircraft_lon, origin_lat, origin_lon)
        return {
            'legDistance': 0.0,
            'crossTrackDistance': aircraft_to_origin,
            'alongTrackDistance': 0.0,
            'distanceFromSegment': aircraft_to_origin,
            'distanceToOrigin': aircraft_to_origin,
            'distanceToDestination': aircraft_to_origin,
            'closestPoint': (origin_lat, origin_lon),
            'courseAtClosestPoint': 0.0,
            'progressRatio': 0.0,
        }

    aircraft_distance_rad = _angular_distance(origin_lat, origin_lon, aircraft_lat, aircraft_lon)
    bearing_origin_to_leg = _initial_bearing_radians(origin_lat, origin_lon, dest_lat, dest_lon)
    bearing_origin_to_aircraft = _initial_bearing_radians(origin_lat, origin_lon, aircraft_lat, aircraft_lon)

    cross_track_rad = math.asin(
        max(-1.0, min(1.0, math.sin(aircraft_distance_rad) * math.sin(bearing_origin_to_aircraft - bearing_origin_to_leg)))
    )
    along_track_rad = math.atan2(
        math.sin(aircraft_distance_rad) * math.cos(bearing_origin_to_aircraft - bearing_origin_to_leg),
        math.cos(aircraft_distance_rad),
    )

    raw_along_track_nm = along_track_rad * EARTH_RADIUS_NM
    clamped_along_track_nm = min(max(raw_along_track_nm, 0.0), leg_distance_nm)

    if raw_along_track_nm < 0:
        closest_lat, closest_lon = origin_lat, origin_lon
        distance_from_segment_nm = calculate_distance(aircraft_lat, aircraft_lon, origin_lat, origin_lon)
    elif raw_along_track_nm > leg_distance_nm:
        closest_lat, closest_lon = dest_lat, dest_lon
        distance_from_segment_nm = calculate_distance(aircraft_lat, aircraft_lon, dest_lat, dest_lon)
    else:
        closest_lat, closest_lon = _intermediate_point(
            origin_lat,
            origin_lon,
            dest_lat,
            dest_lon,
            clamped_along_track_nm / leg_distance_nm,
        )
        distance_from_segment_nm = abs(cross_track_rad) * EARTH_RADIUS_NM

    return {
        'legDistance': leg_distance_nm,
        'crossTrackDistance': abs(cross_track_rad) * EARTH_RADIUS_NM,
        'alongTrackDistance': clamped_along_track_nm,
        'distanceFromSegment': distance_from_segment_nm,
        'distanceToOrigin': calculate_distance(aircraft_lat, aircraft_lon, origin_lat, origin_lon),
        'distanceToDestination': calculate_distance(aircraft_lat, aircraft_lon, dest_lat, dest_lon),
        'closestPoint': (closest_lat, closest_lon),
        'courseAtClosestPoint': _local_course_on_leg(
            origin_lat,
            origin_lon,
            dest_lat,
            dest_lon,
            clamped_along_track_nm,
            leg_distance_nm,
        ),
        'progressRatio': clamped_along_track_nm / leg_distance_nm,
    }

def calculate_bearing(lat1, lon1, lat2, lon2):
    dLon = (lon2 - lon1) * math.pi / 180
    lat1_rad = lat1 * math.pi / 180
    lat2_rad = lat2 * math.pi / 180
    
    y = math.sin(dLon) * math.cos(lat2_rad)
    x = (math.cos(lat1_rad) * math.sin(lat2_rad) - 
         math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dLon))
    
    bearing = math.atan2(y, x) * 180 / math.pi
    bearing = (bearing + 360) % 360  # Normalize to 0-360
    return bearing


def calculate_distance(lat1, lon1, lat2, lon2):
    dLat = (lat2 - lat1) * math.pi / 180
    dLon = (lon2 - lon1) * math.pi / 180
    
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_NM * c

def normalize_heading_diff(diff):
    diff = diff % 360
    if diff > 180:
        diff -= 360
    if diff < -180:
        diff += 360
    return diff

def assess_route_plausibility(aircraft_lat, aircraft_lon, aircraft_heading,
                             origin_lat, origin_lon, dest_lat, dest_lon):
    
    bearing_origin_to_dest = calculate_bearing(origin_lat, origin_lon, dest_lat, dest_lon)
    bearing_aircraft_to_dest = calculate_bearing(aircraft_lat, aircraft_lon, dest_lat, dest_lon)
    metrics = _great_circle_leg_metrics(
        aircraft_lat,
        aircraft_lon,
        origin_lat,
        origin_lon,
        dest_lat,
        dest_lon,
    )

    distance_origin_to_dest = metrics['legDistance']
    distance_aircraft_to_dest = metrics['distanceToDestination']
    distance_aircraft_to_origin = metrics['distanceToOrigin']
    distance_from_segment = metrics['distanceFromSegment']
    cross_track_distance = metrics['crossTrackDistance']
    along_track_distance = metrics['alongTrackDistance']
    progress_ratio = metrics['progressRatio']
    course_at_closest_point = metrics['courseAtClosestPoint']

    heading_error_route = normalize_heading_diff(aircraft_heading - course_at_closest_point)
    heading_error_direct = normalize_heading_diff(aircraft_heading - bearing_origin_to_dest)
    heading_error_current = normalize_heading_diff(aircraft_heading - bearing_aircraft_to_dest)

    terminal_distance = min(distance_aircraft_to_origin, distance_aircraft_to_dest)
    terminal_proximity = max(0.0, 1.0 - min(terminal_distance, 120.0) / 120.0)
    long_haul_factor = max(0.0, min(1.0, (distance_origin_to_dest - 1500.0) / 4500.0))

    heading_tolerance = 35.0 + terminal_proximity * 110.0
    heading_score = max(0.0, 100.0 - (abs(heading_error_route) / heading_tolerance) * 100.0)

    corridor_width = max(40.0, min(900.0, distance_origin_to_dest * 0.16))
    hard_limit = max(
        corridor_width * (2.0 + long_haul_factor * 0.5),
        distance_origin_to_dest * (0.22 + long_haul_factor * 0.18),
        120.0,
    )
    deviation_ratio = min(distance_from_segment / hard_limit, 1.0)
    raw_deviation_score = max(0.0, 100.0 - deviation_ratio * deviation_ratio * 70.0 - deviation_ratio * 20.0)
    deviation_floor = long_haul_factor * 45.0
    deviation_score = max(raw_deviation_score, deviation_floor)

    segment_buffer = max(30.0, min(220.0, distance_origin_to_dest * 0.10))
    endpoint_penalty = max(0.0, distance_from_segment - corridor_width)
    endpoint_score = max(0.0, 100.0 - (endpoint_penalty / segment_buffer) * 100.0)
    endpoint_floor = long_haul_factor * 35.0
    endpoint_score = max(endpoint_score, endpoint_floor)

    progress_bias = 100.0 - abs(50.0 - progress_ratio * 100.0)
    progress_score = max(0.0, min(100.0, (progress_bias * 0.35) + (endpoint_score * 0.65)))

    heading_weight = 0.35 + long_haul_factor * 0.10
    progress_weight = 0.20 + long_haul_factor * 0.05
    deviation_weight = 1.0 - heading_weight - progress_weight
    overall_score = (
        heading_score * heading_weight
        + progress_score * progress_weight
        + deviation_score * deviation_weight
    )
    
    return {
        'plausible': overall_score >= 45 and distance_from_segment <= hard_limit,
        'overallScore': round(overall_score),
        'headingScore': round(heading_score),
        'progressScore': round(progress_score),
        'deviationScore': round(deviation_score),
        'metrics': {
            'aircraftHeading': aircraft_heading,
            'bearingToDestination': round(bearing_aircraft_to_dest),
            'bearingPlannedRoute': round(bearing_origin_to_dest),
            'headingErrorFromRoute': round(heading_error_direct),
            'headingErrorToCurrent': round(heading_error_current),
            'headingErrorToLegCourse': round(heading_error_route),
            'legCourseAtClosestPoint': round(course_at_closest_point),
            'distanceRemaining': round(distance_aircraft_to_dest),
            'distanceTotal': round(distance_origin_to_dest),
            'distanceToOrigin': round(distance_aircraft_to_origin),
            'distanceFromSegment': round(distance_from_segment),
            'crossTrackDistance': round(cross_track_distance),
            'alongTrackDistance': round(along_track_distance),
            'corridorWidth': round(corridor_width),
            'hardLimit': round(hard_limit),
            'progressPercent': round(progress_ratio * 100)
        }
    }

def calc_plausible(route, lat: float, lng: float, trk: float, callsign: str = ""):
    best_result = None
    best_leg = None

    def is_better_candidate(candidate, current_best):
        if current_best is None:
            return True

        if candidate["plausible"] != current_best["plausible"]:
            return candidate["plausible"]

        if candidate["overallScore"] != current_best["overallScore"]:
            return candidate["overallScore"] > current_best["overallScore"]

        candidate_distance = candidate.get("metrics", {}).get("distanceFromSegment", float("inf"))
        current_distance = current_best.get("metrics", {}).get("distanceFromSegment", float("inf"))
        return candidate_distance < current_distance

    for i in range(len(route.get("_airports", [])) - 1):
        a, b = route["_airports"][i], route["_airports"][i + 1]
        candidates = [
            (
                False,
                a,
                b,
                assess_route_plausibility(
                    round(lat, 3),
                    round(lng, 3),
                    trk,
                    round(a["lat"], 3),
                    round(a["lon"], 3),
                    round(b["lat"], 3),
                    round(b["lon"], 3),
                ),
            ),
            (
                True,
                b,
                a,
                assess_route_plausibility(
                    round(lat, 3),
                    round(lng, 3),
                    trk,
                    round(b["lat"], 3),
                    round(b["lon"], 3),
                    round(a["lat"], 3),
                    round(a["lon"], 3),
                ),
            ),
        ]

        for is_reverse, leg_start, leg_end, candidate in candidates:
            if is_better_candidate(candidate, best_result):
                best_result = candidate
                best_leg = {
                    "reverse": is_reverse,
                    "start": leg_start.get("iata") or leg_start["icao"],
                    "end": leg_end.get("iata") or leg_end["icao"],
                }

    if best_result is None:
        return False

    if best_leg["reverse"] and best_result["plausible"]:
        print(callsign, "plausible in reverse leg", best_leg["start"], "->", best_leg["end"])

    print(json.dumps({
        "callsign": callsign,
        "leg": best_leg,
        "plausibility": best_result,
    }, indent=2))
    return best_result["plausible"]

if __name__ == '__main__':
    result = assess_route_plausibility(
        40.7128, -74.0060,  # Aircraft at JFK (lat, lon)
        270,                # Flying west
        40.6895, -74.1745,  # Origin airport (lat, lon)
        51.4700, -0.4543    # Destination airport (lat, lon)
    )
    print(result)