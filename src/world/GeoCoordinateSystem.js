const EARTH_RADIUS_METERS = 6378137;
const radians = (degrees) => degrees * Math.PI / 180;
const degrees = (radiansValue) => radiansValue * 180 / Math.PI;

/** Local ENU coordinate frame backed by WGS84 latitude/longitude. */
export class GeoCoordinateSystem {
  constructor(origin) { this.setOrigin(origin); }

  setOrigin({ latitude, longitude, altitude = 0 }) {
    this.origin = { latitude, longitude, altitude };
    this.cosLatitude = Math.cos(radians(latitude));
  }

  toLocal({ latitude, longitude, altitude = 0 }) {
    return {
      x: radians(longitude - this.origin.longitude) * EARTH_RADIUS_METERS * this.cosLatitude,
      y: altitude - this.origin.altitude,
      z: -radians(latitude - this.origin.latitude) * EARTH_RADIUS_METERS,
    };
  }

  toGeographic({ x, y = 0, z }) {
    return {
      latitude: this.origin.latitude - degrees(z / EARTH_RADIUS_METERS),
      longitude: this.origin.longitude + degrees(x / (EARTH_RADIUS_METERS * this.cosLatitude)),
      altitude: this.origin.altitude + y,
    };
  }

  chunkForLocal(position, chunkSize) {
    return { x: Math.floor(position.x / chunkSize), z: Math.floor(position.z / chunkSize) };
  }
}
