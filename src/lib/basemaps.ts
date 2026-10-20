/** The two map backgrounds both maps offer: Esri's satellite imagery, or OpenStreetMap's streets. */
export type Basemap = "satellite" | "streets";

export const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// English place names and borders over the imagery while zoomed out.
export const LABELS_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
export const STREETS_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const ESRI_CREDIT = "&copy; Esri, Maxar, Earthstar Geographics";
export const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// The basemap picture buttons: one real tile of each, the upper Gulf of Thailand at zoom 8.
export const BASEMAP_THUMB: Record<Basemap, string> = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/8/118/199",
  streets: "https://tile.openstreetmap.org/8/199/118.png",
};
