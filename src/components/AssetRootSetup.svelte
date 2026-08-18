<script lang="ts">
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
      选择游戏项目的 assets 目录，Asset Manager 将直接读取和修改其中的资源与 manifest.json。
    {/if}
  </p>
  <div class="actions">
    {#if needsPermission}
      <button
        class="primary-button"
        type="button"
        onclick={onRequestPermission}
        disabled={isBusy}
      >
        {isBusy ? "授权中..." : "授予访问权限"}
      </button>
    {/if}
    <button
      class={needsPermission ? "secondary-button" : "primary-button"}
      type="button"
      onclick={onSelect}
      disabled={isBusy}
    >
      {isBusy ? "处理中..." : "选择资源目录"}
    </button>
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

  button {
    min-height: 44px;
    border-radius: 10px;
    padding: 0 18px;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition:
      border-color 160ms ease,
      background 160ms ease,
      transform 160ms ease,
      box-shadow 160ms ease;
  }

  button:focus-visible {
    outline: 3px solid rgba(137, 181, 255, 0.55);
    outline-offset: 3px;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  button:disabled {
    cursor: wait;
    opacity: 0.62;
  }

  .primary-button {
    border: 1px solid #6c9ff1;
    color: #08111f;
    background: #90baff;
    box-shadow: 0 8px 24px rgba(55, 111, 205, 0.28);
  }

  .primary-button:hover:not(:disabled) {
    background: #b0ceff;
    box-shadow: 0 10px 28px rgba(55, 111, 205, 0.38);
  }

  .secondary-button {
    border: 1px solid rgba(154, 176, 210, 0.3);
    color: #c1cee2;
    background: rgba(28, 41, 61, 0.72);
  }

  .secondary-button:hover:not(:disabled) {
    border-color: rgba(154, 176, 210, 0.56);
    background: rgba(39, 55, 80, 0.9);
  }

  .action-message {
    max-width: 430px;
    margin: 22px 0 0;
    color: #ffabab;
    font-size: 13px;
    line-height: 1.55;
  }
</style>
