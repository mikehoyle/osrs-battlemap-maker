import { Link } from "react-router-dom";

import "./GuideContent.css";

export function GuidesOverview() {
    return (
        <article className="guide-article">
            <h1 className="guide-title">Welcome to the Guides</h1>
            <p className="guide-intro">
                This section contains tutorials and reference material for using the OSRS
                Tabletop Tools. Whether you're creating battlemaps, generating tokens, or
                importing your creations into a virtual tabletop platform, you'll find
                step-by-step instructions here.
            </p>

            <section className="guide-section">
                <h2>Getting Started</h2>
                <p>
                    New to the tools? Here's what you can do:
                </p>
                <ul>
                    <li>
                        <Link to="/map"><strong>Battlemap Maker</strong></Link> - Explore the
                        world of Old School RuneScape and export high-quality battle maps for
                        your tabletop sessions. Navigate to any location, adjust the grid
                        overlay, and capture the perfect scene.
                    </li>
                    <li>
                        <Link to="/token-maker"><strong>Token Maker</strong></Link> - Create
                        character and NPC tokens directly from OSRS models. Choose from
                        hundreds of NPCs, adjust lighting, and export transparent PNG tokens
                        ready for use.
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
                                Learn how to import your exported battlemaps and tokens into
                                Roll20 for use in your campaigns.
                            </p>
                        </div>
                    </Link>
                    <Link to="/guides/importing-into-foundry" className="guide-card-link">
                        <div className="guide-card">
                            <h3>Importing Into Foundry VTT</h3>
                            <p>
                                Learn how to create Scenes and Actors in Foundry Virtual
                                Tabletop using your exported assets.
                            </p>
                        </div>
                    </Link>
                </div>
            </section>

            <section className="guide-section">
                <h2>Tips for Best Results</h2>
                <ul>
                    <li>
                        Use orthographic camera mode in the{" "}
                        <Link to="/map">Battlemap Maker</Link> for a classic top-down tabletop
                        view.
                    </li>
                    <li>
                        Enable the grid overlay to ensure your exports align with virtual
                        tabletop grid systems.
                    </li>
                    <li>
                        Export at higher resolutions for large maps to maintain quality when
                        zooming in.
                    </li>
                    <li>
                        <Link to="/token-maker">Token Maker</Link> exports include
                        transparency, so tokens will blend seamlessly onto your maps.
                    </li>
                </ul>
            </section>
        </article>
    );
}
