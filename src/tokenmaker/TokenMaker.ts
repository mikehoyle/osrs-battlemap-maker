import { CacheSystem } from "../rs/cache/CacheSystem";
import { CacheLoaderFactory, getCacheLoaderFactory } from "../rs/cache/loader/CacheLoaderFactory";
import { NpcType } from "../rs/config/npctype/NpcType";
import { NpcTypeLoader } from "../rs/config/npctype/NpcTypeLoader";
import { NpcModelLoader } from "../rs/config/npctype/NpcModelLoader";
import { SeqTypeLoader } from "../rs/config/seqtype/SeqTypeLoader";
import { SeqType } from "../rs/config/seqtype/SeqType";
import { VarManager } from "../rs/config/vartype/VarManager";
import { ModelLoader } from "../rs/model/ModelLoader";
import { SeqFrameLoader } from "../rs/model/seq/SeqFrameLoader";
import { SkeletalSeqLoader } from "../rs/model/skeletal/SkeletalSeqLoader";
import { TextureLoader } from "../rs/texture/TextureLoader";
import { CacheList, LoadedCache } from "../mapviewer/Caches";
import { Model } from "../rs/model/Model";

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
    borderColor: string = "#ff981f";
    borderWidth: number = 4;

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
                    const frameCount = seqType.isSkeletalSeq()
                        ? Math.floor(seqType.skeletalEnd - seqType.skeletalStart)
                        : seqType.frameIds?.length ?? 0;
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
            return Math.floor(seqType.skeletalEnd - seqType.skeletalStart);
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

    setBorderColor(color: string): void {
        this.borderColor = color;
        this.onStateChange?.();
    }

    setBorderWidth(width: number): void {
        this.borderWidth = Math.max(1, Math.min(width, 16));
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
