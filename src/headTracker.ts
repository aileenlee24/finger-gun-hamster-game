import '@mediapipe/camera_utils'

declare global {
  interface Window {
    FaceDetector?: any
  }
}

type HeadOffsets = { yaw: number; pitch: number; faceX: number; faceY: number }

export class HeadTracker {
  public faceDetected = false
  public cameraActive = false
  public faceX = 0
  public faceY = 0

  private video: HTMLVideoElement
  private detector: any | null = null
  private lastResult: any | null = null
  private lastDetectTime = 0
  private pending = false
  private smoothYaw = 0
  private smoothPitch = 0
  private targetYaw = 0
  private targetPitch = 0
  private started = false

  constructor() {
    this.video = document.createElement('video')
    this.video.style.display = 'none'
    this.video.setAttribute('playsinline', 'true')
    this.video.muted = true
    this.video.autoplay = true
    document.body.appendChild(this.video)

    if ('FaceDetector' in window) {
      this.detector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
    }
  }

  start(sourceVideo?: HTMLVideoElement) {
    if (this.started) {
      return
    }
    this.started = true

    if (sourceVideo) {
      this.video = sourceVideo
      this.cameraActive = true
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        this.video.srcObject = stream
        this.cameraActive = true
        return this.video.play()
      })
      .catch(() => {
        this.lastResult = null
        this.cameraActive = false
      })
  }

  update(): HeadOffsets {
    if (!this.detector || !this.video.videoWidth) {
      this.faceDetected = false
      this.faceX = 0
      this.faceY = 0
      return { yaw: 0, pitch: 0, faceX: 0, faceY: 0 }
    }

    const now = performance.now()
    if (!this.pending && now - this.lastDetectTime > 160) {
      this.pending = true
      this.detector
        .detect(this.video)
        .then((faces: any[]) => {
          this.pending = false
          this.lastDetectTime = performance.now()
          if (faces.length > 0) {
            this.lastResult = faces[0]
            this.faceDetected = true
          } else {
            this.lastResult = null
            this.faceDetected = false
          }
        })
        .catch(() => {
          this.pending = false
          this.lastResult = null
          this.faceDetected = false
        })
    }

    if (this.lastResult && this.lastResult.boundingBox) {
      const box = this.lastResult.boundingBox
      const centerX = box.left + box.width / 2
      const centerY = box.top + box.height / 2
      const normX = (centerX / this.video.videoWidth) * 2 - 1
      const normY = (centerY / this.video.videoHeight) * 2 - 1
      this.faceX = normX
      this.faceY = normY
      this.targetYaw = Math.max(-0.45, Math.min(0.45, -normX * 0.45))
      this.targetPitch = Math.max(-0.22, Math.min(0.22, -normY * 0.38))
    } else {
      this.faceX = 0
      this.faceY = 0
    }

    this.smoothYaw += (this.targetYaw - this.smoothYaw) * 0.12
    this.smoothPitch += (this.targetPitch - this.smoothPitch) * 0.12

    return {
      yaw: this.smoothYaw,
      pitch: this.smoothPitch,
      faceX: this.faceX,
      faceY: this.faceY
    }
  }
}
