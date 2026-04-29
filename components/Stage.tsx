
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect } from 'react';
import { EditorState, AnimatableProperty, SVGLayer, EasingType } from '../types';
import { easings } from '../utils/easings';
import { interpolateColor } from '../utils/colors';

interface StageProps {
  state: EditorState;
  onSelectLayer: (id: string | null) => void;
  onUpdateTransform: (layerId: string, property: AnimatableProperty, value: number) => void;
  onFinalizeTransform: () => void;
  onEnterPathEdit?: (id: string) => void;
  onExitPathEdit?: () => void;
  onUpdatePath?: (id: string, pathData: string) => void;
  onPanStart?: () => void;
  onUpdateView?: (x: number, y: number) => void;
}

const safeNumber = (val: any, fallback = 0) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
};

const Stage: React.FC<StageProps> = ({ state, onSelectLayer, onUpdateTransform, onFinalizeTransform, onEnterPathEdit, onExitPathEdit, onUpdatePath, onPanStart, onUpdateView }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bbox, setBbox] = useState<DOMRect | null>(null);
  const [activeTool, setActiveTool] = useState<'node' | 'lasso' | 'pen'>('node');
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const primarySelectedId = state.selectedLayerIds[0];
  const isPathEditing = state.editingPathId !== null;

  // Cache valid IDs for hit testing
  const validLayerIds = useMemo(() => {
    const ids = new Set<string>();
    const collect = (nodes: SVGLayer[]) => {
      nodes.forEach(node => {
        ids.add(node.id);
        if (node.children) collect(node.children);
      });
    };
    collect(state.layers);
    return ids;
  }, [state.layers]);

  // Helper to find top-level group/layer ID
  const findRootLayerId = (target: Element): string | null => {
    let current = target;
    const svgRoot = containerRef.current?.querySelector('svg');
    if (!svgRoot) return null;

    // First check if target itself is a tracked layer
    const id = current.getAttribute('id');
    if (id && validLayerIds.has(id)) {
       // Traverse up to find the direct child of SVG (root layer)
       while (current.parentElement && current.parentElement !== svgRoot) {
         if (current.parentElement.getAttribute('id')) {
            // It's a group or nested layer.
            // If the parent is the SVG root, then 'current' is the root layer.
         }
         current = current.parentElement;
       }
       return current.getAttribute('id');
    }
    
    // Traverse up to find valid ID
    while (current && current !== svgRoot) {
       const currId = current.getAttribute('id');
       if (currId && validLayerIds.has(currId)) {
          // Found a tracked ID. Is it top level?
          // If we want "default select root parent", we keep going up until parent is svgRoot
          let rootCandidate = current;
          while (rootCandidate.parentElement && rootCandidate.parentElement !== svgRoot) {
             rootCandidate = rootCandidate.parentElement;
          }
          return rootCandidate.getAttribute('id');
       }
       current = current.parentElement as Element;
    }
    return null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && e.target === document.body) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getCurrentTransformValues = (layerId: string) => {
    const values: Record<string, number> = { x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotateX: 0, rotateY: 0, rotate: 0, anchorX: 0.5, anchorY: 0.5 };
    const anim = state.animations.find(a => a.layerId === layerId);
    if (!anim) return values;

    ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotateX', 'rotateY', 'rotate', 'anchorX', 'anchorY'].forEach(prop => {
      const track = anim.tracks.find(t => t.property === prop as AnimatableProperty);
      if (track && track.keyframes.length > 0) {
        const kfs = track.keyframes;
        let value: number | string = kfs[0].value;

        if (state.currentTime <= kfs[0].time) {
          value = kfs[0].value;
        } else if (state.currentTime >= kfs[kfs.length - 1].time) {
          value = kfs[kfs.length - 1].value;
        } else {
          for (let i = 0; i < kfs.length - 1; i++) {
            if (state.currentTime <= kfs[i + 1].time) {
              const prev = kfs[i];
              const next = kfs[i + 1];
              const dt = next.time - prev.time;
              
              if (dt <= 0.000001) {
                 value = prev.value;
              } else {
                const t = (state.currentTime - prev.time) / dt;
                const ease = next.easing === 'custom' && next.bezierParams 
                  ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3])
                  : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
                
                value = (prev.value as number) + ((next.value as number) - (prev.value as number)) * ease(t);
              }
              break;
            }
          }
        }
        values[prop] = value as number;
      }
    });
    return values;
  };

  const handlePan = (e: React.MouseEvent) => {
    if ((!isSpacePressed && e.button !== 1) || isPathEditing) return;
    
    e.preventDefault();
    setIsPanning(true);
    onPanStart?.();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialViewX = state.viewX;
    const initialViewY = state.viewY;

    let rAF: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        onUpdateView?.(initialViewX + dx, initialViewY + dy);
        rAF = null;
      });
    };

    const onMouseUp = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (isSpacePressed || e.button === 1) {
       handlePan(e);
       return;
    }

    if (!primarySelectedId || !bbox || isPathEditing) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const initialTransforms = state.selectedLayerIds.map(id => ({
      id,
      values: getCurrentTransformValues(id)
    }));

    let rAF: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        let dx = (moveEvent.clientX - startX) / state.stageZoom;
        let dy = (moveEvent.clientY - startY) / state.stageZoom;
        
        if (moveEvent.ctrlKey || moveEvent.metaKey) { dx *= 0.15; dy *= 0.15; }
        if (moveEvent.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }

        initialTransforms.forEach(({ id, values }) => {
          onUpdateTransform(id, 'x', values.x + dx);
          onUpdateTransform(id, 'y', values.y + dy);
        });
        rAF = null;
      });
    };

    const onMouseUp = () => {
      onFinalizeTransform();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleAnchorDrag = (e: React.MouseEvent) => {
    if (!primarySelectedId || !bbox) return;
    e.stopPropagation();
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const initialValues = getCurrentTransformValues(primarySelectedId);
    
    let rAF: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        // Calculate delta in screen pixels
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        // Convert to percentage of bbox width/height
        // Note: bbox size is affected by zoom
        const deltaPctX = dx / bbox.width; 
        const deltaPctY = dy / bbox.height;

        let newAnchorX = initialValues.anchorX + deltaPctX;
        let newAnchorY = initialValues.anchorY + deltaPctY;
        
        if (moveEvent.shiftKey) {
           newAnchorX = Math.round(newAnchorX * 10) / 10;
           newAnchorY = Math.round(newAnchorY * 10) / 10;
        }

        onUpdateTransform(primarySelectedId, 'anchorX', Math.max(0, Math.min(1, newAnchorX)));
        onUpdateTransform(primarySelectedId, 'anchorY', Math.max(0, Math.min(1, newAnchorY)));
        rAF = null;
      });
    };

    const onMouseUp = () => {
      onFinalizeTransform();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScale = (e: React.MouseEvent, handle: string) => {
    if (!primarySelectedId || !bbox || isPathEditing) return;
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const initialTransforms = state.selectedLayerIds.map(id => ({
      id,
      values: getCurrentTransformValues(id)
    }));
    
    let rAF: number | null = null;
    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        let dx = (moveEvent.clientX - startX) / 100;
        let dy = (moveEvent.clientY - startY) / 100;
        
        if (moveEvent.ctrlKey || moveEvent.metaKey) {
          dx *= 0.2;
          dy *= 0.2;
        }
        if (handle.includes('w')) dx = -dx;
        if (handle.includes('n')) dy = -dy;

        initialTransforms.forEach(({ id, values }) => {
          if (['nw', 'ne', 'sw', 'se'].includes(handle)) {
            let delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
            let nextScale = values.scale + delta;
            if (moveEvent.shiftKey) nextScale = Math.round(nextScale * 4) / 4;
            onUpdateTransform(id, 'scale', Math.max(0.05, nextScale));
          }
          
          if (handle === 'e' || handle === 'w') {
            let nextScaleX = values.scaleX + dx;
            if (moveEvent.shiftKey) nextScaleX = Math.round(nextScaleX * 4) / 4;
            onUpdateTransform(id, 'scaleX', Math.max(0.05, nextScaleX));
          }

          if (handle === 'n' || handle === 's') {
            let nextScaleY = values.scaleY + dy;
            if (moveEvent.shiftKey) nextScaleY = Math.round(nextScaleY * 4) / 4;
            onUpdateTransform(id, 'scaleY', Math.max(0.05, nextScaleY));
          }
        });
        rAF = null;
      });
    };
    
    const onMouseUp = () => {
      onFinalizeTransform();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Performance Optimization: Apply styles imperatively to DOM nodes
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const root = containerRef.current;
    
    // 1. Reset Visibility/Interaction for all layers based on hidden state
    // We need to query all potentially animated layers plus hidden ones
    const allLayerIds = new Set<string>();
    const collectLayerIds = (layers: SVGLayer[]) => {
      layers.forEach(layer => {
        allLayerIds.add(layer.id);
        if (layer.children) collectLayerIds(layer.children);
      });
    };
    collectLayerIds(state.layers);

    allLayerIds.forEach(id => {
      const el = root.querySelector(`[id="${id}"]`) as HTMLElement;
      if (!el) return;
      const isHidden = state.hiddenLayerIds.includes(id);
      
      el.style.visibility = isHidden ? 'hidden' : 'visible';
      el.style.pointerEvents = isHidden ? 'none' : 'auto';
      el.style.transformBox = 'fill-box';
      
      if (!state.animations.some(a => a.layerId === id)) {
         el.style.transform = '';
         el.style.opacity = '';
         el.style.fill = '';
         el.style.stroke = '';
         el.style.transformOrigin = '50% 50%';
      }
    });

    // 2. Apply Animations
    state.animations.forEach(anim => {
      const el = root.querySelector(`[id="${anim.layerId}"]`) as HTMLElement;
      // Also look for gradient element if applicable
      let gradientEl: Element | null = null;
      if (el) {
         let fill = el.getAttribute('fill') || el.style.fill;
         if (fill && fill.indexOf('url(#') !== -1) {
            const match = fill.match(/url\(#([^)]+)\)/);
            if (match) gradientEl = root.querySelector(`#${CSS.escape(match[1])}`);
         }
      }

      if (!el && !gradientEl) return;

      let tx = 0, ty = 0, tz = 0, sc = 1, scX = 1, scY = 1, rx = 0, ry = 0, rz = 0;
      let anchorX = 0.5, anchorY = 0.5;
      let opacityValue = 1;
      let fillValue: string | null = null;
      let strokeValue: string | null = null;
      let strokeDashoffsetValue: number | null = null;
      let offsetPath = '', offsetDistance = '', offsetRotate = '';
      let hasTransform = false;

      // Calculate property values for current time
      const calculateValue = (track: any) => {
        const kfs = track.keyframes;
        let value: number | string = kfs[0].value;
        if (state.currentTime <= kfs[0].time) {
          value = kfs[0].value;
        } else if (state.currentTime >= kfs[kfs.length - 1].time) {
          value = kfs[kfs.length - 1].value;
        } else {
          for (let i = 0; i < kfs.length - 1; i++) {
            if (state.currentTime <= kfs[i + 1].time) {
              const prev = kfs[i];
              const next = kfs[i + 1];
              const dt = next.time - prev.time;
              if (dt <= 0.000001) {
                value = prev.value;
              } else {
                const rawT = (state.currentTime - prev.time) / dt;
                const ease = next.easing === 'custom' && next.bezierParams 
                  ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3])
                  : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
                const t = ease(rawT);
                if (typeof prev.value === 'number' && typeof next.value === 'number') {
                  value = prev.value + (next.value - prev.value) * t;
                } else if (typeof prev.value === 'string' && typeof next.value === 'string') {
                  value = interpolateColor(prev.value, next.value, t);
                } else {
                  value = prev.value;
                }
              }
              break;
            }
          }
        }
        return value;
      };

      // Fill fallback
      const fillTrack = anim.tracks.find(t => t.property === 'fill');
      if (fillTrack && fillTrack.keyframes.length > 0) {
        fillValue = calculateValue(fillTrack) as string;
      } else if (el) {
        fillValue = el.getAttribute('fill') || el.style.fill || null;
      }

      anim.tracks.forEach(track => {
        const kfs = track.keyframes;
        if (kfs.length === 0) return;
        const value = calculateValue(track);

        switch (track.property) {
          case 'x': tx = value as number; hasTransform = true; break;
          case 'y': ty = value as number; hasTransform = true; break;
          case 'z': tz = value as number; hasTransform = true; break;
          case 'scale': sc = value as number; hasTransform = true; break;
          case 'scaleX': scX = value as number; hasTransform = true; break;
          case 'scaleY': scY = value as number; hasTransform = true; break;
          case 'rotate': rz = value as number; hasTransform = true; break;
          case 'rotateX': rx = value as number; hasTransform = true; break;
          case 'rotateY': ry = value as number; hasTransform = true; break;
          case 'anchorX': anchorX = value as number; break;
          case 'anchorY': anchorY = value as number; break;
          case 'opacity': opacityValue = value as number; break;
          case 'fill': fillValue = value as string; break;
          case 'stroke': strokeValue = value as string; break;
          case 'strokeDashoffset': strokeDashoffsetValue = value as number; break;
          case 'offsetPath': offsetPath = `path('${value}')`; break;
          case 'offsetDistance': offsetDistance = `${value}%`; break;
          case 'offsetRotate': offsetRotate = String(value); break;
          
          // Gradients
          case 'gradientX1': if(gradientEl) gradientEl.setAttribute('x1', String(value)); break;
          case 'gradientY1': if(gradientEl) gradientEl.setAttribute('y1', String(value)); break;
          case 'gradientX2': if(gradientEl) gradientEl.setAttribute('x2', String(value)); break;
          case 'gradientY2': if(gradientEl) gradientEl.setAttribute('y2', String(value)); break;
          case 'gradientCX': if(gradientEl) gradientEl.setAttribute('cx', String(value)); break;
          case 'gradientCY': if(gradientEl) gradientEl.setAttribute('cy', String(value)); break;
          case 'gradientR': if(gradientEl) gradientEl.setAttribute('r', String(value)); break;
          case 'stopOffset0': 
          case 'stopOffset1': 
          case 'stopOffset2': 
          case 'stopOffset3': 
          case 'stopOffset4': {
             if(gradientEl) {
               const idx = parseInt(track.property.replace('stopOffset', ''));
               const stops = gradientEl.querySelectorAll('stop');
               if (stops[idx]) stops[idx].setAttribute('offset', String(value));
             }
             break;
          }
          case 'stopColor0': 
          case 'stopColor1': 
          case 'stopColor2': 
          case 'stopColor3': 
          case 'stopColor4': {
             if(gradientEl) {
                const idx = parseInt(track.property.replace('stopColor', ''));
                const stops = gradientEl.querySelectorAll('stop');
                if (stops[idx]) {
                   stops[idx].setAttribute('stop-color', String(value));
                   (stops[idx] as SVGStopElement).style.stopColor = String(value);
                }
             }
             break;
          }
        }
      });

      if (el) {
        if (hasTransform) {
          const safeTx = safeNumber(tx);
          const safeTy = safeNumber(ty);
          const safeTz = safeNumber(tz);
          const safeSc = safeNumber(sc, 1);
          const safeScX = safeNumber(scX, 1);
          const safeScY = safeNumber(scY, 1);
          const safeRx = safeNumber(rx);
          const safeRy = safeNumber(ry);
          const safeRz = safeNumber(rz);

          const translate = (Math.abs(safeTz) < 0.001) ? `translate(${safeTx}px, ${safeTy}px)` : `translate3d(${safeTx}px, ${safeTy}px, ${safeTz}px)`;
          const finalScaleX = safeSc * safeScX;
          const finalScaleY = safeSc * safeScY;
          const rotate = (Math.abs(safeRx) < 0.001 && Math.abs(safeRy) < 0.001) ? `rotate(${safeRz}deg)` : `rotateX(${safeRx}deg) rotateY(${safeRy}deg) rotateZ(${safeRz}deg)`;
          
          el.style.transform = `${translate} scale(${finalScaleX}, ${finalScaleY}) ${rotate}`;
        }
        
        el.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
        el.style.opacity = String(safeNumber(opacityValue, 1));
        if (fillValue) el.style.fill = fillValue;
        if (strokeValue) el.style.stroke = strokeValue;
        if (strokeDashoffsetValue !== null) el.style.strokeDashoffset = String(strokeDashoffsetValue);
        if (offsetPath) el.style.offsetPath = offsetPath;
        if (offsetDistance) el.style.offsetDistance = offsetDistance;
        if (offsetRotate) el.style.offsetRotate = offsetRotate;
        el.style.transition = 'none';
      }
    });
  }, [state.currentTime, state.animations, state.hiddenLayerIds, state.layers, state.svgContent, state.artboardWidth, state.artboardHeight, state.selectedLayerIds]); // Added selectedLayerIds to ensure styles re-apply when selection changes

  // Update Bounding Box for selection overlay
  useLayoutEffect(() => {
    const updateBbox = () => {
      if (primarySelectedId && containerRef.current) {
        const el = document.getElementById(primarySelectedId) as any;
        if (el) {
          const rect = el.getBoundingClientRect();
          setBbox(prev => {
            if (prev && Math.abs(prev.x - rect.x) < 0.1 && Math.abs(prev.y - rect.y) < 0.1 && Math.abs(prev.width - rect.width) < 0.1 && Math.abs(prev.height - rect.height) < 0.1) {
              return prev;
            }
            return rect;
          });
        }
      } else {
        setBbox(null);
      }
    };

    // Immediate update
    updateBbox();

    // Also update on window resize
    window.addEventListener('resize', updateBbox);
    return () => window.removeEventListener('resize', updateBbox);
  }, [primarySelectedId, state.currentTime, state.stageZoom, state.viewX, state.viewY, state.animations, state.svgContent, state.layers, state.artboardWidth, state.artboardHeight, state.hiddenLayerIds]);

  const processedSvgContent = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${state.artboardWidth} ${state.artboardHeight}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.style.overflow = 'visible';

      const gradients = doc.querySelectorAll('linearGradient, radialGradient');
      gradients.forEach(grad => {
        const stops = grad.querySelectorAll('stop');
        stops.forEach((stop) => {
          let color = stop.getAttribute('stop-color');
          if (!color && stop.style && stop.style.stopColor) {
             color = stop.style.stopColor;
             stop.style.removeProperty('stop-color'); 
          }
          if (color) {
             stop.setAttribute('stop-color', color);
          }
        });
      });
    }
    return new XMLSerializer().serializeToString(doc);
  }, [state.svgContent, state.artboardWidth, state.artboardHeight]);

  const pathPoints = useMemo(() => {
    const targetId = state.editingPathId || primarySelectedId;
    if (!targetId) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const el = doc.getElementById(targetId);
    if (!el) return [];
    
    if (el.tagName.toLowerCase() === 'path') {
      const d = el.getAttribute('d') || '';
      const coords: { x: number, y: number }[] = [];
      const coordRegex = /([-+]?\d*\.?\d+)[,\s]+([-+]?\d*\.?\d+)/g;
      let m;
      while ((m = coordRegex.exec(d)) !== null) {
        coords.push({ x: parseFloat(m[1]), y: parseFloat(m[2]) });
      }
      return coords;
    } else if (el.tagName.toLowerCase() === 'circle') {
      const cx = parseFloat(el.getAttribute('cx') || '0');
      const cy = parseFloat(el.getAttribute('cy') || '0');
      const r = parseFloat(el.getAttribute('r') || '0');
      return [
        { x: cx, y: cy - r },
        { x: cx + r, y: cy },
        { x: cx, y: cy + r },
        { x: cx - r, y: cy }
      ];
    } else if (el.tagName.toLowerCase() === 'rect') {
      const rx = parseFloat(el.getAttribute('x') || '0');
      const ry = parseFloat(el.getAttribute('y') || '0');
      const rw = parseFloat(el.getAttribute('width') || '0');
      const rh = parseFloat(el.getAttribute('height') || '0');
      return [
        { x: rx, y: ry },
        { x: rx + rw, y: ry },
        { x: rx + rw, y: ry + rh },
        { x: rx, y: ry + rh }
      ];
    }
    return [];
  }, [state.editingPathId, primarySelectedId, state.svgContent]);

  const handleMirror = (direction: 'horizontal' | 'vertical') => {
    if (!state.editingPathId || !onUpdatePath) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const el = doc.getElementById(state.editingPathId);
    if (!el || el.tagName.toLowerCase() !== 'path') return;
    
    const d = el.getAttribute('d') || '';
    const coords = pathPoints;
    if (coords.length === 0) return;

    const minX = Math.min(...coords.map(p => p.x));
    const maxX = Math.max(...coords.map(p => p.x));
    const minY = Math.min(...coords.map(p => p.y));
    const maxY = Math.max(...coords.map(p => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newD = d.replace(/([-+]?\d*\.?\d+)[,\s]+([-+]?\d*\.?\d+)/g, (match, xStr, yStr) => {
      let x = parseFloat(xStr);
      let y = parseFloat(yStr);
      if (direction === 'horizontal') x = centerX - (x - centerX);
      else y = centerY - (y - centerY);
      return `${x},${y}`;
    });

    onUpdatePath(state.editingPathId, newD);
  };

  const overlayRect = useMemo(() => {
    if (!bbox || !containerRef.current) return null;
    const stageRect = containerRef.current.getBoundingClientRect();
    const style = window.getComputedStyle(containerRef.current);
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    
    // We use getBoundingClientRect for both to ensure they are in the same coordinate space (screen pixels)
    // and correctly account for all CSS transforms, zoom, and pan.
    // Absolute positioning is relative to the padding edge, which is borderTop/borderLeft pixels inside the border edge.
    return { 
      top: (bbox.top - stageRect.top - borderTop), 
      left: (bbox.left - stageRect.left - borderLeft), 
      width: bbox.width, 
      height: bbox.height 
    };
  }, [bbox]); // Only depend on bbox; stageRect is measured fresh when bbox changes

  const minX = pathPoints.length > 0 ? Math.min(...pathPoints.map(p => p.x)) : 0;
  const maxX = pathPoints.length > 0 ? Math.max(...pathPoints.map(p => p.x)) : 1;
  const minY = pathPoints.length > 0 ? Math.min(...pathPoints.map(p => p.y)) : 0;
  const maxY = pathPoints.length > 0 ? Math.max(...pathPoints.map(p => p.y)) : 1;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const cursorStyle = isPanning ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : 'cursor-default';

  // Calculate Anchor Handle position relative to overlayRect
  const anchorPosition = useMemo(() => {
    if (!primarySelectedId) return null;
    const initialValues = getCurrentTransformValues(primarySelectedId);
    return {
      left: initialValues.anchorX * 100, // percentage
      top: initialValues.anchorY * 100
    };
  }, [primarySelectedId, state.animations, state.currentTime]);

  return (
    <div 
      className={`flex-1 flex items-center justify-center p-12 relative overflow-hidden ${cursorStyle}`} 
      onMouseDown={handlePan}
      onClick={() => { if (!isPathEditing && !isPanning) onSelectLayer(null); }} 
      ref={containerRef}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div 
        className={`shadow-2xl rounded-sm relative flex items-center justify-center border border-gray-100 bg-white ${state.isClipContent ? 'overflow-hidden' : ''}`}
        style={{ 
          width: `${state.artboardWidth}px`, 
          height: `${state.artboardHeight}px`, 
          transform: `translate(${state.viewX}px, ${state.viewY}px) scale(${state.stageZoom})`, 
          backgroundColor: state.artboardBackground,
          perspective: '1000px',
          transformOrigin: 'center center'
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handlePan}
      >
        <div 
          className="w-full h-full [&>svg]:w-full [&>svg]:h-full" 
          style={{ transformStyle: 'preserve-3d' }} 
          dangerouslySetInnerHTML={{ __html: processedSvgContent }}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => {
            if (isPathEditing || isPanning) return;
            const target = e.target as HTMLElement;
            if (target.tagName.toLowerCase() === 'svg') {
              onSelectLayer(null);
              return;
            }
            
            // Smart Selection Logic
            if (e.metaKey || e.ctrlKey) {
               // Deep select specific element
               const id = target.getAttribute('id');
               if (id && validLayerIds.has(id)) onSelectLayer(id);
            } else {
               // Select Root Parent by default
               const rootId = findRootLayerId(target);
               if (rootId) onSelectLayer(rootId);
               else onSelectLayer(null);
            }
          }}
          onDoubleClick={(e) => {
            if (isPathEditing || isPanning) return;
            const target = e.target as HTMLElement;
            // Dive in: Select specific child
            const id = target.getAttribute('id');
            if (id && validLayerIds.has(id)) onSelectLayer(id);
            
            // If already selected, maybe enter Path Edit
            if (id === primarySelectedId && target.tagName.toLowerCase() === 'path' && onEnterPathEdit) {
               onEnterPathEdit(id);
            }
          }}
        />
      </div>

      {primarySelectedId && !state.hiddenLayerIds.includes(primarySelectedId) && overlayRect && !isPathEditing && (
        <div className="absolute border-2 border-orange-500 pointer-events-auto cursor-move z-40 transition-shadow hover:shadow-lg"
          style={{ 
            top: overlayRect.top, 
            left: overlayRect.left, 
            width: overlayRect.width, 
            height: overlayRect.height 
          }}
          onMouseDown={handleDrag}
        >
          <div className="absolute -top-8 left-[-2px] bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm pointer-events-none whitespace-nowrap z-50 flex items-center gap-1">
             <span className="opacity-75">#</span> {state.selectedLayerIds.length > 1 ? `${state.selectedLayerIds.length} Layers` : primarySelectedId}
          </div>

          <div className="absolute inset-0 border-[1.5px] border-[#3B82F6] opacity-70 pointer-events-none" />
          
          {/* Resize Handles */}
          {['nw', 'ne', 'sw', 'se'].map(h => (
            <div key={h} onMouseDown={(e) => handleScale(e, h)} className={`absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform ${h==='nw'?'top-0 left-0':h==='ne'?'top-0 left-full':h==='sw'?'top-full left-0':'top-full left-full'}`} />
          ))}
          <div onMouseDown={(e) => handleScale(e, 'n')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-0 left-1/2" />
          <div onMouseDown={(e) => handleScale(e, 's')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-full left-1/2" />
          <div onMouseDown={(e) => handleScale(e, 'w')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-1/2 left-0" />
          <div onMouseDown={(e) => handleScale(e, 'e')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-1/2 left-full" />

          {/* Anchor Point Handle */}
          {anchorPosition && (
             <div 
                className="absolute w-4 h-4 transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair z-50 group flex items-center justify-center"
                style={{ left: `${anchorPosition.left}%`, top: `${anchorPosition.top}%` }}
                onMouseDown={handleAnchorDrag}
             >
                <div className="w-4 h-4 rounded-full border border-orange-500 bg-white/20 hover:bg-white/50 flex items-center justify-center">
                   <div className="w-1 h-1 bg-orange-500 rounded-full" />
                   <div className="absolute w-full h-[1px] bg-orange-500" />
                   <div className="absolute h-full w-[1px] bg-orange-500" />
                </div>
             </div>
          )}

          {pathPoints.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {pathPoints.map((p, i) => (
                <div key={i} className="absolute w-2 h-2 bg-white border border-[#3B82F6] rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-sm z-50"
                  style={{ 
                    left: `${((p.x - minX) / rangeX) * overlayRect.width}px`,
                    top: `${((p.y - minY) / rangeY) * overlayRect.height}px`
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isPathEditing && overlayRect && (
        <div className="absolute pointer-events-none z-40"
          style={{ 
            top: overlayRect.top, 
            left: overlayRect.left, 
            width: overlayRect.width, 
            height: overlayRect.height 
          }}
        >
          {pathPoints.map((p, i) => (
            <div key={i} className="absolute w-2.5 h-2.5 bg-white border-2 border-[#3B82F6] rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer shadow-md hover:scale-125 transition-transform active:bg-[#3B82F6]"
              onClick={(e) => e.stopPropagation()}
              style={{ 
                left: `${((p.x - minX) / rangeX) * overlayRect.width}px`,
                top: `${((p.y - minY) / rangeY) * overlayRect.height}px`
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-xl flex items-center gap-6 z-50">
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Engine Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${state.isPlaying ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            <span className={`text-[10px] font-bold ${state.isPlaying ? 'text-gray-700' : 'text-gray-500'}`}>{state.isPlaying ? 'Playing' : 'Paused'}</span>
          </div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Focus Mode</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            <span className="text-[10px] font-bold text-orange-500">
              {isPanning ? 'PANNING' : (isSpacePressed ? 'HAND TOOL' : (primarySelectedId ? (isPathEditing ? `PATH: ${primarySelectedId}` : (state.selectedLayerIds.length > 1 ? `${state.selectedLayerIds.length} ITEMS` : primarySelectedId)) : 'Artboard'))}
            </span>
          </div>
        </div>
      </div>

      {isPathEditing && (
        <div 
          className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-1 flex items-center gap-1 z-50 animate-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTool('node'); }} 
            className={`p-2.5 rounded-xl transition-all ${activeTool === 'node' ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="m13 13 6 6"/></svg>
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveTool('lasso'); }} 
            className={`p-2.5 rounded-xl transition-all ${activeTool === 'lasso' ? 'bg-[#3B82F6] text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 2"><circle cx="12" cy="12" r="10"/></svg>
          </button>
          <div className="h-6 w-px bg-gray-100 mx-1" />
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMirror('horizontal'); }} 
            className="p-2.5 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition-all" 
            title="Mirror Horizontal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m17 7 5 5-5 5"/><path d="m7 7-5 5 5 5"/></svg>
          </button>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMirror('vertical'); }} 
            className="p-2.5 rounded-xl text-gray-400 hover:bg-orange-50 hover:text-orange-500 transition-all" 
            title="Mirror Vertical"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="rotate-90"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m17 7 5 5-5 5"/><path d="m7 7-5 5 5 5"/></svg>
          </button>
          <div className="h-6 w-px bg-gray-100 mx-1" />
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); onExitPathEdit?.(); }} 
            className="p-2.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all" 
            title="Exit Edit Mode"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Stage;
