import { GridSettings } from "../components/renderer/GridRenderer2D";

export interface PlaceOfInterest {
    name: string;
    camera: {
        x: number;
        z: number;
    };
    grid: Pick<GridSettings, "widthInCells" | "heightInCells">;
}

export const PLACES_OF_INTEREST: PlaceOfInterest[] = [
    {
        name: "Lumbridge Castle",
        camera: {
            x: 3215,
            z: 3219,
        },
        grid: {
            widthInCells: 32,
            heightInCells: 32,
        },
    },
];
