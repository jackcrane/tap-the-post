import { useState } from 'react'
import './App.css'

const GAP_PX = 12

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Unable to load image'))
    img.src = src
  })

const sliceImage = async (file) => {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(dataUrl)

  const adjustedHeight = image.height - GAP_PX * 3
  const baseHeight = Math.floor(adjustedHeight / 4)
  const heights = [baseHeight, baseHeight, baseHeight, adjustedHeight - baseHeight * 3]
  const slices = []

  let offsetY = 0
  for (let i = 0; i < 4; i += 1) {
    const sourceHeight = heights[i]
    const canvas = document.createElement('canvas')

    canvas.width = image.width
    canvas.height = sourceHeight

    const ctx = canvas.getContext('2d')
    ctx.drawImage(
      image,
      0,
      offsetY,
      image.width,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    slices.push(canvas.toDataURL('image/png'))
    offsetY += sourceHeight + GAP_PX
  }

  return {
    source: dataUrl,
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
          <span className="brand-mark">tap-the-post</span>
          <span className="domain">.com</span>
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
