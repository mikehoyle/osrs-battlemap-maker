import { memo, useCallback, useState } from "react";

import { ExportResolution, MapViewer } from "../../../mapviewer/MapViewer";
import { MapViewerRenderer } from "../../../mapviewer/MapViewerRenderer";
import { downloadBlob } from "../../../util/DownloadUtil";
import { SidebarSection } from "../SidebarSection";
import { SidebarButton } from "../controls/SidebarButton";
import { SidebarSelect } from "../controls/SidebarSelect";

interface ExportSectionProps {
    mapViewer: MapViewer;
    renderer: MapViewerRenderer;
}

const RESOLUTION_OPTIONS = [
    { label: "64px / cell", value: "64" },
    { label: "128px / cell", value: "128" },
    { label: "256px / cell", value: "256" },
];

export const ExportSection = memo(function ExportSection({
    mapViewer,
    renderer,
}: ExportSectionProps): JSX.Element {
    const [resolution, setResolution] = useState<ExportResolution>(128);
    const [isExporting, setIsExporting] = useState(false);

    const handleResolutionChange = useCallback((value: string) => {
        setResolution(Number(value) as ExportResolution);
    }, []);

    const handleExport = useCallback(() => {
        if (isExporting) {
            return;
        }

        setIsExporting(true);
        mapViewer
            .exportBattlemap(resolution)
            .then((blob) => {
                if (!blob) {
                    console.error("No blob returned");
                    return;
                }

                const settings = renderer.gridRenderer.getSettings();
                const filename = `osrs_battlemap_${settings.widthInCells}x${settings.heightInCells}.png`;
                downloadBlob(blob, filename);
            })
            .finally(() => {
                setIsExporting(false);
            });
    }, [mapViewer, renderer, resolution, isExporting]);

    return (
        <SidebarSection title="Export" defaultCollapsed={true}>
            <SidebarSelect
                label="Resolution"
                value={resolution.toString()}
                options={RESOLUTION_OPTIONS}
                onChange={handleResolutionChange}
            />
            <SidebarButton
                label={isExporting ? "Exporting..." : "Export Map"}
                onClick={handleExport}
                disabled={isExporting}
            />
        </SidebarSection>
    );
});
