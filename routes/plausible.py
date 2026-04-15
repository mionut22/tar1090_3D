import math

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
    R = 3440.065  # Earth's radius in nautical miles
    dLat = (lat2 - lat1) * math.pi / 180
    dLon = (lon2 - lon1) * math.pi / 180
    
    a = (math.sin(dLat / 2) * math.sin(dLat / 2) +
         math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) *
         math.sin(dLon / 2) * math.sin(dLon / 2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def normalize_heading_diff(diff):
    diff = diff % 360
    if diff > 180:
        diff -= 360
    if diff < -180:
        diff += 360
    return diff

def assess_route_plausibility(aircraft_lat, aircraft_lon, aircraft_heading,
                             origin_lat, origin_lon, dest_lat, dest_lon):
    
    # Calculate key bearings and distances
    bearing_origin_to_dest = calculate_bearing(origin_lat, origin_lon, dest_lat, dest_lon)
    bearing_aircraft_to_dest = calculate_bearing(aircraft_lat, aircraft_lon, dest_lat, dest_lon)
    distance_origin_to_dest = calculate_distance(origin_lat, origin_lon, dest_lat, dest_lon)
    distance_aircraft_to_dest = calculate_distance(aircraft_lat, aircraft_lon, dest_lat, dest_lon)
    
    # Calculate heading alignment with direct route
    heading_error_direct = normalize_heading_diff(aircraft_heading - bearing_origin_to_dest)
    
    # Calculate heading alignment with current position to destination
    heading_error_current = normalize_heading_diff(aircraft_heading - bearing_aircraft_to_dest)
    
    # Deviation from planned route (worst case from direct route)
    heading_deviation = abs(heading_error_direct)
    
    # Calculate plausibility scores (0-100, higher is more plausible)
    # 1. Heading alignment: aircraft should be flying toward destination (within ~90°)
    heading_score = max(0, 100 - abs(heading_error_current) / 0.9)
    
    # 2. Progress: aircraft should have reasonable progress toward destination
    progress_ratio = (distance_origin_to_dest - distance_aircraft_to_dest) / distance_origin_to_dest
    progress_score = max(0, min(100, progress_ratio * 150))  # Allow some variance
    
    # 3. Sanity check: aircraft shouldn't be too far from the route
    route_deviation = abs(heading_error_direct)
    deviation_score = max(0, 100 - abs(route_deviation) / 1.8)
    
    # Overall plausibility (weighted average)
    overall_score = (heading_score * 0.4 + progress_score * 0.4 + deviation_score * 0.2)
    
    return {
        'plausible': overall_score > 50,  # Threshold for plausibility
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
            'distanceRemaining': round(distance_aircraft_to_dest),
            'distanceTotal': round(distance_origin_to_dest),
            'progressPercent': round(progress_ratio * 100)
        }
    }


# Example usage:
if __name__ == '__main__':
    result = assess_route_plausibility(
        40.7128, -74.0060,  # Aircraft at JFK (lat, lon)
        270,                # Flying west
        40.6895, -74.1745,  # Origin airport (lat, lon)
        51.4700, -0.4543    # Destination airport (lat, lon)
    )
    
    print(result)