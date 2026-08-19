<script lang="ts">
  import { onDestroy } from "svelte";
  import ImportFileDialog from "@/components/ImportFileDialog.svelte";
  import AsepritePreview from "@/components/AsepritePreview.svelte";
  import ImagePreview from "@/components/ImagePreview.svelte";
  import type { AssetFileSystem } from "@/utils/filesystem";
  import { decodeAseprite, type AsepriteDocument } from "@/utils/aseprite";
  import Button from "@/components/Button.svelte";

  type PreviewState = "empty" | "loading" | "ready" | "unsupported" | "error";

  type Props = {
    root: AssetFileSystem;
    files: string[];
    onManifestChanged: () => void | Promise<void>;
  };

  let { root, files, onManifestChanged }: Props = $props();

  let selectedFile = $state<string | null>(null);
  let fileSearch = $state("");
  let previewState = $state<PreviewState>("empty");
  let previewText = $state("");
  let previewUrl = $state<string | null>(null);
  let asepriteDocument = $state<AsepriteDocument | null>(null);
  let previewError = $state("");
  let previewRequest = 0;
  let isImportDialogOpen = $state(false);
  let isRemovingFromManifest = $state(false);
  let removeActionError = $state("");

  let filteredFiles = $derived.by(() => {
    const query = fileSearch.trim().toLowerCase();
    return query
      ? files.filter((file) => file.toLowerCase().includes(query))
      : files;
  });

  const previewKind = (path: string) => {
    const extension = path.toLowerCase().split(".").pop();
    if (
      extension === "lua" ||
      extension === "json" ||
      extension === "tsj" ||
      extension === "tmj"
    ) {
      return "text";
    }
    if (
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "png" ||
      extension === "webp"
    ) {
      return "image";
    }
    if (extension === "ase" || extension === "aseprite") {
      return "aseprite";
    }
    return "unsupported";
  };

  const releasePreviewUrl = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  };

  const selectFile = async (file: string) => {
    const request = ++previewRequest;
    selectedFile = file;
    removeActionError = "";
    previewText = "";
    previewError = "";
    asepriteDocument = null;
    releasePreviewUrl();

    const kind = previewKind(file);
    if (kind === "unsupported") {
      previewState = "unsupported";
      return;
    }

    previewState = "loading";
    try {
      const content = await root.readFile(file);
      if (kind === "text") {
        if (request !== previewRequest) {
          return;
        }
        previewText = await content.text();
      } else if (kind === "aseprite") {
        const document = await decodeAseprite(await content.arrayBuffer());
        if (request !== previewRequest) {
          return;
        }
        asepriteDocument = document;
      } else {
        const url = URL.createObjectURL(content);
        if (request !== previewRequest) {
          URL.revokeObjectURL(url);
          return;
        }
        previewUrl = url;
      }
      previewState = "ready";
    } catch (error) {
      console.error("Failed to preview file:", error);
      if (request !== previewRequest) {
        return;
      }
      previewState = "error";
      previewError =
        kind === "aseprite" && error instanceof Error
          ? `无法解析 Aseprite 文件：${error.message}`
          : "无法加载该文件，请稍后重试。";
    }
  };

  const removeSelectedFile = async () => {
    if (!selectedFile || isRemovingFromManifest) {
      return;
    }
    const file = selectedFile;
    if (
      !window.confirm(
        "确定从 manifest.files 中移除“" + file + "”吗？\n实际文件不会被删除。",
      )
    ) {
      return;
    }

    isRemovingFromManifest = true;
    removeActionError = "";
    try {
      await root.editManifestFile(file, "delete");
      previewRequest += 1;
      releasePreviewUrl();
      selectedFile = null;
      previewState = "empty";
      previewText = "";
      previewError = "";
      asepriteDocument = null;
      await onManifestChanged();
    } catch {
      removeActionError = "无法从 manifest.files 移除该文件，请稍后重试。";
    } finally {
      isRemovingFromManifest = false;
    }
  };

  const openImportDialog = () => {
    isImportDialogOpen = true;
  };

  const handleImportedFiles = async (files: string[]) => {
    await onManifestChanged();
    const lastImportedFile = files.at(-1);
    if (lastImportedFile) {
      await selectFile(lastImportedFile);
    }
  };

  onDestroy(() => {
    previewRequest += 1;
    releasePreviewUrl();
  });
</script>

<div
  id="files-panel"
  class="content files-content"
  role="tabpanel"
  aria-labelledby="files-tab"
>
  <div class="file-list-panel" aria-label="文件资源列表">
    <div class="file-list-header">
      <div class="file-list-heading">
        <h2>文件资源</h2>
      </div>
      <Button onclick={openImportDialog}>添加文件</Button>
    </div>
    <label class="file-search">
      <span class="visually-hidden">搜索文件资源</span>
      <input
        class="file-search-input"
        type="search"
        bind:value={fileSearch}
        placeholder="搜索文件资源..."
        aria-label="搜索文件资源"
      />
    </label>
    <ul class="file-list">
      {#if files.length === 0}
        <li class="empty-file-list">暂无文件资源</li>
      {:else if filteredFiles.length === 0}
        <li class="empty-file-list">未找到匹配的文件资源</li>
      {:else}
        {#each filteredFiles as file}
          <li>
            <button
              class="file-item"
              class:active={selectedFile === file}
              type="button"
              aria-pressed={selectedFile === file}
              onclick={() => selectFile(file)}
            >
              {file}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>
  <div class="file-detail-panel" aria-label="文件资源详情">
    {#if selectedFile === null}
      <div class="preview-placeholder">选择左侧文件查看预览</div>
    {:else}
      <header class="preview-header">
        <span class="preview-title">{selectedFile}</span>

        <Button
          type="danger"
          disabled={isRemovingFromManifest}
          onclick={removeSelectedFile}
        >
          {isRemovingFromManifest ? "移除中..." : "删除"}
        </Button>
      </header>
      <div class="preview-body">
        {#if removeActionError}
          <p class="preview-message preview-message--error" role="alert">
            {removeActionError}
          </p>
        {:else if previewState === "loading"}
          <p class="preview-message">正在加载预览...</p>
        {:else if previewState === "unsupported"}
          <p class="preview-message">当前资源类型暂不支持预览。</p>
        {:else if previewState === "error"}
          <p class="preview-message preview-message--error">
            {previewError}
          </p>
        {:else if asepriteDocument}
          <AsepritePreview document={asepriteDocument} />
        {:else if previewUrl}
          <ImagePreview src={previewUrl} alt={selectedFile ?? ""} />
        {:else}
          <pre class="preview-text">{previewText}</pre>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if isImportDialogOpen}
  <ImportFileDialog
    {root}
    onClose={() => (isImportDialogOpen = false)}
    onImported={handleImportedFiles}
  />
{/if}

<style>
  .file-search {
    display: block;
    padding: 10px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-raised);
  }
</style>
