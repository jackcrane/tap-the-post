import { useState } from "react";
import "./App.css";

const GAP_PX = 12;
const ASSUMED_VIEWPORT_WIDTH = 390; // typical iPhone CSS px width
const WATERMARK_TEXT = "Made with";
const WATERMARK_LOGO_URL = "/logo.svg";
const WATERMARK_SCREEN_WIDTH_FRACTION = 0.06; // target ~6% of assumed viewport width

const loadWatermarkLogo = (() => {
  let cachedPromise;
  return () => {
    if (cachedPromise) return cachedPromise;

    cachedPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.decoding = "sync";
      img.src = WATERMARK_LOGO_URL;
    });

    return cachedPromise;
  };
})();

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const addWatermark = (canvas, logo, displayScale) => {
  const ctx = canvas.getContext("2d");
  const safeDisplayScale = displayScale || 1;
  const desiredDisplayWidth =
    ASSUMED_VIEWPORT_WIDTH * WATERMARK_SCREEN_WIDTH_FRACTION;
  const desiredSourceWidth = desiredDisplayWidth / safeDisplayScale;
  const margin = Math.max(8, 12 / safeDisplayScale);
  const fontFamily =
    '"Satoshi", "Inter", "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  const hasLogo = Boolean(logo);
  let fontSize = 12 / safeDisplayScale; // start with a 12px display-size font

  const computeMetrics = () => {
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    const textMetrics = ctx.measureText(WATERMARK_TEXT);
    const naturalWidth = hasLogo ? logo.naturalWidth || logo.width || 120 : 120;
    const naturalHeight = hasLogo
      ? logo.naturalHeight || logo.height || 40
      : 40;
    const aspectRatio = naturalWidth / (naturalHeight || 1);
    const paddingX = Math.round(fontSize * 0.75);
    const paddingY = Math.round(fontSize * 0.6);
    const spacing = hasLogo ? Math.round(fontSize * 0.6) : 0;
    const logoHeight = hasLogo
      ? Math.max(Math.round(fontSize * 1.35), fontSize + 2)
      : 0;
    const logoWidth = hasLogo
      ? Math.max(Math.round(logoHeight * aspectRatio), logoHeight)
      : 0;
    const contentHeight = Math.max(logoHeight, fontSize);
    const blockWidth = paddingX * 2 + textMetrics.width + spacing + logoWidth;
    const blockHeight = paddingY * 2 + contentHeight;

    return {
      textMetrics,
      paddingX,
      paddingY,
      spacing,
      logoWidth,
      logoHeight,
      contentHeight,
      blockWidth,
      blockHeight,
    };
  };

  let metrics = computeMetrics();
  const availableWidth = Math.max(
    24 / safeDisplayScale,
    canvas.width - margin * 2,
  );
  const availableHeight = Math.max(
    24 / safeDisplayScale,
    canvas.height - margin * 2,
  );

  // Fit watermark to a target display width; clamp within slice bounds.
  const widthScale = desiredSourceWidth / metrics.blockWidth;
  const clampWidthScale = availableWidth / metrics.blockWidth;
  const clampHeightScale = availableHeight / metrics.blockHeight;
  const appliedScale = Math.min(widthScale, clampWidthScale, clampHeightScale);

  if (isFinite(appliedScale) && appliedScale > 0) {
    fontSize = Math.max(
      10 / safeDisplayScale,
      Math.min(18 / safeDisplayScale, fontSize * appliedScale),
    );
    metrics = computeMetrics();
  }

  const x = canvas.width - margin - metrics.blockWidth;
  const y = canvas.height - margin - metrics.blockHeight;
  const radius = Math.round(metrics.blockHeight / 2);
  const centerY = y + metrics.blockHeight / 2;

  ctx.save();
  drawRoundedRect(ctx, x, y, metrics.blockWidth, metrics.blockHeight, radius);
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  ctx.strokeStyle = "rgba(15, 20, 25, 0.04)";
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.font = `600 ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = "rgba(15, 20, 25, 0.58)";
  ctx.textBaseline = "middle";
  ctx.fillText(WATERMARK_TEXT, x + metrics.paddingX, centerY);

  if (hasLogo) {
    const logoX =
      x + metrics.paddingX + metrics.textMetrics.width + metrics.spacing;
    const logoY = centerY - metrics.logoHeight / 2;
    ctx.drawImage(logo, logoX, logoY, metrics.logoWidth, metrics.logoHeight);
  }
  ctx.restore();
};

const createSliceDataUrl = (
  image,
  sourceX,
  sourceY,
  sourceWidth,
  sourceHeight,
  watermarkLogo,
  applyWatermark,
  displayScale,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  if (applyWatermark) {
    addWatermark(canvas, watermarkLogo, displayScale);
  }
  return canvas.toDataURL("image/png");
};

const loadImageFromFile = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch (_) {
      // Fall through to Image-based decode
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load image"));
    };
    img.src = objectUrl;
  });
};

const sliceImage = async (file) => {
  let image;
  try {
    image = await loadImageFromFile(file);
  } catch (err) {
    console.error("Image load failed", { err, file });
    throw err;
  }

  const sliceHeight = image.height / 4;
  const slices = [];
  const watermarkLogo = await loadWatermarkLogo();
  const targetDisplayWidth = Math.min(ASSUMED_VIEWPORT_WIDTH, image.width);
  const displayScale = targetDisplayWidth / image.width || 1;

  try {
    const scale = targetDisplayWidth / image.width || 1;
    const gapSourcePx = GAP_PX / scale; // convert 12px screen gap to source pixels

    const totalGap = gapSourcePx * 3;
    const contentHeight = Math.max(4, image.height - totalGap); // ensure we have at least 1px per slice
    const baseVisible = contentHeight / 4;
    let cursor = 0; // position in the original image accounting for removed gaps

    for (let i = 0; i < 4; i += 1) {
      // Allocate integer heights that sum to contentHeight to avoid drift.
      const targetStartWithinContent = Math.round(i * baseVisible);
      const targetEndWithinContent =
        i === 3 ? contentHeight : Math.round((i + 1) * baseVisible);

      const sliceVisibleHeight = Math.max(
        1,
        targetEndWithinContent - targetStartWithinContent,
      );

      const startY = Math.round(cursor);
      const endY = Math.round(cursor + sliceVisibleHeight);

      const safeStart = Math.max(0, Math.min(startY, image.height - 1));
      const safeEnd = Math.max(safeStart + 1, Math.min(endY, image.height));

      // If trimming collapses the slice (tiny images), fall back to an untrimmed boundary.
      if (safeEnd - safeStart < 1) {
        const fallbackStart = Math.round(i * sliceHeight);
        const fallbackEnd = Math.max(
          fallbackStart + 1,
          Math.min(Math.round((i + 1) * sliceHeight), image.height),
        );
        slices.push(
          createSliceDataUrl(
            image,
            0,
            fallbackStart,
            image.width,
            fallbackEnd - fallbackStart,
            watermarkLogo,
            i === 3,
            displayScale,
          ),
        );
        cursor = fallbackEnd + gapSourcePx;
        continue;
      }

      const sourceHeight = safeEnd - safeStart;
      slices.push(
        createSliceDataUrl(
          image,
          0,
          safeStart,
          image.width,
          sourceHeight,
          watermarkLogo,
          i === 3,
          displayScale,
        ),
      );
      cursor = safeEnd + (i < 3 ? gapSourcePx : 0); // skip the gap worth of pixels for the next slice
    }
  } catch (err) {
    console.error("Slice generation failed", {
      err,
      imageDims: { width: image.width, height: image.height },
    });
    throw err;
  }

  return {
    slices,
  };
};

function App() {
  const [step, setStep] = useState("upload");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const deriveFileParts = (fileName = "") => {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return { baseName: fileName || "image", extension: "png" };
    }
    return {
      baseName: fileName.slice(0, lastDot),
      extension: fileName.slice(lastDot + 1),
    };
  };

  const handleFile = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setError("");

    try {
      const output = await sliceImage(file);
      const { baseName, extension } = deriveFileParts(file.name);
      setResult({ ...output, baseName, extension });
      setStep("preview");
    } catch (err) {
      console.error("Failed to process image", { err, file });
      setError("Unable to process that image. Try a different file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setResult(null);
    setStep("upload");
    setError("");
  };

  const downloadAll = () => {
    if (!result) return;
    result.slices.forEach((src, index) => {
      const link = document.createElement("a");
      link.href = src;
      const baseName = result.baseName || "image";
      const extension = result.extension || "png";
      link.download = `${index + 1}-${baseName}-tap-the-post.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <img src="/logo.svg" alt="tap-the-post logo" className="brand-logo" />
        </div>
      </header>

      <main className="content">
        {step === "upload" ? (
          <section className="panel">
            <div className="intro">
              <p className="eyebrow">Twitter/X 4-up ready</p>
              <h1>Crop once, post seamlessly.</h1>
              <p className="lede">
                Drop a single image and get four slices trimmed for the 12px gap
                so your multi-image post stays flush.
              </p>
            </div>
            <label className={`dropzone ${isProcessing ? "is-loading" : ""}`}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFile(event.target.files?.[0])}
                disabled={isProcessing}
              />
              <div className="drop-text">
                <strong>
                  {isProcessing ? "Processing…" : "Choose or drop an image"}
                </strong>
                <span>Images stay on your device. PNG/JPEG recommended.</span>
              </div>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="notes">
              <span>
                Outputs 4 slices; each accounts for a {GAP_PX}px gap between
                posts.
              </span>
              <span>No uploads. Everything runs in your browser.</span>
            </div>
          </section>
        ) : null}

        {step === "preview" && result ? (
          <section className="panel">
            <div className="panel-header">
              <div className="intro">
                <p className="eyebrow">Ready for X</p>
                <h1>Your cropped set</h1>
                <p className="lede">
                  Previewed in a Twitter-style stack: 12px gap, 16px radius, and
                  a subtle border.
                </p>
              </div>
              <button className="ghost" onClick={reset}>
                Start over
              </button>
            </div>

            <div className="preview-layout">
              <div className="stack" aria-label="Twitter style gallery preview">
                {result.slices.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt={`Segment ${index + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>

              <div className="summary">
                <p className="eyebrow">Done</p>
                <h2>Cropped and gap-trimmed</h2>
                <p className="lede">
                  Each slice removes 12px between rows so the set reunites
                  perfectly once Twitter adds its spacing.
                </p>
                <div className="actions column">
                  <button onClick={downloadAll}>Download all 4</button>
                  <label className="secondary">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                      disabled={isProcessing}
                    />
                    <span>
                      {isProcessing ? "Processing…" : "Replace image"}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
