import * as Location from 'expo-location';

export type DetectLocationResult =
  { ok: true; location: string } | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Asks for location permission (only while the app is open) and reads the phone's position as
 * "lat, lng", the format PATCH /business/profile accepts.
 */
export async function detectLocation(): Promise<DetectLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { ok: false, reason: 'denied' };
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const { latitude, longitude } = position.coords;
    return { ok: true, location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
