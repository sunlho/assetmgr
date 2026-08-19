export type AsepriteFrame = {
  duration: number;
  pixels: Uint8ClampedArray;
};

export type AsepriteDocument = {
  width: number;
  height: number;
  colorDepth: 8 | 16 | 32;
  layerCount: number;
  frames: AsepriteFrame[];
  skippedTilemapLayers: number;
};

type Layer = {
  flags: number;
  type: number;
  childLevel: number;
  blendMode: number;
  opacity: number;
};

type Cel = {
  layer: number;
  x: number;
  y: number;
  opacity: number;
  width: number;
  height: number;
  pixels: Uint8Array | null;
  linkedFrame: number | null;
};

type ParsedFrame = {
  duration: number;
  cels: Map<number, Cel>;
  palette: Uint8Array;
};

const ASEPRITE_MAGIC = 0xa5e0;
const FRAME_MAGIC = 0xf1fa;
const OLD_PALETTE_CHUNK = 0x0004;
const OLD_PALETTE_CHUNK_2 = 0x0011;
const LAYER_CHUNK = 0x2004;
const CEL_CHUNK = 0x2005;
const PALETTE_CHUNK = 0x2019;
const HEADER_SIZE = 128;
const MAX_PIXELS = 64 * 1024 * 1024;
const MAX_DECODED_CEL_BYTES = 256 * 1024 * 1024;
const MAX_FRAMES = 4096;

class Reader {
  private readonly view: DataView;
  private readonly data: Uint8Array;
  private offset = 0;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  get position() {
    return this.offset;
  }

  get remaining() {
    return this.data.byteLength - this.offset;
  }

  u8() {
    this.require(1);
    return this.data[this.offset++];
  }

  u16() {
    this.require(2);
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  i16() {
    this.require(2);
    const value = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return value;
  }

  u32() {
    this.require(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  skip(size: number) {
    this.require(size);
    this.offset += size;
  }

  bytes(size: number) {
    this.require(size);
    const value = this.data.subarray(this.offset, this.offset + size);
    this.offset += size;
    return value;
  }

  string() {
    return new TextDecoder().decode(this.bytes(this.u16()));
  }

  private require(size: number) {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.remaining) {
      throw new Error("文件数据不完整");
    }
  }
}

const inflate = async (compressed: Uint8Array, expectedSize: number) => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("当前浏览器不支持 Aseprite 压缩数据解码");
  }

  const source = compressed.slice().buffer;
  const stream = new Blob([source])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  const result = new Uint8Array(await new Response(stream).arrayBuffer());
  if (result.byteLength !== expectedSize) {
    throw new Error("Aseprite 像素数据长度不正确");
  }
  return result;
};

const updatePalette = (chunk: Reader, palette: Uint8Array) => {
  chunk.u32();
  const first = chunk.u32();
  const last = chunk.u32();
  chunk.skip(8);
  if (last < first || last >= 256) {
    throw new Error("Aseprite 调色板范围不正确");
  }

  for (let color = first; color <= last; color += 1) {
    const flags = chunk.u16();
    const offset = color * 4;
    palette[offset] = chunk.u8();
    palette[offset + 1] = chunk.u8();
    palette[offset + 2] = chunk.u8();
    palette[offset + 3] = chunk.u8();
    if ((flags & 1) !== 0) chunk.string();
  }
};

const updateOldPalette = (
  chunk: Reader,
  palette: Uint8Array,
  sixBitChannels: boolean,
) => {
  const packetCount = chunk.u16();
  let color = 0;
  for (let packet = 0; packet < packetCount; packet += 1) {
    color += chunk.u8();
    const encodedCount = chunk.u8();
    const count = encodedCount === 0 ? 256 : encodedCount;
    if (color + count > 256) {
      throw new Error("Aseprite 旧调色板范围不正确");
    }

    for (let entry = 0; entry < count; entry += 1, color += 1) {
      const offset = color * 4;
      const scale = sixBitChannels ? 255 / 63 : 1;
      palette[offset] = Math.round(chunk.u8() * scale);
      palette[offset + 1] = Math.round(chunk.u8() * scale);
      palette[offset + 2] = Math.round(chunk.u8() * scale);
      palette[offset + 3] = 255;
    }
  }
};

