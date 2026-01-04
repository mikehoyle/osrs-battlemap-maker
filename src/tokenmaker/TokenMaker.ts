import { CacheList, LoadedCache } from "../mapviewer/Caches";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { NpcModelLoader } from "../rs/config/npctype/NpcModelLoader";
import { NpcType } from "../rs/config/npctype/NpcType";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { ObjTypeLoader } from "../rs/config/objtype/ObjTypeLoader";
import { SeqType } from "../rs/config/seqtype/SeqType";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../rs/config/vartype/VarManager";
import { Model } from "../rs/model/Model";
import { ModelLoader } from "../rs/model/ModelLoader";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../rs/model/skeletal/SkeletalSeqLoader";
import { TextureLoader } from "../rs/texture/TextureLoader";
import { NpcAnimationFinder, SerializedAnimationMapping } from "./NpcAnimationFinder";

const ANIMATION_MAPPING_STORAGE_KEY_PREFIX = "npc-animation-mapping-";

export type NpcOption = {
    id: number;
    name: string;
    combatLevel: number;
};

export type AnimationOption = {
    id: number;
    name: string;
    frameCount: number;
};

export type ExportResolution = 64 | 128 | 256;

export enum TextureFilterMode {
    DISABLED,
    BILINEAR,
    TRILINEAR,
    ANISOTROPIC_2X,
    ANISOTROPIC_4X,
    ANISOTROPIC_8X,
    ANISOTROPIC_16X,
}

export function getMaxAnisotropy(mode: TextureFilterMode): number {
    switch (mode) {
        case TextureFilterMode.ANISOTROPIC_2X:
            return 2;
        case TextureFilterMode.ANISOTROPIC_4X:
            return 4;
        case TextureFilterMode.ANISOTROPIC_8X:
            return 8;
        case TextureFilterMode.ANISOTROPIC_16X:
            return 16;
        default:
            return 1;
    }
}

export class TokenMaker {
    // Cache
    cacheSystem!: CacheSystem;
    loaderFactory!: CacheLoaderFactory;

    // Loaders
    textureLoader!: TextureLoader;
    modelLoader!: ModelLoader;
    seqTypeLoader!: SeqTypeLoader;
    seqFrameLoader!: SeqFrameLoader;
    skeletalSeqLoader!: SkeletalSeqLoader | undefined;
    npcTypeLoader!: NpcTypeLoader;
    npcModelLoader!: NpcModelLoader;
    objTypeLoader!: ObjTypeLoader;
    varManager!: VarManager;
    animationFinder!: NpcAnimationFinder;

    // NPC list
    npcList: NpcOption[] = [];

    // Selection state
    selectedNpcId: number | null = null;
    selectedSeqId: number | null = null;
    currentFrame: number = 0;
    isPlaying: boolean = false;

    // Export settings
    exportResolution: ExportResolution = 128;
    hdEnabled: boolean = true;

    // Renderer settings
    brightness: number = 1; // 0-4 scale (higher = darker)
    textureFilterMode: TextureFilterMode = TextureFilterMode.ANISOTROPIC_16X;
    smoothModel: boolean = true;

    // Shadow settings
    shadowEnabled: boolean = true;
    shadowOpacity: number = 0.5; // 0.2 - 0.8 range

    // Light position (unit circle, center = overhead)
    lightX: number = 0.15; // -1 = left, 1 = right
    lightZ: number = -0.1; // -1 = bottom of screen, 1 = top of screen

    // Model position offset (normalized -0.5 to 0.5, where 0.5 = half preview width)
    modelOffsetX: number = 0; // horizontal offset, positive = right
    modelOffsetY: number = 0; // vertical offset, positive = up

    // Model rotation (0, 90, 180, 270 degrees)
    modelRotation: number = 0;

    // Event callbacks
    onStateChange?: () => void;

    constructor(
        readonly cacheList: CacheList,
        readonly loadedCache: LoadedCache,
    ) {}

