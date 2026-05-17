import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Cropper from 'react-easy-crop'
import { RotateCcw, Upload, X } from 'lucide-react'

function createImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

function getRadianAngle(deg) {
  return (deg * Math.PI) / 180
}

function rotateSize(width, height, rotation) {
  const rad = getRadianAngle(rotation)
  return {
    width:  Math.abs(Math.cos(rad) * width)  + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width)  + Math.abs(Math.cos(rad) * height),
  }
}

async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const { width: bw, height: bh } = rotateSize(image.width, image.height, rotation)
  canvas.width = bw
  canvas.height = bh

  ctx.translate(bw / 2, bh / 2)
  ctx.rotate(getRadianAngle(rotation))
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const OUTPUT = 512
  const out = document.createElement('canvas')
  out.width = OUTPUT
  out.height = OUTPUT
  const outCtx = out.getContext('2d')
  outCtx.drawImage(canvas, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, OUTPUT, OUTPUT)

  return new Promise(resolve => out.toBlob(blob => resolve(blob), 'image/webp', 0.92))
}

export default function ProfilePhotoCropper({ imageSrc, onConfirm, onCancel }) {
  const [src, setSrc] = useState(imageSrc)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [working, setWorking] = useState(false)
  const internalBlobRef = useRef(null)

  useEffect(() => {
    return () => {
      if (internalBlobRef.current) URL.revokeObjectURL(internalBlobRef.current)
    }
  }, [])

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  function reset() {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
  }

  function handleInternalFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) return
    if (file.size > 10 * 1024 * 1024) return
    if (internalBlobRef.current) URL.revokeObjectURL(internalBlobRef.current)
    const newSrc = URL.createObjectURL(file)
    internalBlobRef.current = newSrc
    setSrc(newSrc)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setCroppedAreaPixels(null)
  }

  async function handleConfirm() {
    if (!croppedAreaPixels || working) return
    setWorking(true)
    try {
      const blob = await getCroppedImg(src, croppedAreaPixels, rotation)
      onConfirm(blob)
    } catch {
      setWorking(false)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  return createPortal(
    <div className="profile-crop-overlay" role="dialog" aria-modal="true" aria-label="Recadrer la photo" onClick={handleOverlayClick}>
      <div className="profile-crop-modal">

        <div className="profile-crop-header">
          <span>Recadrer la photo</span>
          <button type="button" className="profile-crop-close" onClick={onCancel} aria-label="Annuler">
            <X size={16} />
          </button>
        </div>

        <p className="profile-crop-hint">Ajustez votre photo avant de l'enregistrer.</p>

        <div className="profile-crop-area">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="crop-slider-row">
          <span>Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={e => setZoom(Number(e.target.value))} aria-label="Zoom" />
        </div>

        <div className="crop-slider-row">
          <span>Rotation</span>
          <input type="range" min={-180} max={180} step={1} value={rotation}
            onChange={e => setRotation(Number(e.target.value))} aria-label="Rotation" />
        </div>

        <div className="profile-crop-actions">
          <button type="button" className="crop-btn-reset" onClick={reset}>
            <RotateCcw size={13} /> Réinitialiser
          </button>
          <label className="crop-btn-change">
            <Upload size={13} /> Changer
            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleInternalFileChange} style={{ display: 'none' }} />
          </label>
          <button type="button" className="crop-btn-cancel" onClick={onCancel}>Annuler</button>
          <button type="button" className="crop-btn-confirm" onClick={handleConfirm} disabled={working}>
            {working ? '…' : 'Valider'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  )
}
