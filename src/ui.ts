export class UI {
  private scoreElement: HTMLSpanElement
  private remainingElement: HTMLSpanElement
  private statusElement: HTMLSpanElement
  private soundStateElement!: HTMLSpanElement
  private headTrackingStateElement!: HTMLSpanElement
  private debugCamera!: HTMLSpanElement
  private debugHand!: HTMLSpanElement
  private debugFinger!: HTMLSpanElement
  private debugFlick!: HTMLSpanElement
  private debugFace!: HTMLSpanElement
  private debugHeadX!: HTMLSpanElement
  private debugHeadY!: HTMLSpanElement
  private debugYawDelta!: HTMLSpanElement
  private debugPitchDelta!: HTMLSpanElement
  private debugLastShot!: HTMLSpanElement
  private hintElement: HTMLDivElement
  private debugPanel: HTMLDivElement
  private winOverlay: HTMLDivElement
  private startOverlay!: HTMLDivElement
  private shotTimeout?: number
  private debugVisible = false

  constructor() {
    this.scoreElement = document.createElement('span')
    this.remainingElement = document.createElement('span')
    this.statusElement = document.createElement('span')
    this.hintElement = document.createElement('div')
    this.debugPanel = document.createElement('div')
    this.winOverlay = document.createElement('div')

    this.buildUI()
  }

  update(score: number, remaining: number, status: string, soundState: string, headState: string) {
    this.scoreElement.textContent = String(score)
    this.remainingElement.textContent = String(remaining)
    this.statusElement.textContent = status
    this.soundStateElement.textContent = soundState
    this.headTrackingStateElement.textContent = headState
  }

  updateDebug(debug: {
    cameraActive: boolean
    handDetected: boolean
    fingerGun: boolean
    flick: boolean
    faceDetected: boolean
    headX: number
    headY: number
    yawDelta: number
    pitchDelta: number
    lastShotTime: number
  }) {
    this.debugCamera.textContent = debug.cameraActive ? 'yes' : 'no'
    this.debugHand.textContent = debug.handDetected ? 'yes' : 'no'
    this.debugFinger.textContent = debug.fingerGun ? 'yes' : 'no'
    this.debugFlick.textContent = debug.flick ? 'yes' : 'no'
    this.debugFace.textContent = debug.faceDetected ? 'yes' : 'no'
    this.debugHeadX.textContent = debug.headX.toFixed(2)
    this.debugHeadY.textContent = debug.headY.toFixed(2)
    this.debugYawDelta.textContent = debug.yawDelta.toFixed(3)
    this.debugPitchDelta.textContent = debug.pitchDelta.toFixed(3)
    this.debugLastShot.textContent = debug.lastShotTime ? new Date(debug.lastShotTime).toLocaleTimeString() : '—'
  }

  flashShot() {
    this.statusElement.textContent = 'Shot fired'
    window.clearTimeout(this.shotTimeout)
    this.shotTimeout = window.setTimeout(() => {
      this.statusElement.textContent = this.statusElement.textContent === 'Shot fired' ? 'Finger gun detected' : this.statusElement.textContent
    }, 320)
  }

  showWin(score: number) {
    this.winOverlay.style.display = 'flex'
    const title = this.winOverlay.querySelector<HTMLHeadingElement>('#win-title')
    const scoreLabel = this.winOverlay.querySelector<HTMLParagraphElement>('#win-score')
    if (title) title.textContent = 'All meme hamsters are asleep!'
    if (scoreLabel) scoreLabel.textContent = `Score: ${score}`
  }

  hideWin() {
    this.winOverlay.style.display = 'none'
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible
    this.debugPanel.style.display = this.debugVisible ? 'grid' : 'none'
  }

  private buildUI() {
    const container = document.createElement('div')
    container.id = 'game-ui'

    const panel = document.createElement('div')
    panel.className = 'game-panel'
    panel.innerHTML = `
      <div class="panel-title">햄스터들을 재우세여</div>
      <div><strong>Score</strong><span id="score-value">0</span></div>
      <div><strong>깨어있는 햄스터</strong><span id="remaining-value">0</span></div>
      <div><strong>Gesture</strong><span id="status-text"></span></div>
      <div><strong>Sound</strong><span id="sound-state">ON</span></div>
      <div><strong>Head tracking</strong><span id="headtracking-state">OFF</span></div>
    `
    container.appendChild(panel)

    this.debugPanel.id = 'debug-panel'
    this.debugPanel.innerHTML = `
      <div class="debug-row"><strong>Camera</strong><span id="debug-camera">no</span></div>
      <div class="debug-row"><strong>Hand</strong><span id="debug-hand">no</span></div>
      <div class="debug-row"><strong>Finger gun</strong><span id="debug-finger">no</span></div>
      <div class="debug-row"><strong>Flick</strong><span id="debug-flick">no</span></div>
      <div class="debug-row"><strong>Face</strong><span id="debug-face">no</span></div>
      <div class="debug-row"><strong>Head X</strong><span id="debug-headx">0.00</span></div>
      <div class="debug-row"><strong>Head Y</strong><span id="debug-heady">0.00</span></div>
      <div class="debug-row"><strong>Yaw Δ</strong><span id="debug-yawdelta">0.000</span></div>
      <div class="debug-row"><strong>Pitch Δ</strong><span id="debug-pitchdelta">0.000</span></div>
      <div class="debug-row"><strong>Last shot</strong><span id="debug-lastshot">—</span></div>
    `
    this.debugPanel.style.display = 'none'
    container.appendChild(this.debugPanel)

    this.hintElement.id = 'hint-text'
    this.hintElement.textContent = 'T = 테스트 발사 · H = 고개 트래킹 · M = 소리 끄기/켜기 · D = 디버그'
    container.appendChild(this.hintElement)

    document.body.appendChild(container)

    this.scoreElement = panel.querySelector<HTMLSpanElement>('#score-value')!
    this.remainingElement = panel.querySelector<HTMLSpanElement>('#remaining-value')!
    this.statusElement = panel.querySelector<HTMLSpanElement>('#status-text')!
    this.soundStateElement = panel.querySelector<HTMLSpanElement>('#sound-state')!
    this.headTrackingStateElement = panel.querySelector<HTMLSpanElement>('#headtracking-state')!
    this.debugCamera = this.debugPanel.querySelector<HTMLSpanElement>('#debug-camera')!
    this.debugHand = this.debugPanel.querySelector<HTMLSpanElement>('#debug-hand')!
    this.debugFinger = this.debugPanel.querySelector<HTMLSpanElement>('#debug-finger')!
    this.debugFlick = this.debugPanel.querySelector<HTMLSpanElement>('#debug-flick')!
    this.debugFace = this.debugPanel.querySelector<HTMLSpanElement>('#debug-face')!
    this.debugHeadX = this.debugPanel.querySelector<HTMLSpanElement>('#debug-headx')!
    this.debugHeadY = this.debugPanel.querySelector<HTMLSpanElement>('#debug-heady')!
    this.debugYawDelta = this.debugPanel.querySelector<HTMLSpanElement>('#debug-yawdelta')!
    this.debugPitchDelta = this.debugPanel.querySelector<HTMLSpanElement>('#debug-pitchdelta')!
    this.debugLastShot = this.debugPanel.querySelector<HTMLSpanElement>('#debug-lastshot')!

    const crosshair = document.createElement('div')
    crosshair.id = 'crosshair'
    document.body.appendChild(crosshair)

    this.winOverlay.id = 'win-overlay'
    this.winOverlay.innerHTML = `
      <div id="win-card">
        <h2 id="win-title">All meme hamsters are asleep!</h2>
        <p id="win-score">Score: 0</p>
        <button id="restart-button">Restart</button>
      </div>
    `
    this.winOverlay.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).id === 'restart-button') {
        this.hideWin()
        window.location.reload()
      }
    })
    document.body.appendChild(this.winOverlay)

    this.startOverlay = document.createElement('div')
    this.startOverlay.id = 'start-overlay'
    this.startOverlay.innerHTML = `
      <div id="start-card">
        <div class="start-scene">
          <div class="cloud cloud-1"></div>
          <div class="cloud cloud-2"></div>
          <div class="cloud cloud-3"></div>
          <div class="hill hill-left"></div>
          <div class="hill hill-right"></div>
          <div class="sun"></div>
          <div class="hamster-icon">🐹</div>
        </div>
        <h2>햄스터들을 재우세여</h2>
        <p class="subtitle">손총으로 피용피용 쏴서 춤추는 햄스터들을 낮잠 재우는 게임</p>
        <div class="start-tips">
          <div>손총 모양 + 위로 까딱 = 피용!</div>
          <div>T = 테스트 발사</div>
          <div>H = 고개 트래킹</div>
          <div>M = 소리 끄기/켜기</div>
        </div>
        <button id="start-button">시작하기</button>
      </div>
    `
    document.body.appendChild(this.startOverlay)
  }

  showStartScreen(onStart: () => void) {
    if (!this.startOverlay) return
    this.startOverlay.style.display = 'flex'
    const startButton = this.startOverlay.querySelector<HTMLButtonElement>('#start-button')
    startButton?.addEventListener('click', () => onStart(), { once: true })
  }

  hideStartScreen() {
    if (!this.startOverlay) return
    this.startOverlay.style.display = 'none'
  }
}
