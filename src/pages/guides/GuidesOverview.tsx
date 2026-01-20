import { Link } from "react-router-dom";

import "./GuideContent.css";

export function GuidesOverview() {
    return (
        <article className="guide-article">
            <h1 className="guide-title">Guides</h1>
            <p className="guide-intro">
                How to use OSRS Tabletop Tools and integrate the results in your VTT of choice.
            </p>

            <section className="guide-section">
                <h2>Getting Started</h2>
                <p>New to the tools? Here's what you can do:</p>
                <ul>
                    <li>
                        <Link to="/map">
                            <strong>Battlemap Maker</strong>
                        </Link>{" "}
                        - Explore the map of Old School RuneScape and export high-quality battle
                        maps for your tabletop sessions. This operates on the principle that OSRS is
                        a grid-based game in much the same way as D&D and other tabletop games,
                        making many areas of the map translate well across systems.
                    </li>
                    <li>
                        <Link to="/token-maker">
                            <strong>Token Maker</strong>
                        </Link>{" "}
                        - Create character and NPC tokens directly from OSRS models. Choose from
                        hundreds of NPCs, adjust pose and lighting, and export transparent PNG
                        tokens ready for use.
                    </li>
                </ul>
            </section>

            <section className="guide-section">
                <h2>Available Guides</h2>
                <div className="guide-card-list">
                    <Link to="/guides/importing-into-roll20" className="guide-card-link">
                        <div className="guide-card">
                            <h3>Importing Into Roll20</h3>
                            <p>
                                Learn how to import your exported battlemaps and tokens into Roll20
                                for use in your campaigns.
                            </p>
                        </div>
                    </Link>
                    <Link to="/guides/importing-into-foundry" className="guide-card-link">
                        <div className="guide-card">
                            <h3>Importing Into Foundry VTT</h3>
                            <p>
                                Learn how to create Scenes and Actors in Foundry Virtual Tabletop
                                using your exported assets.
                            </p>
                        </div>
                    </Link>
                </div>
            </section>
        </article>
    );
}
