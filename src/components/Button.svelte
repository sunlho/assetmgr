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
    min-height: 34px;
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 0 12px;
    color: #fff;
    background: var(--accent);
    box-shadow: 0 2px 5px rgba(189, 66, 27, 0.15);
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition:
      color 160ms ease,
      background 160ms ease,
      border-color 160ms ease,
      transform 160ms ease,
      box-shadow 160ms ease;
    position: relative;
    vertical-align: middle;
  }
  .assetmgr-button > span {
    color: inherit;
    display: inline-flex;
    align-items: center;
  }

  .assetmgr-button:hover:not(:disabled) {
    border-color: var(--accent-strong);
    background: var(--accent-strong);
    box-shadow: 0 5px 12px rgba(189, 66, 27, 0.18);
    transform: translateY(-1px);
  }

  .assetmgr-button:active:not(:disabled) {
    box-shadow: none;
    transform: translateY(0);
  }

  .assetmgr-button:focus-visible {
    outline: 3px solid rgba(232, 101, 50, 0.2);
    outline-offset: 2px;
  }

  .assetmgr-button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .assetmgr-button_danger {
    color: #ffffff;
    border-color: var(--danger);
    background: var(--danger);
    box-shadow: 0 2px 5px rgba(198, 75, 64, 0.14);
  }

  .assetmgr-button_danger:hover:not(:disabled) {
    border-color: #a73931;
    background: #a73931;
  }

  .assetmgr-button_info {
    color: var(--ink-soft);
    border-color: var(--line-strong);
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }

  .assetmgr-button_info:hover:not(:disabled) {
    color: var(--ink);
    border-color: #aaa294;
    background: var(--surface-muted);
  }

  .assetmgr-button_success {
    border-color: var(--success);
    background: var(--success);
  }

  .assetmgr-button_success:hover:not(:disabled) {
    border-color: #1b5c43;
    background: #1b5c43;
  }

  .assetmgr-button_warning {
    border-color: #bd7127;
    background: #bd7127;
  }

  .assetmgr-button_warning:hover:not(:disabled) {
    border-color: #95531a;
    background: #95531a;
  }

  .assetmgr-button_small {
    min-height: 28px;
    padding-inline: 9px;
    font-size: 11px;
  }

  .assetmgr-button_large {
    min-height: 42px;
    padding-inline: 18px;
    font-size: 13px;
  }
</style>
