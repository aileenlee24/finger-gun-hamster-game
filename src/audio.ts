export class AudioManager {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private backgroundLoopId: number | null = null
  public isMuted = false

  private ensureAudioContext() {
    if (this.audioContext) {
      return this.audioContext
    }
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    this.audioContext = new AudioContext()
    this.masterGain = this.audioContext.createGain()
    this.musicGain = this.audioContext.createGain()
    this.masterGain.gain.value = 1
    this.musicGain.gain.value = 0.22
    this.masterGain.connect(this.audioContext.destination)
    this.musicGain.connect(this.masterGain)
    return this.audioContext
  }

  toggleMute() {
    this.ensureAudioContext()
    this.isMuted = !this.isMuted
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 1
    }
    return this.isMuted
  }

  backgroundMusic() {
    const ctx = this.ensureAudioContext()
    if (this.backgroundLoopId !== null) {
      return
    }

    const playTone = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'triangle', volume = 0.04) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(volume, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
      osc.connect(gain)
      gain.connect(this.musicGain!)
      osc.start(startTime)
      osc.stop(startTime + duration + 0.03)
    }

    const sequence = () => {
      const baseTime = ctx.currentTime + 0.02
      const pattern = [
        { freq: 146.83, duration: 0.18 },
        { freq: 174.61, duration: 0.16 },
        { freq: 196.00, duration: 0.18 },
        { freq: 220.00, duration: 0.28 },
        { freq: 164.81, duration: 0.16 },
        { freq: 174.61, duration: 0.14 }
      ]
      let time = baseTime
      pattern.forEach((note, index) => {
        playTone(note.freq * (index % 2 ? 1 : 0.5), time, note.duration, index % 2 === 0 ? 'triangle' : 'square', 0.05)
        time += note.duration
      })
    }

    sequence()
    this.backgroundLoopId = window.setInterval(sequence, 2600)
  }

  playShootSound() {
    const ctx = this.ensureAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 950 + Math.random() * 220
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.14)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start(now)
    osc.stop(now + 0.16)
  }

  playHamsterIdle() {
    const ctx = this.ensureAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 440 + Math.random() * 160
    gain.gain.setValueAtTime(0.06, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start(now)
    osc.stop(now + 0.3)
  }

  playSleepSound() {
    const ctx = this.ensureAudioContext()
    const now = ctx.currentTime

    const snore = ctx.createOscillator()
    const snoreGain = ctx.createGain()
    snore.type = 'sine'
    snore.frequency.value = 220
    snoreGain.gain.setValueAtTime(0.06, now)
    snoreGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34)
    snore.connect(snoreGain)
    snoreGain.connect(this.masterGain!)
    snore.start(now)
    snore.stop(now + 0.34)

    const chime = ctx.createOscillator()
    const chimeGain = ctx.createGain()
    chime.type = 'sine'
    chime.frequency.value = 620
    chimeGain.gain.setValueAtTime(0.04, now + 0.08)
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    chime.connect(chimeGain)
    chimeGain.connect(this.masterGain!)
    chime.start(now + 0.08)
    chime.stop(now + 0.28)
  }
}
