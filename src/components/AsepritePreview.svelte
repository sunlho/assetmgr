<script lang="ts">
  import type { AsepriteDocument } from "@/utils/aseprite";

  type Props = {
    document: AsepriteDocument;
  };

  let { document }: Props = $props();
  let canvas = $state<HTMLCanvasElement>();
  let frameIndex = $state(0);
  let playing = $state(false);
  let previousDocument: AsepriteDocument | null = null;

  const totalDuration = $derived(
    document.frames.reduce((total, frame) => total + frame.duration, 0),
  );
  const displayScale = $derived(
    Math.max(
      1,
      Math.min(8, Math.floor(320 / Math.max(document.width, document.height))),
    ),
  );

  $effect(() => {
    if (document !== previousDocument) {
      previousDocument = document;
      frameIndex = 0;
      playing = document.frames.length > 1;
    }
  });

  $effect(() => {
    const target = canvas;
    const frame = document.frames[frameIndex];
    if (!target || !frame) return;

    target.width = document.width;
    target.height = document.height;
    const context = target.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = false;
    context.putImageData(
      new ImageData(
        new Uint8ClampedArray(frame.pixels),
        document.width,
        document.height,
      ),
      0,
      0,
    );
  });

  $effect(() => {
    if (!playing || document.frames.length < 2) return;
    const frame = document.frames[frameIndex];
    const timeout = window.setTimeout(() => {
      frameIndex = (frameIndex + 1) % document.frames.length;
    }, Math.max(16, frame.duration));
    return () => window.clearTimeout(timeout);
  });

  const previousFrame = () => {
    playing = false;
    frameIndex =
      (frameIndex - 1 + document.frames.length) % document.frames.length;
  };

  const nextFrame = () => {
    playing = false;
    frameIndex = (frameIndex + 1) % document.frames.length;
  };
</script>

<div class="aseprite-preview">
  <div class="aseprite-stage">
    <canvas
      bind:this={canvas}
      style:width={`${document.width * displayScale}px`}
      style:height={`${document.height * displayScale}px`}
      aria-label={`Aseprite 预览，第 ${frameIndex + 1} 帧，共 ${document.frames.length} 帧`}
    ></canvas>
  </div>

  <footer class="aseprite-toolbar">
    <div class="aseprite-meta">
      <span>{document.width} × {document.height}</span>
      <span>{document.colorDepth} bit</span>
      <span>{document.layerCount} 图层</span>
      {#if document.frames.length > 1}
        <span>{(totalDuration / 1000).toFixed(2)} s</span>
      {/if}
    </div>

    <div class="aseprite-controls" aria-label="动画帧控制">
      <button
        type="button"
        aria-label="上一帧"
        disabled={document.frames.length < 2}
        onclick={previousFrame}>‹</button
      >
      <button
        class="play-button"
        type="button"
        aria-label={playing ? "暂停动画" : "播放动画"}
        aria-pressed={playing}
        disabled={document.frames.length < 2}
        onclick={() => (playing = !playing)}
      >
        {playing ? "暂停" : "播放"}
      </button>
      <span class="frame-count">
        {String(frameIndex + 1).padStart(2, "0")} / {String(
          document.frames.length,
        ).padStart(2, "0")}
      </span>
      <button
        type="button"
        aria-label="下一帧"
        disabled={document.frames.length < 2}
        onclick={nextFrame}>›</button
      >
    </div>
  </footer>

  {#if document.skippedTilemapLayers > 0}
    <p class="aseprite-warning" role="status">
      已跳过 {document.skippedTilemapLayers} 个暂不支持的 Tilemap 图层。
    </p>
  {/if}
</div>

<style>
  .aseprite-preview {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    background: #f7f4ed;
  }

  .aseprite-stage {
    display: grid;
    flex: 1 1 auto;
    min-height: 0;
    place-items: center;
    overflow: auto;
    padding: 28px;
    background-color: #e8e3d9;
    background-image:
      linear-gradient(45deg, #d8d2c5 25%, transparent 25%),
      linear-gradient(-45deg, #d8d2c5 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #d8d2c5 75%),
      linear-gradient(-45deg, transparent 75%, #d8d2c5 75%);
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    background-size: 16px 16px;
  }

  canvas {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 100%;
    border-radius: 3px;
    image-rendering: pixelated;
    box-shadow:
      0 0 0 1px rgba(38, 43, 39, 0.12),
      0 14px 36px rgba(38, 43, 39, 0.16);
  }

  .aseprite-toolbar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    min-height: 54px;
    gap: 14px;
    padding: 9px 12px;
    border-top: 1px solid var(--line);
    background: var(--surface-raised);
  }

  .aseprite-meta,
  .aseprite-controls {
    display: flex;
    align-items: center;
  }

  .aseprite-meta {
    min-width: 0;
    gap: 6px;
    overflow: hidden;
  }

  .aseprite-meta span {
    flex: 0 0 auto;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 7px;
    color: var(--ink-soft);
    background: var(--surface);
    font: 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .aseprite-controls {
    flex: 0 0 auto;
    gap: 5px;
  }

  .aseprite-controls button {
    display: grid;
    min-width: 28px;
    height: 28px;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    color: var(--ink);
    background: var(--surface-raised);
    font: inherit;
    font-size: 17px;
    cursor: pointer;
  }

  .aseprite-controls button:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }

  .aseprite-controls button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .aseprite-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .aseprite-controls .play-button {
    min-width: 46px;
    padding: 0 9px;
    font-size: 10px;
    font-weight: 700;
  }

  .frame-count {
    min-width: 54px;
    color: var(--ink-soft);
    font: 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
    text-align: center;
  }

  .aseprite-warning {
    flex: 0 0 auto;
    margin: 0;
    padding: 7px 12px;
    border-top: 1px solid #efc6b2;
    color: var(--accent-strong);
    background: var(--accent-soft);
    font-size: 10px;
    text-align: center;
  }

  @media (max-width: 860px) {
    .aseprite-toolbar {
      align-items: flex-end;
      flex-direction: column;
    }

    .aseprite-meta {
      width: 100%;
    }
  }
</style>
