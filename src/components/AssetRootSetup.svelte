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
    position: relative;
    width: min(calc(100% - 40px), 600px);
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    padding: 54px 38px 48px;
    border: 1px solid var(--line);
    border-radius: 16px;
    color: var(--ink);
    background: var(--surface-raised);
    box-shadow: var(--shadow-md);
    text-align: center;
  }

  .file-icon {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin-bottom: 24px;
    border: 0;
    border-radius: 16px;
    color: #fff;
    background: var(--nav);
    box-shadow: inset -8px -8px 0 rgba(255, 255, 255, 0.035);
    font-size: 30px;
  }

  .eyebrow {
    margin: 0 0 10px;
    color: var(--accent-strong);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    color: var(--ink);
    font-size: clamp(25px, 5vw, 34px);
    letter-spacing: -0.035em;
    line-height: 1.2;
  }

  .description {
    max-width: 420px;
    margin: 14px 0 28px;
    color: var(--ink-soft);
    font-size: 14px;
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
    color: var(--danger);
    font-size: 13px;
    line-height: 1.55;
  }
</style>
