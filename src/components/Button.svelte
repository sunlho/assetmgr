<script lang="ts">
  import type { Snippet } from "svelte";
  import type { DOMAttributes } from "svelte/elements";

  type ButtonType = "primary" | "info" | "success" | "warning" | "danger";

  type Props = {
    type?: ButtonType;
    disabled?: boolean;
    size?: "small" | "medium" | "large";
    onclick?: DOMAttributes<HTMLButtonElement>["onclick"];
    children: Snippet;
  };

  let {
    type = "primary",
    size = "medium",
    onclick,
    children,
    disabled,
  }: Props = $props();
</script>

<button
  class={`assetmgr-button assetmgr-button_${type} assetmgr-button_${size}`}
  type="button"
  {onclick}
  {disabled}
>
  <span>{@render children()}</span>
</button>

<style>
  .assetmgr-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    line-height: 1;
    min-height: 32px;
    border: 1px solid #6c9ff1;
    border-radius: 7px;
    padding: 0 10px;
    color: #08111f;
    background: #6c9ff1;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition:
      color 160ms ease,
      background 160ms ease,
      border-color 160ms ease;
    position: relative;
    vertical-align: middle;
  }
  .assetmgr-button > span {
    color: inherit;
    display: inline-flex;
    align-items: center;
  }

  .assetmgr-button:hover:not(:disabled) {
    border-color: #90baff;
    background: #b0ceff;
  }

  .assetmgr-button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .assetmgr-button_danger {
    color: #ffffff;
    border-color: #f56c6c;
    background: #f56c6c;
  }

  .assetmgr-button_danger:hover:not(:disabled) {
    border-color: #f78989;
    background: #f78989;
  }

  .assetmgr-button_info {
    color: #c1cee2;
    border-color: rgba(154, 176, 210, 0.36);
    background: rgba(28, 41, 61, 0.72);
  }

  .assetmgr-button_info:hover:not(:disabled) {
    border-color: rgba(154, 176, 210, 0.56);
    background: rgba(39, 55, 80, 0.9);
  }

  .assetmgr-button_success {
  }

  .assetmgr-button_success:hover:not(:disabled) {
  }

  .assetmgr-button_warning {
  }

  .assetmgr-button_warning:hover:not(:disabled) {
  }

  .assetmgr-button_small {
    min-height: 28px;
    font-size: 12px;
  }

  .assetmgr-button_large {
    min-height: 36px;
    font-size: 16px;
  }
</style>
