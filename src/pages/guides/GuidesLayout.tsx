import { NavLink, Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import { useState } from "react";

import "./GuidesLayout.css";

interface GuideNavItem {
    path: string;
    title: string;
}

const guides: GuideNavItem[] = [
    { path: "/guides/importing-into-roll20", title: "Importing Into Roll20" },
    { path: "/guides/importing-into-foundry", title: "Importing Into Foundry VTT" },
];

export function GuidesLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="guides-page">
            <header className="guides-header">
                <Link to="/" className="guides-back-link">
                    Home
                </Link>
                <h1 className="guides-header-title">Guides</h1>
                <button
                    className="guides-menu-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    aria-label="Toggle navigation"
                >
                    <span className="guides-menu-icon" />
                </button>
            </header>
            <div className="guides-body">
                <aside className={`guides-sidebar ${sidebarOpen ? "open" : ""}`}>
                    <nav className="guides-nav">
                        <NavLink
                            to="/guides"
                            end
                            className={({ isActive }) =>
                                `guides-nav-link ${isActive ? "active" : ""}`
                            }
                            onClick={() => setSidebarOpen(false)}
                        >
                            Overview
                        </NavLink>
                        <div className="guides-nav-section">
                            <span className="guides-nav-section-title">Tutorials</span>
                            {guides.map((guide) => (
                                <NavLink
                                    key={guide.path}
                                    to={guide.path}
                                    className={({ isActive }) =>
                                        `guides-nav-link ${isActive ? "active" : ""}`
                                    }
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    {guide.title}
                                </NavLink>
                            ))}
                        </div>
                    </nav>
                </aside>
                <main className="guides-content">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen && (
                <div
                    className="guides-sidebar-backdrop"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
