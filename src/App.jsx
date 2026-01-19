import { useState } from 'react'
import './App.css'

const GAP_PX = 12

const loadImageFromFile = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch (_) {
      // Fall through to Image-based decode
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to load image'))
    }
    img.src = objectUrl
  })
}

const sliceImage = async (file) => {
  let image
  try {
    image = await loadImageFromFile(file)
  } catch (err) {
    console.error('Image load failed', { err, file })
    throw err
  }

  const TRIM_PX = 6
  const sliceHeight = image.height / 4
  const slices = []

  try {
    for (let i = 0; i < 4; i += 1) {
      const rawStart = Math.floor(i * sliceHeight) + TRIM_PX
      const rawEnd = Math.ceil((i + 1) * sliceHeight) - TRIM_PX

      const startY = Math.max(0, Math.min(rawStart, image.height - 1))
      let endY = Math.max(startY + 1, Math.min(rawEnd, image.height))

      // If trim collapses the slice (very small images), fall back to untrimmed boundaries.
      if (endY - startY < 1) {
        const fallbackStart = Math.floor(i * sliceHeight)
        const fallbackEnd = Math.min(image.height, Math.ceil((i + 1) * sliceHeight))
        endY = Math.max(fallbackStart + 1, fallbackEnd)
      }

      const sourceHeight = endY - startY
      const canvas = document.createElement('canvas')

      canvas.width = image.width
      canvas.height = sourceHeight

      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        0,
        startY,
        image.width,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      slices.push(canvas.toDataURL('image/png'))
    }
  } catch (err) {
    console.error('Slice generation failed', { err, imageDims: { width: image.width, height: image.height } })
    throw err
  }

  return {
    slices,
  }
}

function App() {
  const [step, setStep] = useState('upload')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)

  const handleFile = async (file) => {
    if (!file) return

    setIsProcessing(true)
    setError('')

    try {
      const output = await sliceImage(file)
      setResult(output)
      setStep('preview')
    } catch (err) {
      console.error('Failed to process image', { err, file })
      setError('Unable to process that image. Try a different file.')
    } finally {
      setIsProcessing(false)
    }
  }

  const reset = () => {
    setResult(null)
    setStep('upload')
    setError('')
  }

  const downloadAll = () => {
    if (!result) return
    result.slices.forEach((src, index) => {
      const link = document.createElement('a')
      link.href = src
      link.download = `tap-the-post-segment-${index + 1}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  return (
    <div className="page">
      <header className="top-bar">
        <div className="brand">
          <img src="/logo.svg" alt="tap-the-post logo" className="brand-logo" />
        </div>
      </header>

      <main className="content">
        {step === 'upload' ? (
          <section className="panel">
            <div className="intro">
              <p className="eyebrow">Twitter/X 4-up ready</p>
              <h1>Crop once, post seamlessly.</h1>
              <p className="lede">
                Drop a single image and get four slices trimmed for the 12px gap so your multi-image post
                stays flush.
              </p>
            </div>
            <label className={`dropzone ${isProcessing ? 'is-loading' : ''}`}>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleFile(event.target.files?.[0])}
                disabled={isProcessing}
              />
              <div className="drop-text">
                <strong>{isProcessing ? 'Processing…' : 'Choose or drop an image'}</strong>
                <span>Images stay on your device. PNG/JPEG recommended.</span>
              </div>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <div className="notes">
              <span>Outputs 4 slices; each accounts for a {GAP_PX}px gap between posts.</span>
              <span>No uploads. Everything runs in your browser.</span>
            </div>
          </section>
        ) : null}

        {step === 'preview' && result ? (
          <section className="panel">
            <div className="panel-header">
              <div className="intro">
                <p className="eyebrow">Ready for X</p>
                <h1>Your cropped set</h1>
                <p className="lede">
                  Previewed in a Twitter-style stack: 12px gap, 16px radius, and a subtle border.
                </p>
              </div>
              <button className="ghost" onClick={reset}>
                Start over
              </button>
            </div>

            <div className="preview-layout">
              <div className="stack" aria-label="Twitter style gallery preview">
                {result.slices.map((src, index) => (
                  <img key={src} src={src} alt={`Segment ${index + 1}`} loading="lazy" />
                ))}
              </div>

              <div className="summary">
                <p className="eyebrow">Done</p>
                <h2>Cropped and gap-trimmed</h2>
                <p className="lede">
                  Each slice removes 12px between rows so the set reunites perfectly once Twitter adds its spacing.
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
                    <span>{isProcessing ? 'Processing…' : 'Replace image'}</span>
                  </label>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