const blendChannel = (backdrop: number, source: number, mode: number) => {
  switch (mode) {
    case 1:
      return backdrop * source;
    case 2:
      return backdrop + source - backdrop * source;
    case 3:
      return backdrop <= 0.5
        ? 2 * backdrop * source
        : 1 - 2 * (1 - backdrop) * (1 - source);
    case 4:
      return Math.min(backdrop, source);
    case 5:
      return Math.max(backdrop, source);
    case 6:
      return source >= 1 ? 1 : Math.min(1, backdrop / (1 - source));
    case 7:
      return source <= 0 ? 0 : 1 - Math.min(1, (1 - backdrop) / source);
    case 8:
      return source <= 0.5
        ? 2 * backdrop * source
        : 1 - 2 * (1 - backdrop) * (1 - source);
    case 9: {
      if (source <= 0.5) {
        return backdrop - (1 - 2 * source) * backdrop * (1 - backdrop);
      }
      const curve =
        backdrop <= 0.25
          ? ((16 * backdrop - 12) * backdrop + 4) * backdrop
          : Math.sqrt(backdrop);
      return backdrop + (2 * source - 1) * (curve - backdrop);
    }
    case 10:
      return Math.abs(backdrop - source);
    case 11:
      return backdrop + source - 2 * backdrop * source;
    case 16:
      return Math.min(1, backdrop + source);
    case 17:
      return Math.max(0, backdrop - source);
    case 18:
      return source <= 0 ? 1 : Math.min(1, backdrop / source);
    default:
      return source;
  }
};

const compositePixel = (
  output: Uint8ClampedArray,
  destinationOffset: number,
  source: ArrayLike<number>,
  opacity: number,
  blendMode: number,
) => {
  const sourceAlpha = (source[3] / 255) * opacity;
  if (sourceAlpha <= 0) return;

  const destinationAlpha = output[destinationOffset + 3] / 255;
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const backdrop = output[destinationOffset + channel] / 255;
    const foreground = source[channel] / 255;
    const blended = blendChannel(backdrop, foreground, blendMode);
    const premultiplied =
      sourceAlpha * (1 - destinationAlpha) * foreground +
      sourceAlpha * destinationAlpha * blended +
      (1 - sourceAlpha) * destinationAlpha * backdrop;
    output[destinationOffset + channel] =
      outputAlpha > 0 ? Math.round((premultiplied / outputAlpha) * 255) : 0;
  }
  output[destinationOffset + 3] = Math.round(outputAlpha * 255);
};

const resolvedLayerStates = (layers: Layer[]) => {
  const visibleAtLevel: boolean[] = [true];
  const opacityAtLevel: number[] = [1];
  return layers.map((layer) => {
    const parentVisible = visibleAtLevel[layer.childLevel] ?? true;
    const parentOpacity = opacityAtLevel[layer.childLevel] ?? 1;
    const visible = parentVisible && (layer.flags & 1) !== 0;
    const opacity = parentOpacity * (layer.opacity / 255);
    if (layer.type === 1) {
      visibleAtLevel.length = layer.childLevel + 2;
      opacityAtLevel.length = layer.childLevel + 2;
      visibleAtLevel[layer.childLevel + 1] = visible;
      opacityAtLevel[layer.childLevel + 1] = opacity;
    }
    return { visible, opacity };
  });
};

const resolveCel = (
  frames: ParsedFrame[],
  frameIndex: number,
  layerIndex: number,
  visited = new Set<number>(),
): Cel | null => {
  const cel = frames[frameIndex]?.cels.get(layerIndex);
  if (!cel) return null;
  if (cel.linkedFrame === null) return cel;
  if (cel.linkedFrame >= frameIndex || visited.has(cel.linkedFrame)) {
    throw new Error("Aseprite 链接帧引用无效");
  }
  visited.add(cel.linkedFrame);
  const linked = resolveCel(frames, cel.linkedFrame, layerIndex, visited);
  if (!linked) throw new Error("Aseprite 链接帧缺少源图层");
  return {
    ...cel,
    width: linked.width,
    height: linked.height,
    pixels: linked.pixels,
    linkedFrame: null,
  };
};

