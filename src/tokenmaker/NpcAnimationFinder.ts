import { NpcType } from "../rs/config/npctype/NpcType";
import { SeqType } from "../rs/config/seqtype/SeqType";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../rs/model/skeletal/SkeletalSeqLoader";
import { getAnimationName } from "./AnimationNames";

/**
 * Serialized format for storing animation mapping in localStorage.
 */
export type SerializedAnimationMapping = {
    // Array of [seqId, baseIds[]] pairs
    seqToBaseIds: [number, number[]][];
    // Array of [baseId, seqIds[]] pairs
    baseIdToSeqs: [number, number[]][];
};

/**
 * Finds all compatible animations for an NPC based on skeleton/base compatibility.
 *
 * The logic follows the OSRS client's approach:
 * 1. Each animation references a SeqBase (skeleton) via frame data or skeletal data
 * 2. An NPC's reference animations (idle, walk, etc.) define which skeletons the NPC uses
 * 3. Any animation sharing the same skeleton as a reference animation is compatible
 */
export class NpcAnimationFinder {
    // Map of animation ID -> Set of base/skeleton IDs it uses
    private seqToBaseIds: Map<number, Set<number>> = new Map();

    // Reverse map: base/skeleton ID -> Set of animation IDs that use it
    private baseIdToSeqs: Map<number, Set<number>> = new Map();

    // Track if we've built the mappings
    private isBuilt: boolean = false;

    // Progress tracking for UI
    private buildProgress: number = 0;
    private buildTotal: number = 0;

    constructor(
        private seqTypeLoader: SeqTypeLoader,
        private seqFrameLoader: SeqFrameLoader,
        private skeletalSeqLoader: SkeletalSeqLoader | undefined,
    ) {}

    /**
     * Load mapping from previously serialized data.
     * This allows fast initialization from localStorage cache.
     */
    loadFromSerialized(data: SerializedAnimationMapping): void {
        this.seqToBaseIds.clear();
        this.baseIdToSeqs.clear();

        for (const [seqId, baseIds] of data.seqToBaseIds) {
            this.seqToBaseIds.set(seqId, new Set(baseIds));
        }

        for (const [baseId, seqIds] of data.baseIdToSeqs) {
            this.baseIdToSeqs.set(baseId, new Set(seqIds));
        }

        this.isBuilt = true;
    }

    /**
     * Serialize the mapping data for storage in localStorage.
     */
    serialize(): SerializedAnimationMapping {
        const seqToBaseIds: [number, number[]][] = [];
        for (const [seqId, baseIds] of this.seqToBaseIds) {
            seqToBaseIds.push([seqId, Array.from(baseIds)]);
        }

        const baseIdToSeqs: [number, number[]][] = [];
        for (const [baseId, seqIds] of this.baseIdToSeqs) {
            baseIdToSeqs.push([baseId, Array.from(seqIds)]);
        }

        return { seqToBaseIds, baseIdToSeqs };
    }

    /**
     * Get the current build progress (0-1)
     */
    getProgress(): number {
        if (this.buildTotal === 0) return 0;
        return this.buildProgress / this.buildTotal;
    }

    /**
     * Check if the mapping has been built
     */
    isMappingBuilt(): boolean {
        return this.isBuilt;
    }

