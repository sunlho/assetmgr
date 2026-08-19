<script lang="ts">
  import AppearanceResources from "@/ability/AppearanceResources.svelte";
  import FileResources from "@/ability/FileResources.svelte";
  import LocalizationResources from "@/ability/LocalizationResources.svelte";
  import MapResources from "@/ability/MapResources.svelte";
  import type { AssetFileSystem } from "@/utils/filesystem";
  import "@/ability/resource-tabs.css";

  type ResourceTabId = "files" | "localization" | "appearances" | "maps";

  type ResourceTab = {
    id: ResourceTabId;
    label: string;
    index: string;
    description: string;
  };

  type LocalizationData = {
    path: string;
    catalogs: string[];
    languages: {
      tag: string;
      displayName: string;
      path: string;
    }[];
  };

  type Props = {
    root: AssetFileSystem;
    files: string[];
    appearances: string[];
    localizationData: LocalizationData | null;
    onManifestChanged: () => void | Promise<void>;
  };

  let { root, files, appearances, localizationData, onManifestChanged }: Props =
    $props();

  const tabs: ResourceTab[] = [
    { id: "files", label: "文件资源", index: "01", description: "Files" },
    {
      id: "localization",
      label: "国际化资源",
      index: "02",
      description: "Localization",
    },
    {
      id: "appearances",
      label: "角色资源",
      index: "03",
      description: "Appearances",
    },
    { id: "maps", label: "地图资源", index: "04", description: "Maps" },
  ];

  let activeTab = $state<ResourceTabId>("files");
  let localizationHasUnsavedChanges = $state(false);

  const switchTab = (tabId: ResourceTabId) => {
    if (
      activeTab === "localization" &&
      tabId !== "localization" &&
      localizationHasUnsavedChanges &&
      !window.confirm("当前有未保存的国际化文本，确定放弃修改并切换吗？")
    ) {
      return;
    }
    activeTab = tabId;
  };

  const handleLocalizationUnsavedChanges = (dirty: boolean) => {
    localizationHasUnsavedChanges = dirty;
  };

  const resourceCount = (tabId: ResourceTabId) => {
    if (tabId === "files") return files.length;
    if (tabId === "localization") return localizationData?.catalogs.length ?? 0;
    if (tabId === "appearances") return appearances.length;
    return 0;
  };

  const activeTabData = $derived(tabs.find((tab) => tab.id === activeTab)!);
</script>

