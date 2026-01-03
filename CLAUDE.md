# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OSRS Battle Map Maker - A 3D web-based RuneScape map visualization tool forked from dennisdev/rs-map-viewer. Used for creating battle maps from Old School RuneScape terrain data.

## Development Commands

```bash
npm run start              # Dev server on localhost:3000
npm run build              # Production build
npm run test               # Run Jest tests
npm run lint               # Format all files with Prettier
npm run download-caches    # Download OSRS cache files (required before first run)
```

## Architecture

### Core Rendering Pipeline

**Renderer Hierarchy:**
```
Renderer (abstract base, manages RAF loop)
  └─> MapViewerRenderer (adds input handling, map management)
       └─> WebGLMapViewerRenderer (PicoGL/WebGL2 implementation)
       └─> WebGPUMapViewerRenderer (experimental)
```

**Main Components:**
- `MapViewerApp.tsx` - Top-level component, cache loading initialization
- `MapViewerContainer.tsx` - Container with UI state management
- `MapViewer.ts` - Central state container holding all loaders and settings
- `MapManager.ts` - Spatial LOD system managing 64x64 tile map squares with frustum culling
- `Camera.ts` - 3D camera with orthographic/perspective projection and frustum

**Data Flow:**
1. App loads cache files → initializes worker pool
2. Camera frustum determines visible map squares
3. Worker pool async loads map data for visible squares
4. WebGL renders terrain/objects via shaders → post-processing (FXAA) → 2D grid overlay

### Key Directories

```
src/
├── mapviewer/           # Main application logic
│   ├── webgl/           # WebGL2 renderer, shaders, loaders
│   │   ├── shaders/     # GLSL shaders (main.vert/frag, fxaa, npc)
│   │   └── loader/      # SdMapDataLoader - map square loading
│   └── worker/          # Web worker pool for async data loading
├── rs/                  # RuneScape data structures (from decompiled client)
│   ├── cache/           # Cache file system (CacheSystem, Archive, loaders)
│   ├── scene/           # Scene representation (tiles, locs, walls)
│   ├── config/          # Type loaders (ObjType, NpcType, LocType, etc.)
│   └── model/           # 3D models and skeletal animation
├── components/
│   └── renderer/        # GridRenderer2D for overlay, RendererCanvas wrapper
└── util/                # General utilities
```

### Graphics

- **PicoGL** wraps WebGL2 for rendering
- **Shader loading** via ts-shader-loader (Craco configured)
- **Texture arrays** support up to 2048 textures
- **Multi-draw indexed** batches geometry into single draw calls
- **Compression** uses WASM-based bzip2/gzip for cache decompression

### Worker Threads

Heavy operations (map loading, data parsing) run in a worker pool (`RenderDataWorkerPool.ts`) to prevent UI blocking. The `threads` library handles worker communication.

## Build Configuration

- **Craco** overrides Create React App webpack config
- Custom loaders: GLSL shaders (`ts-shader-loader`), threads plugin
- CORP headers enabled for SharedArrayBuffer support
- Prettier with import sorting on pre-commit via Husky
