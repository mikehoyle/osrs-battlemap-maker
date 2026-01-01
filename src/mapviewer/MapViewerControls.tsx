import { Leva, LevaInputs, button, folder, useControls } from "leva";
import { Schema } from "leva/dist/declarations/src/types";
import { memo, useEffect, useState } from "react";

import {
    GridRenderer2D,
    GridSettings,
    MINIMUM_GRID_SIZE,
} from "../components/renderer/GridRenderer2D";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { isTouchDevice } from "../util/DeviceUtil";
import { downloadBlob } from "../util/DownloadUtil";
import { loadCacheFiles } from "./Caches";
import { ProjectionType } from "./Camera";
import { MapViewer } from "./MapViewer";
import { MapViewerRenderer } from "./MapViewerRenderer";
import {
    MapViewerRendererType,
    createRenderer,
    getAvailableRenderers,
    getRendererName,
} from "./MapViewerRenderers";
import { fetchNpcSpawns, getNpcSpawnsUrl } from "./data/npc/NpcSpawn";

interface MapViewerControlsProps {
    renderer: MapViewerRenderer;
    hideUi: boolean;
    cameraZoom: number;
    setRenderer: (renderer: MapViewerRenderer) => void;
    setHideUi: (hideUi: boolean | ((hideUi: boolean) => boolean)) => void;
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
}

