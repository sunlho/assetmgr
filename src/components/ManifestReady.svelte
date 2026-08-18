<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    editManifestFileApi,
    getContentApi,
    getContentPreviewApi,
    type AssetEntry,
  } from "../api";

  type ResourceTabId = "files" | "localization" | "appearances" | "maps";

  type PreviewState =
    | "empty"
    | "loading"
    | "ready"
    | "unsupported"
    | "error";

  type ResourceTab = {
    id: ResourceTabId;
    label: string;
    manifestKey: string;
    description: string;
  };

  type Props = {
    files: string[];
    onManifestChanged: () => void | Promise<void>;
  };

  let { files, onManifestChanged }: Props = $props();

  const tabs: ResourceTab[] = [
    {
      id: "files",
      label: "文件资源",
      manifestKey: "files",
      description: "管理 manifest.files 中声明的通用文件资源。",
    },
    {
      id: "localization",
      label: "国际化资源",
      manifestKey: "localization",
      description: "管理 manifest.localization 指向的国际化资源。",
    },
    {
      id: "appearances",
      label: "角色资源",
      manifestKey: "appearances",
      description: "管理 manifest.appearances 中声明的角色资源。",
    },
    {
      id: "maps",
      label: "地图资源",
      manifestKey: "maps",
      description: "管理 manifest.maps 中声明的地图资源。",
    },
  ];

  let activeTab = $state<ResourceTabId>("files");
  let selectedFile = $state<string | null>(null);
  let previewState = $state<PreviewState>("empty");
  let previewText = $state("");
  let previewUrl = $state<string | null>(null);
  let previewError = $state("");
  let previewRequest = 0;
  let isImportDialogOpen = $state(false);
  let importPath = $state("");
  let importEntries = $state<AssetEntry[]>([]);
  let selectedImportPath = $state<string | null>(null);
  let isLoadingEntries = $state(false);
  let entriesError = $state("");
  let isAddingToManifest = $state(false);
  let importActionError = $state("");
  let isRemovingFromManifest = $state(false);
  let removeActionError = $state("");

  const previewKind = (path: string) => {
    const extension = path.toLowerCase().split(".").pop();
    if (extension === "lua" || extension === "json") {
      return "text";
    }
    if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
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
        const response = await getContentPreviewApi(file, "text");
        if (request !== previewRequest) {
          return;
        }
        previewText = response.data as string;
      } else {
        const response = await getContentPreviewApi(file, "blob");
        const url = URL.createObjectURL(response.data);
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
    if (!window.confirm(`确定从 manifest.files 中移除“${file}”吗？\n实际文件不会被删除。`)) {
      return;
    }

    isRemovingFromManifest = true;
    removeActionError = "";
    try {
      await editManifestFileApi(file, "delete");
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

  const loadImportEntries = async (path: string) => {
    isLoadingEntries = true;
    entriesError = "";
    try {
      const response = await getContentApi(path, "entries");
      importPath = response.data.path;
      importEntries = response.data.entries;
    } catch {
      importEntries = [];
      entriesError = "无法读取资源列表，请稍后重试。";
    } finally {
      isLoadingEntries = false;
    }
  };

  const openImportDialog = () => {
    isImportDialogOpen = true;
    importPath = "";
    selectedImportPath = null;
    importActionError = "";
    void loadImportEntries("");
  };

  const closeImportDialog = () => {
    if (isAddingToManifest) {
      return;
    }
    isImportDialogOpen = false;
  };

  const selectImportEntry = (entry: AssetEntry) => {
    if (entry.directory) {
      selectedImportPath = null;
      void loadImportEntries(entry.path);
      return;
    }
    selectedImportPath = entry.path;
  };

  const parentImportPath = () => {
    if (!importPath) {
      return;
    }
    const parts = importPath.split("/").filter(Boolean);
    parts.pop();
    selectedImportPath = null;
    void loadImportEntries(parts.join("/"));
  };

  const confirmImportSelection = async () => {
    if (!selectedImportPath) {
      return;
    }
    const file = selectedImportPath;
    isAddingToManifest = true;
    importActionError = "";
    try {
      await editManifestFileApi(file, "add");
      isAddingToManifest = false;
      closeImportDialog();
      await onManifestChanged();
      await selectFile(file);
    } catch {
      importActionError = "无法将文件添加到 manifest.files，请稍后重试。";
    } finally {
      isAddingToManifest = false;
    }
  };

  const handleImportDialogKeydown = (event: KeyboardEvent) => {
    if (isImportDialogOpen && !isAddingToManifest && event.key === "Escape") {
      closeImportDialog();
    }
  };

  const closeImportDialogOnBackdrop = (event: MouseEvent) => {
    if (!isAddingToManifest && event.target === event.currentTarget) {
      closeImportDialog();
    }
  };

  onDestroy(() => {
    previewRequest += 1;
    releasePreviewUrl();
  });
</script>

<svelte:window onkeydown={handleImportDialogKeydown} />

<main class="ready-state">
  <div class="tabs" role="tablist" aria-label="Manifest 资源分类">
    {#each tabs as tab}
      <button
        id={`${tab.id}-tab`}
        class:active={activeTab === tab.id}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`${tab.id}-panel`}
        onclick={() => (activeTab = tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#each tabs as tab}
    {#if activeTab === tab.id}
      {#if tab.id === "files"}
        <div class="content files-content">
          <section class="file-list-panel" aria-label="文件资源列表">
            <div class="file-list-header">
              <h2>文件资源</h2>
              <button
                class="import-button"
                type="button"
                onclick={openImportDialog}
              >
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
          </section>
          <section class="file-detail-panel" aria-label="文件资源详情">
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
                  <p class="preview-message preview-message--error">{previewError}</p>
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
          </section>
        </div>
      {:else}
        <div class="content"></div>
      {/if}
    {/if}
  {/each}
</main>

{#if isImportDialogOpen}
  <div
    class="modal-backdrop"
    role="presentation"
    onclick={closeImportDialogOnBackdrop}
  >
    <section
      class="import-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
      onclick={(event) => event.stopPropagation()}
    >
      <header class="dialog-header">
        <h2 id="import-dialog-title">选择文件</h2>
        <button
          class="dialog-close-button"
          type="button"
          aria-label="关闭"
          onclick={closeImportDialog}
          disabled={isAddingToManifest}
        >
          ×
        </button>
      </header>

      <div class="dialog-toolbar">
        <button
          class="parent-button"
          type="button"
          onclick={parentImportPath}
          disabled={!importPath || isLoadingEntries || isAddingToManifest}
        >
          返回上级
        </button>
        <span class="current-path">{importPath || "资源根目录"}</span>
      </div>

      <div class="entry-list" aria-live="polite">
        {#if isLoadingEntries}
          <p class="dialog-message">正在读取资源列表...</p>
        {:else if entriesError}
          <p class="dialog-message dialog-message--error">{entriesError}</p>
        {:else if importEntries.length === 0}
          <p class="dialog-message">当前目录没有可选文件。</p>
        {:else}
          {#each importEntries as entry}
            <button
              class="entry-button"
              class:entry-selected={selectedImportPath === entry.path}
              type="button"
              disabled={isAddingToManifest}
              onclick={() => selectImportEntry(entry)}
            >
              <span class="entry-icon" aria-hidden="true">
                {entry.directory ? "▸" : "·"}
              </span>
              <span class="entry-name">{entry.name}</span>
              {#if entry.directory}
                <span class="entry-kind">目录</span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>

      <footer class="dialog-footer">
        {#if importActionError}
          <p class="dialog-action-error">{importActionError}</p>
        {/if}
        <button
          class="dialog-secondary-button"
          type="button"
          onclick={closeImportDialog}
          disabled={isAddingToManifest}
        >
          取消
        </button>
        <button
          class="dialog-primary-button"
          type="button"
          disabled={!selectedImportPath || isLoadingEntries || isAddingToManifest}
          onclick={confirmImportSelection}
        >
          {isAddingToManifest ? "导入中..." : "导入文件"}
        </button>
      </footer>
    </section>
  </div>
{/if}

<style>
  .ready-state {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tabs {
    display: flex;
    padding: 4px;
    border: 1px solid rgba(154, 176, 210, 0.18);
    border-radius: 12px;
    background: rgba(19, 28, 43, 0.72);
  }

  .tabs button {
    width: 100px;
    min-height: 44px;
    border: 0;
    border-radius: 8px;
    color: #91a2bc;
    background: transparent;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition:
      color 160ms ease,
      background 160ms ease,
      box-shadow 160ms ease;
  }

  .tabs button:hover {
    color: #d4e1f6;
  }

  .tabs button:focus-visible {
    outline: 3px solid rgba(137, 181, 255, 0.55);
    outline-offset: -2px;
  }

  .content {
    flex: 1;
    margin-top: 16px;
    padding: 12px;
    border: 1px solid rgba(154, 176, 210, 0.18);
    border-radius: 12px;
    background: rgba(19, 28, 43, 0.72);
    min-height: 0;
    overflow: hidden;
  }

  .files-content {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 7fr);
    gap: 12px;
    min-height: 0;
    overflow: hidden;
  }

  .file-list-panel,
  .file-detail-panel {
    min-width: 0;
    min-height: 0;
    border: 1px solid rgba(154, 176, 210, 0.14);
    border-radius: 10px;
    background: rgba(12, 17, 27, 0.32);
  }

  .file-list-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .file-list-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.14);
  }

  .file-list-header h2 {
    margin: 0;
    color: #dce7f8;
    font-size: 14px;
  }

  .import-button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    border: 1px solid #6c9ff1;
    border-radius: 7px;
    padding: 0 9px;
    color: #08111f;
    background: #90baff;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .import-button span {
    font-size: 16px;
    font-weight: 400;
    line-height: 1;
  }

  .import-button:hover {
    background: #b0ceff;
  }

  .file-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: 6px;
    list-style: none;
  }

  .file-list,
  .preview-body,
  .preview-text,
  .entry-list {
    scrollbar-color: rgba(144, 186, 255, 0.42) transparent;
    scrollbar-width: thin;
  }

  .file-list::-webkit-scrollbar,
  .preview-body::-webkit-scrollbar,
  .preview-text::-webkit-scrollbar,
  .entry-list::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .file-list::-webkit-scrollbar-track,
  .preview-body::-webkit-scrollbar-track,
  .preview-text::-webkit-scrollbar-track,
  .entry-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .file-list::-webkit-scrollbar-thumb,
  .preview-body::-webkit-scrollbar-thumb,
  .preview-text::-webkit-scrollbar-thumb,
  .entry-list::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: rgba(144, 186, 255, 0.36);
    background-clip: padding-box;
  }

  .file-list::-webkit-scrollbar-thumb:hover,
  .preview-body::-webkit-scrollbar-thumb:hover,
  .preview-text::-webkit-scrollbar-thumb:hover,
  .entry-list::-webkit-scrollbar-thumb:hover {
    background: rgba(144, 186, 255, 0.62);
    background-clip: padding-box;
  }

  .file-item,
  .empty-file-list {
    display: block;
    width: 100%;
    padding: 10px 8px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.1);
    color: #b9c7db;
    background: transparent;
    font: inherit;
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
    overflow-wrap: anywhere;
  }

  .file-item {
    border-top: 0;
    border-right: 0;
    border-left: 0;
    cursor: pointer;
  }

  .file-list li:last-child .file-item,
  .file-list li:last-child .empty-file-list {
    border-bottom: 0;
  }

  .file-item:hover {
    color: #d4e1f6;
    background: rgba(72, 125, 216, 0.1);
  }

  .file-item.active {
    color: #dceaff;
    background: rgba(72, 125, 216, 0.22);
  }

  .empty-file-list {
    color: #7f90aa;
    text-align: center;
  }

  .file-detail-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(12, 17, 27, 0.18);
  }

  .preview-placeholder,
  .preview-message {
    display: grid;
    flex: 1;
    place-items: center;
    margin: 0;
    padding: 24px;
    color: #7f90aa;
    font-size: 14px;
    text-align: center;
  }

  .preview-message--error {
    color: #ffabab;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex: 0 0 auto;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.14);
  }

  .preview-title {
    min-width: 0;
    display: block;
    overflow: hidden;
    color: #dce7f8;
    font-size: 13px;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-button {
    flex: 0 0 auto;
    min-height: 30px;
    border: 1px solid rgba(255, 140, 140, 0.48);
    border-radius: 7px;
    padding: 0 10px;
    color: #ffc1c1;
    background: rgba(122, 39, 51, 0.35);
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition:
      color 160ms ease,
      background 160ms ease,
      border-color 160ms ease;
  }

  .delete-button:hover:not(:disabled) {
    border-color: rgba(255, 160, 160, 0.72);
    color: #ffe2e2;
    background: rgba(156, 46, 61, 0.58);
  }

  .delete-button:disabled {
    cursor: wait;
    opacity: 0.65;
  }

  .preview-body {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .preview-image {
    display: block;
    max-width: 100%;
    max-height: 100%;
    margin: auto;
    object-fit: contain;
  }

  .preview-text {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    max-height: 100%;
    margin: 0;
    padding: 16px;
    color: #c9d6e9;
    font: 13px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 8, 15, 0.72);
    backdrop-filter: blur(4px);
  }

  .import-dialog {
    display: flex;
    flex-direction: column;
    width: min(100%, 640px);
    max-height: calc(100vh - 48px);
    overflow: hidden;
    border: 1px solid rgba(154, 176, 210, 0.28);
    border-radius: 14px;
    background: #131c2b;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
  }

  .dialog-header,
  .dialog-toolbar,
  .dialog-footer {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .dialog-header {
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.14);
  }

  .dialog-header h2 {
    margin: 0;
    color: #f3f6fb;
    font-size: 18px;
  }

  .dialog-close-button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 7px;
    color: #a9b7cc;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .dialog-close-button:hover {
    color: #f3f6fb;
    background: rgba(154, 176, 210, 0.12);
  }

  .dialog-close-button:disabled,
  .entry-button:disabled,
  .dialog-secondary-button:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  .dialog-toolbar {
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid rgba(154, 176, 210, 0.1);
  }

  .parent-button,
  .dialog-secondary-button,
  .dialog-primary-button {
    min-height: 36px;
    border-radius: 8px;
    padding: 0 13px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .parent-button,
  .dialog-secondary-button {
    border: 1px solid rgba(154, 176, 210, 0.24);
    color: #c1cee2;
    background: rgba(28, 41, 61, 0.72);
  }

  .parent-button:hover:not(:disabled),
  .dialog-secondary-button:hover {
    border-color: rgba(154, 176, 210, 0.48);
    background: rgba(39, 55, 80, 0.9);
  }

  .parent-button:disabled,
  .dialog-primary-button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .current-path {
    min-width: 0;
    overflow: hidden;
    color: #91a2bc;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-list {
    flex: 1 1 auto;
    min-height: 220px;
    overflow-y: auto;
    padding: 8px;
  }

  .entry-button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 42px;
    gap: 8px;
    border: 0;
    border-radius: 7px;
    padding: 0 10px;
    color: #c1cee2;
    background: transparent;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .entry-button:hover,
  .entry-button.entry-selected {
    color: #e4edfb;
    background: rgba(72, 125, 216, 0.2);
  }

  .entry-icon {
    width: 18px;
    color: #90baff;
    text-align: center;
  }

  .entry-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-kind {
    margin-left: auto;
    color: #7f90aa;
    font-size: 12px;
  }

  .dialog-message {
    display: grid;
    min-height: 180px;
    place-items: center;
    margin: 0;
    padding: 24px;
    color: #7f90aa;
    font-size: 13px;
    text-align: center;
  }

  .dialog-message--error {
    color: #ffabab;
  }

  .dialog-action-error {
    margin: 0 auto 0 0;
    color: #ffabab;
    font-size: 12px;
  }

  .dialog-footer {
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 18px;
    border-top: 1px solid rgba(154, 176, 210, 0.14);
  }

  .dialog-primary-button {
    border: 1px solid #6c9ff1;
    color: #08111f;
    background: #90baff;
  }

  .dialog-primary-button:hover:not(:disabled) {
    background: #b0ceff;
  }

  @media (max-width: 640px) {
    .files-content {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(180px, 3fr) minmax(120px, 7fr);
    }
  }

  .tabs button.active {
    color: #08111f;
    background: #90baff;
    box-shadow: 0 6px 18px rgba(55, 111, 205, 0.24);
  }
</style>
