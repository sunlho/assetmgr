<script lang="ts">
  import { onDestroy } from "svelte";
  import type { AssetFileSystem } from "@/utils/filesystem";
  import Button from "@/components/Button.svelte";

  type LocalizationLanguage = {
    tag: string;
    displayName: string;
    path: string;
  };

  type Props = {
    root: AssetFileSystem;
    localizationPath: string | null;
    catalogs: string[];
    languages: LocalizationLanguage[];
    onUnsavedChanges: (dirty: boolean) => void;
    onLocalizationChanged: () => void | Promise<void>;
  };

  type PreviewState = "empty" | "loading" | "ready" | "error";

  type LoadedCatalog = {
    language: LocalizationLanguage;
    document: Record<string, unknown> | null;
    messages: Record<string, string>;
    error: string | null;
  };

  let {
    root,
    localizationPath,
    catalogs,
    languages,
    onUnsavedChanges,
    onLocalizationChanged,
  }: Props = $props();

  let selectedCatalog = $state<string | null>(null);
  let selectedKey = $state<string | null>(null);
  let previewState = $state<PreviewState>("empty");
  let catalogContents = $state<LoadedCatalog[]>([]);
  let draftTranslations = $state<Record<string, string>>({});
  let savedTranslations = $state<Record<string, string>>({});
  let saveError = $state("");
  let saveMessage = $state("");
  let isSaving = $state(false);
  let isCreatingCatalog = $state(false);
  let catalogActionError = $state("");
  let keyActionError = $state("");
  let addedCatalogs = $state<string[]>([]);
  let pendingKeys = $state<string[]>([]);
  let isDeletingKey = $state(false);
  let catalogRequest = 0;

  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

  const joinAssetPath = (directory: string, file: string) => {
    const normalizedDirectory = directory
      .replaceAll("\\", "/")
      .replace(/\/+$/, "");
    const normalizedFile = file.replaceAll("\\", "/").replace(/^\/+/, "");
    return normalizedDirectory
      ? normalizedDirectory + "/" + normalizedFile
      : normalizedFile;
  };

  const flattenMessages = (
    value: unknown,
    prefix = "",
    result: Record<string, string> = {},
  ) => {
    if (typeof value === "string") {
      if (prefix !== "") {
        result[prefix] = value;
      }
      return result;
    }
    if (!isObject(value)) {
      return result;
    }

    for (const [key, child] of Object.entries(value)) {
      flattenMessages(child, prefix ? prefix + "." + key : key, result);
    }
    return result;
  };

  const cloneDocument = (document: Record<string, unknown>) =>
    JSON.parse(JSON.stringify(document)) as Record<string, unknown>;

  const setNestedValue = (
    document: Record<string, unknown>,
    key: string,
    value: string,
  ) => {
    const segments = key.split(".").filter((segment) => segment !== "");
    if (segments.length === 0) {
      return false;
    }

    let current = document;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      if (index === segments.length - 1) {
        current[segment] = value;
        return true;
      }

      if (!isObject(current[segment])) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }
    return false;
  };

  const deleteNestedValue = (
    document: Record<string, unknown>,
    key: string,
  ) => {
    const segments = key.split(".").filter((segment) => segment !== "");
    if (segments.length === 0) {
      return false;
    }

    let current = document;
    for (let index = 0; index < segments.length - 1; index += 1) {
      if (!isObject(current[segments[index]])) {
        return false;
      }
      current = current[segments[index]] as Record<string, unknown>;
    }

    const lastSegment = segments[segments.length - 1];
    if (!Object.prototype.hasOwnProperty.call(current, lastSegment)) {
      return false;
    }
    delete current[lastSegment];
    return true;
  };

  const catalogNames = $derived.by(() => {
    const names = new Set<string>();
    for (const catalog of [...catalogs, ...addedCatalogs]) {
      const name = catalog.trim();
      if (name !== "") {
        names.add(name);
      }
    }
    return Array.from(names);
  });

  const availableKeys = $derived.by(() => {
    const keys = new Set<string>();
    for (const content of catalogContents) {
      for (const key of Object.keys(content.messages)) {
        keys.add(key);
      }
    }
    for (const key of pendingKeys) {
      keys.add(key);
    }
    return Array.from(keys).sort((left, right) => left.localeCompare(right));
  });

  const isDirty = $derived.by(() =>
    languages.some(
      (language) =>
        (draftTranslations[language.tag] ?? "") !==
        (savedTranslations[language.tag] ?? ""),
    ),
  );

  const hasUnsavedChanges = $derived(isDirty || pendingKeys.length > 0);

  const canAddKey = $derived(
    selectedCatalog !== null &&
      previewState === "ready" &&
      catalogContents.length === languages.length &&
      catalogContents.length > 0 &&
      catalogContents.every((content) => content.document !== null) &&
      !isSaving &&
      !isCreatingCatalog &&
      !isDeletingKey,
  );

  const resetDraftsForKey = (key: string | null) => {
    const next: Record<string, string> = {};
    if (key !== null) {
      for (const content of catalogContents) {
        next[content.language.tag] = content.messages[key] ?? "";
      }
    }
    draftTranslations = next;
    savedTranslations = { ...next };
    saveError = "";
    saveMessage = "";
  };

  const discardUnsavedChanges = () => {
    pendingKeys = [];
    resetDraftsForKey(null);
  };

  const confirmDiscardChanges = () =>
    !hasUnsavedChanges ||
    window.confirm("当前有未保存的修改，继续操作将丢失这些修改，确定继续吗？");

  const selectCatalog = async (catalog: string) => {
    if (selectedCatalog === catalog || isSaving || !confirmDiscardChanges()) {
      return;
    }

    discardUnsavedChanges();
    const request = ++catalogRequest;
    selectedCatalog = catalog;
    selectedKey = null;
    catalogContents = [];
    previewState = "loading";

    const contents = await Promise.all(
      languages.map(async (language): Promise<LoadedCatalog> => {
        const path = joinAssetPath(language.path, catalog);
        try {
          const content = await root.readFile(path);
          const value: unknown = JSON.parse(await content.text());
          if (!isObject(value)) {
            throw new Error("catalog must contain an object");
          }
          return {
            language,
            document: value,
            messages: flattenMessages(value),
            error: null,
          };
        } catch {
          return {
            language,
            document: null,
            messages: {},
            error: "无法加载 " + path + "。",
          };
        }
      }),
    );

    if (request !== catalogRequest) {
      return;
    }
    catalogContents = contents;
    previewState = "ready";
  };

  const selectKey = (key: string) => {
    if (selectedKey === key || !confirmDiscardChanges()) {
      return;
    }
    discardUnsavedChanges();
    selectedKey = key;
    resetDraftsForKey(key);
  };

  const updateDraft = (languageTag: string, value: string) => {
    draftTranslations = {
      ...draftTranslations,
      [languageTag]: value,
    };
    saveError = "";
    saveMessage = "";
  };

  const createCatalog = async () => {
    if (
      localizationPath === null ||
      isCreatingCatalog ||
      isSaving ||
      isDeletingKey
    ) {
      catalogActionError = "未配置可写入的 localization index。";
      return;
    }

    const input = window.prompt(
      "请输入新的 catalog 文件名（必须以 .json 结尾）：",
      "messages.json",
    );
    if (input === null) {
      return;
    }

    const catalog = input.trim();
    catalogActionError = "";
    if (
      catalog === "" ||
      !catalog.toLowerCase().endsWith(".json") ||
      catalog.includes("/") ||
      catalog.includes("\\") ||
      catalog === "." ||
      catalog === ".."
    ) {
      catalogActionError = "catalog 必须是顶层的 .json 文件名。";
      return;
    }
    if (catalogNames.includes(catalog)) {
      catalogActionError = "该 catalog 已存在。";
      return;
    }
    if (!confirmDiscardChanges()) {
      return;
    }

    discardUnsavedChanges();
    isCreatingCatalog = true;
    try {
      const indexFile = await root.readFile(localizationPath);
      const indexValue: unknown = JSON.parse(await indexFile.text());
      if (!isObject(indexValue) || !Array.isArray(indexValue.catalogs)) {
        throw new Error("invalid localization index");
      }

      const indexCatalogs = indexValue.catalogs;
      if (
        indexCatalogs.some(
          (entry) => typeof entry === "string" && entry.trim() === catalog,
        )
      ) {
        throw new Error("catalog already exists");
      }

      const paths = Array.from(
        new Set(
          languages.map((language) => joinAssetPath(language.path, catalog)),
        ),
      );
      if (paths.length === 0) {
        throw new Error("no localization languages");
      }
      for (const path of paths) {
        if (await root.fileExists(path)) {
          throw new Error("catalog file already exists");
        }
      }

      await Promise.all(paths.map((path) => root.writeTextFile(path, "{}\n")));
      indexValue.catalogs = [...indexCatalogs, catalog];
      await root.writeTextFile(
        localizationPath,
        JSON.stringify(indexValue, null, 2) + "\n",
      );

      addedCatalogs = [...addedCatalogs, catalog];
      await onLocalizationChanged();
      await selectCatalog(catalog);
    } catch {
      catalogActionError = "创建 catalog 失败，请确认 index 和语言目录可写。";
    } finally {
      isCreatingCatalog = false;
    }
  };

  const createKey = () => {
    if (!canAddKey) {
      return;
    }

    const input = window.prompt(
      "请输入新的 key，例如 messages.app.title：",
      "messages.app.title",
    );
    if (input === null) {
      return;
    }

    const key = input.trim();
    keyActionError = "";
    if (key === "" || key.split(".").some((segment) => segment.trim() === "")) {
      keyActionError = "key 不能为空，也不能包含连续的点号。";
      return;
    }
    if (availableKeys.includes(key)) {
      keyActionError = "该 key 已存在。";
      return;
    }
    if (!confirmDiscardChanges()) {
      return;
    }

    discardUnsavedChanges();
    pendingKeys = [key];
    selectedKey = key;
    resetDraftsForKey(key);
  };

  const deleteKey = async () => {
    if (selectedKey === null || isSaving || isDeletingKey) {
      return;
    }

    const key = selectedKey;
    const warning = hasUnsavedChanges
      ? "确定立即删除 key“" + key + "”吗？未保存的修改也会一并丢弃。"
      : "确定立即删除 key“" + key + "”吗？";
    if (!window.confirm(warning)) {
      return;
    }

    keyActionError = "";
    if (pendingKeys.includes(key)) {
      pendingKeys = pendingKeys.filter((pendingKey) => pendingKey !== key);
      selectedKey = null;
      resetDraftsForKey(null);
      return;
    }
    if (
      catalogContents.length !== languages.length ||
      catalogContents.some((content) => content.document === null)
    ) {
      keyActionError = "无法删除该 key：至少有一个语言 catalog 未加载。";
      return;
    }

    isDeletingKey = true;
    try {
      const catalog = selectedCatalog;
      if (catalog === null) {
        return;
      }

      const updatedContents = await Promise.all(
        catalogContents.map(async (content) => {
          if (content.document === null) {
            throw new Error("catalog is not loaded");
          }
          const document = cloneDocument(content.document);
          deleteNestedValue(document, key);
          const path = joinAssetPath(content.language.path, catalog);
          await root.writeTextFile(
            path,
            JSON.stringify(document, null, 2) + "\n",
          );
          return {
            ...content,
            document,
            messages: flattenMessages(document),
          };
        }),
      );

      catalogContents = updatedContents;
      pendingKeys = [];
      selectedKey = null;
      resetDraftsForKey(null);
    } catch {
      keyActionError = "删除失败，请确认所有语言 catalog 仍有写入权限。";
    } finally {
      isDeletingKey = false;
    }
  };

  const saveTranslations = async () => {
    if (
      selectedCatalog === null ||
      selectedKey === null ||
      !hasUnsavedChanges ||
      isSaving ||
      isDeletingKey
    ) {
      return;
    }

    isSaving = true;
    saveError = "";
    saveMessage = "";
    const drafts = { ...draftTranslations };
    const keysToAdd = [...pendingKeys];
    const key = selectedKey;
    const catalog = selectedCatalog;

    try {
      const updatedContents = await Promise.all(
        catalogContents.map(async (content) => {
          if (content.error !== null || content.document === null) {
            return content;
          }

          const document = cloneDocument(content.document);
          for (const pendingKey of keysToAdd) {
            if (!setNestedValue(document, pendingKey, "")) {
              throw new Error("invalid localization key");
            }
          }
          const value = drafts[content.language.tag] ?? "";
          if (!setNestedValue(document, key, value)) {
            throw new Error("invalid localization key");
          }

          const path = joinAssetPath(content.language.path, catalog);
          await root.writeTextFile(
            path,
            JSON.stringify(document, null, 2) + "\n",
          );
          return {
            ...content,
            document,
            messages: flattenMessages(document),
          };
        }),
      );

      catalogContents = updatedContents;
      pendingKeys = [];
      draftTranslations = drafts;
      savedTranslations = { ...drafts };
      saveMessage = "已保存";
    } catch {
      saveError = "保存失败，请确认资源目录仍有写入权限。";
    } finally {
      isSaving = false;
    }
  };

  $effect(() => {
    onUnsavedChanges(hasUnsavedChanges);
  });

  $effect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  });

  onDestroy(() => {
    catalogRequest += 1;
    onUnsavedChanges(false);
  });