export const MapViewerControls = memo(
    ({
        renderer,
        hideUi: hidden,
        cameraZoom,
        setRenderer,
        setHideUi,
        setDownloadProgress,
    }: MapViewerControlsProps): JSX.Element => {
        const mapViewer = renderer.mapViewer;

        const [projectionType, setProjectionType] = useState<ProjectionType>(
            mapViewer.camera.projectionType,
        );
        const [dashedGridLine, setDashedGridLine] = useState<boolean>(
            renderer.gridRenderer.getSettings().dashedLine,
        );

        const [isExportingBattlemap, setExportingBattlemap] = useState(false);

        const positionControls = isTouchDevice
            ? "Joystick, Drag up and down." // TODO: confirm this is actually right for mobile
            : "WASD or Arrow Keys\nor Click-and-drag.\nUse SHIFT to go faster, or TAB to go slower.";

        const controlsSchema: Schema = {
            Position: { value: positionControls, editable: false },
        };

        const [gridSize, setGridSize] = useState({
            ...renderer.gridRenderer.maxGridSize,
            automaticGridSize: renderer.gridRenderer.getSettings().automaticGridSize,
            widthInCells: renderer.gridRenderer.getSettings().widthInCells,
            heightInCells: renderer.gridRenderer.getSettings().heightInCells,
        });

        useEffect(() => {
            function handleKeyDown(e: KeyboardEvent) {
                if (e.repeat) {
                    return;
                }

                // TODO remove?
                switch (e.key) {
                    case "F1":
                        setHideUi((v) => !v);
                        break;
                }
            }

            document.addEventListener("keydown", handleKeyDown);

            return () => {
                document.removeEventListener("keydown", handleKeyDown);
            };
        }, [mapViewer]);

        const rendererOptions: Record<string, MapViewerRendererType> = {};
        for (let v of getAvailableRenderers()) {
            rendererOptions[getRendererName(v)] = v;
        }

        const [, setCameraControls] = useControls(
            "Camera",
            () => ({
                ...createCameraControls(mapViewer),
                "Move Speed": {
                    value: mapViewer.cameraSpeed,
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    onChange: (v: number) => {
                        mapViewer.cameraSpeed = v;
                    },
                    order: 10,
                },
                "Rotate Left": button(() => {
                    const currentYaw = mapViewer.camera.getYaw();
                    mapViewer.camera.animateToYaw((currentYaw + 512) & 2047);
                }),
                "Rotate Right": button(() => {
                    const currentYaw = mapViewer.camera.getYaw();
                    mapViewer.camera.animateToYaw((currentYaw - 512 + 2048) & 2047);
                }),
                Controls: folder(controlsSchema, { collapsed: true, order: 999 }),
            }),
            { collapsed: false, order: 0 },
            [projectionType],
        );

        useControls(
            () => ({
                Grid: folder(
                    {
                        // Grid sub-folders configured below
                    },
                    { collapsed: false, order: 1 },
                ),
                Cache: folder(
                    {
                        Version: {
                            value: mapViewer.loadedCache.info.name,
                            options: mapViewer.cacheList.caches.map((cache) => cache.name),
                            onChange: async (v: string) => {
                                const cacheInfo = mapViewer.cacheList.caches.find(
                                    (cache) => cache.name === v,
                                );
                                if (v !== mapViewer.loadedCache.info.name && cacheInfo) {
                                    const [loadedCache, npcSpawns] = await Promise.all([
                                        loadCacheFiles(cacheInfo, undefined, setDownloadProgress),
                                        fetchNpcSpawns(getNpcSpawnsUrl(cacheInfo)),
                                    ]);
                                    mapViewer.npcSpawns = npcSpawns;
                                    mapViewer.initCache(loadedCache);
                                    setDownloadProgress(undefined);
                                }
                            },
                        },
                    },
                    { collapsed: true, order: 2 },
                ),
                Render: folder(
                    {
                        Renderer: {
                            value: renderer.type,
                            options: rendererOptions,
                            onChange: (v: MapViewerRendererType) => {
                                if (renderer.type !== v) {
                                    const renderer = createRenderer(v, mapViewer);
                                    mapViewer.setRenderer(renderer);
                                    setRenderer(renderer);
                                }
                            },
                        },
                        "Fps Limit": {
                            value: renderer.fpsLimit,
                            min: 1,
                            max: 999,
                            onChange: (v: number) => {
                                renderer.fpsLimit = v;
                            },
                        },
                        ...renderer.getControls(),
                    },
                    { collapsed: true, order: 3 },
                ),
                Export: folder(
                    {
                        "Export Map": button(
                            () => {
                                if (isExportingBattlemap) {
                                    return;
                                }
                                setExportingBattlemap(true);
                                mapViewer
                                    .exportBattlemap()
                                    .then((blob) => {
                                        if (!blob) {
                                            // TODO actual error handling, but I think this should be rare
                                            console.error("No blob returned");
                                            return;
                                        }

                                        downloadBlob(blob);
                                    })
                                    .finally(() => {
                                        setExportingBattlemap(false);
                                    });
                            },
                            { disabled: isExportingBattlemap },
                        ),
                    },
                    { collapsed: true, order: 4 },
                ),
            }),
            [renderer, isExportingBattlemap],
        );

        // Sync the Leva zoom slider when zoom changes via scroll wheel
        useEffect(() => {
            if (mapViewer.camera.projectionType === ProjectionType.ORTHO) {
                setCameraControls({ Zoom: cameraZoom } as Parameters<typeof setCameraControls>[0]);
            }
        }, [cameraZoom, mapViewer.camera.projectionType, setCameraControls]);

        useControls(
            "Grid.Appearance",
            {
                Enabled: {
                    value: renderer.gridRenderer.getSettings().enabled,
                    type: LevaInputs.BOOLEAN,
                    onChange: (value: boolean) => {
                        renderer.gridRenderer.setSettings({
                            enabled: value,
                        });
                    },
                    order: 1,
                },
                "Line Width": {
                    value: renderer.gridRenderer.getSettings().widthPx,
                    min: 0.5,
                    max: 5,
                    step: 0.5,
                    onChange: (value: number) => {
                        renderer.gridRenderer.setSettings({
                            widthPx: value,
                        });
                    },
                    order: 2,
                },
                "Dashed Line": {
                    value: renderer.gridRenderer.getSettings().dashedLine,
                    onChange: (value: boolean) => {
                        setDashedGridLine(value);
                        renderer.gridRenderer.setSettings({ dashedLine: value });
                    },
                    order: 3,
                },
                ...(dashedGridLine
                    ? {
                          "Dash Length": {
                              value: renderer.gridRenderer.getSettings().dashLengthPx,
                              min: 1,
                              max: 25,
                              step: 1,
                              onChange: (v) =>
                                  renderer.gridRenderer.setSettings({
                                      dashLengthPx: v,
                                  }),
                              order: 4,
                          },
                          "Gap Length": {
                              value: renderer.gridRenderer.getSettings().gapLengthPx,
                              min: 1,
                              max: 25,
                              step: 1,
                              onChange: (v) =>
                                  mapViewer.renderer.gridRenderer.setSettings({
                                      gapLengthPx: v,
                                  }),
                              order: 5,
                          },
                      }
                    : {}),
                Color: {
                    value: renderer.gridRenderer.getSettings().color,
                    type: LevaInputs.COLOR,
                    onChange: (value: { r: number; g: number; b: number; a?: number }) => {
                        renderer.gridRenderer.setSettings({
                            color: value,
                        });
                    },
                    order: 6,
                },
            },
            { collapsed: false, order: 0 },
            [dashedGridLine],
        );

        const [, setGridSizeLeva] = useControls(
            "Grid.Size",
            () => ({
                Automatic: {
                    value: gridSize.automaticGridSize,
                    type: LevaInputs.BOOLEAN,
                    onChange: (value: boolean) => {
                        renderer.gridRenderer.setSettings({
                            automaticGridSize: value,
                        });
                    },
                    order: 0,
                },
                Width: {
                    value: gridSize.widthInCells,
                    min: MINIMUM_GRID_SIZE,
                    max: gridSize.maxWidthInCells,
                    step: 2,
                    onChange: (value: number) => {
                        const widthInCells =
                            Math.round(
                                Math.max(
                                    MINIMUM_GRID_SIZE,
                                    Math.min(value, gridSize.maxWidthInCells),
                                ) / 2,
                            ) * 2;
                        renderer.gridRenderer.setSettings({
                            widthInCells,
                        });
                    },
                    order: 1,
                },
                Height: {
                    value: gridSize.heightInCells,
                    min: MINIMUM_GRID_SIZE,
                    max: gridSize.maxHeightInCells,
                    step: 2,
                    onChange: (value: number) => {
                        const heightInCells =
                            Math.round(
                                Math.max(
                                    MINIMUM_GRID_SIZE,
                                    Math.min(value, gridSize.maxHeightInCells),
                                ) / 2,
                            ) * 2;
                        renderer.gridRenderer.setSettings({
                            heightInCells,
                        });
                    },
                    order: 2,
                },
            }),
            { collapsed: false, order: 1 },
            [gridSize],
        );

        useEffect(() => {
            return renderer.gridRenderer.onMaxGridSizeChanged((gridSize) => {
                console.log("Grid size changed", gridSize);

                // It's awkward, but we set the grid size in Leva before AND after the
                // grid size (max size) update, because max can't go below the current value,
                // and the setting can't go above the max value.

                setGridSizeLeva({
                    Automatic: gridSize.automaticGridSize,
                    Width: gridSize.widthInCells,
                    Height: gridSize.heightInCells,
                });
                setGridSize(() => gridSize);
                setGridSizeLeva({
                    Automatic: gridSize.automaticGridSize,
                    Width: gridSize.widthInCells,
                    Height: gridSize.heightInCells,
                });
            });
        }, [renderer.gridRenderer]);

        return (
            <Leva
                titleBar={{ filter: false }}
                collapsed={true}
                hideCopyButton={true}
                hidden={hidden}
            />
        );
    },
);

function createCameraControls(mapViewer: MapViewer): Schema {
    if (mapViewer.camera.projectionType === ProjectionType.PERSPECTIVE) {
        return {
            FOV: {
                value: mapViewer.camera.fov,
                min: 30,
                max: 140,
                step: 1,
                onChange: (v: number) => {
                    mapViewer.camera.fov = v;
                },
            },
        };
    } else {
        return {
            Zoom: {
                value: mapViewer.camera.orthoZoom,
                min: 15,
                max: 200,
                step: 1,
                onChange: (v: number) => {
                    mapViewer.camera.orthoZoom = v;
                },
            },
        };
    }
}