    /**
     * Get the localStorage key for storing animation mapping for the current cache.
     */
    private getAnimationMappingStorageKey(): string {
        return ANIMATION_MAPPING_STORAGE_KEY_PREFIX + this.loadedCache.info.name;
    }

    /**
     * Try to load cached animation mapping from localStorage.
     */
    private loadCachedAnimationMapping(): boolean {
        try {
            const key = this.getAnimationMappingStorageKey();
            const cached = localStorage.getItem(key);
            if (cached) {
                const data: SerializedAnimationMapping = JSON.parse(cached);
                this.animationFinder.loadFromSerialized(data);
                return true;
            }
        } catch (e) {
            console.warn("Failed to load cached animation mapping:", e);
        }
        return false;
    }

    /**
     * Save animation mapping to localStorage for future use.
     */
    private saveAnimationMappingToCache(): void {
        try {
            const key = this.getAnimationMappingStorageKey();
            const data = this.animationFinder.serialize();
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn("Failed to save animation mapping to cache:", e);
        }
    }

    /**
     * Initialize the TokenMaker.
     * @param animationProgressCallback Optional callback for animation mapping build progress (0-1).
     *        This is only called if the mapping needs to be built (not cached).
     */
    async init(animationProgressCallback?: (progress: number) => void): Promise<void> {
        this.cacheSystem = CacheSystem.fromFiles(this.loadedCache.type, this.loadedCache.files);
        this.loaderFactory = getCacheLoaderFactory(this.loadedCache.info, this.cacheSystem);

        this.textureLoader = this.loaderFactory.getTextureLoader();
        this.modelLoader = this.loaderFactory.getModelLoader();
        this.seqTypeLoader = this.loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = this.loaderFactory.getSeqFrameLoader();
        this.skeletalSeqLoader = this.loaderFactory.getSkeletalSeqLoader();
        this.npcTypeLoader = this.loaderFactory.getNpcTypeLoader();
        this.objTypeLoader = this.loaderFactory.getObjTypeLoader();

        this.varManager = new VarManager(this.loaderFactory.getVarBitTypeLoader());

        this.npcModelLoader = new NpcModelLoader(
            this.npcTypeLoader,
            this.modelLoader,
            this.textureLoader,
            this.seqTypeLoader,
            this.seqFrameLoader,
            this.skeletalSeqLoader,
            this.varManager,
        );

        this.animationFinder = new NpcAnimationFinder(
            this.seqTypeLoader,
            this.seqFrameLoader,
            this.skeletalSeqLoader,
        );

        this.buildNpcList();

        // Try to load animation mapping from localStorage cache
        const loadedFromCache = this.loadCachedAnimationMapping();

        if (!loadedFromCache) {
            // Build the animation mapping and save to localStorage
            await this.animationFinder.buildMapping(animationProgressCallback);
            this.saveAnimationMappingToCache();
        }
    }

    private stripColorTags(name: string): string {
        // Handle both <col=xxx>text</col> and unclosed <col=xxx>text
        return name.replace(/<col=[^>]*>([^<]*)<\/col>/g, "$1").replace(/<col=[^>]*>/g, "");
    }

    private buildNpcList(): void {
        const count = this.npcTypeLoader.getCount();
        const npcs: NpcOption[] = [];

        for (let id = 0; id < count; id++) {
            const npc = this.npcTypeLoader.load(id);
            if (npc && npc.name && npc.name !== "null" && npc.modelIds && npc.modelIds.length > 0) {
                // Skip unknown/placeholder names
                if (npc.name === "? ? ? ?" || npc.name.includes("? ? ? ?")) {
                    continue;
                }

                const cleanName = this.stripColorTags(npc.name);
                npcs.push({
                    id,
                    name: cleanName,
                    combatLevel: npc.combatLevel,
                });
            }
        }

        this.npcList = npcs.sort((a, b) => a.name.localeCompare(b.name));
    }

