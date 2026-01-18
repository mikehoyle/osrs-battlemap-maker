import { memo, useState } from "react";

import "./SidebarSection.css";

interface SidebarSectionProps {
    title: string;
    defaultCollapsed?: boolean;
    children: React.ReactNode;
}

export const SidebarSection = memo(function SidebarSection({
    title,
    defaultCollapsed = false,
    children,
}: SidebarSectionProps): JSX.Element {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    return (
        <div className="sidebar-section">
            <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
                <span className="sidebar-section-title">{title}</span>
                <span className={`sidebar-section-toggle ${collapsed ? "collapsed" : ""}`}>
                    &#9660;
                </span>
            </div>
            <div className={`sidebar-section-content ${collapsed ? "collapsed" : ""}`}>
                {children}
            </div>
        </div>
    );
});

interface SidebarSubsectionProps {
    title: string;
    children: React.ReactNode;
}

export const SidebarSubsection = memo(function SidebarSubsection({
    title,
    children,
}: SidebarSubsectionProps): JSX.Element {
    return (
        <div className="sidebar-subsection">
            <div className="sidebar-subsection-title">{title}</div>
            {children}
        </div>
    );
});
