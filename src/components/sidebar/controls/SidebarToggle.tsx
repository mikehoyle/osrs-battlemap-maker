import { memo } from "react";

import "./SidebarControls.css";

interface SidebarToggleProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export const SidebarToggle = memo(function SidebarToggle({
    label,
    checked,
    onChange,
}: SidebarToggleProps): JSX.Element {
    return (
        <div className="sidebar-toggle-container" onClick={() => onChange(!checked)}>
            <span className="sidebar-toggle-label">{label}</span>
            <div className={`sidebar-toggle ${checked ? "checked" : ""}`}>
                <div className="sidebar-toggle-thumb" />
            </div>
        </div>
    );
});
