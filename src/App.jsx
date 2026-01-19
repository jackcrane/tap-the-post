import { useState } from "react";
import "./App.css";

const GAP_PX = 12;
const ASSUMED_VIEWPORT_WIDTH = 390; // typical iPhone CSS px width

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

  try {
    const targetDisplayWidth = Math.min(ASSUMED_VIEWPORT_WIDTH, image.width);
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
        i === 3
          ? contentHeight
          : Math.round((i + 1) * baseVisible);

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
          (() => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = fallbackEnd - fallbackStart;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              image,
              0,
              fallbackStart,
              image.width,
              fallbackEnd - fallbackStart,
              0,
              0,
              canvas.width,
              canvas.height,
            );
            return canvas.toDataURL("image/png");
          })(),
        );
        cursor = fallbackEnd + gapSourcePx;
        continue;
      }

      const sourceHeight = safeEnd - safeStart;
      const canvas = document.createElement("canvas");

      canvas.width = image.width;
      canvas.height = sourceHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        image,
        0,
        safeStart,
        image.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      slices.push(canvas.toDataURL("image/png"));
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

  const handleFile = async (file) => {
    if (!file) return;

    setIsProcessing(true);
    setError("");

    try {
      const output = await sliceImage(file);
      setResult(output);
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
      link.download = `tap-the-post-segment-${index + 1}.png`;
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
