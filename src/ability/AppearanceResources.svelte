<script lang="ts">
  import { onDestroy } from "svelte";
  import type { AssetFileSystem } from "@/utils/filesystem";

  type Props = {
    root: AssetFileSystem;
    appearances: string[];
  };

  type AppearanceAnimation = {
    name: string;
    path: string;
    frameDuration: number;
    loop: boolean;
    imageUrl: string | null;
    imageError: string | null;
  };

  type AppearanceDetails = {
    id: string;
    defaultAnimation: string;
    geometry: {
      scale: number;
      originX: number;
      originY: number;
      useCenterOrigin: boolean;
    };
    idleDelay: {
      min: number;
      max: number;
    };
    animations: AppearanceAnimation[];
  };

  type PreviewState = "empty" | "loading" | "ready" | "error";

  let { root, appearances }: Props = $props();
  let selectedAppearance = $state<string | null>(null);
  let previewState = $state<PreviewState>("empty");
  let appearanceDetails = $state<AppearanceDetails | null>(null);
  let previewError = $state("");
  let selectedAnimationIndex = $state<number | null>(null);
  let appearanceRequest = 0;
  let imageUrls: string[] = [];

  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const joinAssetPath = (directory: string, file: string) => {
    const normalizedDirectory = directory
      .replaceAll("\\", "/")
      .replace(/\/+$/, "");
    const normalizedFile = file.replaceAll("\\", "/").replace(/^\/+/, "");
    return normalizedDirectory
      ? normalizedDirectory + "/" + normalizedFile
      : normalizedFile;
  };

  const directoryOf = (path: string) => {
    const normalizedPath = path.replaceAll("\\", "/");
    const separator = normalizedPath.lastIndexOf("/");
    return separator < 0 ? "" : normalizedPath.slice(0, separator);
  };

  const numberValue = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const parseAppearance = (value: unknown): AppearanceDetails => {
    if (!isObject(value)) {
      throw new Error("appearance must contain an object");
    }

    const geometry = isObject(value.geometry) ? value.geometry : {};
    const idleDelay = isObject(value.idleDelay) ? value.idleDelay : {};
    const animations = Array.isArray(value.animations)
      ? value.animations.map((animation, index): AppearanceAnimation => {
          const data = isObject(animation) ? animation : {};
          return {
            name:
              typeof data.name === "string" && data.name.trim() !== ""
                ? data.name.trim()
                : "animation-" + (index + 1),
            path: typeof data.path === "string" ? data.path : "",
            frameDuration: numberValue(data.frameDuration, 0.12),
            loop: typeof data.loop === "boolean" ? data.loop : true,
            imageUrl: null,
            imageError: null,
          };
        })
      : [];

    return {
      id: typeof value.id === "string" ? value.id : "未配置",
      defaultAnimation:
        typeof value.defaultAnimation === "string"
          ? value.defaultAnimation
          : "未配置",
      geometry: {
        scale: numberValue(geometry.scale, 1),
        originX: numberValue(geometry.originX, 0),
        originY: numberValue(geometry.originY, 0),
        useCenterOrigin:
          typeof geometry.useCenterOrigin === "boolean"
            ? geometry.useCenterOrigin
            : true,
      },
      idleDelay: {
        min: numberValue(idleDelay.min, 0.5),
        max: numberValue(idleDelay.max, 1.2),
      },
      animations,
    };
  };

  const releaseImageUrls = () => {
    for (const url of imageUrls) {
      URL.revokeObjectURL(url);
    }
    imageUrls = [];
  };

  const appearanceNames = $derived(
    appearances
      .filter((appearance) => appearance.trim() !== "")
      .map((appearance) => appearance.trim()),
  );

  const selectedAnimation = $derived.by(
    () =>
      appearanceDetails?.animations.find(
        (_, index) => index === selectedAnimationIndex,
      ) ?? null,
  );

  const selectAppearance = async (appearance: string) => {
    const request = ++appearanceRequest;
    selectedAppearance = appearance;
    selectedAnimationIndex = null;
    appearanceDetails = null;
    previewError = "";
    previewState = "loading";
    releaseImageUrls();

    try {
      const file = await root.readFile(appearance);
      const value: unknown = JSON.parse(await file.text());
      const parsed = parseAppearance(value);
      const directory = directoryOf(appearance);
      const animations = await Promise.all(
        parsed.animations.map(async (animation) => {
          if (animation.path.trim() === "") {
            return {
              ...animation,
              imageError: "未配置图片路径。",
            };
          }

          const imagePath = joinAssetPath(directory, animation.path);
          try {
            const image = await root.readFile(imagePath);
            return {
              ...animation,
              imageUrl: URL.createObjectURL(image),
            };
          } catch {
            return {
              ...animation,
              imageError: "无法加载 " + imagePath + "。",
            };
          }
        }),
      );

      const loadedUrls = animations.flatMap((animation) =>
        animation.imageUrl === null ? [] : [animation.imageUrl],
      );
      if (request !== appearanceRequest) {
        loadedUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      imageUrls = loadedUrls;
      appearanceDetails = {
        ...parsed,
        animations,
      };
      selectedAnimationIndex = animations[0] ? 0 : null;
      previewState = "ready";
    } catch {
      if (request !== appearanceRequest) {
        return;
      }
      previewState = "error";
      previewError = "无法加载角色资源，请确认 JSON 格式和文件路径正确。";
    }
  };

  const selectAnimation = (index: number) => {
    selectedAnimationIndex = index;
  };

  onDestroy(() => {
    appearanceRequest += 1;
    releaseImageUrls();
  });
</script>

<div
  id="appearances-panel"
  class="content files-content appearance-content"
  role="tabpanel"
  aria-labelledby="appearances-tab"
  aria-label="角色资源"
>
  <div class="file-list-panel" aria-label="角色资源列表">
    <div class="file-list-header">
      <div>
        <h2>角色资源</h2>
        <p class="list-caption">{appearanceNames.length} 个角色资源</p>
      </div>
    </div>
    <ul class="file-list">
      {#if appearanceNames.length === 0}
        <li class="empty-file-list">manifest.appearances 为空</li>
      {:else}
        {#each appearanceNames as appearance}
          <li>
            <button
              class="file-item"
              class:active={selectedAppearance === appearance}
              type="button"
              aria-pressed={selectedAppearance === appearance}
              onclick={() => selectAppearance(appearance)}
            >
              {appearance}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>

  <div
    class="file-detail-panel appearance-detail-panel"
    aria-label="角色资源详情"
  >
    {#if selectedAppearance === null}
      <div class="preview-placeholder">选择左侧角色资源查看详情</div>
    {:else if previewState === "loading"}
      <div class="preview-placeholder">正在读取角色资源...</div>
    {:else if previewState === "error" || appearanceDetails === null}
      <div class="preview-placeholder preview-message--error">
        {previewError}
      </div>
    {:else}
      <header class="preview-header">
        <span class="preview-title">{selectedAppearance}</span>
      </header>
      <div class="appearance-detail-body">
        <section class="appearance-properties-panel" aria-label="角色属性">
          <div class="appearance-section-header">
            <h3>角色属性</h3>
          </div>
          <dl class="appearance-property-list">
            <div>
              <dt>id</dt>
              <dd>
                <input type="text" bind:value={appearanceDetails.id} />
              </dd>
            </div>
            <div>
              <dt>defaultAnimation</dt>
              <dd>
                <input
                  type="text"
                  bind:value={appearanceDetails.defaultAnimation}
                />
              </dd>
            </div>
            <div>
              <dt>geometry.scale</dt>
              <dd>
                <input
                  type="number"
                  step="any"
                  bind:value={appearanceDetails.geometry.scale}
                />
              </dd>
            </div>
            <div>
              <dt>geometry.originX</dt>
              <dd>
                <input
                  type="number"
                  step="any"
                  bind:value={appearanceDetails.geometry.originX}
                />
              </dd>
            </div>
            <div>
              <dt>geometry.originY</dt>
              <dd>
                <input
                  type="number"
                  step="any"
                  bind:value={appearanceDetails.geometry.originY}
                />
              </dd>
            </div>
            <div>
              <dt>geometry.useCenterOrigin</dt>
              <dd>
                <input
                  type="checkbox"
                  bind:checked={appearanceDetails.geometry.useCenterOrigin}
                />
              </dd>
            </div>
            <div>
              <dt>idleDelay.min</dt>
              <dd>
                <input
                  type="number"
                  step="any"
                  bind:value={appearanceDetails.idleDelay.min}
                />
              </dd>
            </div>
            <div>
              <dt>idleDelay.max</dt>
              <dd>
                <input
                  type="number"
                  step="any"
                  bind:value={appearanceDetails.idleDelay.max}
                />
              </dd>
            </div>
          </dl>
        </section>

        <section class="appearance-animation-panel" aria-label="角色动画">
          <div class="appearance-section-header">
            <h3>Animations</h3>
            <span>{appearanceDetails.animations.length}</span>
          </div>
          <div class="appearance-animation-list">
            {#if appearanceDetails.animations.length === 0}
              <p class="appearance-empty-message">暂无 animation</p>
            {:else}
              {#each appearanceDetails.animations as animation, index}
                <button
                  class="appearance-animation-card"
                  class:active={selectedAnimationIndex === index}
                  type="button"
                  aria-pressed={selectedAnimationIndex === index}
                  onclick={() => selectAnimation(index)}
                >
                  <div class="appearance-animation-image">
                    {#if animation.imageUrl}
                      <img src={animation.imageUrl} alt={animation.name} />
                    {:else if animation.imageError}
                      <span class="appearance-image-error">图片不可用</span>
                    {:else}
                      <span class="appearance-image-empty">暂无图片</span>
                    {/if}
                  </div>
                  <span class="appearance-animation-name">{animation.name}</span
                  >
                </button>
              {/each}
            {/if}
          </div>

          <div class="appearance-animation-properties">
            <div class="appearance-section-header">
              <h3>Animation 属性</h3>
            </div>
            {#if selectedAnimation}
              <div class="appearance-animation-property-list">
                <div>
                  <dt>name</dt>
                  <dd>
                    <input type="text" bind:value={selectedAnimation.name} />
                  </dd>
                </div>
                <div>
                  <dt>frameDuration</dt>
                  <dd>
                    <input
                      type="number"
                      step="any"
                      bind:value={selectedAnimation.frameDuration}
                    />
                  </dd>
                </div>
                <div>
                  <dt>loop</dt>
                  <dd>
                    <input
                      type="checkbox"
                      bind:checked={selectedAnimation.loop}
                    />
                  </dd>
                </div>
              </div>
            {:else}
              <p class="appearance-empty-message">
                选择一个 animation 查看属性
              </p>
            {/if}
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .appearance-detail-panel {
    display: flex;
    flex-direction: column;
  }

  .appearance-detail-body {
    display: grid;
    grid-template-columns: 240px minmax(0, 1.28fr);
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }

  .appearance-properties-panel,
  .appearance-animation-panel {
    min-width: 0;
    min-height: 0;
  }

  .appearance-properties-panel {
    overflow: auto;
    border-right: 1px solid rgba(154, 176, 210, 0.14);
  }

  .appearance-animation-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .appearance-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.14);
  }

  .appearance-section-header h3 {
    margin: 0;
    color: #dce7f8;
    font-size: 12px;
  }

  .appearance-section-header > span {
    color: #7f90aa;
    font-size: 11px;
  }

  .appearance-property-list {
    margin: 0;
    padding: 10px 12px;
  }

  .appearance-property-list > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(154, 176, 210, 0.1);
  }

  .appearance-property-list > div:last-child {
    border-bottom: 0;
  }

  .appearance-property-list dt {
    min-width: 0;
    color: #7f90aa;
    font:
      14px/1.4 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    overflow-wrap: anywhere;
  }

  .appearance-property-list dd {
    min-width: 0;
    margin: 0;
    color: #dce7f8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .appearance-animation-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
    align-content: start;
    gap: 10px;
    flex: 1 1 auto;
    min-height: 0;
    padding: 12px;
    overflow: auto;
  }

  .appearance-animation-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 8px;
    border: 1px solid rgba(154, 176, 210, 0.16);
    border-radius: 8px;
    padding: 8px;
    color: #b9c7db;
    background: rgba(19, 28, 43, 0.48);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .appearance-animation-card:hover {
    border-color: rgba(137, 181, 255, 0.52);
    background: rgba(72, 125, 216, 0.14);
  }

  .appearance-animation-card.active {
    border-color: #90baff;
    color: #e4eeff;
    background: rgba(72, 125, 216, 0.24);
    box-shadow: 0 0 0 1px rgba(144, 186, 255, 0.18);
  }

  .appearance-animation-image {
    display: grid;
    width: 100%;
    aspect-ratio: 1;
    place-items: center;
    overflow: hidden;
    border-radius: 6px;
    background: rgba(7, 12, 20, 0.58);
  }

  .appearance-animation-image img {
    display: block;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    object-position: center;
    image-rendering: pixelated;
  }

  .appearance-image-error,
  .appearance-image-empty {
    padding: 8px;
    color: #7f90aa;
    font-size: 11px;
    text-align: center;
  }

  .appearance-image-error {
    color: #ffabab;
  }

  .appearance-animation-name {
    overflow: hidden;
    color: inherit;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .appearance-animation-properties {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    max-height: 230px;
    overflow: hidden;
    border-top: 1px solid rgba(154, 176, 210, 0.14);
  }

  .appearance-animation-property-list {
    flex: 1 1 auto;
    overflow: auto;
    padding: 0 12px;
  }

  .appearance-animation-property-list > div {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 8px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.1);
  }

  .appearance-animation-property-list > div:last-child {
    border-bottom: 0;
  }

  .appearance-animation-property-list dt {
    min-width: 0;
    color: #7f90aa;
    font:
      14px/1.4 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    overflow-wrap: anywhere;
  }

  .appearance-animation-property-list dd {
    min-width: 0;
    margin: 0;
    color: #dce7f8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .appearance-empty-message {
    margin: 0;
    padding: 18px 12px;
    color: #7f90aa;
    font-size: 12px;
    text-align: center;
  }
</style>
