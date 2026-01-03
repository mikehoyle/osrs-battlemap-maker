import { CacheList, LoadedCache } from "../mapviewer/Caches";
import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { NpcModelLoader } from "../rs/config/npctype/NpcModelLoader";
import { NpcType } from "../rs/config/npctype/NpcType";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { SeqType } from "../rs/config/seqtype/SeqType";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { VarManager } from "../rs/config/vartype/VarManager";
import { Model } from "../rs/model/Model";
import { ModelLoader } from "../rs/model/ModelLoader";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../rs/model/skeletal/SkeletalSeqLoader";
import { TextureLoader } from "../rs/texture/TextureLoader";

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
    varManager!: VarManager;

    // NPC list
    npcList: NpcOption[] = [];

    // Selection state
    selectedNpcId: number | null = null;
    selectedSeqId: number | null = null;
    currentFrame: number = 0;
    isPlaying: boolean = false;

    // Export settings
    exportResolution: ExportResolution = 128;
    hdEnabled: boolean = false;

    // Renderer settings
    brightness: number = 1; // 0-4 scale (higher = darker)
    textureFilterMode: TextureFilterMode = TextureFilterMode.ANISOTROPIC_16X;
    smoothModel: boolean = false;

    // Shadow settings
    shadowEnabled: boolean = true;
    shadowOpacity: number = 0.5; // 0.2 - 0.8 range

    // Event callbacks
    onStateChange?: () => void;

    constructor(
        readonly cacheList: CacheList,
        readonly loadedCache: LoadedCache,
    ) {}

    async init(): Promise<void> {
        this.cacheSystem = CacheSystem.fromFiles(this.loadedCache.type, this.loadedCache.files);
        this.loaderFactory = getCacheLoaderFactory(this.loadedCache.info, this.cacheSystem);

        this.textureLoader = this.loaderFactory.getTextureLoader();
        this.modelLoader = this.loaderFactory.getModelLoader();
        this.seqTypeLoader = this.loaderFactory.getSeqTypeLoader();
        this.seqFrameLoader = this.loaderFactory.getSeqFrameLoader();
        this.skeletalSeqLoader = this.loaderFactory.getSkeletalSeqLoader();
        this.npcTypeLoader = this.loaderFactory.getNpcTypeLoader();

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

        this.buildNpcList();
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

    getAvailableAnimations(): AnimationOption[] {
        const npcType = this.getSelectedNpcType();
        if (!npcType) {
            return [];
        }

        const animations: AnimationOption[] = [];
        const addAnim = (id: number, name: string) => {
            if (id !== -1) {
                const seqType = this.seqTypeLoader.load(id);
                if (seqType) {
                    let frameCount: number;
                    if (seqType.isSkeletalSeq()) {
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
                    animations.push({ id, name, frameCount });
                }
            }
        };

        addAnim(npcType.idleSeqId, "Idle");
        addAnim(npcType.walkSeqId, "Walk");
        addAnim(npcType.walkBackSeqId, "Walk Back");
        addAnim(npcType.walkLeftSeqId, "Walk Left");
        addAnim(npcType.walkRightSeqId, "Walk Right");
        addAnim(npcType.runSeqId, "Run");
        addAnim(npcType.crawlSeqId, "Crawl");
        addAnim(npcType.crawlBackSeqId, "Crawl Back");
        addAnim(npcType.crawlLeftSeqId, "Crawl Left");
        addAnim(npcType.crawlRightSeqId, "Crawl Right");

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
}