</script>

<div
  id="localization-panel"
  class="content localization-content"
  role="tabpanel"
  aria-labelledby="localization-tab"
>
  <div
    class="file-list-panel localization-list-panel"
    aria-label="国际化资源目录"
  >
    <div class="file-list-header">
      <div>
        <h2>国际化资源</h2>
        <p class="list-caption">
          {languages.length} 个语言 · {catalogNames.length} 个 catalog
        </p>
        {#if catalogActionError}
          <p class="localization-action-error" role="alert">
            {catalogActionError}
          </p>
        {/if}
      </div>

      <Button
        disabled={localizationPath === null ||
          languages.length === 0 ||
          isCreatingCatalog ||
          isSaving ||
          isDeletingKey}
        onclick={createCatalog}
      >
        {isCreatingCatalog ? "创建中..." : "新建文件"}
      </Button>
    </div>
    <div class="localization-level">
      <ul class="file-list localization-catalog-list">
        {#if catalogNames.length === 0}
          <li class="empty-file-list">暂无 catalog 文件</li>
        {:else}
          {#each catalogNames as catalog}
            <li>
              <button
                class="file-item"
                class:active={selectedCatalog === catalog}
                type="button"
                aria-pressed={selectedCatalog === catalog}
                disabled={isSaving || isCreatingCatalog || isDeletingKey}
                onclick={() => selectCatalog(catalog)}
              >
                {catalog}
              </button>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>

  <div
    class="localization-level localization-key-level file-list-panel localization-list-panel"
  >
    <div class="localization-level-header">
      <span>Keys</span>
      <div class="localization-key-header-actions">
        {#if selectedCatalog}
          <small>{selectedCatalog}</small>
        {/if}

        <Button disabled={!canAddKey} onclick={createKey}>添加</Button>
      </div>
    </div>
    {#if keyActionError}
      <p class="localization-action-error" role="alert">{keyActionError}</p>
    {/if}
    <ul class="file-list localization-key-list">
      {#if selectedCatalog === null}
        <li class="empty-file-list">先选择一个 catalog</li>
      {:else if previewState === "loading"}
        <li class="empty-file-list">正在读取 key...</li>
      {:else if availableKeys.length === 0}
        <li class="empty-file-list">暂无 key</li>
      {:else}
        {#each availableKeys as key}
          <li>
            <button
              class="file-item key-item"
              class:active={selectedKey === key}
              type="button"
              aria-pressed={selectedKey === key}
              disabled={isSaving || isCreatingCatalog || isDeletingKey}
              onclick={() => selectKey(key)}
            >
              {key}
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>

  <div class="file-detail-panel" aria-label="国际化文本详情">
    {#if selectedKey === null}
      <div class="preview-placeholder">
        {selectedCatalog === null
          ? "选择左侧 catalog 查看 key"
          : previewState === "loading"
            ? "正在读取 catalog..."
            : "选择左侧 key 查看各语言内容"}
      </div>
    {:else}
      <header class="preview-header">
        <div class="translation-header">
          <span class="preview-title">{selectedKey}</span>
          <span class="preview-subtitle">{selectedCatalog}</span>
        </div>
        <div class="translation-actions">
          <Button
            type="danger"
            disabled={isSaving || isDeletingKey}
            onclick={deleteKey}
          >
            {isDeletingKey ? "删除中..." : "删除 key"}
          </Button>
          {#if saveError}
            <span class="localization-save-error" role="alert">{saveError}</span
            >
          {:else if saveMessage}
            <span class="localization-save-status" aria-live="polite"
              >{saveMessage}</span
            >
          {/if}

          <Button
            disabled={!hasUnsavedChanges || isSaving || isDeletingKey}
            onclick={saveTranslations}
          >
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </div>
      </header>
      <div class="preview-body localization-translation-list">
        {#each catalogContents as content}
          <article class="localization-translation">
            <div class="localization-language">
              <span class="localization-language-tag">
                {content.language.tag}
              </span>
              <span class="localization-language-name">
                {content.language.displayName}
              </span>
            </div>
            {#if content.error}
              <p class="localization-translation-error">{content.error}</p>
            {:else}
              <textarea
                aria-label={`${content.language.displayName} (${content.language.tag})`}
                placeholder="未配置"
                rows="3"
                value={draftTranslations[content.language.tag] ?? ""}
                disabled={isSaving || isDeletingKey}
                oninput={(event) =>
                  updateDraft(
                    content.language.tag,
                    (event.currentTarget as HTMLTextAreaElement).value,
                  )}
              ></textarea>
            {/if}
          </article>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .localization-content {
    display: grid;
    grid-template-columns: minmax(250px, 290px) minmax(250px, 300px) minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
    overflow: hidden;
  }

  .file-list-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .localization-list-panel {
    background: var(--surface-raised);
  }

  .localization-level {
    overflow: hidden;
    display: flex;
    min-height: 0;
    flex-direction: column;
    flex: 1 1 auto;
    border-bottom: 1px solid var(--line);
  }

  .localization-key-level {
    flex: 1 1 auto;
  }

  .localization-level-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex: 0 0 auto;
    min-height: 48px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    color: var(--ink-soft);
    background: #f7f4ed;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .localization-level-header small {
    min-width: 0;
    overflow: hidden;
    color: var(--ink-faint);
    font-size: 10px;
    font-weight: 400;
    letter-spacing: 0;
    text-overflow: ellipsis;
    text-transform: none;
    white-space: nowrap;
  }

  .localization-key-header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  .localization-action-error {
    margin: 4px 0 0;
    color: var(--danger);
    font-size: 11px;
    line-height: 1.4;
  }

  .localization-catalog-list,
  .localization-key-list {
    flex: 1 1 auto;
    min-height: 0;
  }

  .key-item {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 12px;
  }

  .translation-header {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .preview-subtitle {
    overflow: hidden;
    color: var(--ink-faint);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .translation-actions {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .localization-save-status,
  .localization-save-error {
    font-size: 11px;
    white-space: nowrap;
  }

  .localization-save-status {
    color: var(--success);
  }

  .localization-save-error {
    color: var(--danger);
  }

  .localization-translation-list {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 14px;
    background: #f6f3ec;
  }

  .localization-translation {
    flex: 0 0 auto;
    padding: 13px 14px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface-raised);
    box-shadow: var(--shadow-sm);
  }

  .localization-language {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  .localization-language-tag {
    color: var(--accent-strong);
    font:
      700 13px/1.4 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
  }

  .localization-language-name {
    color: var(--ink-faint);
    font-size: 12px;
  }

  .localization-translation-error {
    margin: 0;
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @media (max-width: 1180px) {
    .localization-content {
      grid-template-columns: minmax(220px, 250px) minmax(220px, 250px) minmax(0, 1fr);
    }
  }
</style>
