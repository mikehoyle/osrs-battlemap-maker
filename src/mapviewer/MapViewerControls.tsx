import { Leva, LevaInputs, button, folder, useControls } from "leva";
import { memo, useEffect, useState } from "react";

import {
    GridSettings,
    MINIMUM_GRID_SIZE,
    MAXIMUM_GRID_SIZE,
} from "../components/renderer/GridRenderer2D";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { downloadBlob } from "../util/DownloadUtil";
import { loadCacheFiles } from "./Caches";
import { ExportResolution } from "./MapViewer";
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
    setRenderer: (renderer: MapViewerRenderer) => void;
    setHideUi: (hideUi: boolean | ((hideUi: boolean) => boolean)) => void;
    setDownloadProgress: (progress: DownloadProgress | undefined) => void;
}

export const MapViewerControls = memo(
    ({
        renderer,
        hideUi: hidden,
        setRenderer,
        setHideUi,
        setDownloadProgress,
    }: MapViewerControlsProps): JSX.Element => {
        const mapViewer = renderer.mapViewer;

        const [dashedGridLine, setDashedGridLine] = useState<boolean>(
            renderer.gridRenderer.getSettings().dashedLine,
        );

        const [isExportingBattlemap, setExportingBattlemap] = useState(false);
        const [exportResolution, setExportResolution] = useState<ExportResolution>(128);

        const positionControls =
            "WASD or Arrow Keys\nor Click-and-drag.\nUse SHIFT to go faster, or TAB to go slower.";

        const controlsSchema = {
            Position: { value: positionControls, editable: false },
        };

        const [gridPosition, setGridPosition] = useState({
            worldX: renderer.gridRenderer.getSettings().worldX,
            worldZ: renderer.gridRenderer.getSettings().worldZ,
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
        }, [setHideUi]);

        const rendererOptions: Record<string, MapViewerRendererType> = {};
        for (let v of getAvailableRenderers()) {
            rendererOptions[getRendererName(v)] = v;
        }

        useControls(
            "Camera",
            () => ({
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
                        Resolution: {
                            value: exportResolution,
                            options: {
                                "64px": 64 as ExportResolution,
                                "128px": 128 as ExportResolution,
                                "256px": 256 as ExportResolution,
                            },
                            onChange: (v: ExportResolution) => {
                                setExportResolution(v);
                            },
                            order: 0,
                        },
                        "Export Map": button(
                            () => {
                                if (isExportingBattlemap) {
                                    return;
                                }
                                setExportingBattlemap(true);
                                mapViewer
                                    .exportBattlemap(exportResolution)
                                    .then((blob) => {
                                        if (!blob) {
                                            // TODO actual error handling, but I think this should be rare
                                            console.error("No blob returned");
                                            return;
                                        }

                                        const settings = renderer.gridRenderer.getSettings();
                                        const filename = `osrs_battlemap_${settings.widthInCells}x${settings.heightInCells}.png`;
                                        downloadBlob(blob, filename);
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
            [renderer, isExportingBattlemap, exportResolution],
        );

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

        const [, setGridPositionLeva] = useControls(
            "Grid.Position",
            () => ({
                "World X": {
                    value: gridPosition.worldX,
                    step: 1,
                    onChange: (value: number) => {
                        const worldX = Math.floor(value);
                        renderer.gridRenderer.setSettings({ worldX });
                        setGridPosition((prev) => ({ ...prev, worldX }));
                    },
                    order: 0,
                },
                "World Z": {
                    value: gridPosition.worldZ,
                    step: 1,
                    onChange: (value: number) => {
                        const worldZ = Math.floor(value);
                        renderer.gridRenderer.setSettings({ worldZ });
                        setGridPosition((prev) => ({ ...prev, worldZ }));
                    },
                    order: 1,
                },
                Width: {
                    value: gridPosition.widthInCells,
                    min: MINIMUM_GRID_SIZE,
                    max: MAXIMUM_GRID_SIZE,
                    step: 1,
                    onChange: (value: number) => {
                        renderer.gridRenderer.setSettings({ widthInCells: value });
                        setGridPosition((prev) => ({ ...prev, widthInCells: value }));
                    },
                    order: 2,
                },
                Height: {
                    value: gridPosition.heightInCells,
                    min: MINIMUM_GRID_SIZE,
                    max: MAXIMUM_GRID_SIZE,
                    step: 1,
                    onChange: (value: number) => {
                        renderer.gridRenderer.setSettings({ heightInCells: value });
                        setGridPosition((prev) => ({ ...prev, heightInCells: value }));
                    },
                    order: 3,
                },
                "Center on Camera": button(() => {
                    const camX = mapViewer.camera.getPosX();
                    const camZ = mapViewer.camera.getPosZ();
                    renderer.gridRenderer.centerGridOnPosition(camX, camZ);
                    const settings = renderer.gridRenderer.getSettings();
                    setGridPosition({
                        worldX: settings.worldX,
                        worldZ: settings.worldZ,
                        widthInCells: settings.widthInCells,
                        heightInCells: settings.heightInCells,
                    });
                    setGridPositionLeva({
                        "World X": settings.worldX,
                        "World Z": settings.worldZ,
                        Width: settings.widthInCells,
                        Height: settings.heightInCells,
                    });
                }),
            }),
            { collapsed: false, order: 1 },
            [gridPosition],
        );

        return (
            <Leva
                titleBar={{ filter: false }}
                collapsed={false}
                hideCopyButton={true}
                hidden={hidden}
            />
        );
    },
);
