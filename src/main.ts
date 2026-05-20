import './style.css'
import Game from './game'

window.addEventListener('error', (event) => {
  console.error('Runtime error:', event.error ?? event.message, event)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

try {
  new Game()
} catch (error) {
  console.error('Failed to initialize game:', error)
}