    getSelectedNpcType(): NpcType | undefined {
        if (this.selectedNpcId === null) {
            return undefined;
        }
        return this.npcTypeLoader.load(this.selectedNpcId);
    }

    /**
     * Get all available animations for the selected NPC.
     * Returns all skeleton-compatible animations found via the animation finder.
     */
    getAvailableAnimations(): AnimationOption[] {
        const npcType = this.getSelectedNpcType();
        if (!npcType) {
            return [];
        }

        // Get all compatible animations based on skeleton matching
        const compatibleSeqIds = this.animationFinder.findCompatibleAnimations(npcType);

        // Build the reference animation set for labeling
        const referenceLabels = new Map<number, string>();

        const addRef = (id: number, name: string) => {
            if (id !== -1) {
                referenceLabels.set(id, name);
            }
        };

        addRef(npcType.idleSeqId, "Idle");
        addRef(npcType.walkSeqId, "Walk");
        addRef(npcType.walkBackSeqId, "Walk Back");
        addRef(npcType.walkLeftSeqId, "Walk Left");
        addRef(npcType.walkRightSeqId, "Walk Right");
        addRef(npcType.turnLeftSeqId, "Turn Left");
        addRef(npcType.turnRightSeqId, "Turn Right");
        addRef(npcType.runSeqId, "Run");
        addRef(npcType.runBackSeqId, "Run Back");
        addRef(npcType.runLeftSeqId, "Run Left");
        addRef(npcType.runRightSeqId, "Run Right");
        addRef(npcType.crawlSeqId, "Crawl");
        addRef(npcType.crawlBackSeqId, "Crawl Back");
        addRef(npcType.crawlLeftSeqId, "Crawl Left");
        addRef(npcType.crawlRightSeqId, "Crawl Right");

        const animations: AnimationOption[] = [];

        for (const seqId of compatibleSeqIds) {
            const info = this.animationFinder.getAnimationInfo(seqId);
            if (info) {
                // Use reference name if this is a reference animation, otherwise use generated name
                const name = referenceLabels.get(seqId) ?? info.name;
                animations.push({
                    id: seqId,
                    name,
                    frameCount: info.frameCount,
                });
            }
        }

        return animations;
    }

    getSelectedSeqType(): SeqType | undefined {
        if (this.selectedSeqId === null) {
            return undefined;
        }
        return this.seqTypeLoader.load(this.selectedSeqId);
    }

    getCurrentFrameCount(): number {
        const seqType = this.getSelectedSeqType();
        if (!seqType) {
            return 0;
        }
        if (seqType.isSkeletalSeq()) {
            let frameCount = Math.floor(seqType.skeletalEnd - seqType.skeletalStart);
            if (frameCount === 0 && this.skeletalSeqLoader) {
                const skeletalSeq = this.skeletalSeqLoader.load(seqType.skeletalId);
                if (skeletalSeq) {
                    frameCount = skeletalSeq.getDuration();
                }
            }
            return frameCount;
        }
        return seqType.frameIds?.length ?? 0;
    }

    getModel(): Model | undefined {
        const npcType = this.getSelectedNpcType();
        if (!npcType) {
            return undefined;
        }

        const seqId = this.selectedSeqId ?? -1;
        const frame = this.currentFrame;

        return this.npcModelLoader.getModel(npcType, seqId, frame);
    }

    selectNpc(npcId: number | null): void {
        this.selectedNpcId = npcId;
        this.selectedSeqId = null;
        this.currentFrame = 0;
        this.isPlaying = false;

        // Auto-select idle animation if available
        if (npcId !== null) {
            const npcType = this.npcTypeLoader.load(npcId);
            if (npcType && npcType.idleSeqId !== -1) {
                this.selectedSeqId = npcType.idleSeqId;
            }
        }

        this.npcModelLoader.clearCache();
        this.onStateChange?.();
    }

    selectAnimation(seqId: number | null): void {
        this.selectedSeqId = seqId;
        this.currentFrame = 0;
        this.isPlaying = false;
        this.onStateChange?.();
    }

