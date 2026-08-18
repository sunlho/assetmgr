<script lang="ts">
  type Props = {
    onCreate: () => void | Promise<void>;
    onReload: () => void | Promise<void>;
    isCreating: boolean;
    isChecking: boolean;
    actionMessage: string;
  };

  let { onCreate, onReload, isCreating, isChecking, actionMessage }: Props =
    $props();
</script>

<main class="empty-state" aria-labelledby="missing-title">
  <div class="file-icon" aria-hidden="true">
    <span>{"{}"}</span>
  </div>
  <p class="eyebrow">Asset Manager</p>
  <h1 id="missing-title">找不到 manifest.json</h1>
  <p class="description">创建 manifest 文件后，才能开始管理和预览项目资源。</p>
  <div class="actions">
    <button
      class="primary-button"
      type="button"
      onclick={onCreate}
      disabled={isCreating}
    >
      <span aria-hidden="true">+</span>
      {isCreating ? "创建中..." : "创建 manifest 文件"}
    </button>
    <button
      class="secondary-button"
      type="button"
      onclick={onReload}
      disabled={isChecking || isCreating}
    >
      {isChecking ? "检查中..." : "重新检查"}
    </button>
  </div>
  {#if actionMessage}
    <p class="action-message" role="status">{actionMessage}</p>
  {/if}
</main>

<style>
  .empty-state {
    width: min(100%, 560px);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 32px;
    border: 1px solid rgba(154, 176, 210, 0.18);
    border-radius: 16px;
    background: rgba(19, 28, 43, 0.88);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
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
    font:
      700 25px/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
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
    max-width: 390px;
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

  .primary-button span {
    margin-right: 7px;
    font-size: 19px;
    font-weight: 400;
    vertical-align: -1px;
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
    color: #9db6d8;
    font-size: 13px;
    line-height: 1.55;
  }
</style>
