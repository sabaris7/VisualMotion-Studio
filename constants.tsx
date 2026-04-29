
import React from 'react';
import { AnimatableProperty } from './types';

export const DEFAULT_DURATION = 5; // seconds
export const TICK_INTERVAL = 0.016; // 60fps
export const PIXELS_PER_SECOND = 100;

export const PROPERTY_LABELS: Record<AnimatableProperty, string> = {
  x: 'X Position',
  y: 'Y Position',
  z: 'Z Position',
  scale: 'Scale',
  scaleX: 'Scale X',
  scaleY: 'Scale Y',
  rotate: 'Rotation',
  rotateX: 'Rotate X',
  rotateY: 'Rotate Y',
  opacity: 'Opacity',
  strokeDashoffset: 'Stroke Draw',
  fill: 'Fill Color',
  stroke: 'Stroke Color',
  
  // Gradient Props
  stopColor0: 'Stop 1 Color',
  stopColor1: 'Stop 2 Color',
  stopColor2: 'Stop 3 Color',
  stopColor3: 'Stop 4 Color',
  stopColor4: 'Stop 5 Color',
  stopOffset0: 'Stop 1 Offset',
  stopOffset1: 'Stop 2 Offset',
  stopOffset2: 'Stop 3 Offset',
  stopOffset3: 'Stop 4 Offset',
  stopOffset4: 'Stop 5 Offset',
  gradientX1: 'Gradient Start X',
  gradientY1: 'Gradient Start Y',
  gradientX2: 'Gradient End X',
  gradientY2: 'Gradient End Y',
  gradientCX: 'Gradient Center X',
  gradientCY: 'Gradient Center Y',
  gradientR: 'Gradient Radius',

  // Motion Path
  offsetPath: 'Motion Path',
  offsetDistance: 'Path Progress',
  offsetRotate: 'Path Rotation',

  // Anchor
  anchorX: 'Anchor X',
  anchorY: 'Anchor Y'
};

export const INITIAL_SVG = `
<svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect id="background" width="400" height="400" fill="#F3F4F6"/>
  <circle id="main-circle" cx="200" cy="200" r="50" fill="url(#paint0_linear)"/>
  <path id="sparkle" d="M200 120L210 140L230 145L215 160L220 180L200 170L180 180L185 160L170 145L190 140L200 120Z" fill="#FBBF24" />
  <defs>
    <linearGradient id="paint0_linear" x1="200" y1="150" x2="200" y2="250" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F97316"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
  </defs>
</svg>
`.trim();
