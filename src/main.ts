import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) {
  throw new Error('Missing #game-canvas element.');
}

const game = new Game(canvas);
game.start();

const startBtn = document.querySelector<HTMLButtonElement>('#start-button');
const resumeBtn = document.querySelector<HTMLButtonElement>('#resume-button');
const restartBtn = document.querySelector<HTMLButtonElement>('#restart-button');
const upgradeOverlay = document.querySelector<HTMLElement>('#upgrade-overlay');

const pressEnter = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
  window.setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', bubbles: true }));
  }, 30);
};

const pressDigit = (index: number) => {
  const code = `Digit${index + 1}`;
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: String(index + 1), bubbles: true }));
  window.setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code, key: String(index + 1), bubbles: true }));
  }, 30);
};

startBtn?.addEventListener('click', pressEnter);
restartBtn?.addEventListener('click', pressEnter);
resumeBtn?.addEventListener('click', () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
  window.setTimeout(() => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }));
  }, 30);
});

upgradeOverlay?.addEventListener('upgrade-pick', (event) => {
  const detail = (event as CustomEvent<{ id: string; index: number }>).detail;
  pressDigit(detail.index);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
