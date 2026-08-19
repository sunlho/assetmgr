<script lang="ts">
  import { onMount } from "svelte";
  import type { AssetEntry, AssetFileSystem } from "@/utils/filesystem";
  import Button from "@/components/Button.svelte";

  type Props = {
    root: AssetFileSystem;
    onClose: () => void;
    onImported: (file: string) => void | Promise<void>;
  };

  let { root, onClose, onImported }: Props = $props();

  let importPath = $state("");
  let importEntries = $state<AssetEntry[]>([]);
  let selectedImportPath = $state<string | null>(null);
  let isLoadingEntries = $state(false);
  let entriesError = $state("");
  let isAddingToManifest = $state(false);
  let importActionError = $state("");

  const loadImportEntries = async (path: string) => {
    isLoadingEntries = true;
    entriesError = "";
    try {
      const response = await root.listEntries(path);
      importPath = response.path;
      importEntries = response.entries;
    } catch {
      importEntries = [];
      entriesError = "无法读取资源列表，请稍后重试。";
    } finally {
      isLoadingEntries = false;
    }
  };

  const closeDialog = () => {
    if (isAddingToManifest) {
      return;
    }
    onClose();
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
      await root.editManifestFile(file, "add");
      isAddingToManifest = false;
      onClose();
      await onImported(file);
    } catch {
      importActionError = "无法将文件添加到 manifest.files，请稍后重试。";
    } finally {
      isAddingToManifest = false;
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isAddingToManifest && event.key === "Escape") {
      closeDialog();
    }
  };

  const closeOnBackdrop = (event: MouseEvent) => {
    if (!isAddingToManifest && event.target === event.currentTarget) {
      closeDialog();
    }
  };

  onMount(() => {
    void loadImportEntries("");
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="modal-backdrop" role="presentation" onclick={closeOnBackdrop}>
  <div class="import-dialog" aria-labelledby="import-dialog-title">
    <header class="dialog-header">
      <h2 id="import-dialog-title">选择文件</h2>
      <button
        class="dialog-close-button"
        type="button"
        aria-label="关闭"
        onclick={closeDialog}
        disabled={isAddingToManifest}
      >
        ×
      </button>
    </header>

    <div class="dialog-toolbar">
      <Button
        type="info"
        disabled={!importPath || isLoadingEntries || isAddingToManifest}
        onclick={parentImportPath}
      >
        返回上级
      </Button>
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

      <Button type="info" disabled={isAddingToManifest} onclick={closeDialog}>
        取消
      </Button>
      <Button
        type="primary"
        disabled={!selectedImportPath || isLoadingEntries || isAddingToManifest}
        onclick={confirmImportSelection}
      >
        {isAddingToManifest ? "导入中..." : "导入文件"}
      </Button>
    </footer>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(23, 32, 29, 0.62);
    backdrop-filter: blur(7px);
  }

  .import-dialog {
    display: flex;
    flex-direction: column;
    width: min(100%, 680px);
    height: min(80%, 680px);
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    color: var(--ink);
    background: var(--surface);
    box-shadow: 0 28px 90px rgba(17, 23, 21, 0.28);
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
    padding: 17px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-raised);
  }

  .dialog-header h2 {
    margin: 0;
    color: var(--ink);
    font-size: 17px;
    letter-spacing: -0.02em;
  }

  .dialog-close-button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    color: var(--ink-faint);
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .dialog-close-button:hover {
    color: var(--ink);
    background: var(--surface-muted);
  }

  .dialog-close-button:disabled,
  .entry-button:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  .dialog-toolbar {
    gap: 12px;
    padding: 11px 20px;
    border-bottom: 1px solid var(--line);
    background: #f7f4ed;
  }

  .current-path {
    min-width: 0;
    overflow: hidden;
    color: var(--ink-soft);
    font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-list {
    flex: 1 1 auto;
    min-height: 220px;
    overflow-y: auto;
    padding: 10px;
    background: var(--surface-raised);
  }

  .entry-button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 44px;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    padding: 0 11px;
    color: var(--ink-soft);
    background: transparent;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .entry-button:hover,
  .entry-button.entry-selected {
    color: var(--accent-strong);
    background: var(--accent-soft);
  }

  .entry-icon {
    width: 18px;
    color: var(--accent);
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
    color: var(--ink-faint);
    font-size: 12px;
  }

  .dialog-message {
    display: grid;
    min-height: 180px;
    place-items: center;
    margin: 0;
    padding: 24px;
    color: var(--ink-faint);
    font-size: 13px;
    text-align: center;
  }

  .dialog-message--error {
    color: var(--danger);
  }

  .dialog-action-error {
    margin: 0 auto 0 0;
    color: var(--danger);
    font-size: 12px;
  }

  .dialog-footer {
    justify-content: flex-end;
    gap: 10px;
    padding: 12px 20px;
    border-top: 1px solid var(--line);
    background: #f7f4ed;
  }
</style>