const renderFrame = (
  frameIndex: number,
  frames: ParsedFrame[],
  layers: Layer[],
  width: number,
  height: number,
  colorDepth: 8 | 16 | 32,
  transparentIndex: number,
) => {
  const output = new Uint8ClampedArray(width * height * 4);
  const layerStates = resolvedLayerStates(layers);
  const palette = frames[frameIndex].palette;
  const bytesPerPixel = colorDepth / 8;

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    const layerState = layerStates[layerIndex];
    if (layer.type !== 0 || !layerState.visible) continue;
    const cel = resolveCel(frames, frameIndex, layerIndex);
    if (!cel?.pixels) continue;

    const opacity = layerState.opacity * (cel.opacity / 255);
    for (let y = 0; y < cel.height; y += 1) {
      const destinationY = cel.y + y;
      if (destinationY < 0 || destinationY >= height) continue;
      for (let x = 0; x < cel.width; x += 1) {
        const destinationX = cel.x + x;
        if (destinationX < 0 || destinationX >= width) continue;
        const sourceOffset = (y * cel.width + x) * bytesPerPixel;
        let source: ArrayLike<number>;
        if (colorDepth === 32) {
          source = cel.pixels.subarray(sourceOffset, sourceOffset + 4);
        } else if (colorDepth === 16) {
          const value = cel.pixels[sourceOffset];
          source = [value, value, value, cel.pixels[sourceOffset + 1]];
        } else {
          const paletteIndex = cel.pixels[sourceOffset];
          const paletteOffset = paletteIndex * 4;
          source = palette.subarray(paletteOffset, paletteOffset + 4);
          if (paletteIndex === transparentIndex && (layer.flags & 8) === 0) {
            source = [source[0], source[1], source[2], 0];
          }
        }
        const destinationOffset = (destinationY * width + destinationX) * 4;
        compositePixel(output, destinationOffset, source, opacity, layer.blendMode);
      }
    }
  }
  return output;
};