<main class="ready-state">
  <aside class="workspace-nav">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">A</div>
      <div>
        <strong>Asset Manager</strong>
        <span>Project workspace</span>
      </div>
    </div>

    <p class="nav-label">资源浏览器</p>
    <div class="tabs" role="tablist" aria-label="Manifest 资源分类">
      {#each tabs as tab}
        <button
          id={tab.id + "-tab"}
          class:active={activeTab === tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={tab.id + "-panel"}
          onclick={() => switchTab(tab.id)}
        >
          <span class="tab-index">{tab.index}</span>
          <span class="tab-copy">
            <strong>{tab.label}</strong>
            <small>{tab.description}</small>
          </span>
          <span class="tab-count">{resourceCount(tab.id)}</span>
        </button>
      {/each}
    </div>

    <div class="root-status">
      <span class="status-dot" aria-hidden="true"></span>
      <div>
        <small>当前资源目录</small>
        <strong>{root.name}</strong>
      </div>
    </div>
  </aside>

  <section class="workspace-main">
    <header class="workspace-header">
      <div>
        <p>Manifest / {activeTabData.description}</p>
        <h1>{activeTabData.label}</h1>
      </div>
      <div class="manifest-badge">
        <span aria-hidden="true"></span>
        manifest.json 已连接
      </div>
    </header>

    <div class="workspace-stage">
      {#if activeTab === "files"}
        <FileResources {root} {files} {onManifestChanged} />
      {:else if activeTab === "localization"}
        <LocalizationResources
          {root}
          localizationPath={localizationData?.path ?? null}
          catalogs={localizationData?.catalogs ?? []}
          languages={localizationData?.languages ?? []}
          onUnsavedChanges={handleLocalizationUnsavedChanges}
          onLocalizationChanged={onManifestChanged}
        />
      {:else if activeTab === "appearances"}
        <AppearanceResources {root} {appearances} />
      {:else}
        <MapResources />
      {/if}
    </div>
  </section>
</main>

<style>
  .ready-state {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: grid;
    grid-template-columns: 228px minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
    background: var(--canvas);
  }

  .workspace-nav {
    display: flex;
    min-height: 0;
    flex-direction: column;
    padding: 18px 14px 14px;
    border-radius: 13px;
    color: #f7f4ec;
    background: var(--nav);
    box-shadow: 0 12px 34px rgba(23, 32, 29, 0.18);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 2px 4px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .brand-mark {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 9px;
    color: #fff;
    background: var(--accent);
    font: 800 18px/1 Georgia, serif;
    transform: rotate(-2deg);
  }

  .brand strong,
  .brand span {
    display: block;
  }

  .brand strong {
    font-size: 13px;
    letter-spacing: 0.01em;
  }

  .brand span {
    margin-top: 3px;
    color: #8f9e97;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nav-label {
    margin: 22px 8px 9px;
    color: #718079;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .tabs {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .tabs button {
    position: relative;
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    min-height: 57px;
    gap: 8px;
    border: 0;
    border-radius: 9px;
    padding: 8px 9px;
    color: #aab7b1;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      color 140ms ease,
      background 140ms ease,
      transform 140ms ease;
  }

  .tabs button:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.055);
  }

  .tabs button:focus-visible {
    outline: 2px solid #ff9368;
    outline-offset: -2px;
  }

  .tabs button.active {
    color: #fff;
    background: var(--nav-raised);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .tab-index {
    color: #65736d;
    font: 600 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .tabs button.active .tab-index {
    color: #ff9368;
  }

  .tab-copy strong,
  .tab-copy small {
    display: block;
  }

  .tab-copy strong {
    font-size: 12px;
    font-weight: 650;
  }

  .tab-copy small {
    margin-top: 3px;
    color: #68766f;
    font-size: 9px;
    letter-spacing: 0.04em;
  }

  .tabs button.active .tab-copy small {
    color: #93a19b;
  }

  .tab-count {
    display: grid;
    min-width: 23px;
    height: 23px;
    place-items: center;
    border-radius: 999px;
    color: #78867f;
    background: rgba(255, 255, 255, 0.06);
    font-size: 9px;
  }

  .tabs button.active .tab-count {
    color: #fff;
    background: rgba(232, 101, 50, 0.2);
  }

  .root-status {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    margin-top: auto;
    padding: 12px 8px 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4fc18a;
    box-shadow: 0 0 0 4px rgba(79, 193, 138, 0.11);
  }

  .root-status small,
  .root-status strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .root-status small {
    color: #718079;
    font-size: 8px;
  }

  .root-status strong {
    margin-top: 3px;
    color: #cbd4d0;
    font-size: 10px;
    font-weight: 600;
  }

  .workspace-main {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
  }

  .workspace-header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    min-height: 78px;
    gap: 24px;
    padding: 8px 10px 14px;
  }

  .workspace-header p {
    margin: 0 0 3px;
    color: var(--ink-faint);
    font-size: 9px;
    font-weight: 650;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .workspace-header h1 {
    margin: 0;
    color: var(--ink);
    font-size: 23px;
    font-weight: 730;
    letter-spacing: -0.035em;
  }

  .manifest-badge {
    display: flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 10px;
    color: var(--ink-soft);
    background: rgba(255, 255, 255, 0.55);
    font-size: 10px;
  }

  .manifest-badge span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
  }

  .workspace-stage {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0 2px 2px;
  }

  @media (max-width: 980px) {
    .ready-state {
      grid-template-columns: 190px minmax(0, 1fr);
    }

    .workspace-nav {
      padding-inline: 10px;
    }

    .brand span,
    .tab-copy small {
      display: none;
    }
  }
</style>
