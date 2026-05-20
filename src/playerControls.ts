import { PerspectiveCamera, Vector3 } from 'three'

const MOUSE_SENSITIVITY = 0.0018
// Increased by ~30% for a snappier default auto-fly
const BASE_SPEED = 2.6
const BOOST_MULTIPLIER = 2.0
const STRAFE_SPEED = 2.6
const MAX_PITCH = Math.PI / 2 - 0.15
const MIN_PITCH = -Math.PI / 2 + 0.15
const HEAD_YAW_STRENGTH = 1.8
const HEAD_PITCH_STRENGTH = 1.25
const HEAD_TRACKING_DEADZONE = 0.05
const HEAD_TRACKING_SMOOTHING = 0.16

export class PlayerControls {
  private camera: PerspectiveCamera
  private domElement: HTMLElement
  private movement = { forward: false, backward: false, left: false, right: false }
  private shift = false
  private yaw = 0
  private pitch = 0
  private canMove = false
  private headTargetYaw = 0
  private headTargetPitch = 0
  private headEnabled = false
  public lastAppliedYawDelta = 0
  public lastAppliedPitchDelta = 0

  constructor(camera: PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.domElement = domElement

    document.addEventListener('keydown', this.onKeyDown.bind(this))
    document.addEventListener('keyup', this.onKeyUp.bind(this))
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this))
    document.addEventListener('mousemove', this.onMouseMove.bind(this))
    domElement.addEventListener('click', () => domElement.requestPointerLock())
  }

  update(delta: number, headOffsets: { yaw: number; pitch: number } | null, faceDetected: boolean) {
    // Auto-forward flight
    const boost = this.shift ? BOOST_MULTIPLIER : 1
    const forwardSpeed = BASE_SPEED * boost

    const forward = new Vector3()
    this.camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    const right = new Vector3().crossVectors(this.camera.up, forward).normalize()

    // Always move forward automatically
    this.camera.position.addScaledVector(forward, forwardSpeed * delta)

    // Strafe from input
    const strafeX = Number(this.movement.right) - Number(this.movement.left)
    if (strafeX !== 0) {
      this.camera.position.addScaledVector(right, strafeX * STRAFE_SPEED * delta)
    }

    if (this.headEnabled && headOffsets && faceDetected) {
      const prevYaw = this.yaw
      const prevPitch = this.pitch
      const targetYaw = Math.abs(headOffsets.yaw) > HEAD_TRACKING_DEADZONE ? headOffsets.yaw * HEAD_YAW_STRENGTH : 0
      const targetPitch = Math.abs(headOffsets.pitch) > HEAD_TRACKING_DEADZONE ? headOffsets.pitch * HEAD_PITCH_STRENGTH : 0
      this.headTargetYaw = targetYaw
      this.headTargetPitch = targetPitch
      this.yaw += (this.headTargetYaw - this.yaw) * HEAD_TRACKING_SMOOTHING
      this.pitch += (this.headTargetPitch - this.pitch) * HEAD_TRACKING_SMOOTHING
      this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch))
      this.camera.rotation.set(this.pitch, this.yaw, 0)
      this.lastAppliedYawDelta = this.yaw - prevYaw
      this.lastAppliedPitchDelta = this.pitch - prevPitch
    } else {
      this.lastAppliedYawDelta = 0
      this.lastAppliedPitchDelta = 0
    }
  }

  lock() {
    this.domElement.requestPointerLock()
  }

  setHeadControl(enabled: boolean) {
    this.headEnabled = enabled
  }

  private onPointerLockChange() {
    this.canMove = document.pointerLockElement === this.domElement
  }

  private onMouseMove(event: MouseEvent) {
    if (!this.canMove) return
    this.yaw -= event.movementX * MOUSE_SENSITIVITY
    this.pitch -= event.movementY * MOUSE_SENSITIVITY
    this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch))
    // apply directly — no roll
    this.camera.rotation.set(this.pitch, this.yaw, 0)
  }

  private onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
        this.movement.forward = true
        break
      case 'KeyS':
        this.movement.backward = true
        break
      case 'KeyA':
        this.movement.left = true
        break
      case 'KeyD':
        this.movement.right = true
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.shift = true
        break
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
        this.movement.forward = false
        break
      case 'KeyS':
        this.movement.backward = false
        break
      case 'KeyA':
        this.movement.left = false
        break
      case 'KeyD':
        this.movement.right = false
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.shift = false
        break
    }
  }
}
