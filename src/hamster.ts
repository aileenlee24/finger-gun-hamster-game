import * as THREE from 'three'

export class Hamster {
  public group = new THREE.Group()
  public isAwake = true
  private body: THREE.Mesh
  private bodyMaterial: THREE.MeshStandardMaterial
  private eyeLeft: THREE.Mesh
  private eyeRight: THREE.Mesh
  private sleepBubble: THREE.Mesh
  private legs: THREE.Mesh[] = []
  private basePosition = new THREE.Vector3()
  private wanderTarget = new THREE.Vector3()
  private wanderTimer = 0
  private wanderDuration = 0
  private bobOffset = Math.random() * Math.PI * 2
  private baseY = 1.1

  constructor(position: THREE.Vector3) {
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffb26f, emissive: 0xff8f6e, emissiveIntensity: 0.28, roughness: 0.42 })
    this.body = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 16), this.bodyMaterial)
    this.body.position.set(0, this.baseY, 0)
    this.group.add(this.body)

    const earMaterial = new THREE.MeshStandardMaterial({ color: 0xffdb9a, roughness: 0.35 })
    const earLeft = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), earMaterial)
    const earRight = earLeft.clone()
    earLeft.position.set(-0.45, this.baseY + 0.9, -0.15)
    earRight.position.set(0.45, this.baseY + 0.9, -0.15)
    this.group.add(earLeft)
    this.group.add(earRight)

    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x221815, emissive: 0x221815, emissiveIntensity: 0.18 })
    this.eyeLeft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), eyeMaterial)
    this.eyeRight = this.eyeLeft.clone()
    this.eyeLeft.position.set(-0.28, this.baseY + 0.18, 0.9)
    this.eyeRight.position.set(0.28, this.baseY + 0.18, 0.9)
    this.group.add(this.eyeLeft)
    this.group.add(this.eyeRight)

    this.sleepBubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xe4f7ff, transparent: true, opacity: 0.85, emissive: 0xc2f0ff, emissiveIntensity: 0.16, roughness: 0.5 })
    )
    this.sleepBubble.position.set(0.25, this.baseY + 0.8, 1.05)
    this.sleepBubble.visible = false
    this.group.add(this.sleepBubble)

    const legMaterial = new THREE.MeshStandardMaterial({ color: 0xc3774b, roughness: 0.4 })
    const legOffsets = [
      [-0.55, 0.18, 0.55],
      [0.55, 0.18, 0.55],
      [-0.5, 0.18, -0.5],
      [0.5, 0.18, -0.5]
    ]
    legOffsets.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.4, 8), legMaterial)
      leg.position.set(x, y, z)
      leg.rotation.x = Math.PI / 2
      this.legs.push(leg)
      this.group.add(leg)
    })

    this.basePosition.copy(position)
    this.group.position.copy(position)
    this.wanderTarget.copy(position)
    this.wanderDuration = 0
  }

  update(delta: number) {
    const time = performance.now() * 0.001
    if (this.isAwake) {
      this.wanderTimer += delta
      if (this.wanderTimer >= this.wanderDuration) {
        this.wanderTimer = 0
        this.wanderDuration = 1.6 + Math.random() * 1.6
        const angle = Math.random() * Math.PI * 2
        const radius = 0.7 + Math.random() * 1.1
        this.wanderTarget.set(
          this.basePosition.x + Math.cos(angle) * radius,
          this.basePosition.y,
          this.basePosition.z + Math.sin(angle) * radius
        )
      }

      const move = new THREE.Vector3(
        this.wanderTarget.x - this.group.position.x,
        0,
        this.wanderTarget.z - this.group.position.z
      )
      const distance = move.length()
      if (distance > 0.03) {
        move.setLength(Math.min(distance, delta * 1.0))
        this.group.position.add(move)
      }

      const hop = Math.sin(time * 2.1 + this.bobOffset) * 0.18
      this.group.position.y = this.basePosition.y + hop
      this.group.rotation.y = Math.sin(time * 0.7 + this.bobOffset) * 0.2
      this.body.scale.setScalar(1 + Math.sin(time * 2.2 + this.bobOffset) * 0.05)
      this.legs.forEach((leg, index) => {
        leg.rotation.z = Math.sin(time * 3 + index) * 0.16
      })
      this.eyeLeft.scale.set(1, 1, 1)
      this.eyeRight.scale.set(1, 1, 1)
      this.sleepBubble.visible = false
    } else {
      this.group.rotation.z += (0.8 - this.group.rotation.z) * delta * 2.2
      this.group.rotation.x += (0.32 - this.group.rotation.x) * delta * 2.2
      this.group.position.y = this.basePosition.y - 0.08 + Math.sin(time * 1.3 + this.bobOffset) * 0.02
      this.body.scale.set(1, 0.88, 1)
      this.legs.forEach((leg) => {
        leg.rotation.z += (0.06 - leg.rotation.z) * delta * 2.2
      })
      this.eyeLeft.scale.set(1, 0.18, 1)
      this.eyeRight.scale.set(1, 0.18, 1)
      this.sleepBubble.visible = true
      this.sleepBubble.position.set(0.22 + Math.sin(time * 1.8) * 0.06, this.baseY + 0.8 + Math.sin(time * 1.2) * 0.05, 1.05)
    }
  }

  sleep() {
    if (!this.isAwake) {
      return
    }
    this.isAwake = false
  }

  reset() {
    this.isAwake = true
    this.group.rotation.set(0, 0, 0)
    this.group.position.copy(this.basePosition)
    this.group.position.y = this.basePosition.y
    this.body.scale.setScalar(1)
    this.bodyMaterial.color.set(0xffb26f)
    this.bodyMaterial.emissive.set(0xff8f6e)
    this.bodyMaterial.emissiveIntensity = 0.28
    this.wanderTimer = 0
    this.wanderDuration = 0
    this.wanderTarget.copy(this.basePosition)
  }

  collisionObjects() {
    return [this.body]
  }

  ownsObject(object: THREE.Object3D) {
    return object === this.body || object === this.eyeLeft || object === this.eyeRight || this.legs.includes(object as THREE.Mesh)
  }
}
