export type AsepriteFrame = {
  duration: number;
  pixels: Uint8ClampedArray;
};

export type AsepriteDocument = {
  width: number;
  height: number;
  colorDepth: 8 | 16 | 32;
  layerCount: number;
  skippedTilemapLayers: number;
  frames: AsepriteFrame[];
};

type AsepriteDecoderModule = {
  HEAPU8: Uint8Array;
  HEAPU32: Uint32Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _aseprite_decode(
    input: number,
    inputSize: number,
    output: number,
    outputSize: number,
    error: number,
    errorSize: number,
  ): number;
  _aseprite_free(pointer: number): void;
};

type AsepriteDecoderFactory = (moduleArg?: {
  locateFile?: (path: string, scriptDirectory: string) => string;
}) => Promise<AsepriteDecoderModule>;

const WIRE_MAGIC = 0x57505341;
const WIRE_VERSION = 1;
const WIRE_HEADER_BYTES = 32;
const RESULT_SLOTS_BYTES = 16;
const MAX_FRAMES = 4096;
const MAX_FRAME_PIXELS = 64 * 1024 * 1024;

let decoderModulePromise: Promise<AsepriteDecoderModule> | null = null;

const loadDecoderModule = async () => {
  if (!decoderModulePromise) {
    const baseUrl = new URL(import.meta.env.BASE_URL, document.baseURI);
    const modulePath = new URL("wasm/aseprite-decoder.mjs", baseUrl).href;
    const wasmPath = new URL("wasm/aseprite-decoder.wasm", baseUrl).href;
    decoderModulePromise = (async () => {
      const response = await fetch(modulePath, { credentials: "same-origin" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const moduleUrl = URL.createObjectURL(
        new Blob([await response.text()], { type: "text/javascript" }),
      );
      try {
        const module = await import(/* @vite-ignore */ moduleUrl);
        return (module.default as AsepriteDecoderFactory)({
          locateFile: (path) =>
            path === "aseprite-decoder.wasm" ? wasmPath : path,
        });
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }
    })()
      .catch((error: unknown) => {
        decoderModulePromise = null;
        const detail = error instanceof Error ? `：${error.message}` : "";
        throw new Error(
          `无法加载 Aseprite WASM 解码器，请先在主项目构建 AsepriteDecoderWasm 目标${detail}`,
        );
      });
  }
  return decoderModulePromise;
};

const parseWireDocument = (encoded: Uint8Array): AsepriteDocument => {
  if (encoded.byteLength < WIRE_HEADER_BYTES) {
    throw new Error("Aseprite WASM 返回了不完整的数据");
  }
  const view = new DataView(
    encoded.buffer,
    encoded.byteOffset,
    encoded.byteLength,
  );
  let offset = 0;
  const u32 = () => {
    if (offset + 4 > encoded.byteLength) {
      throw new Error("Aseprite WASM 返回了不完整的数据");
    }
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };

  if (u32() !== WIRE_MAGIC || u32() !== WIRE_VERSION) {
    throw new Error("Aseprite WASM 数据格式版本不匹配");
  }
  const width = u32();
  const height = u32();
  const encodedColorDepth = u32();
  const layerCount = u32();
  const skippedTilemapLayers = u32();
  const frameCount = u32();
  if (
    width === 0 ||
    height === 0 ||
    ![8, 16, 32].includes(encodedColorDepth) ||
    frameCount === 0 ||
    frameCount > MAX_FRAMES
  ) {
    throw new Error("Aseprite WASM 返回了无效的文档信息");
  }

  const framePixelCount = width * height;
  const frameBytes = framePixelCount * 4;
  if (
    !Number.isSafeInteger(frameBytes) ||
    framePixelCount > MAX_FRAME_PIXELS
  ) {
    throw new Error("Aseprite WASM 返回的画布尺寸过大");
  }

  const frames: AsepriteFrame[] = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const duration = u32();
    const pixelBytes = u32();
    if (pixelBytes !== frameBytes || offset + pixelBytes > encoded.byteLength) {
      throw new Error("Aseprite WASM 返回了无效的帧数据");
    }
    frames.push({
      duration,
      pixels: new Uint8ClampedArray(
        encoded.buffer,
        encoded.byteOffset + offset,
        pixelBytes,
      ),
    });
    offset += pixelBytes;
  }
  if (offset !== encoded.byteLength) {
    throw new Error("Aseprite WASM 返回了无法识别的尾部数据");
  }

  return {
    width,
    height,
    colorDepth: encodedColorDepth as 8 | 16 | 32,
    layerCount,
    skippedTilemapLayers,
    frames,
  };
};

export const decodeAseprite = async (
  buffer: ArrayBuffer,
): Promise<AsepriteDocument> => {
  const module = await loadDecoderModule();
  const input = new Uint8Array(buffer);
  const inputPointer = module._malloc(Math.max(1, input.byteLength));
  const slotsPointer = module._malloc(RESULT_SLOTS_BYTES);
  if (inputPointer === 0 || slotsPointer === 0) {
    if (inputPointer !== 0) module._free(inputPointer);
    if (slotsPointer !== 0) module._free(slotsPointer);
    throw new Error("Aseprite WASM 内存不足");
  }

  let outputPointer = 0;
  let errorPointer = 0;
  try {
    module.HEAPU8.set(input, inputPointer);
    module.HEAPU8.fill(0, slotsPointer, slotsPointer + RESULT_SLOTS_BYTES);
    const status = module._aseprite_decode(
      inputPointer,
      input.byteLength,
      slotsPointer,
      slotsPointer + 4,
      slotsPointer + 8,
      slotsPointer + 12,
    );

    const slots = slotsPointer >>> 2;
    outputPointer = module.HEAPU32[slots] ?? 0;
    const outputSize = module.HEAPU32[slots + 1] ?? 0;
    errorPointer = module.HEAPU32[slots + 2] ?? 0;
    const errorSize = module.HEAPU32[slots + 3] ?? 0;
    if (status !== 0) {
      const message =
        errorPointer !== 0 && errorSize !== 0
          ? new TextDecoder().decode(
              module.HEAPU8.slice(errorPointer, errorPointer + errorSize),
            )
          : "C++ 解码器返回了未知错误";
      throw new Error(message);
    }
    if (outputPointer === 0 || outputSize === 0) {
      throw new Error("Aseprite WASM 没有返回解码结果");
    }
    const encoded = module.HEAPU8.slice(
      outputPointer,
      outputPointer + outputSize,
    );
    return parseWireDocument(encoded);
  } finally {
    if (outputPointer !== 0) module._aseprite_free(outputPointer);
    if (errorPointer !== 0) module._aseprite_free(errorPointer);
    module._free(slotsPointer);
    module._free(inputPointer);
  }
};
