import { useCallback, useMemo, useState } from "react";
import { NpcOption } from "../TokenMaker";
import "./NpcPicker.css";

interface NpcPickerProps {
    npcList: NpcOption[];
    selectedNpcId: number | null;
    onSelect: (npcId: number | null) => void;
}

const MAX_VISIBLE_ITEMS = 200;

export function NpcPicker({ npcList, selectedNpcId, onSelect }: NpcPickerProps): JSX.Element {
    const [searchText, setSearchText] = useState("");

    const filteredNpcs = useMemo(() => {
        if (!searchText.trim()) {
            return npcList.slice(0, MAX_VISIBLE_ITEMS);
        }
        const search = searchText.toLowerCase();
        return npcList
            .filter(
                (npc) =>
                    npc.name.toLowerCase().includes(search) || npc.id.toString().includes(search),
            )
            .slice(0, MAX_VISIBLE_ITEMS);
    }, [npcList, searchText]);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchText(e.target.value);
    }, []);

    const handleNpcClick = useCallback(
        (npcId: number) => {
            onSelect(npcId);
        },
        [onSelect],
    );

    const selectedNpc = useMemo(() => {
        return npcList.find((npc) => npc.id === selectedNpcId);
    }, [npcList, selectedNpcId]);

    return (
        <div className="control-panel rs-border rs-background npc-picker">
            <h3 className="control-panel-title">Select NPC</h3>

            <div className="control-row">
                <input
                    type="text"
                    className="control-input npc-search"
                    placeholder="Search NPCs by name or ID..."
                    value={searchText}
                    onChange={handleSearchChange}
                />
            </div>

            {selectedNpc && (
                <div className="selected-npc">
                    <span className="selected-npc-name">{selectedNpc.name}</span>
                    <span className="selected-npc-id">ID: {selectedNpc.id}</span>
                    {selectedNpc.combatLevel > 0 && (
                        <span className="selected-npc-combat">Lvl {selectedNpc.combatLevel}</span>
                    )}
                </div>
            )}

            <div className="npc-list">
                {filteredNpcs.map((npc) => (
                    <div
                        key={npc.id}
                        className={`npc-item ${npc.id === selectedNpcId ? "selected" : ""}`}
                        onClick={() => handleNpcClick(npc.id)}
                    >
                        <span className="npc-name">{npc.name}</span>
                        <span className="npc-id">#{npc.id}</span>
                        {npc.combatLevel > 0 && (
                            <span className="npc-combat">Lvl {npc.combatLevel}</span>
                        )}
                    </div>
                ))}
                {filteredNpcs.length === MAX_VISIBLE_ITEMS && (
                    <div className="npc-item-info">
                        Showing first {MAX_VISIBLE_ITEMS} results. Use search to find more.
                    </div>
                )}
                {filteredNpcs.length === 0 && (
                    <div className="npc-item-info">No NPCs found matching "{searchText}"</div>
                )}
            </div>
        </div>
    );
}
