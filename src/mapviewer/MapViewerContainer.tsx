import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { RendererCanvas } from "../components/renderer/RendererCanvas";
import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { OsrsMenu, OsrsMenuProps } from "../components/rs/menu/OsrsMenu";
import { PlacesOfInterestDialog } from "../components/rs/places/PlacesOfInterestDialog";
import { WorldMapModal } from "../components/rs/worldmap/WorldMapModal";
import { Sidebar } from "../components/sidebar/Sidebar";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { MapViewer } from "./MapViewer";
import "./MapViewerContainer.css";
import { MapViewerRenderer } from "./MapViewerRenderer";
import { PlaceOfInterest } from "./PlacesOfInterest";

interface MapViewerContainerProps {
    mapViewer: MapViewer;
}

export function MapViewerContainer({ mapViewer }: MapViewerContainerProps): JSX.Element {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [renderer, setRenderer] = useState<MapViewerRenderer>(mapViewer.renderer);

    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();

    const [hideUi, setHideUi] = useState(false);
    const [isWorldMapOpen, setWorldMapOpen] = useState<boolean>(false);
    const [isPlacesDialogOpen, setPlacesDialogOpen] = useState<boolean>(false);
    const [isGridVisible, setIsGridVisible] = useState<boolean>(true);

    const [menuProps, setMenuProps] = useState<OsrsMenuProps | undefined>(undefined);

    const requestRef = useRef<number | undefined>();

    const animate = useCallback(
        (time: DOMHighResTimeStamp) => {
            // Wait for 200ms before updating search params
            if (
                mapViewer.needsSearchParamUpdate &&
                performance.now() - mapViewer.lastTimeSearchParamsUpdated > 200
            ) {
                setSearchParams(mapViewer.getSearchParams(), { replace: true });
                mapViewer.needsSearchParamUpdate = false;
                console.log("Updated search params");
            }

            if (!hideUi) {
                // Check if grid is visible in current camera view
                const canvas = renderer.canvas;
                if (canvas) {
                    const gridVisible = renderer.gridRenderer.isGridVisible(
                        mapViewer.camera,
                        canvas.width,
                        canvas.height,
                    );
                    setIsGridVisible(gridVisible);
                }
            }

            if (
                mapViewer.menuEntries.length > 0 &&
                mapViewer.menuX !== -1 &&
                mapViewer.menuY !== -1
            ) {
                setMenuProps({
                    x: mapViewer.menuX,
                    y: mapViewer.menuY,
                    tooltip: !mapViewer.menuOpen,
                    entries: mapViewer.menuEntries,
                    debugId: mapViewer.debugId,
                });
            } else {
                setMenuProps(undefined);
            }

            requestRef.current = requestAnimationFrame(animate);
        },
        [mapViewer, renderer, hideUi, setSearchParams],
    );

    useEffect(() => {
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [animate]);

    const goBack = useCallback(() => {
        navigate("/");
    }, [navigate]);

    const openWorldMap = useCallback(() => {
        setWorldMapOpen(true);
    }, []);

    const closeWorldMap = useCallback(() => {
        setWorldMapOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const openPlacesDialog = useCallback(() => {
        setPlacesDialogOpen(true);
    }, []);

    const closePlacesDialog = useCallback(() => {
        setPlacesDialogOpen(false);
        renderer.canvas.focus();
    }, [renderer]);

    const snapGridToCamera = useCallback(() => {
        const canvas = renderer.canvas;
        if (canvas) {
            renderer.gridRenderer.snapGridToCamera(mapViewer.camera, canvas.width, canvas.height);
        }
    }, [mapViewer, renderer]);

    const returnToGrid = useCallback(() => {
        const gridCenter = renderer.gridRenderer.gridCenter;
        mapViewer.camera.teleport(gridCenter[0], undefined, gridCenter[1]);
    }, [mapViewer, renderer]);

    const onPlaceSelected = useCallback(
        (place: PlaceOfInterest) => {
            mapViewer.camera.teleport(place.camera.x, undefined, place.camera.z);
            mapViewer.camera.orthoZoom = place.camera.zoom;
            renderer.gridRenderer.setSettings({
                worldX: place.grid.worldX,
                worldZ: place.grid.worldZ,
                widthInCells: place.grid.widthInCells,
                heightInCells: place.grid.heightInCells,
            });
        },
        [mapViewer, renderer],
    );

    const onMapClicked = useCallback(
        (x: number, y: number) => {
            // "y" is actually z from our camera's perspective
            mapViewer.camera.teleport(x, undefined, y);
            closeWorldMap();
        },
        [mapViewer, closeWorldMap],
    );

    const getMapPosition = useCallback(() => {
        const x = mapViewer.camera.getPosX();
        const y = mapViewer.camera.getPosZ();

        return {
            x,
            y,
        };
    }, [mapViewer]);

    const loadMapImageUrl = useCallback(
        (mapX: number, mapY: number) => {
            return mapViewer.getMapImageUrl(mapX, mapY, false);
        },
        [mapViewer],
    );

    let loadingBarOverlay: JSX.Element | undefined = undefined;
    if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        loadingBarOverlay = (
            <div className="overlay-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    }

    return (
        <div className="map-viewer-root">
            {loadingBarOverlay}

            {menuProps && <OsrsMenu {...menuProps} />}

            {!hideUi && (
                <Sidebar
                    mapViewer={mapViewer}
                    renderer={renderer}
                    setHideUi={setHideUi}
                    onBackClick={goBack}
                    onWorldMapClick={openWorldMap}
                    onPlacesOfInterestClick={openPlacesDialog}
                />
            )}

            <div className="map-viewer-content">
                {!hideUi && (
                    <>
                        <WorldMapModal
                            isOpen={isWorldMapOpen}
                            onRequestClose={closeWorldMap}
                            onDoubleClick={onMapClicked}
                            getPosition={getMapPosition}
                            loadMapImageUrl={loadMapImageUrl}
                        />
                        <PlacesOfInterestDialog
                            isOpen={isPlacesDialogOpen}
                            onRequestClose={closePlacesDialog}
                            onPlaceSelected={onPlaceSelected}
                        />
                        <div className={`grid-buttons ${!isGridVisible ? "visible" : ""}`}>
                            <button
                                className="grid-button rs-border rs-background"
                                onClick={returnToGrid}
                            >
                                Return to grid
                            </button>
                            <button
                                className="grid-button rs-border rs-background"
                                onClick={snapGridToCamera}
                            >
                                Snap grid to camera
                            </button>
                        </div>
                    </>
                )}

                <RendererCanvas renderer={renderer} />
            </div>
        </div>
    );
}
