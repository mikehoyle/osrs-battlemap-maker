import { memo } from "react";

import "./SidebarControls.css";

interface SidebarSelectOption {
    label: string;
    value: string;
}

interface SidebarSelectProps {
    label: string;
    value: string;
    options: SidebarSelectOption[];
    onChange: (value: string) => void;
}

export const SidebarSelect = memo(function SidebarSelect({
    label,
    value,
    options,
    onChange,
}: SidebarSelectProps): JSX.Element {
    return (
        <div className="sidebar-select-container">
            <span className="sidebar-select-label">{label}</span>
            <select
                className="sidebar-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
});
