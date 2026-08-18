<script lang="ts">
  import { onMount } from "svelte";
  import { createManifestApi, getContentApi } from "./api";
  import ManifestError from "./components/ManifestError.svelte";
  import ManifestMissing from "./components/ManifestMissing.svelte";
  import ManifestReady from "./components/ManifestReady.svelte";

  type ManifestStatus = "loading" | "ready" | "missing" | "error";
  type Manifest = {
    files?: unknown;
  };

  let manifestStatus = $state<ManifestStatus>("loading");
  let actionMessage = $state("");
  let isChecking = $state(false);
  let isCreating = $state(false);
  let manifestFiles = $state<string[]>([]);

  const getResponseStatus = (error: unknown) =>
    error && typeof error === "object" && "response" in error
      ? (error.response as { status?: number } | undefined)?.status
      : undefined;

  const loadManifest = async () => {
    isChecking = true;
    actionMessage = "";

    try {
      const response = await getContentApi("manifest.json");
      const manifest = response.data as Manifest;
      manifestFiles = Array.isArray(manifest.files)
        ? manifest.files.filter(
            (file): file is string => typeof file === "string",
          )
        : [];
      manifestStatus = "ready";
    } catch (error) {
      manifestFiles = [];
      const status = getResponseStatus(error);
      manifestStatus = status === 404 ? "missing" : "error";
    } finally {
      isChecking = false;
    }
  };

  const createManifest = async () => {
    isCreating = true;
    actionMessage = "";

    try {
      await createManifestApi();
      await loadManifest();
    } catch (error) {
      const status = getResponseStatus(error);
      actionMessage =
        status === 409
          ? "manifest.json 已存在，请点击“重新检查”。"
          : "创建 manifest.json 失败，请确认资源服务正在运行，然后重试。";
    } finally {
      isCreating = false;
    }
  };

  onMount(() => {
    loadManifest();
  });
</script>

<svelte:head>
  <title>Asset Manager</title>
</svelte:head>

<div class="app">
  {#if manifestStatus === "loading"}
    <div class="state-panel" aria-live="polite">
      <span class="loader" aria-hidden="true"></span>
      <p>正在检查 manifest.json...</p>
    </div>
  {:else if manifestStatus === "ready"}
    <ManifestReady files={manifestFiles} onManifestChanged={loadManifest} />
  {:else if manifestStatus === "missing"}
    <ManifestMissing
      onCreate={createManifest}
      onReload={loadManifest}
      {isCreating}
      {isChecking}
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
