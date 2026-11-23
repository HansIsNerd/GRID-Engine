// src/main.ts
import './style.css';
import { Engine } from './engine/core/Engine';
import { WebGLRenderer } from './engine/renderer/WebGLRenderer';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const engine = new Engine(canvas);   
  engine.start();
});