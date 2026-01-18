import { memo } from "react";

import { SidebarSection } from "../SidebarSection";
import { SidebarButton } from "../controls/SidebarButton";

interface NavigationSectionProps {
    onBackClick: () => void;
    onWorldMapClick: () => void;
    onPlacesOfInterestClick: () => void;
}

export const NavigationSection = memo(function NavigationSection({
    onBackClick,
    onWorldMapClick,
    onPlacesOfInterestClick,
}: NavigationSectionProps): JSX.Element {
    return (
        <SidebarSection title="Navigation">
            <SidebarButton label="Back" onClick={onBackClick} />
            <SidebarButton label="World Map" onClick={onWorldMapClick} />
            <SidebarButton label="Places of Interest" onClick={onPlacesOfInterestClick} />
        </SidebarSection>
    );
});
