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

  .file-icon--error {
    border-color: rgba(255, 142, 142, 0.38);
    color: #ffabab;
    background: rgba(197, 75, 75, 0.14);
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
</style>
