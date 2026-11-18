import './style.css';
import { Engine } from './engine/core/Engine';

const canvas = document.getElementById('game-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('#game-canvas not found');
}

const engine = new Engine(canvas);
engine.start();