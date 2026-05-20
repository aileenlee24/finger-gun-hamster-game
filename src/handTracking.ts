
type GestureStatus = 'No hand' | 'Finger gun detected' | 'Shot fired'

declare global {
  interface Window {
    Hands: any
    Camera: any
  }
}

type Results = any

export class HandTracker {
  public status: GestureStatus = 'No hand'
  public cameraActive = false
  public handDetected = false
  public fingerGunDetected = false
  public flickDetected = false
  public lastShotTimePublic = 0
  public video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private hands: any
  private camera: any
  private prevIndexY: number | null = null
  private shotPending = false
  private lastShotTime = 0
  private lastHandSeen = 0
  private lastProcess = 0
  private processInterval = 66 // ~15 FPS

  constructor() {
    this.video = document.createElement('video')
    this.video.style.display = 'none'
    this.video.setAttribute('playsinline', 'true')
    this.video.muted = true
    this.video.autoplay = true
    document.body.appendChild(this.video)

    this.canvas = document.createElement('canvas')
    this.canvas.id = 'hand-overlay'
    this.canvas.width = 320
    this.canvas.height = 240
    document.body.appendChild(this.canvas)

    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to create canvas context for hand overlay.')
    }
    this.context = context

    const Hands = (window as any).Hands
    const Camera = (window as any).Camera
    this.hands = new Hands({ locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` })
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55,
      selfieMode: true
    })
    this.hands.onResults(this.onResults.bind(this))
    this.camera = new Camera(this.video, {
      onFrame: async () => {
        const now = performance.now()
        if (now - this.lastProcess >= this.processInterval) {
          this.lastProcess = now
          try {
            await this.hands.send({ image: this.video })
          } catch (e) {
            // ignore send errors
          }
        }
      },
      width: 320,
      height: 240
    })
  }

  start() {
    this.camera
      .start()
      .then(() => {
        this.cameraActive = true
      })
      .catch(() => {
        console.warn('Webcam permission denied or unavailable.')
        this.status = 'No hand'
        this.cameraActive = false
      })
  }

  hasShot() {
    if (this.shotPending) {
      this.shotPending = false
      return true
    }
    return false
  }

  private onResults(results: Results) {
    const ctx = this.context
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const now = performance.now()

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.handDetected = false
      // only reset prevIndexY after a short timeout to avoid losing state across brief drops
      if (now - this.lastHandSeen > 320) {
        this.prevIndexY = null
      }
      this.status = 'No hand'
      return
    }

    const landmarks = results.multiHandLandmarks[0]
    this.handDetected = true
    this.lastHandSeen = now
    const isFingerGun = this.detectFingerGun(landmarks)
    this.fingerGunDetected = isFingerGun
    const shotFired = this.detectShot(landmarks, isFingerGun)
    this.flickDetected = shotFired

    if (shotFired) {
      this.status = 'Shot fired'
      this.shotPending = true
      this.lastShotTimePublic = this.lastShotTime
    } else if (isFingerGun) {
      this.status = 'Finger gun detected'
    } else {
      this.status = 'No hand'
    }

    this.drawLandmarks(landmarks)
  }

  private drawLandmarks(landmarks: Array<{ x: number; y: number }>) {
    const ctx = this.context
    ctx.strokeStyle = 'rgba(106, 226, 255, 0.65)'
    ctx.fillStyle = 'rgba(180, 245, 255, 0.8)'
    ctx.lineWidth = 2

    landmarks.forEach((landmark) => {
      const x = landmark.x * this.canvas.width
      const y = landmark.y * this.canvas.height
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    })
  }

  private detectFingerGun(landmarks: Array<{ x: number; y: number; z: number }>) {
    const thumbTip = landmarks[4]
    const thumbIP = landmarks[3]
    const indexTip = landmarks[8]
    const indexPIP = landmarks[6]
    const ringTip = landmarks[16]
    const ringPIP = landmarks[14]
    const pinkyTip = landmarks[20]
    const pinkyPIP = landmarks[18]

    const thumbUp = thumbTip.y < thumbIP.y
    const indexExtended = indexTip.y < indexPIP.y && Math.abs(indexTip.x - indexPIP.x) > 0.03
    const ringFolded = ringTip.y > ringPIP.y
    const pinkyFolded = pinkyTip.y > pinkyPIP.y

    return thumbUp && indexExtended && ringFolded && pinkyFolded
  }

  private detectShot(
    landmarks: Array<{ x: number; y: number; z: number }>,
    isFingerGun: boolean
  ) {
    const indexTip = landmarks[8]
    const now = performance.now()
    if (!isFingerGun) {
      // preserve prevIndexY for a few frames; don't reset immediately
      return false
    }

    if (this.prevIndexY === null) {
      this.prevIndexY = indexTip.y
      return false
    }

    const deltaY = this.prevIndexY - indexTip.y
    const shot = deltaY > 0.045 && now - this.lastShotTime > 350 // 350ms cooldown
    this.prevIndexY = indexTip.y

    if (shot) {
      this.lastShotTime = now
      this.lastShotTimePublic = now
    }

    return shot
  }
}
