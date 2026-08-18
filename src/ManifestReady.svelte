<script lang="ts">
  import AppearanceResources from "./ability/AppearanceResources.svelte";
  import FileResources from "./ability/FileResources.svelte";
  import LocalizationResources from "./ability/LocalizationResources.svelte";
  import MapResources from "./ability/MapResources.svelte";
  import type { AssetFileSystem } from "./utils/filesystem";
  import "./ability/resource-tabs.css";

  type ResourceTabId = "files" | "localization" | "appearances" | "maps";

  type ResourceTab = {
    id: ResourceTabId;
    label: string;
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
    { id: "files", label: "文件资源" },
    { id: "localization", label: "国际化资源" },
    { id: "appearances", label: "角色资源" },
    { id: "maps", label: "地图资源" },
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
</script>

<main class="ready-state">
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
        {tab.label}
      </button>
    {/each}
  </div>

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
</main>

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

  .tabs button.active {
    color: #08111f;
    background: #90baff;
    box-shadow: 0 6px 18px rgba(55, 111, 205, 0.24);
  }
</style>
