<script lang="ts">
  import Button from "@/components/Button.svelte";

  type Props = {
    rootName: string | null;
    needsPermission: boolean;
    isBusy: boolean;
    actionMessage: string;
    onSelect: () => void | Promise<void>;
    onRequestPermission: () => void | Promise<void>;
  };

  let {
    rootName,
    needsPermission,
    isBusy,
    actionMessage,
    onSelect,
    onRequestPermission,
  }: Props = $props();
</script>

<div class="empty-state" aria-labelledby="root-title">
  <div class="file-icon" aria-hidden="true">⌂</div>
  <p class="eyebrow">Asset Manager</p>
  <h1 id="root-title">
    {needsPermission ? "需要访问资源目录" : "选择资源目录"}
  </h1>
  <p class="description">
    {#if needsPermission && rootName}
      已找到目录“{rootName}”，请重新授予访问权限后继续。
    {:else}
      选择游戏项目的 assets 目录，Asset Manager 将直接读取和修改其中的资源与
      manifest.json。
    {/if}
  </p>
  <div class="actions">
    {#if needsPermission}
      <Button size="large" disabled={isBusy} onclick={onRequestPermission}>
        {isBusy ? "授权中..." : "授予访问权限"}
      </Button>
    {/if}
    <Button
      type={needsPermission ? "info" : "primary"}
      size="large"
      disabled={isBusy}
      onclick={onSelect}
    >
      {isBusy ? "处理中..." : "选择资源目录"}
    </Button>
  </div>
  {#if actionMessage}
    <p class="action-message" role="alert">{actionMessage}</p>
  {/if}
</div>

<style>
  .empty-state {
    width: min(100%, 560px);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 32px;
    border: 1px solid rgba(154, 176, 210, 0.18);
    border-radius: 16px;
    background: rgba(19, 28, 43, 0.88);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
    text-align: center;
  }

  .file-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin-bottom: 24px;
    border: 1px solid rgba(119, 169, 255, 0.42);
    border-radius: 18px;
    color: #a8caff;
    background: rgba(72, 125, 216, 0.16);
    font-size: 32px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: #86a9db;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(24px, 5vw, 34px);
    line-height: 1.2;
  }

  .description {
    max-width: 420px;
    margin: 14px 0 28px;
    color: #a9b7cc;
    font-size: 15px;
    line-height: 1.65;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .action-message {
    max-width: 430px;
    margin: 22px 0 0;
    color: #ffabab;
    font-size: 13px;
    line-height: 1.55;
  }
</style>