    /**
     * Build the animation-to-skeleton mapping for all animations.
     * This is a potentially slow operation that should be done once.
     *
     * @param progressCallback Optional callback for progress updates (0-1)
     */
    async buildMapping(progressCallback?: (progress: number) => void): Promise<void> {
        if (this.isBuilt) {
            return;
        }

        this.seqToBaseIds.clear();
        this.baseIdToSeqs.clear();

        const count = this.seqTypeLoader.getCount();
        this.buildTotal = count;
        this.buildProgress = 0;

        // Process in batches to avoid blocking the UI
        const batchSize = 100;

        for (let i = 0; i < count; i += batchSize) {
            const end = Math.min(i + batchSize, count);

            for (let seqId = i; seqId < end; seqId++) {
                try {
                    const baseIds = this.getBaseIdsForSeq(seqId);
                    if (baseIds.size > 0) {
                        this.seqToBaseIds.set(seqId, baseIds);

                        // Build reverse mapping
                        for (const baseId of baseIds) {
                            let seqs = this.baseIdToSeqs.get(baseId);
                            if (!seqs) {
                                seqs = new Set();
                                this.baseIdToSeqs.set(baseId, seqs);
                            }
                            seqs.add(seqId);
                        }
                    }
                } catch (e) {
                    // Skip animations that fail to load
                }

                this.buildProgress = seqId + 1;
            }

            // Yield to allow UI updates
            if (progressCallback) {
                progressCallback(this.buildProgress / this.buildTotal);
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }

        this.isBuilt = true;
        if (progressCallback) {
            progressCallback(1);
        }
    }

    /**
     * Extract the base/skeleton IDs for a given animation.
     *
     * For frame-based animations: The baseId comes from the SeqFrame's SeqBase
     * For skeletal animations: The baseId comes from the SkeletalSeq's SeqBase
     */
    private getBaseIdsForSeq(seqId: number): Set<number> {
        const baseIds = new Set<number>();

        const seqType = this.seqTypeLoader.load(seqId);
        if (!seqType) {
            return baseIds;
        }

        if (seqType.isSkeletalSeq()) {
            // Skeletal animation - load the skeletal seq to get its base ID
            if (this.skeletalSeqLoader) {
                try {
                    const skeletalSeq = this.skeletalSeqLoader.load(seqType.skeletalId);
                    if (skeletalSeq && skeletalSeq.base) {
                        baseIds.add(skeletalSeq.base.id);
                    }
                } catch (e) {
                    // Ignore loading errors
                }
            }
        } else if (seqType.frameIds && seqType.frameIds.length > 0) {
            // Frame-based animation - extract base ID from the first frame
            // The frame ID is packed as (archiveId << 16) | frameId
            // All frames in an archive share the same SeqBase
            const firstFrameId = seqType.frameIds[0];
            try {
                const frame = this.seqFrameLoader.load(firstFrameId);
                if (frame && frame.base) {
                    baseIds.add(frame.base.id);
                }
            } catch (e) {
                // Ignore loading errors
            }
        }

        return baseIds;
    }

    /**
     * Get the reference animation IDs for an NPC.
     * These are the animations defined in the NPC's configuration.
     */
    private getReferenceAnimationIds(npcType: NpcType): number[] {
        const animIds: number[] = [];

        const addIfValid = (id: number) => {
            if (id !== -1 && !animIds.includes(id)) {
                animIds.push(id);
            }
        };

        // Core animations
        addIfValid(npcType.idleSeqId);
        addIfValid(npcType.walkSeqId);
        addIfValid(npcType.walkBackSeqId);
        addIfValid(npcType.walkLeftSeqId);
        addIfValid(npcType.walkRightSeqId);

        // Turn animations
        addIfValid(npcType.turnLeftSeqId);
        addIfValid(npcType.turnRightSeqId);

        // Run animations
        addIfValid(npcType.runSeqId);
        addIfValid(npcType.runBackSeqId);
        addIfValid(npcType.runLeftSeqId);
        addIfValid(npcType.runRightSeqId);

        // Crawl animations
        addIfValid(npcType.crawlSeqId);
        addIfValid(npcType.crawlBackSeqId);
        addIfValid(npcType.crawlLeftSeqId);
        addIfValid(npcType.crawlRightSeqId);

        return animIds;
    }

    /**
     * Get all base/skeleton IDs used by an NPC's reference animations.
     */
    private getNpcBaseIds(npcType: NpcType): Set<number> {
        const baseIds = new Set<number>();

        const refAnimIds = this.getReferenceAnimationIds(npcType);
        for (const animId of refAnimIds) {
            const animBaseIds = this.seqToBaseIds.get(animId);
            if (animBaseIds) {
                for (const baseId of animBaseIds) {
                    baseIds.add(baseId);
                }
            }
        }

        return baseIds;
    }

    /**
     * Find all animations compatible with the given NPC.
     *
     * An animation is compatible if it shares any skeleton/base with
     * the NPC's reference animations.
     *
     * @param npcType The NPC to find animations for
     * @returns Array of compatible animation IDs sorted by ID
     */
    findCompatibleAnimations(npcType: NpcType): number[] {
        if (!this.isBuilt) {
            // If mapping isn't built, return just the reference animations
            return this.getReferenceAnimationIds(npcType);
        }

        const npcBaseIds = this.getNpcBaseIds(npcType);
        if (npcBaseIds.size === 0) {
            return this.getReferenceAnimationIds(npcType);
        }

        const compatibleSeqs = new Set<number>();

        // Find all animations that share any base with this NPC
        for (const baseId of npcBaseIds) {
            const seqs = this.baseIdToSeqs.get(baseId);
            if (seqs) {
                for (const seqId of seqs) {
                    compatibleSeqs.add(seqId);
                }
            }
        }

        return Array.from(compatibleSeqs).sort((a, b) => a - b);
    }

    /**
     * Get information about an animation for display purposes.
     */
    getAnimationInfo(
        seqId: number,
    ): { id: number; name: string; frameCount: number; isSkeletal: boolean } | undefined {
        const seqType = this.seqTypeLoader.load(seqId);
        if (!seqType) {
            return undefined;
        }

        const isSkeletal = seqType.isSkeletalSeq();
        let frameCount: number;

        if (isSkeletal) {
            frameCount = Math.floor(seqType.skeletalEnd - seqType.skeletalStart);
            if (frameCount === 0 && this.skeletalSeqLoader) {
                const skeletalSeq = this.skeletalSeqLoader.load(seqType.skeletalId);
                if (skeletalSeq) {
                    frameCount = skeletalSeq.getDuration();
                }
            }
        } else {
            frameCount = seqType.frameIds?.length ?? 0;
        }

        // Generate name from known names, cache data, or fallback
        const name = this.getAnimationDisplayName(seqId, seqType);

        return { id: seqId, name, frameCount, isSkeletal };
    }

    /**
     * Get a descriptive name for an animation.
     * Priority: known names map > cache name > animation ID fallback.
     */
    private getAnimationDisplayName(seqId: number, seqType: SeqType): string {
        // First check the known animation names map
        const knownName = getAnimationName(seqId);
        if (knownName) {
            return knownName;
        }

        // Fall back to cache name if available
        if (seqType.name && seqType.name.length > 0) {
            return seqType.name;
        }

        return `Animation ${seqId}`;
    }

    /**
     * Get statistics about the built mapping.
     */
    getStats(): { totalAnimations: number; totalBases: number; averageAnimsPerBase: number } {
        const totalAnimations = this.seqToBaseIds.size;
        const totalBases = this.baseIdToSeqs.size;
        let totalAnimsPerBase = 0;
        for (const seqs of this.baseIdToSeqs.values()) {
            totalAnimsPerBase += seqs.size;
        }
        const averageAnimsPerBase = totalBases > 0 ? totalAnimsPerBase / totalBases : 0;

        return { totalAnimations, totalBases, averageAnimsPerBase };
    }
}
