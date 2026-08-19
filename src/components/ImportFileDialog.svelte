<script lang="ts">
  import { onMount } from "svelte";
  import type { AssetEntry, AssetFileSystem } from "@/utils/filesystem";
  import Button from "@/components/Button.svelte";

  type Props = {
    root: AssetFileSystem;
    onClose: () => void;
    onImported: (files: string[]) => void | Promise<void>;
  };

  let { root, onClose, onImported }: Props = $props();

  let importPath = $state("");
  let importEntries = $state<AssetEntry[]>([]);
  let selectedEntries = $state<AssetEntry[]>([]);
  let isLoadingEntries = $state(false);
  let entriesError = $state("");
  let isAddingToManifest = $state(false);
  let importActionError = $state("");

  const selectedSize = $derived(
    selectedEntries.reduce((total, entry) => total + (entry.size ?? 0), 0),
  );

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

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
    if (!isAddingToManifest) onClose();
  };

  const isSelected = (path: string) =>
    selectedEntries.some((entry) => entry.path === path);

  const toggleImportEntry = (entry: AssetEntry) => {
    if (entry.directory) {
      void loadImportEntries(entry.path);
      return;
    }

    selectedEntries = isSelected(entry.path)
      ? selectedEntries.filter((selected) => selected.path !== entry.path)
      : [...selectedEntries, entry];
    importActionError = "";
  };

  const removeSelectedEntry = (path: string) => {
    selectedEntries = selectedEntries.filter((entry) => entry.path !== path);
  };

  const parentImportPath = () => {
    if (!importPath) return;
    const parts = importPath.split("/").filter(Boolean);
    parts.pop();
    void loadImportEntries(parts.join("/"));
  };

  const confirmImportSelection = async () => {
    if (selectedEntries.length === 0) return;

    const files = selectedEntries.map((entry) => entry.path);
    isAddingToManifest = true;
    importActionError = "";
    try {
      await root.editManifestFiles(files, "add");
      isAddingToManifest = false;
      onClose();
      await onImported(files);
    } catch {
      importActionError = "无法将所选文件添加到 manifest.files，请稍后重试。";
    } finally {
      isAddingToManifest = false;
    }
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (!isAddingToManifest && event.key === "Escape") closeDialog();
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
  <div
    class="import-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-dialog-title"
  >
    <header class="dialog-header">
      <div>
        <h2 id="import-dialog-title">添加文件资源</h2>
        <p>从资源目录中选择一个或多个文件</p>
      </div>
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

    <div class="dialog-content">
      <section class="browser-pane" aria-label="资源目录">
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
                class:entry-selected={isSelected(entry.path)}
                class:entry-directory={entry.directory}
                type="button"
                aria-pressed={entry.directory ? undefined : isSelected(entry.path)}
                disabled={isAddingToManifest}
                onclick={() => toggleImportEntry(entry)}
              >
                {#if entry.directory}
                  <span class="entry-icon folder-icon" aria-hidden="true"></span>
                {:else}
                  <span class="selection-check" aria-hidden="true">
                    {isSelected(entry.path) ? "✓" : ""}
                  </span>
                {/if}
                <span class="entry-copy">
                  <span class="entry-name">{entry.name}</span>
                  {#if !entry.directory && entry.size !== undefined}
                    <small>{formatSize(entry.size)}</small>
                  {/if}
                </span>
                {#if entry.directory}
                  <span class="entry-kind">打开</span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
      </section>

      <aside class="selection-pane" aria-label="已选择的文件">
        <header class="selection-header">
          <div>
            <span>已选择</span>
            <small>{selectedEntries.length} 个文件</small>
          </div>
          {#if selectedEntries.length > 0}
            <button
              class="clear-button"
              type="button"
              disabled={isAddingToManifest}
              onclick={() => (selectedEntries = [])}
            >
              清空
            </button>
          {/if}
        </header>

        <div class="selection-list">
          {#if selectedEntries.length === 0}
            <div class="selection-empty">
              <div aria-hidden="true">+</div>
              <strong>尚未选择文件</strong>
              <span>在左侧单击文件，可连续选择多个条目。</span>
            </div>
          {:else}
            {#each selectedEntries as entry, index}
              <article class="selected-item">
                <span class="selected-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{entry.name}</strong>
                  <span>{entry.path}</span>
                </div>
                <button
                  type="button"
                  aria-label={`移除 ${entry.name}`}
                  disabled={isAddingToManifest}
                  onclick={() => removeSelectedEntry(entry.path)}
                >
                  ×
                </button>
              </article>
            {/each}
          {/if}
        </div>

        <footer class="selection-summary">
          <span>总计</span>
          <strong>{formatSize(selectedSize)}</strong>
        </footer>
      </aside>
    </div>

    <footer class="dialog-footer">
      {#if importActionError}
        <p class="dialog-action-error" role="alert">{importActionError}</p>
      {:else}
        <p class="dialog-hint">所选文件只会加入 manifest，不会被移动或复制。</p>
      {/if}

      <Button type="info" disabled={isAddingToManifest} onclick={closeDialog}>
        取消
      </Button>
      <Button
        type="primary"
        disabled={selectedEntries.length === 0 ||
          isLoadingEntries ||
          isAddingToManifest}
        onclick={confirmImportSelection}
      >
        {isAddingToManifest
          ? "添加中..."
          : selectedEntries.length > 0
            ? `添加 ${selectedEntries.length} 个文件`
            : "添加文件"}
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
    width: min(100%, 920px);
    height: min(84vh, 720px);
    min-height: 480px;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 15px;
    color: var(--ink);
    background: var(--surface);
    box-shadow: 0 28px 90px rgba(17, 23, 21, 0.28);
  }

  .dialog-header,
  .dialog-toolbar,
  .dialog-footer {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
  }

  .dialog-header {
    justify-content: space-between;
    min-height: 74px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-raised);
  }

  .dialog-header h2 {
    margin: 0;
    color: var(--ink);
    font-size: 17px;
    letter-spacing: -0.02em;
  }

  .dialog-header p {
    margin: 4px 0 0;
    color: var(--ink-faint);
    font-size: 10px;
  }

  .dialog-close-button {
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 8px;
    color: var(--ink-faint);
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .dialog-close-button:hover:not(:disabled) {
    color: var(--ink);
    background: var(--surface-muted);
  }

  .dialog-close-button:disabled,
  .entry-button:disabled,
  .selected-item button:disabled,
  .clear-button:disabled {
    cursor: wait;
    opacity: 0.48;
  }

  .dialog-content {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(270px, 0.78fr);
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .browser-pane,
  .selection-pane {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .browser-pane {
    border-right: 1px solid var(--line);
    background: var(--surface-raised);
  }

  .dialog-toolbar {
    gap: 12px;
    min-height: 57px;
    padding: 10px 14px;
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

  .entry-list,
  .selection-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }

  .entry-list {
    padding: 8px;
  }

  .entry-button {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 48px;
    gap: 10px;
    border: 0;
    border-radius: 8px;
    padding: 5px 10px;
    color: var(--ink-soft);
    background: transparent;
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .entry-button:hover:not(:disabled) {
    color: var(--ink);
    background: var(--surface-muted);
  }

  .entry-button.entry-selected {
    color: var(--accent-strong);
    background: var(--accent-soft);
  }

  .entry-button:focus-visible,
  .dialog-close-button:focus-visible,
  .clear-button:focus-visible,
  .selected-item button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .selection-check,
  .folder-icon {
    display: grid;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
    place-items: center;
  }

  .selection-check {
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    color: #fff;
    font-size: 11px;
  }

  .entry-selected .selection-check {
    border-color: var(--accent);
    background: var(--accent);
  }

  .folder-icon {
    position: relative;
    width: 21px;
    height: 15px;
    border-radius: 3px;
    background: #d6a343;
  }

  .folder-icon::before {
    position: absolute;
    top: -4px;
    left: 2px;
    width: 9px;
    height: 5px;
    border-radius: 3px 3px 0 0;
    background: #d6a343;
    content: "";
  }

  .entry-copy {
    min-width: 0;
  }

  .entry-name,
  .entry-copy small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-copy small {
    margin-top: 3px;
    color: var(--ink-faint);
    font-size: 9px;
  }

  .entry-kind {
    margin-left: auto;
    color: var(--ink-faint);
    font-size: 9px;
  }

  .dialog-message {
    display: grid;
    min-height: 180px;
    place-items: center;
    margin: 0;
    padding: 24px;
    color: var(--ink-faint);
    font-size: 12px;
    text-align: center;
  }

  .dialog-message--error,
  .dialog-action-error {
    color: var(--danger);
  }

  .selection-pane {
    background: #f2efe7;
  }

  .selection-header {
    display: flex;
    min-height: 57px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--line);
  }

  .selection-header span,
  .selection-header small {
    display: block;
  }

  .selection-header span {
    color: var(--ink);
    font-size: 11px;
    font-weight: 720;
  }

  .selection-header small {
    margin-top: 2px;
    color: var(--ink-faint);
    font-size: 9px;
  }

  .clear-button {
    border: 0;
    padding: 5px;
    color: var(--accent-strong);
    background: transparent;
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }

  .selection-list {
    padding: 8px;
  }

  .selection-empty {
    display: flex;
    height: 100%;
    min-height: 220px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }

  .selection-empty div {
    display: grid;
    width: 38px;
    height: 38px;
    margin-bottom: 12px;
    place-items: center;
    border: 1px dashed var(--line-strong);
    border-radius: 10px;
    color: var(--ink-faint);
    font-size: 20px;
  }

  .selection-empty strong {
    color: var(--ink-soft);
    font-size: 11px;
  }

  .selection-empty span {
    max-width: 190px;
    margin-top: 6px;
    color: var(--ink-faint);
    font-size: 9px;
    line-height: 1.6;
  }

  .selected-item {
    display: grid;
    grid-template-columns: 25px minmax(0, 1fr) 25px;
    align-items: center;
    gap: 7px;
    margin-bottom: 6px;
    padding: 9px 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }

  .selected-index {
    color: var(--accent);
    font: 650 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .selected-item strong,
  .selected-item div span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-item strong {
    color: var(--ink);
    font-size: 10px;
    font-weight: 650;
  }

  .selected-item div span {
    margin-top: 3px;
    color: var(--ink-faint);
    font-size: 8px;
  }

  .selected-item button {
    width: 25px;
    height: 25px;
    border: 0;
    border-radius: 6px;
    color: var(--ink-faint);
    background: transparent;
    font-size: 16px;
    cursor: pointer;
  }

  .selected-item button:hover:not(:disabled) {
    color: var(--danger);
    background: var(--danger-soft);
  }

  .selection-summary {
    display: flex;
    min-height: 42px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    border-top: 1px solid var(--line);
    color: var(--ink-faint);
    font-size: 9px;
  }

  .selection-summary strong {
    color: var(--ink-soft);
    font: 650 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .dialog-footer {
    justify-content: flex-end;
    min-height: 64px;
    gap: 10px;
    padding: 11px 20px;
    border-top: 1px solid var(--line);
    background: #f7f4ed;
  }

  .dialog-action-error,
  .dialog-hint {
    margin: 0 auto 0 0;
    font-size: 10px;
  }

  .dialog-hint {
    color: var(--ink-faint);
  }

  @media (max-width: 720px) {
    .modal-backdrop {
      padding: 12px;
    }

    .import-dialog {
      height: calc(100vh - 24px);
    }

    .dialog-content {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(240px, 1fr) minmax(180px, 0.7fr);
    }

    .browser-pane {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }

    .dialog-hint {
      display: none;
    }
  }
</style>