    setFrame(frame: number): void {
        const maxFrame = this.getCurrentFrameCount();
        this.currentFrame = Math.max(0, Math.min(frame, maxFrame - 1));
        this.onStateChange?.();
    }

    setExportResolution(resolution: ExportResolution): void {
        this.exportResolution = resolution;
        this.onStateChange?.();
    }

    setHdEnabled(enabled: boolean): void {
        this.hdEnabled = enabled;
        this.onStateChange?.();
    }

    setBrightness(value: number): void {
        this.brightness = Math.max(0, Math.min(value, 4));
        this.onStateChange?.();
    }

    setTextureFilterMode(mode: TextureFilterMode): void {
        this.textureFilterMode = mode;
        this.onStateChange?.();
    }

    setSmoothModel(enabled: boolean): void {
        this.smoothModel = enabled;
        this.onStateChange?.();
    }

    setShadowEnabled(enabled: boolean): void {
        this.shadowEnabled = enabled;
        this.onStateChange?.();
    }

    setShadowOpacity(opacity: number): void {
        this.shadowOpacity = Math.max(0.2, Math.min(opacity, 0.8));
        this.onStateChange?.();
    }

    togglePlay(): void {
        this.isPlaying = !this.isPlaying;
        this.onStateChange?.();
    }

    advanceFrame(): void {
        const maxFrame = this.getCurrentFrameCount();
        if (maxFrame > 0) {
            this.currentFrame = (this.currentFrame + 1) % maxFrame;
            this.onStateChange?.();
        }
    }

    setLightPosition(x: number, z: number): void {
        // Clamp to unit circle
        const dist = Math.sqrt(x * x + z * z);
        if (dist > 1) {
            this.lightX = x / dist;
            this.lightZ = z / dist;
        } else {
            this.lightX = x;
            this.lightZ = z;
        }
        this.onStateChange?.();
    }

    setModelOffset(x: number, y: number): void {
        // Clamp to -0.5 to 0.5 (half preview width max in each direction)
        this.modelOffsetX = Math.max(-0.5, Math.min(x, 0.5));
        this.modelOffsetY = Math.max(-0.5, Math.min(y, 0.5));
        this.onStateChange?.();
    }

    resetModelOffset(): void {
        this.modelOffsetX = 0;
        this.modelOffsetY = 0;
        this.onStateChange?.();
    }

    isModelOffCenter(): boolean {
        return this.modelOffsetX !== 0 || this.modelOffsetY !== 0;
    }

    rotateLeft(): void {
        this.modelRotation = (this.modelRotation + 90) % 360;
        this.onStateChange?.();
    }

    rotateRight(): void {
        this.modelRotation = (this.modelRotation - 90 + 360) % 360;
        this.onStateChange?.();
    }

    /**
     * Computes the 3D light direction vector from the 2D control position.
     * Returns [x, y, z] where the vector points FROM the scene TO the light source.
     * The dot position represents where the light IS, so we negate to get direction TO light.
     * At center (0,0) = straight overhead (0, 1, 0)
     * At edge = angled light with max ~35° from vertical
     */
    getLightDirection(): [number, number, number] {
        const dist = Math.sqrt(this.lightX * this.lightX + this.lightZ * this.lightZ);

        if (dist < 0.001) {
            // Center: straight overhead
            return [0, 1, 0];
        }

        // Map distance to angle from vertical (0 at center, ~35° at edge)
        const maxAngle = 35 * (Math.PI / 180); // 35 degrees in radians
        const angle = dist * maxAngle;

        const horizontalLength = Math.sin(angle);
        const vertical = Math.cos(angle);

        // Compute horizontal direction (normalized)
        // Dot position represents where the light source IS
        // Light direction points FROM scene TO light, so it matches the dot position
        const dirX = -(this.lightX / dist) * horizontalLength;
        const dirZ = -(this.lightZ / dist) * horizontalLength;

        return [dirX, vertical, dirZ];
    }
}
