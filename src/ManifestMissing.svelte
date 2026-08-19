<script lang="ts">
  import Button from "@/components/Button.svelte";

  type Props = {
    onCreate: () => void | Promise<void>;
    onReload: () => void | Promise<void>;
    onSelectRoot: () => void | Promise<void>;
    isCreating: boolean;
    isChecking: boolean;
    isSelectingRoot: boolean;
    actionMessage: string;
  };

  let {
    onCreate,
    onReload,
    onSelectRoot,
    isCreating,
    isChecking,
    isSelectingRoot,
    actionMessage,
  }: Props = $props();
</script>

<div class="empty-state" aria-labelledby="missing-title">
  <div class="file-icon" aria-hidden="true">
    <span>{"{}"}</span>
  </div>
  <p class="eyebrow">Asset Manager</p>
  <h1 id="missing-title">找不到 manifest.json</h1>
  <p class="description">创建 manifest 文件后，才能开始管理和预览项目资源。</p>
  <div class="actions">
    <Button
      size="large"
      disabled={isCreating || isChecking || isSelectingRoot}
      onclick={onCreate}
    >
      {isCreating ? "创建中..." : "创建 manifest 文件"}
    </Button>

    <Button
      type="info"
      size="large"
      disabled={isChecking || isCreating || isSelectingRoot}
      onclick={onReload}
    >
      {isChecking ? "检查中..." : "重新检查"}
    </Button>
    <Button
      type="info"
      size="large"
      disabled={isCreating || isChecking || isSelectingRoot}
      onclick={onSelectRoot}
    >
      {isSelectingRoot ? "选择中..." : "重新选择目录"}
    </Button>
  </div>
  {#if actionMessage}
    <p class="action-message" role="status">{actionMessage}</p>
  {/if}
</div>

<style>
  .empty-state {
    position: relative;
    width: min(calc(100% - 40px), 600px);
    text-align: center;
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
    font:
      700 25px/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
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
    max-width: 390px;
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
    color: var(--ink-soft);
    font-size: 13px;
    line-height: 1.55;
  }
</style>
