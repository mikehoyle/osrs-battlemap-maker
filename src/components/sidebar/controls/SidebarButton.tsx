import { memo } from "react";

import "./SidebarControls.css";

interface SidebarButtonProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    iconClass?: string;
}

export const SidebarButton = memo(function SidebarButton({
    label,
    onClick,
    disabled = false,
    iconClass,
}: SidebarButtonProps): JSX.Element {
    return (
        <button
            className="sidebar-button rs-border rs-background"
            onClick={onClick}
            disabled={disabled}
        >
            {iconClass && <div className={`sidebar-button-icon ${iconClass}`} />}
            {label}
        </button>
    );
});
