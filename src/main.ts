import './style.css';
import { Engine } from './engine/core/Engine';

// The engine owns a full-window canvas. We create it here so the default Vite
// index.html (<div id="app">) works unchanged.
const canvas = document.createElement('canvas');
canvas.id = 'ascii-canvas';
document.body.appendChild(canvas);

const engine = new Engine(canvas);
engine.start();