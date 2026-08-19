<script lang="ts">
  import Button from "@/components/Button.svelte";

  type Props = {
    onRetry: () => void | Promise<void>;
    isChecking: boolean;
  };

  let { onRetry, isChecking }: Props = $props();
</script>

<div class="empty-state" aria-labelledby="error-title">
  <div class="file-icon file-icon--error" aria-hidden="true">!</div>
  <p class="eyebrow">Asset Manager</p>
  <h1 id="error-title">暂时无法检查 manifest.json</h1>
  <p class="description">请确认资源服务正在运行，然后重试。</p>
  <Button size="large" disabled={isChecking} onclick={onRetry}>
    {isChecking ? "检查中..." : "重新检查"}
  </Button>
</div>

<style>
  .empty-state {
    width: min(calc(100% - 40px), 600px);
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
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
    font:
      700 25px/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
  }

  .file-icon--error {
    color: #fff;
    background: var(--danger);
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
</style>