export const decodeAseprite = async (
  buffer: ArrayBuffer,
): Promise<AsepriteDocument> => {
  if (buffer.byteLength < HEADER_SIZE) {
    throw new Error("Aseprite 文件缺少完整文件头");
  }

  const reader = new Reader(new Uint8Array(buffer));
  const declaredSize = reader.u32();
  const magic = reader.u16();
  const frameCount = reader.u16();
  const width = reader.u16();
  const height = reader.u16();
  const colorDepth = reader.u16();
  const headerFlags = reader.u32();
  const defaultDuration = reader.u16();
  reader.skip(8);
  const transparentIndex = reader.u8();
  reader.skip(HEADER_SIZE - reader.position);

  const pixelCount = width * height;
  if (
    magic !== ASEPRITE_MAGIC ||
    declaredSize !== buffer.byteLength ||
    frameCount === 0 ||
    frameCount > MAX_FRAMES ||
    width === 0 ||
    height === 0 ||
    pixelCount > MAX_PIXELS ||
    pixelCount * frameCount > MAX_PIXELS ||
    (colorDepth !== 8 && colorDepth !== 16 && colorDepth !== 32)
  ) {
    throw new Error("Aseprite 文件头包含不支持的参数");
  }

  const typedColorDepth = colorDepth as 8 | 16 | 32;
  const bytesPerPixel = colorDepth / 8;
  const layers: Layer[] = [];
  const frames: ParsedFrame[] = [];
  let decodedCelBytes = 0;
  const palette = new Uint8Array(256 * 4);
  for (let color = 0; color < 256; color += 1) {
    palette[color * 4] = color;
    palette[color * 4 + 1] = color;
    palette[color * 4 + 2] = color;
    palette[color * 4 + 3] = 255;
  }

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (reader.remaining < 16) throw new Error("Aseprite 文件缺少帧头");
    const frameSize = reader.u32();
    const frameMagic = reader.u16();
    const oldChunkCount = reader.u16();
    const encodedDuration = reader.u16();
    reader.skip(2);
    const newChunkCount = reader.u32();
    if (
      frameMagic !== FRAME_MAGIC ||
      frameSize < 16 ||
      frameSize - 16 > reader.remaining
    ) {
      throw new Error("Aseprite 帧头无效");
    }

    const frameReader = new Reader(reader.bytes(frameSize - 16));
    const cels = new Map<number, Cel>();
    const chunkCount = newChunkCount || oldChunkCount;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      if (frameReader.remaining < 6) throw new Error("Aseprite 缺少区块头");
      const chunkSize = frameReader.u32();
      const chunkType = frameReader.u16();
      if (chunkSize < 6 || chunkSize - 6 > frameReader.remaining) {
        throw new Error("Aseprite 区块大小无效");
      }
      const chunk = new Reader(frameReader.bytes(chunkSize - 6));

      if (chunkType === LAYER_CHUNK) {
        const flags = chunk.u16();
        const type = chunk.u16();
        const childLevel = chunk.u16();
        chunk.skip(4);
        const blendMode = chunk.u16();
        const encodedOpacity = chunk.u8();
        chunk.skip(3);
        chunk.string();
        if (type === 2 && chunk.remaining >= 4) chunk.u32();
        layers.push({
          flags,
          type,
          childLevel,
          blendMode,
          opacity:
            (headerFlags & 1) === 0 ||
            (type === 1 && (headerFlags & 2) === 0)
              ? 255
              : encodedOpacity,
        });
      } else if (chunkType === CEL_CHUNK) {
        const layer = chunk.u16();
        const x = chunk.i16();
        const y = chunk.i16();
        const opacity = chunk.u8();
        const celType = chunk.u16();
        chunk.skip(7);
        if (cels.has(layer)) throw new Error("Aseprite 单帧图层包含多个 Cel");

        if (celType === 1) {
          cels.set(layer, {
            layer,
            x,
            y,
            opacity,
            width: 0,
            height: 0,
            pixels: null,
            linkedFrame: chunk.u16(),
          });
        } else if (celType === 0 || celType === 2) {
          const celWidth = chunk.u16();
          const celHeight = chunk.u16();
          const celPixelCount = celWidth * celHeight;
          const expectedSize = celPixelCount * bytesPerPixel;
          if (
            celWidth === 0 ||
            celHeight === 0 ||
            celPixelCount > MAX_PIXELS
          ) {
            throw new Error("Aseprite Cel 尺寸无效");
          }
          decodedCelBytes += expectedSize;
          if (decodedCelBytes > MAX_DECODED_CEL_BYTES) {
            throw new Error("Aseprite 文件包含过多像素数据");
          }
          const encodedPixels = chunk.bytes(chunk.remaining);
          const pixels =
            celType === 0
              ? encodedPixels.slice()
              : await inflate(encodedPixels, expectedSize);
          if (pixels.byteLength !== expectedSize) {
            throw new Error("Aseprite Cel 像素数据长度无效");
          }
          cels.set(layer, {
            layer,
            x,
            y,
            opacity,
            width: celWidth,
            height: celHeight,
            pixels,
            linkedFrame: null,
          });
        }
      } else if (chunkType === PALETTE_CHUNK) {
        updatePalette(chunk, palette);
      } else if (chunkType === OLD_PALETTE_CHUNK) {
        updateOldPalette(chunk, palette, true);
      } else if (chunkType === OLD_PALETTE_CHUNK_2) {
        updateOldPalette(chunk, palette, false);
      }
    }

    if (frameReader.remaining !== 0) {
      throw new Error("Aseprite 帧包含无法识别的尾部数据");
    }
    frames.push({
      duration: encodedDuration || defaultDuration || 100,
      cels,
      palette: palette.slice(),
    });
  }

  if (layers.length === 0) throw new Error("Aseprite 文件没有图层");
  for (const frame of frames) {
    for (const cel of frame.cels.values()) {
      if (cel.layer >= layers.length) {
        throw new Error("Aseprite Cel 引用了不存在的图层");
      }
    }
  }

  return {
    width,
    height,
    colorDepth: typedColorDepth,
    layerCount: layers.length,
    skippedTilemapLayers: layers.filter((layer) => layer.type === 2).length,
    frames: frames.map((frame, frameIndex) => ({
      duration: frame.duration,
      pixels: renderFrame(
        frameIndex,
        frames,
        layers,
        width,
        height,
        typedColorDepth,
        transparentIndex,
      ),
    })),
  };
};
