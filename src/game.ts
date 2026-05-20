import * as THREE from 'three'
import { Hamster } from './hamster'
import { PlayerControls } from './playerControls'
import { HandTracker } from './handTracking'
import { HeadTracker } from './headTracker'
import { AudioManager } from './audio'
import { UI } from './ui'

type DartData = {
  group: THREE.Group
  direction: THREE.Vector3
  speed: number
  life: number
}

export default class Game {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)
  private renderer = new THREE.WebGLRenderer({ antialias: true })
  private clock = new THREE.Clock()
  private controls: PlayerControls
  private handTracker: HandTracker
  private faceTracker = new HeadTracker()
  private audio = new AudioManager()
  private ui: UI
  private hamsters: Hamster[] = []
  private darts: DartData[] = []
  private sleepEffects: Array<{ group: THREE.Group; life: number }> = []
  private obstacleBounds: THREE.Box3[] = []
  private score = 0
  private shotCooldown = 0
  private maxActiveDarts = 6
  private winShown = false
  private chunks = new Map<string, THREE.Group>()
  private playerChunkX = 0
  private playerChunkZ = 0
  private chunkSize = 36
  private headTrackingEnabled = false
  private idleSoundTimer = 0
  private worldBounds = { minX: -48, maxX: 48, minZ: -48, maxZ: 48 }

  constructor() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.domElement.style.display = 'block'
    document.body.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x87ceff)
    this.scene.fog = new THREE.FogExp2(0x87ceff, 0.005)
    this.camera.position.set(0, 2.2, 0)
    this.camera.lookAt(0, 2.2, -1)

    this.setupLighting()
    this.buildSkyLayer()
    this.updateChunks(true)
    this.spawnHamsters()

    this.controls = new PlayerControls(this.camera, this.renderer.domElement)
    this.handTracker = new HandTracker()
    this.ui = new UI()

    this.ui.update(this.score, this.hamstersRemaining(), this.handTracker.status, this.audio.isMuted ? 'OFF' : 'ON', 'OFF')
    try {
      this.ui.updateDebug({
        cameraActive: this.handTracker.cameraActive,
        handDetected: this.handTracker.handDetected,
        fingerGun: this.handTracker.fingerGunDetected,
        flick: this.handTracker.flickDetected,
        faceDetected: this.faceTracker.faceDetected,
        headX: this.faceTracker.faceX,
        headY: this.faceTracker.faceY,
        yawDelta: this.controls.lastAppliedYawDelta,
        pitchDelta: this.controls.lastAppliedPitchDelta,
        lastShotTime: this.handTracker.lastShotTimePublic
      })
    } catch (error) {
      console.error('UI debug initialization failed:', error)
    }

    try {
      this.ui.showStartScreen(() => this.start())
    } catch (error) {
      console.error('Failed to show start screen:', error)
    }

    window.addEventListener('resize', this.onResize.bind(this))
    window.addEventListener('keydown', this.onKeyDown.bind(this))
    // Reference legacy builders to avoid unused-function TypeScript errors
    // (these helpers are intentionally kept for possible future use)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _legacyRefs = [this.createTower, this.createCubeCluster, this.createTunnel]
    void _legacyRefs
  }

  start() {
    this.ui.hideStartScreen()
    try {
      this.handTracker.start()
    } catch (error) {
      console.error('Hand tracker failed to start:', error)
    }

    try {
      this.audio.backgroundMusic()
    } catch (error) {
      console.error('Audio failed to start:', error)
    }

    this.idleSoundTimer = performance.now() + 6500
    this.animate()
  }

  private animate() {
    requestAnimationFrame(() => this.animate())
    const delta = this.clock.getDelta()
    const headOffsets = this.headTrackingEnabled ? this.faceTracker.update() : null
    const faceDetected = this.headTrackingEnabled && this.faceTracker.faceDetected
    this.controls.update(delta, headOffsets, faceDetected)
    this.update(delta)
    this.renderer.render(this.scene, this.camera)
  }

  private update(delta: number) {
    if (this.handTracker.hasShot()) {
      this.fireShot()
    }

    this.applyPlayerCollision()
    this.hamsters.forEach((hamster) => hamster.update(delta))
    this.updateDarts(delta)
    this.updateHitEffects(delta)

    if (performance.now() >= this.idleSoundTimer) {
      this.audio.playHamsterIdle()
      this.idleSoundTimer = performance.now() + 8000 + Math.random() * 12000
    }

    this.ui.update(
      this.score,
      this.hamstersRemaining(),
      this.handTracker.status,
      this.audio.isMuted ? 'OFF' : 'ON',
      this.headTrackingEnabled ? 'ON' : 'OFF'
    )
    this.ui.updateDebug({
      cameraActive: this.handTracker.cameraActive,
      handDetected: this.handTracker.handDetected,
      fingerGun: this.handTracker.fingerGunDetected,
      flick: this.handTracker.flickDetected,
      faceDetected: this.faceTracker.faceDetected,
      headX: this.faceTracker.faceX,
      headY: this.faceTracker.faceY,
      yawDelta: this.controls.lastAppliedYawDelta,
      pitchDelta: this.controls.lastAppliedPitchDelta,
      lastShotTime: this.handTracker.lastShotTimePublic
    })

    if (!this.winShown && this.hamstersRemaining() === 0) {
      this.winShown = true
      this.ui.showWin(this.score)
    }
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private onKeyDown(event: KeyboardEvent) {
    if (event.code === 'KeyT') {
      this.fireShot()
    }
    if (event.code === 'KeyH') {
      this.headTrackingEnabled = !this.headTrackingEnabled
      this.controls.setHeadControl(this.headTrackingEnabled)
      if (this.headTrackingEnabled) {
        this.faceTracker.start(this.handTracker.video)
      }
    }
    if (event.code === 'KeyM') {
      this.audio.toggleMute()
    }
    if (event.code === 'KeyD') {
      this.ui.toggleDebug()
    }
    if (event.code === 'KeyL') {
      this.controls.lock()
    }
    if (event.code === 'KeyR' && this.winShown) {
      this.reset()
    }
  }

  private fireShot() {
    const now = performance.now()
    if (this.shotCooldown > now) {
      return
    }
    this.shotCooldown = now + 420
    this.ui.flashShot()
    this.audio.playShootSound()
    this.spawnDart()
  }

  private spawnDart() {
    if (this.darts.length >= this.maxActiveDarts) {
      const oldest = this.darts.shift()
      if (oldest) {
        this.scene.remove(oldest.group)
      }
    }

    const group = new THREE.Group()
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x91f7ff, emissive: 0x4dc9ff, emissiveIntensity: 1.2, flatShading: true })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), bodyMaterial)
    group.add(body)

    const trailMaterial = new THREE.MeshStandardMaterial({ color: 0xa2f0ff, emissive: 0x72d8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.8 })
    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.4), trailMaterial)
    trail.position.set(0, 0, -0.85)
    group.add(trail)

    const direction = new THREE.Vector3()
    this.camera.getWorldDirection(direction).normalize()
    group.position.copy(this.camera.position)
    group.position.addScaledVector(direction, 0.75)
    group.lookAt(group.position.clone().add(direction))
    this.scene.add(group)

    this.darts.push({ group, direction, speed: 36, life: 6.0 })
  }

  private updateDarts(delta: number) {
    const activeDarts: DartData[] = []
    const previous = new THREE.Vector3()
    this.darts.forEach((dart) => {
      previous.copy(dart.group.position)
      dart.group.position.addScaledVector(dart.direction, dart.speed * delta)
      dart.life -= delta

      const insideBounds =
        dart.group.position.x >= this.worldBounds.minX - 10 &&
        dart.group.position.x <= this.worldBounds.maxX + 10 &&
        dart.group.position.z >= this.worldBounds.minZ - 10 &&
        dart.group.position.z <= this.worldBounds.maxZ + 10

      if (!this.traceDart(previous, dart.group.position) && dart.life > 0 && insideBounds) {
        activeDarts.push(dart)
      } else {
        this.scene.remove(dart.group)
      }
    })
    this.darts = activeDarts
  }

  private traceDart(start: THREE.Vector3, end: THREE.Vector3): Hamster | null {
    const segment = new THREE.Vector3().subVectors(end, start)
    const segmentLengthSq = segment.lengthSq()
    if (segmentLengthSq === 0) {
      return null
    }

    let closestHamster: Hamster | null = null
    let closestDistance = Infinity
    const hitRadius = 1.3

    for (const hamster of this.hamsters) {
      if (!hamster.isAwake) {
        continue
      }
      const center = hamster.group.position.clone()
      const toCenter = new THREE.Vector3().subVectors(center, start)
      const t = Math.max(0, Math.min(1, toCenter.dot(segment) / segmentLengthSq))
      const nearest = new THREE.Vector3().copy(start).addScaledVector(segment, t)
      const distance = nearest.distanceTo(center)
      if (distance <= hitRadius && distance < closestDistance) {
        closestDistance = distance
        closestHamster = hamster
      }
    }

    if (closestHamster !== null) {
      closestHamster.sleep()
      this.score += 1
      this.spawnHitEffect(closestHamster)
      this.audio.playSleepSound()
      return closestHamster
    }

    return null
  }

  private updateHitEffects(delta: number) {
    const activeEffects: Array<{ group: THREE.Group; life: number }> = []
    this.sleepEffects.forEach((effect) => {
      effect.life -= delta
      effect.group.position.y += delta * 0.32
      effect.group.children.forEach((child) => {
        if ((child as THREE.Mesh).material) {
          const material = (child as THREE.Mesh).material as THREE.Material & { opacity?: number }
          if (material.transparent) {
            material.opacity = Math.max(0, effect.life / 1.2)
          }
        }
      })
      if (effect.life > 0) {
        activeEffects.push(effect)
      } else {
        this.scene.remove(effect.group)
      }
    })
    this.sleepEffects = activeEffects
  }

  private spawnHitEffect(hamster: Hamster) {
    const group = new THREE.Group()
    const sprite = this.createTextSprite('Zzz', '#fdf5a4')
    sprite.position.set(0, 1.6, 0)
    group.add(sprite)

    for (let i = 0; i < 3; i++) {
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8ffff, transparent: true, opacity: 0.85, emissive: 0xa0f5ff, emissiveIntensity: 0.18, roughness: 0.5 })
      )
      bubble.position.set((Math.random() - 0.5) * 0.4, 1.3 + i * 0.18, (Math.random() - 0.5) * 0.4)
      group.add(bubble)
    }

    group.position.copy(hamster.group.position)
    this.scene.add(group)
    this.sleepEffects.push({ group, life: 1.2 })
  }

  private createTextSprite(text: string, color: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = 'bold 32px ui-sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = color
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    }
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
    return new THREE.Sprite(material)
  }

  private applyPlayerCollision() {
    // Simplified: only clamp to world bounds to avoid getting stuck in obstacles
    const position = this.camera.position
    if (position.x < this.worldBounds.minX) position.x = this.worldBounds.minX
    if (position.x > this.worldBounds.maxX) position.x = this.worldBounds.maxX
    if (position.z < this.worldBounds.minZ) position.z = this.worldBounds.minZ
    if (position.z > this.worldBounds.maxZ) position.z = this.worldBounds.maxZ
  }

  private hamstersRemaining() {
    return this.hamsters.filter((hamster) => hamster.isAwake).length
  }

  private reset() {
    this.score = 0
    this.winShown = false
    this.hamsters.forEach((hamster) => hamster.reset())
    this.ui.hideWin()
    this.ui.update(
      this.score,
      this.hamstersRemaining(),
      this.handTracker.status,
      this.audio.isMuted ? 'OFF' : 'ON',
      this.headTrackingEnabled ? 'ON' : 'OFF'
    )
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xb9e6ff, 0.34)
    this.scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0x90d9ff, 0.95)
    keyLight.position.set(5, 10, 4)
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xa47dff, 0.35)
    fillLight.position.set(-6, 4, -3)
    this.scene.add(fillLight)

    const glow = new THREE.PointLight(0x74c6ff, 0.15, 40)
    glow.position.set(0, 6, 0)
    this.scene.add(glow)
  }

  private buildSkyLayer() {
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: 0x86de57, roughness: 0.95 })
    )
    base.rotation.x = -Math.PI / 2
    base.position.y = -1.5
    this.scene.add(base)

    const skyBall = new THREE.Mesh(
      new THREE.SphereGeometry(9, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8 })
    )
    skyBall.position.set(-35, 18, -45)
    this.scene.add(skyBall)

    for (let i = 0; i < 18; i++) {
      const orb = this.createEmojiOrb(Math.random(), Math.random(), Math.random())
      orb.position.y += 4 + Math.random() * 3
      this.scene.add(orb)
    }

    for (let i = 0; i < 10; i++) {
      const ring = this.createFloatingRing(Math.random(), Math.random(), Math.random())
      this.scene.add(ring)
    }
  }

  private createFloatingRing(rx: number, rz: number, sizeSeed: number) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4 + sizeSeed * 4, 0.45, 14, 44),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(40 + rx * 140, 0.96, 0.7), emissive: 0xfff1a8, emissiveIntensity: 0.3 })
    )
    ring.position.set((rx - 0.5) * 90, 5 + rz * 6, (rz - 0.5) * 90)
    ring.rotation.x = Math.PI / 2 + rz * 0.2
    ring.rotation.y = rx * Math.PI * 0.5
    return ring
  }

  private createTower(rx: number, rz: number, heightSeed: number) {
    const tower = new THREE.Group()
    const height = 4 + heightSeed * 5
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, height, 10),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(280 + rx * 120, 0.85, 0.65), emissive: 0xd98dff, emissiveIntensity: 0.14, roughness: 0.35 })
    )
    base.position.y = height / 2
    tower.add(base)

    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 1.8, 10),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(25 + rz * 120, 0.8, 0.7), emissive: 0xffd164, emissiveIntensity: 0.18 })
    )
    cap.position.y = height + 0.8
    tower.add(cap)

    tower.position.set((rx - 0.5) * 38, 0, (rz - 0.5) * 38)
    tower.rotation.y = rx * Math.PI * 0.3
    return tower
  }

  private createCubeCluster(rx: number, rz: number, sizeSeed: number) {
    const group = new THREE.Group()
    const count = 2 + Math.floor(sizeSeed * 3)
    for (let i = 0; i < count; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.2 + rx * 2.3, 1.2 + rz * 1.8, 1.2 + sizeSeed * 2.2),
        new THREE.MeshStandardMaterial({ color: this.hslToHex(10 + i * 60, 0.9, 0.7), roughness: 0.25, emissive: 0xffc8d6, emissiveIntensity: 0.12 })
      )
      box.position.set((i - 1) * 2.2, 0.8 + i * 0.6, 0)
      box.rotation.y = i * 0.3
      group.add(box)
    }
    group.position.set((rx - 0.5) * 34, 0, (rz - 0.5) * 34)
    return group
  }

  private createRamp(rx: number, rz: number, sizeSeed: number) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(6 + rx * 5, 0.4, 3 + rz * 4 + sizeSeed * 1.8),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(140 + rx * 120, 0.88, 0.65), roughness: 0.35, emissive: 0x7af4ff, emissiveIntensity: 0.1 })
    )
    ramp.position.set((rx - 0.5) * 36, 0.35, (rz - 0.5) * 36)
    ramp.rotation.x = -0.18 - rz * 0.12
    ramp.rotation.y = rx * Math.PI * 0.25
    return ramp
  }

  private createTunnel(rx: number, rz: number, sizeSeed: number) {
    const arch = new THREE.Group()
    const tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2 + rx * 1.8, 2.2 + rx * 1.8, 4 + rz * 4, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(200 + rz * 120, 0.88, 0.7), side: THREE.DoubleSide, roughness: 0.4, emissive: 0x79f7ff, emissiveIntensity: 0.12 })
    )
    tunnel.rotation.z = Math.PI / 2
    arch.add(tunnel)

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(4 + sizeSeed * 2, 0.16, 3.4 + rz * 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
    )
    path.position.set(0, -0.8, 0)
    arch.add(path)

    arch.position.set((rx - 0.5) * 38, 0, (rz - 0.5) * 38)
    return arch
  }

  private createPillar(rx: number, rz: number, sizeSeed: number) {
    const height = 2.2 + sizeSeed * 3.2
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8 + rx * 0.6, 0.8 + rx * 0.6, height, 12),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(160 + rz * 90, 0.92, 0.68), emissive: 0x7df0ff, emissiveIntensity: 0.12, roughness: 0.35 })
    )
    pillar.position.set((rx - 0.5) * 34, height / 2 - 0.1, (rz - 0.5) * 34)
    return pillar
  }

  private createColorSphere(rx: number, rz: number, sizeSeed: number) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.2 + sizeSeed * 0.8, 16, 16),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(20 + rz * 120, 0.9, 0.72), emissive: 0xfff6b6, emissiveIntensity: 0.16, roughness: 0.3 })
    )
    sphere.position.set((rx - 0.5) * 36, 1.2 + rz * 1.8, (rz - 0.5) * 36)
    return sphere
  }

  private registerObstacle(object: THREE.Object3D) {
    const bounds = new THREE.Box3().setFromObject(object)
    if (!bounds.isEmpty()) {
      this.obstacleBounds.push(bounds)
    }
  }

  private updateChunks(initial = false) {
    const currentChunkX = Math.floor(this.camera.position.x / this.chunkSize)
    const currentChunkZ = Math.floor(this.camera.position.z / this.chunkSize)
    if (!initial && currentChunkX === this.playerChunkX && currentChunkZ === this.playerChunkZ) {
      return
    }
    this.playerChunkX = currentChunkX
    this.playerChunkZ = currentChunkZ

    const minChunkX = Math.floor(this.worldBounds.minX / this.chunkSize)
    const maxChunkX = Math.floor(this.worldBounds.maxX / this.chunkSize)
    const minChunkZ = Math.floor(this.worldBounds.minZ / this.chunkSize)
    const maxChunkZ = Math.floor(this.worldBounds.maxZ / this.chunkSize)

    for (let x = minChunkX; x <= maxChunkX; x++) {
      for (let z = minChunkZ; z <= maxChunkZ; z++) {
        const key = `${x}_${z}`
        if (!this.chunks.has(key)) {
          const chunk = this.buildChunk(x, z)
          this.chunks.set(key, chunk)
          this.scene.add(chunk)
        }
      }
    }
  }

  private buildChunk(cx: number, cz: number) {
    const group = new THREE.Group()
    group.position.set(cx * this.chunkSize, 0, cz * this.chunkSize)

    const seed = this.seedFromCoords(cx, cz)
    const rand = this.seededRandom(seed)

    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(this.chunkSize, this.chunkSize),
      new THREE.MeshStandardMaterial({ color: 0x8eea5b, roughness: 0.88 })
    )
    tile.rotation.x = -Math.PI / 2
    tile.position.y = -1.5
    group.add(tile)

    const isStartCorridor = Math.abs(cx) <= 1 && cz >= -3 && cz <= 1
    // Reduce obstacles roughly 50%: 0 or 1 feature per chunk (except start)
    const featureCount = isStartCorridor ? 0 : Math.floor(rand() * 2)
    for (let i = 0; i < featureCount; i++) {
      const choice = rand()
      let feature: THREE.Object3D
      if (choice < 0.22) {
        feature = this.createPillar(rand(), rand(), rand())
      } else if (choice < 0.44) {
        feature = this.createFloatingPlatform(rand(), rand(), rand())
      } else if (choice < 0.66) {
        feature = this.createFloatingRing(rand(), rand(), rand())
      } else if (choice < 0.88) {
        feature = this.createRamp(rand(), rand(), rand())
      } else {
        feature = this.createColorSphere(rand(), rand(), rand())
      }
      group.add(feature)
      // register only larger obstacles (avoid small decorative orb)
      this.registerObstacle(feature)
    }

    return group
  }

  private createFloatingPlatform(rx: number, rz: number, sizeSeed: number) {
    const width = 4 + sizeSeed * 7
    const depth = 4 + rz * 8
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.24, depth),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(50 + rx * 120, 0.88, 0.65), metalness: 0.15, roughness: 0.6 })
    )
    platform.position.set((rx - 0.5) * 34, 0.6 + rz * 3.4, (rz - 0.5) * 34)
    platform.rotation.y = rx * Math.PI * 0.3

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.55, 1.8, 10),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(140 + rz * 100, 0.95, 0.62), roughness: 0.3, emissive: 0x88ff98, emissiveIntensity: 0.08 })
    )
    pillar.position.set(platform.position.x, -0.5, platform.position.z)
    const group = new THREE.Group()
    group.add(platform)
    group.add(pillar)

    return group
  }

  private createEmojiOrb(rx: number, rz: number, colorSeed: number) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(1.1 + rx * 0.8, 12, 12),
      new THREE.MeshStandardMaterial({ color: this.hslToHex(45 + colorSeed * 50, 0.92, 0.7), emissive: 0xfff569, emissiveIntensity: 0.22 })
    )
    orb.position.set((rx - 0.5) * 28, 1.8 + rz * 2.2, (rz - 0.5) * 28)
    return orb
  }

  private spawnHamsters() {
    const positions: THREE.Vector3[] = []
    const obstacleCenters = this.obstacleBounds.map((box) => {
      const center = new THREE.Vector3()
      box.getCenter(center)
      return center
    })

    const addPosition = (position: THREE.Vector3) => {
      if (position.x < this.worldBounds.minX + 8 || position.x > this.worldBounds.maxX - 8) {
        return false
      }
      if (position.z < this.worldBounds.minZ + 8 || position.z > this.worldBounds.maxZ - 8) {
        return false
      }
      if (positions.some((other) => other.distanceTo(position) < 14)) {
        return false
      }
      positions.push(position)
      return true
    }

    let attempts = 0
    // Ensure 3 early-visible hamsters near the start corridor
    while (positions.length < 3 && attempts < 120) {
      const candidate = new THREE.Vector3(
        THREE.MathUtils.lerp(-12, 12, Math.random()),
        Math.random() * 1.1 + 0.7,
        THREE.MathUtils.lerp(-24, -8, Math.random())
      )
      if (addPosition(candidate)) continue
      attempts += 1
    }

    // Add a couple of air hamsters and platform-like placements
    attempts = 0
    while (positions.length < 5 && attempts < 180) {
      const candidate = new THREE.Vector3(
        THREE.MathUtils.lerp(this.worldBounds.minX + 10, this.worldBounds.maxX - 10, Math.random()),
        Math.random() * 1.8 + 1.5,
        THREE.MathUtils.lerp(this.worldBounds.minZ + 8, this.worldBounds.maxZ - 10, Math.random())
      )
      if (addPosition(candidate)) continue
      attempts += 1
    }

    // Add a few around obstacles
    attempts = 0
    while (positions.length < 8 && attempts < 260) {
      const base = obstacleCenters.length ? obstacleCenters[Math.floor(Math.random() * obstacleCenters.length)] : new THREE.Vector3(0, 0, -10)
      const offset = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 2.2 + 0.6, (Math.random() - 0.5) * 8)
      const candidate = base.clone().add(offset)
      if (addPosition(candidate)) continue
      attempts += 1
    }

    // Fill up to 10 across the smaller world
    attempts = 0
    while (positions.length < 10 && attempts < 500) {
      const candidate = new THREE.Vector3(
        THREE.MathUtils.lerp(this.worldBounds.minX + 8, this.worldBounds.maxX - 8, Math.random()),
        Math.random() * 2.4 + 0.6,
        THREE.MathUtils.lerp(this.worldBounds.minZ + 8, this.worldBounds.maxZ - 8, Math.random())
      )
      if (addPosition(candidate)) continue
      attempts += 1
    }

    positions.forEach((position) => {
      const hamster = new Hamster(position)
      this.hamsters.push(hamster)
      this.scene.add(hamster.group)
    })
  }

  private seedFromCoords(x: number, z: number) {
    const n = x * 374761393 + z * 668265263
    return (n ^ (n >> 13)) >>> 0
  }

  private seededRandom(seed: number) {
    let value = seed
    return () => {
      value ^= value << 13
      value ^= value >> 17
      value ^= value << 5
      return ((value < 0 ? ~value + 1 : value) % 1000) / 1000
    }
  }

  private hslToHex(h: number, s: number, l: number) {
    h = h % 360
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color)
    }
    return (f(0) << 16) | (f(8) << 8) | f(4)
  }
}
