export interface PlaceOfInterest {
    name: string;
    camera: {
        x: number;
        z: number;
        zoom: number;
    };
    grid: {
        worldX: number;
        worldZ: number;
        widthInCells: number;
        heightInCells: number;
    };
}

// worldX = camera.x - widthInCells / 2
// worldZ = camera.z + heightInCells / 2 (top-left corner, grid extends down toward lower Z)
export const PLACES_OF_INTEREST: PlaceOfInterest[] = [
    {
        name: "Lumbridge Castle",
        camera: { x: 3215, z: 3219, zoom: 87 },
        grid: { worldX: 3198, worldZ: 3238, widthInCells: 34, heightInCells: 38 },
    },
    {
        name: "Falador Castle",
        camera: { x: 2976, z: 3341, zoom: 68 },
        grid: { worldX: 2943, worldZ: 3365, widthInCells: 66, heightInCells: 48 },
    },
    {
        name: "Crandor Volcano",
        camera: { x: 2842, z: 3271, zoom: 33 },
        grid: { worldX: 2802, worldZ: 3322, widthInCells: 80, heightInCells: 102 },
    },
    {
        name: "Karamja Volcano",
        camera: { x: 2845, z: 3174, zoom: 66 },
        grid: { worldX: 2819, worldZ: 3200, widthInCells: 52, heightInCells: 52 },
    },
    {
        name: "Gnome Maze",
        camera: { x: 2527, z: 3168, zoom: 50 },
        grid: { worldX: 2493, worldZ: 3201, widthInCells: 68, heightInCells: 66 },
    },
    {
        name: "Great Conch Village",
        camera: { x: 3162, z: 2409, zoom: 50 },
        grid: { worldX: 3127, worldZ: 2436, widthInCells: 70, heightInCells: 54 },
    },
    {
        name: "The Onyx Crest Island",
        camera: { x: 2975, z: 2272, zoom: 50 },
        grid: { worldX: 2944, worldZ: 2299, widthInCells: 62, heightInCells: 54 },
    },
    {
        name: "Last Light Island",
        camera: { x: 2851, z: 2328, zoom: 71 },
        grid: { worldX: 2825, worldZ: 2354, widthInCells: 52, heightInCells: 52 },
    },
    {
        name: "Hunter's Guild",
        camera: { x: 1562, z: 3047, zoom: 71 },
        grid: { worldX: 1533, worldZ: 3072, widthInCells: 58, heightInCells: 50 },
    },
    {
        name: "Fortis Colosseum",
        camera: { x: 1825, z: 3107, zoom: 55 },
        grid: { worldX: 1796, worldZ: 3136, widthInCells: 58, heightInCells: 58 },
    },
    {
        name: "Civitas illa Fortis Boatyard",
        camera: { x: 1760, z: 3140, zoom: 66 },
        grid: { worldX: 1731, worldZ: 3169, widthInCells: 58, heightInCells: 58 },
    },
    {
        name: "Mount Quidamortem",
        camera: { x: 1240, z: 3562, zoom: 105 },
        grid: { worldX: 1218, worldZ: 3580, widthInCells: 44, heightInCells: 36 },
    },
    {
        name: "Mount Karuulm",
        camera: { x: 1312, z: 3806, zoom: 47 },
        grid: { worldX: 1280, worldZ: 3838, widthInCells: 64, heightInCells: 64 },
    },
    {
        name: "Blast Mines",
        camera: { x: 1491, z: 3865, zoom: 60 },
        grid: { worldX: 1465, worldZ: 3887, widthInCells: 52, heightInCells: 44 },
    },
    {
        name: "Wintertodt",
        camera: { x: 1631, z: 4005, zoom: 79 },
        grid: { worldX: 1609, worldZ: 4029, widthInCells: 44, heightInCells: 48 },
    },
    {
        name: "Waterbirth Island",
        camera: { x: 2529, z: 3741, zoom: 48 },
        grid: { worldX: 2498, worldZ: 3772, widthInCells: 62, heightInCells: 62 },
    },
    {
        name: "Bandit Camp",
        camera: { x: 3044, z: 3681, zoom: 58 },
        grid: { worldX: 3016, worldZ: 3713, widthInCells: 56, heightInCells: 64 },
    },
    {
        name: "Scorpion Pit",
        camera: { x: 3239, z: 3947, zoom: 90 },
        grid: { worldX: 3215, worldZ: 3961, widthInCells: 48, heightInCells: 28 },
    },
    {
        name: "Chaos Temple",
        camera: { x: 3239, z: 3610, zoom: 80 },
        grid: { worldX: 3210, worldZ: 3634, widthInCells: 58, heightInCells: 48 },
    },
    {
        name: "Stronghold of Security",
        camera: { x: 2145, z: 5279, zoom: 47 },
        grid: { worldX: 2107, worldZ: 5313, widthInCells: 76, heightInCells: 68 },
    },
    {
        name: "Inferno",
        camera: { x: 2273, z: 5344, zoom: 56 },
        grid: { worldX: 2244, worldZ: 5373, widthInCells: 58, heightInCells: 58 },
    },
    {
        name: "Tempoross Port",
        camera: { x: 3157, z: 2837, zoom: 70 },
        grid: { worldX: 3125, worldZ: 2866, widthInCells: 64, heightInCells: 58 },
    },
    {
        name: "Tempoross Island",
        camera: { x: 3037, z: 2850, zoom: 59 },
        grid: { worldX: 3005, worldZ: 2881, widthInCells: 64, heightInCells: 62 },
    },
    {
        name: "Ardougne Castle",
        camera: { x: 2582, z: 3297, zoom: 78 },
        grid: { worldX: 2566, worldZ: 3312, widthInCells: 32, heightInCells: 30 },
    },
];
