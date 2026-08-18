import { api } from "./axios";

export type AssetEntry = {
  name: string;
  path: string;
  directory: boolean;
  size?: number;
};

export const getContentApi = (
  path: string,
  mode: "content" | "entries" = "content"
) => {
  if (mode === "entries") {
    return api.get<{ path: string; entries: AssetEntry[] }>("/entries", {
      params: { path },
    });
  }
  return api.get("/content", { params: { path } });
};

export const getContentPreviewApi = (
  path: string,
  responseType: "text" | "blob"
) => {
  return api.get("/content", { params: { path }, responseType });
};

export const editManifestFileApi = (path: string, action: "add" | "delete") => {
  return api.post("/manifest/files/edit", { path, action });
};

export const createManifestApi = () => {
  return api.post("/manifest");
};
