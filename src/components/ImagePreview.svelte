<script lang="ts">
  import { onMount } from "svelte";

  type Props = {
    src: string;
    alt: string;
  };

  let { src, alt }: Props = $props();
  let viewport = $state<HTMLDivElement>();
  let naturalWidth = $state(0);
  let naturalHeight = $state(0);
  let scale = $state(1);
  let autoFit = $state(true);
  let previousSrc = "";

  const MIN_SCALE = 0.1;
  const MAX_SCALE = 8;
  const zoomLabel = $derived(`${Math.round(scale * 100)}%`);

  const clampedScale = (value: number) =>
    Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const availableFitScale = () => {
    if (!viewport || naturalWidth === 0 || naturalHeight === 0) return 1;
    return clampedScale(
      Math.min(
        1,
        (viewport.clientWidth - 48) / naturalWidth,
        (viewport.clientHeight - 48) / naturalHeight,
      ),
    );
  };

  const fitImage = () => {
    autoFit = true;
    scale = availableFitScale();
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    });
  };

  const setScale = (value: number) => {
    if (!viewport) return;
    const nextScale = clampedScale(value);
    const ratio = nextScale / scale;
    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    autoFit = false;
    scale = nextScale;
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollLeft = centerX * ratio - viewport.clientWidth / 2;
      viewport.scrollTop = centerY * ratio - viewport.clientHeight / 2;
    });
  };

  const handleImageLoad = (event: Event) => {
    const image = event.currentTarget as HTMLImageElement;
    naturalWidth = image.naturalWidth;
    naturalHeight = image.naturalHeight;
    requestAnimationFrame(fitImage);
  };

  const handleWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setScale(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
  };

  $effect(() => {
    if (src !== previousSrc) {
      previousSrc = src;
      naturalWidth = 0;
      naturalHeight = 0;
      scale = 1;
      autoFit = true;
    }
  });

  onMount(() => {
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (autoFit && naturalWidth > 0) scale = availableFitScale();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  });
</script>

<div class="image-preview">
  <div
    class="image-viewport"
    bind:this={viewport}
    role="img"
    aria-label={alt}
    onwheel={handleWheel}
  >
    <div
      class="image-sheet"
      style:width={`${Math.max(1, naturalWidth * scale)}px`}
      style:height={`${Math.max(1, naturalHeight * scale)}px`}
    >
      <img
        {src}
        {alt}
        draggable="false"
        onload={handleImageLoad}
      />
    </div>
  </div>

  <footer class="image-toolbar">
    <div class="image-meta">
      {#if naturalWidth > 0}
        <span>{naturalWidth} × {naturalHeight}</span>
      {:else}
        <span>正在读取图片尺寸...</span>
      {/if}
      <small>按住 Ctrl / ⌘ 滚动可缩放</small>
    </div>

    <div class="zoom-controls" aria-label="图片缩放控制">
      <button
        type="button"
        aria-label="缩小"
        disabled={scale <= MIN_SCALE}
        onclick={() => setScale(scale / 1.25)}
      >−</button>
      <span>{zoomLabel}</span>
      <button
        type="button"
        aria-label="放大"
        disabled={scale >= MAX_SCALE}
        onclick={() => setScale(scale * 1.25)}
      >+</button>
      <button
        class:active={autoFit}
        type="button"
        aria-label="适应窗口"
        onclick={fitImage}
      >适应</button>
      <button
        class:active={!autoFit && scale === 1}
        type="button"
        aria-label="使用原始尺寸"
        onclick={() => setScale(1)}
      >1:1</button>
    </div>
  </footer>
</div>

<style>
  .image-preview {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .image-viewport {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    align-items: center;
    overflow: auto;
    padding: 24px;
    background-color: #e8e3d9;
    background-image:
      linear-gradient(45deg, #d8d2c5 25%, transparent 25%),
      linear-gradient(-45deg, #d8d2c5 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #d8d2c5 75%),
      linear-gradient(-45deg, transparent 75%, #d8d2c5 75%);
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
    background-size: 16px 16px;
  }

  .image-sheet {
    position: relative;
    display: grid;
    flex: 0 0 auto;
    place-items: stretch;
    margin: auto;
    box-shadow:
      0 0 0 1px rgba(38, 43, 39, 0.12),
      0 14px 36px rgba(38, 43, 39, 0.16);
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
    image-rendering: pixelated;
    user-select: none;
  }

  .image-toolbar {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    min-height: 54px;
    gap: 16px;
    padding: 9px 12px;
    border-top: 1px solid var(--line);
    background: var(--surface-raised);
  }

  .image-meta {
    min-width: 0;
  }

  .image-meta span,
  .image-meta small {
    display: block;
  }

  .image-meta span {
    color: var(--ink-soft);
    font: 10px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .image-meta small {
    margin-top: 3px;
    color: var(--ink-faint);
    font-size: 8px;
  }

  .zoom-controls {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 5px;
  }

  .zoom-controls button {
    display: grid;
    min-width: 29px;
    height: 29px;
    place-items: center;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    padding: 0 8px;
    color: var(--ink-soft);
    background: var(--surface-raised);
    font: inherit;
    font-size: 10px;
    font-weight: 650;
    cursor: pointer;
  }

  .zoom-controls button:first-child,
  .zoom-controls button:nth-child(3) {
    padding: 0;
    font-size: 16px;
  }

  .zoom-controls button:hover:not(:disabled),
  .zoom-controls button.active {
    border-color: var(--accent);
    color: var(--accent-strong);
    background: var(--accent-soft);
  }

  .zoom-controls button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .zoom-controls button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
  }

  .zoom-controls span {
    min-width: 48px;
    color: var(--ink-soft);
    font: 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
    text-align: center;
  }

  @media (max-width: 760px) {
    .image-meta small {
      display: none;
    }
  }
</style>
