export type AssetEntry = {
  name: string;
  path: string;
  directory: boolean;
  size?: number;
};

export type Manifest = Record<string, unknown>;
export type ManifestFileAction = "add" | "delete";

type FileSystemWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

type AssetFileErrorCode =
  | "unsupported"
  | "not-found"
  | "already-exists"
  | "invalid-manifest"
  | "invalid-path";

export class AssetFileError extends Error {
  constructor(public readonly code: AssetFileErrorCode, message: string) {
    super(message);
    this.name = "AssetFileError";
  }
}

const databaseName = "asset-manager";
const objectStoreName = "settings";
const rootHandleKey = "asset-root";

const isDomException = (error: unknown, name: string) =>
  typeof DOMException !== "undefined" &&
  error instanceof DOMException &&
  error.name === name;

const isMissingError = (error: unknown) =>
  (error instanceof AssetFileError && error.code === "not-found") ||
  isDomException(error, "NotFoundError");

const openSettingsDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(objectStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readStoredRootHandle = async () => {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  const database = await openSettingsDatabase();
  return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const request = database
      .transaction(objectStoreName, "readonly")
      .objectStore(objectStoreName)
      .get(rootHandleKey);
    request.onsuccess = () => {
      database.close();
      resolve(
        (request.result as FileSystemDirectoryHandle | undefined) ?? null
      );
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
};

const storeRootHandle = async (root: FileSystemDirectoryHandle) => {
  if (typeof indexedDB === "undefined") {
    return;
  }

  const database = await openSettingsDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(objectStoreName, "readwrite");
    transaction.objectStore(objectStoreName).put(root, rootHandleKey);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

const normalizePath = (path: string) => {
  const segments = path.replaceAll("\\", "/").split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new AssetFileError("invalid-path", "资源路径不能包含 . 或 ..。");
  }
  return segments;
};

const isDirectoryHandle = (
  handle: FileSystemHandle
): handle is FileSystemDirectoryHandle => handle.kind === "directory";

const isFileHandle = (
  handle: FileSystemHandle
): handle is FileSystemFileHandle => handle.kind === "file";

export class AssetFileSystem {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  get name() {
    return this.root.name;
  }

  async queryWritePermission() {
    // @ts-ignore
    return this.root.queryPermission({ mode: "readwrite" });
  }

  async requestWritePermission() {
    // @ts-ignore
    return this.root.requestPermission({ mode: "readwrite" });
  }

  async listEntries(path: string) {
    const normalizedPath = normalizePath(path).join("/");
    const directory = await this.resolveDirectory(normalizedPath);
    const entries: AssetEntry[] = [];

    for await (const [name, handle] of directory.entries()) {
      if (isDirectoryHandle(handle)) {
        entries.push({
          name,
          path: this.joinPath(normalizedPath, name),
          directory: true,
        });
        continue;
      }

      if (isFileHandle(handle)) {
        const file = await handle.getFile();
        entries.push({
          name,
          path: this.joinPath(normalizedPath, name),
          directory: false,
          size: file.size,
        });
      }
    }

    return {
      path: normalizedPath,
      entries: entries.sort((left, right) => {
        if (left.directory !== right.directory) {
          return left.directory ? -1 : 1;
        }
        return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
      }),
    };
  }

  async readFile(path: string) {
    return (await this.resolveFile(path)).getFile();
  }

  async fileExists(path: string) {
    try {
      await this.resolveFile(path);
      return true;
    } catch (error) {
      if (isMissingError(error)) {
        return false;
      }
      throw error;
    }
  }

  async writeTextFile(path: string, content: string) {
    await this.writeText(path, content);
  }

  async readManifest() {
    let content: string;
    try {
      content = await (await this.resolveFile("manifest.json"))
        .getFile()
        .then((file) => file.text());
    } catch (error) {
      if (isMissingError(error)) {
        throw new AssetFileError("not-found", "manifest.json 不存在。");
      }
      throw error;
    }

    try {
      const value: unknown = JSON.parse(content);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("manifest.json must contain an object");
      }
      return value as Manifest;
    } catch (error) {
      if (error instanceof AssetFileError) {
        throw error;
      }
      throw new AssetFileError(
        "invalid-manifest",
        "manifest.json 不是有效的 JSON 对象。"
      );
    }
  }

  async createManifest() {
    try {
      await this.resolveFile("manifest.json");
      throw new AssetFileError("already-exists", "manifest.json 已存在。");
    } catch (error) {
      if (!isMissingError(error)) {
        throw error;
      }
    }

    await this.writeText(
      "manifest.json",
      `${JSON.stringify(defaultManifest(), null, 2)}\n`
    );
  }

  async editManifestFile(path: string, action: ManifestFileAction) {
    await this.editManifestFiles([path], action);
  }

  async editManifestFiles(paths: string[], action: ManifestFileAction) {
    const relatives = [
      ...new Set(paths.map((path) => normalizePath(path).join("/"))),
    ];
    if (relatives.length === 0) {
      return;
    }
    if (
      relatives.some(
        (relative) => !relative || relative === "manifest.json"
      )
    ) {
      throw new AssetFileError(
        "invalid-path",
        "manifest.json 不能出现在 manifest.files 中。"
      );
    }
    if (action === "add") {
      await Promise.all(
        relatives.map((relative) => this.resolveFile(relative))
      );
    }

    const manifest = await this.readManifest();
    const files = manifest.files;
    if (files == null) {
      manifest.files = [];
    } else if (!Array.isArray(files)) {
      throw new AssetFileError(
        "invalid-manifest",
        "manifest.files 必须是数组。"
      );
    }

    const manifestFiles = manifest.files as unknown[];
    const relativeSet = new Set(relatives);
    let changed = false;
    if (action === "add") {
      const existingFiles = new Set(
        manifestFiles.filter((entry): entry is string => typeof entry === "string")
      );
      for (const relative of relatives) {
        if (!existingFiles.has(relative)) {
          manifestFiles.push(relative);
          existingFiles.add(relative);
          changed = true;
        }
      }
    } else {
      const nextFiles = manifestFiles.filter(
        (entry) => !(typeof entry === "string" && relativeSet.has(entry))
      );
      changed = nextFiles.length !== manifestFiles.length;
      if (changed) {
        manifest.files = nextFiles;
      }
    }

    if (changed) {
      await this.writeText(
        "manifest.json",
        `${JSON.stringify(manifest, null, 2)}\n`
      );
    }
  }

  private async resolveDirectory(path: string) {
    let current = this.root;
    for (const segment of normalizePath(path)) {
      current = await current.getDirectoryHandle(segment);
    }
    return current;
  }

  private async resolveFile(path: string) {
    const segments = normalizePath(path);
    const name = segments.pop();
    if (!name) {
      throw new AssetFileError("invalid-path", "文件路径不能为空。");
    }

    let directory = this.root;
    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment);
    }
    return directory.getFileHandle(name);
  }

  private async writeText(path: string, content: string) {
    const segments = normalizePath(path);
    const name = segments.pop();
    if (!name) {
      throw new AssetFileError("invalid-path", "文件路径不能为空。");
    }

    let directory = this.root;
    for (const segment of segments) {
      directory = await directory.getDirectoryHandle(segment);
    }

    const file = await directory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
  }

  private joinPath(parent: string, name: string) {
    return parent ? `${parent}/${name}` : name;
  }
}

const defaultManifest = (): Manifest => ({
  maps: [],
  appearances: [],
  localization: "",
  files: [],
  optionalFiles: [],
});

export const restoreAssetFileSystem = async () => {
  const root = await readStoredRootHandle();
  return root ? new AssetFileSystem(root) : null;
};

export const pickAssetFileSystem = async () => {
  const picker = (window as FileSystemWindow).showDirectoryPicker;
  if (!picker) {
    throw new AssetFileError(
      "unsupported",
      "当前浏览器不支持本地资源目录访问，请使用 Chrome 或 Edge。"
    );
  }

  try {
    const root = await picker.call(window, {
      id: "asset-manager-root",
      mode: "readwrite",
    });
    try {
      await storeRootHandle(root);
    } catch {
      // The selected handle is still usable for this session if persistence fails.
    }
    return new AssetFileSystem(root);
  } catch (error) {
    if (isDomException(error, "AbortError")) {
      return null;
    }
    throw error;
  }
};
