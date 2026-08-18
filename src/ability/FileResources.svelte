<script lang="ts">
  import { onDestroy } from "svelte";
  import ImportFileDialog from "../components/ImportFileDialog.svelte";
  import type { AssetFileSystem } from "../utils/filesystem";

  type PreviewState = "empty" | "loading" | "ready" | "unsupported" | "error";

  type Props = {
    root: AssetFileSystem;
    files: string[];
    onManifestChanged: () => void | Promise<void>;
  };

  let { root, files, onManifestChanged }: Props = $props();

  let selectedFile = $state<string | null>(null);
  let previewState = $state<PreviewState>("empty");
  let previewText = $state("");
  let previewUrl = $state<string | null>(null);
  let previewError = $state("");
  let previewRequest = 0;
  let isImportDialogOpen = $state(false);
  let isRemovingFromManifest = $state(false);
  let removeActionError = $state("");

  const previewKind = (path: string) => {
    const extension = path.toLowerCase().split(".").pop();
    if (extension === "lua" || extension === "json") {
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
    releasePreviewUrl();

    const kind = previewKind(file);
    if (kind === "unsupported") {
      previewState = "unsupported";
      return;
    }

    previewState = "loading";
    try {
      if (kind === "text") {
        const content = await root.readFile(file);
        if (request !== previewRequest) {
          return;
        }
        previewText = await content.text();
      } else {
        const content = await root.readFile(file);
        const url = URL.createObjectURL(content);
        if (request !== previewRequest) {
          URL.revokeObjectURL(url);
          return;
        }
        previewUrl = url;
      }
      previewState = "ready";
    } catch {
      if (request !== previewRequest) {
        return;
      }
      previewState = "error";
      previewError = "无法加载该文件，请稍后重试。";
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

  const handleImportedFile = async (file: string) => {
    await onManifestChanged();
    await selectFile(file);
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
      <h2>文件资源</h2>
      <button class="import-button" type="button" onclick={openImportDialog}>
        <span aria-hidden="true">+</span>
        导入文件
      </button>
    </div>
    <ul class="file-list">
      {#if files.length === 0}
        <li class="empty-file-list">暂无文件资源</li>
      {:else}
        {#each files as file}
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
        <button
          class="delete-button"
          type="button"
          onclick={removeSelectedFile}
          disabled={isRemovingFromManifest}
        >
          {isRemovingFromManifest ? "移除中..." : "删除"}
        </button>
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
        {:else if previewUrl}
          <img
            class="preview-image"
            src={previewUrl}
            alt={selectedFile ?? ""}
          />
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
    onImported={handleImportedFile}
  />
{/if}
