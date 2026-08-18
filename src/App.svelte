<script lang="ts">
  import { onMount } from "svelte";
  import AssetRootSetup from "./components/AssetRootSetup.svelte";
  import ManifestError from "./components/ManifestError.svelte";
  import ManifestMissing from "./components/ManifestMissing.svelte";
  import ManifestReady from "./components/ManifestReady.svelte";
  import {
    AssetFileError,
    type AssetFileSystem,
    pickAssetFileSystem,
    restoreAssetFileSystem,
  } from "./filesystem";

  type RootStatus = "loading" | "missing" | "permission" | "ready" | "error";
  type ManifestStatus = "loading" | "ready" | "missing" | "error";
  type Manifest = {
    files?: unknown;
  };

  let rootStatus = $state<RootStatus>("loading");
  let assetFileSystem = $state<AssetFileSystem | null>(null);
  let rootActionMessage = $state("");
  let isSelectingRoot = $state(false);
  let manifestStatus = $state<ManifestStatus>("loading");
  let actionMessage = $state("");
  let isChecking = $state(false);
  let isCreating = $state(false);
  let manifestFiles = $state<string[]>([]);

  const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof AssetFileError ? error.message : fallback;

  const loadManifest = async () => {
    if (!assetFileSystem) {
      return;
    }

    isChecking = true;
    actionMessage = "";

    try {
      const manifest = (await assetFileSystem.readManifest()) as Manifest;
      manifestFiles = Array.isArray(manifest.files)
        ? manifest.files.filter(
            (file): file is string => typeof file === "string",
          )
        : [];
      manifestStatus = "ready";
    } catch (error) {
      manifestFiles = [];
      manifestStatus =
        error instanceof AssetFileError && error.code === "not-found"
          ? "missing"
          : "error";
      actionMessage = getErrorMessage(
        error,
        "无法读取 manifest.json，请确认资源目录仍然可访问。",
      );
    } finally {
      isChecking = false;
    }
  };

  const selectRoot = async () => {
    isSelectingRoot = true;
    rootActionMessage = "";
    try {
      const selected = await pickAssetFileSystem();
      if (!selected) {
        return;
      }
      assetFileSystem = selected;
      rootStatus = "ready";
      manifestStatus = "loading";
      await loadManifest();
    } catch (error) {
      rootStatus = "error";
      rootActionMessage = getErrorMessage(
        error,
        "无法访问所选资源目录，请稍后重试。",
      );
    } finally {
      isSelectingRoot = false;
    }
  };

  const requestRootPermission = async () => {
    if (!assetFileSystem) {
      await selectRoot();
      return;
    }

    isSelectingRoot = true;
    rootActionMessage = "";
    try {
      const permission = await assetFileSystem.requestWritePermission();
      if (permission !== "granted") {
        rootActionMessage = "未获得资源目录的读写权限。";
        rootStatus = "permission";
        return;
      }
      rootStatus = "ready";
      manifestStatus = "loading";
      await loadManifest();
    } catch (error) {
      rootActionMessage = getErrorMessage(
        error,
        "无法重新获得资源目录权限，请重新选择目录。",
      );
      rootStatus = "permission";
    } finally {
      isSelectingRoot = false;
    }
  };

  const restoreRoot = async () => {
    try {
      const restored = await restoreAssetFileSystem();
      if (!restored) {
        rootStatus = "missing";
        return;
      }

      assetFileSystem = restored;
      if ((await restored.queryWritePermission()) !== "granted") {
        rootStatus = "permission";
        return;
      }

      rootStatus = "ready";
      await loadManifest();
    } catch (error) {
      rootStatus = "error";
      rootActionMessage = getErrorMessage(
        error,
        "无法恢复上次使用的资源目录，请重新选择目录。",
      );
    }
  };

  const createManifest = async () => {
    if (!assetFileSystem) {
      return;
    }

    isCreating = true;
    actionMessage = "";

    try {
      await assetFileSystem.createManifest();
      await loadManifest();
    } catch (error) {
      actionMessage =
        error instanceof AssetFileError && error.code === "already-exists"
          ? "manifest.json 已存在，请点击“重新检查”。"
          : getErrorMessage(error, "创建 manifest.json 失败，请稍后重试。");
    } finally {
      isCreating = false;
    }
  };

  onMount(() => {
    void restoreRoot();
  });
</script>

<svelte:head>
  <title>Asset Manager</title>
</svelte:head>

<div class="app">
  {#if rootStatus === "loading"}
    <div class="state-panel" aria-live="polite">
      <span class="loader" aria-hidden="true"></span>
      <p>正在恢复资源目录...</p>
    </div>
  {:else if rootStatus === "missing" || rootStatus === "permission" || rootStatus === "error"}
    <AssetRootSetup
      rootName={assetFileSystem?.name ?? null}
      needsPermission={rootStatus === "permission"}
      isBusy={isSelectingRoot}
      actionMessage={rootActionMessage}
      onSelect={selectRoot}
      onRequestPermission={requestRootPermission}
    />
  {:else if manifestStatus === "loading"}
    <div class="state-panel" aria-live="polite">
      <span class="loader" aria-hidden="true"></span>
      <p>正在检查 manifest.json...</p>
    </div>
  {:else if manifestStatus === "ready" && assetFileSystem}
    <ManifestReady
      root={assetFileSystem}
      files={manifestFiles}
      onManifestChanged={loadManifest}
    />
  {:else if manifestStatus === "missing"}
    <ManifestMissing
      onCreate={createManifest}
      onReload={loadManifest}
      onSelectRoot={selectRoot}
      {isCreating}
      {isChecking}
      {isSelectingRoot}
      {actionMessage}
    />
  {:else}
    <ManifestError onRetry={loadManifest} {isChecking} />
  {/if}
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    background: #0c111b;
    color: #f3f6fb;
  }

  :global(html),
  :global(body),
  :global(#app) {
    height: 100%;
    overflow: hidden;
  }

  .app {
    height: 100vh;
    min-height: 100vh;
    min-width: 0;
    display: grid;
    place-items: center;
    padding: 32px 20px;
    overflow: hidden;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    background: radial-gradient(
        circle at 50% -20%,
        rgba(63, 104, 184, 0.2),
        transparent 48%
      ),
      #0c111b;
  }

  .state-panel {
    width: min(100%, 560px);
    text-align: center;
  }

  .state-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: #a9b7cc;
  }

  .state-panel p {
    margin: 0;
  }

  .loader {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(144, 186, 255, 0.2);
    border-top-color: #90baff;
    border-radius: 50%;
    animation: spin 800ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
