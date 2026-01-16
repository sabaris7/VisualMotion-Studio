
import React, { useMemo, useState, useRef, useEffect } from 'react';
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
}

const Stage: React.FC<StageProps> = ({ state, onSelectLayer, onUpdateTransform, onFinalizeTransform, onEnterPathEdit, onExitPathEdit, onUpdatePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bbox, setBbox] = useState<DOMRect | null>(null);
  const [activeTool, setActiveTool] = useState<'node' | 'lasso' | 'pen'>('node');

  const primarySelectedId = state.selectedLayerIds[0];
  const isPathEditing = state.editingPathId !== null;

  const getCurrentTransformValues = (layerId: string) => {
    const values: Record<string, number> = { x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotateX: 0, rotateY: 0, rotate: 0 };
    const anim = state.animations.find(a => a.layerId === layerId);
    if (!anim) return values;

    ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotateX', 'rotateY', 'rotate'].forEach(prop => {
      const track = anim.tracks.find(t => t.property === prop as AnimatableProperty);
      if (track && track.keyframes.length > 0) {
        let prev = track.keyframes[0];
        let next = track.keyframes[track.keyframes.length - 1];
        for (let i = 0; i < track.keyframes.length - 1; i++) {
          if (state.currentTime >= track.keyframes[i].time && state.currentTime <= track.keyframes[i + 1].time) {
            prev = track.keyframes[i];
            next = track.keyframes[i + 1];
            break;
          }
        }
        if (prev === next) values[prop] = prev.value as number;
        else {
          const t = (state.currentTime - prev.time) / (next.time - prev.time);
          const ease = next.easing === 'custom' && next.bezierParams 
            ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3])
            : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
          values[prop] = (prev.value as number) + ((next.value as number) - (prev.value as number)) * ease(t);
        }
      }
    });
    return values;
  };

  useEffect(() => {
    if (primarySelectedId && containerRef.current) {
      const el = document.getElementById(primarySelectedId);
      if (el) {
        setBbox(el.getBoundingClientRect());
      }
    } else {
      setBbox(null);
    }
  }, [primarySelectedId, state.currentTime, state.stageZoom, state.animations, state.svgContent]);

  const handleDrag = (e: React.MouseEvent) => {
    if (!primarySelectedId || !bbox || isPathEditing) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialVals = getCurrentTransformValues(primarySelectedId);

    const onMouseMove = (moveEvent: MouseEvent) => {
      let dx = (moveEvent.clientX - startX) / state.stageZoom;
      let dy = (moveEvent.clientY - startY) / state.stageZoom;
      if (moveEvent.ctrlKey || moveEvent.metaKey) { dx *= 0.15; dy *= 0.15; }
      if (moveEvent.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      onUpdateTransform(primarySelectedId, 'x', initialVals.x + dx);
      onUpdateTransform(primarySelectedId, 'y', initialVals.y + dy);
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
    const startX = e.clientX;
    const startY = e.clientY;
    const initialVals = getCurrentTransformValues(primarySelectedId);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      let dx = (moveEvent.clientX - startX) / 100;
      let dy = (moveEvent.clientY - startY) / 100;
      
      if (moveEvent.ctrlKey || moveEvent.metaKey) {
        dx *= 0.2;
        dy *= 0.2;
      }

      // Flip delta based on handle position for intuitive drag
      if (handle.includes('w')) dx = -dx;
      if (handle.includes('n')) dy = -dy;

      // Uniform Scaling (Corners)
      if (['nw', 'ne', 'sw', 'se'].includes(handle)) {
        let delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
        let nextScale = initialVals.scale + delta;
        if (moveEvent.shiftKey) nextScale = Math.round(nextScale * 4) / 4;
        onUpdateTransform(primarySelectedId, 'scale', Math.max(0.05, nextScale));
      }
      
      // Horizontal Scaling (Sides)
      if (handle === 'e' || handle === 'w') {
        let nextScaleX = initialVals.scaleX + dx;
        if (moveEvent.shiftKey) nextScaleX = Math.round(nextScaleX * 4) / 4;
        onUpdateTransform(primarySelectedId, 'scaleX', Math.max(0.05, nextScaleX));
      }

      // Vertical Scaling (Top/Bottom)
      if (handle === 'n' || handle === 's') {
        let nextScaleY = initialVals.scaleY + dy;
        if (moveEvent.shiftKey) nextScaleY = Math.round(nextScaleY * 4) / 4;
        onUpdateTransform(primarySelectedId, 'scaleY', Math.max(0.05, nextScaleY));
      }
    };
    
    const onMouseUp = () => {
      onFinalizeTransform();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const getStylesForTime = (time: number) => {
    const styles: Record<string, string> = {};
    const allLayerIds = new Set<string>();
    const collectLayerIds = (layers: SVGLayer[]) => {
      layers.forEach(layer => {
        allLayerIds.add(layer.id);
        if (layer.children) collectLayerIds(layer.children);
      });
    };
    collectLayerIds(state.layers);

    allLayerIds.forEach(id => {
      const isHidden = state.hiddenLayerIds.includes(id);
      styles[id] = `#${CSS.escape(id)} { visibility: ${isHidden ? 'hidden' : 'visible'}; pointer-events: ${isHidden ? 'none' : 'auto'}; }`;
    });

    state.animations.forEach(anim => {
      let transformStr = '';
      let opacityValue = 1;
      let fillValue: string | null = null;
      let strokeValue: string | null = null;
      let strokeDashoffsetValue: number | null = null;
      
      let tx = 0, ty = 0, tz = 0, sc = 1, scX = 1, scY = 1, rx = 0, ry = 0, rz = 0;
      let hasTransform = false;

      anim.tracks.forEach(track => {
        const kfs = track.keyframes;
        if (kfs.length === 0) return;
        let prev = kfs[0], next = kfs[kfs.length - 1];
        if (time <= prev.time) {} 
        else if (time >= next.time) { prev = next; } 
        else {
          for (let i = 0; i < kfs.length - 1; i++) {
            if (time >= kfs[i].time && time <= kfs[i + 1].time) { prev = kfs[i]; next = kfs[i + 1]; break; }
          }
        }
        let value: number | string = prev.value;
        if (prev !== next && time > prev.time && time < next.time) {
          const rawT = (time - prev.time) / (next.time - prev.time);
          const ease = next.easing === 'custom' && next.bezierParams 
            ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3])
            : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
          const t = ease(rawT);
          if (typeof prev.value === 'number' && typeof next.value === 'number') { value = prev.value + (next.value - prev.value) * t; } 
          else if (typeof prev.value === 'string' && typeof next.value === 'string' && prev.value.startsWith('#') && next.value.startsWith('#')) { value = interpolateColor(prev.value, next.value, t); }
        }
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
          case 'opacity': opacityValue = value as number; break;
          case 'fill': fillValue = value as string; break;
          case 'stroke': strokeValue = value as string; break;
          case 'strokeDashoffset': strokeDashoffsetValue = value as number; break;
        }
      });

      if (hasTransform) {
        // Use standard translate for 2D if Z is zero for better SVG support across browsers
        // translate3d can cause layer composition bugs in some browsers (Chrome) for SVG elements
        const translate = (Math.abs(tz) < 0.001) ? `translate(${tx}px, ${ty}px)` : `translate3d(${tx}px, ${ty}px, ${tz}px)`;
        const finalScaleX = isNaN(sc * scX) ? 1 : sc * scX;
        const finalScaleY = isNaN(sc * scY) ? 1 : sc * scY;
        
        transformStr = `${translate} scale(${finalScaleX}, ${finalScaleY}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
      }

      styles[anim.layerId] = `
        #${CSS.escape(anim.layerId)} { 
          transform: ${transformStr} !important; 
          opacity: ${opacityValue} !important; 
          ${fillValue ? `fill: ${fillValue} !important;` : ''} 
          ${strokeValue ? `stroke: ${strokeValue} !important;` : ''} 
          ${strokeDashoffsetValue !== null ? `stroke-dashoffset: ${strokeDashoffsetValue} !important;` : ''} 
          transform-origin: center center !important; 
          transform-box: fill-box !important;
          transition: none !important;
        }
      `;
    });
    return Object.values(styles).join('\n');
  };

  const interpolatedStyles = useMemo(() => getStylesForTime(state.currentTime), [state.currentTime, state.animations, state.hiddenLayerIds, state.layers]);

  const processedSvgContent = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${state.artboardWidth} ${state.artboardHeight}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      // SVG overflow visible ensures elements translated outside viewBox can still be seen if clipping is disabled
      svg.style.overflow = 'visible';
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
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    
    return { 
      top: (bbox.top - stageRect.top) + scrollTop, 
      left: (bbox.left - stageRect.left) + scrollLeft, 
      width: bbox.width, 
      height: bbox.height 
    };
  }, [bbox, state.stageZoom, state.currentTime, state.animations]);

  const minX = pathPoints.length > 0 ? Math.min(...pathPoints.map(p => p.x)) : 0;
  const maxX = pathPoints.length > 0 ? Math.max(...pathPoints.map(p => p.x)) : 1;
  const minY = pathPoints.length > 0 ? Math.min(...pathPoints.map(p => p.y)) : 0;
  const maxY = pathPoints.length > 0 ? Math.max(...pathPoints.map(p => p.y)) : 1;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return (
    <div className="flex-1 flex items-center justify-center p-12 relative overflow-hidden" onClick={() => { if (!isPathEditing) onSelectLayer(null); }} ref={containerRef}>
      <style>{interpolatedStyles}</style>
      
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div 
        className={`shadow-2xl rounded-sm relative flex items-center justify-center border border-gray-100 bg-white ${state.isClipContent ? 'overflow-hidden' : ''}`}
        style={{ 
          width: `${state.artboardWidth}px`, 
          height: `${state.artboardHeight}px`, 
          transform: `scale(${state.stageZoom})`, 
          backgroundColor: state.artboardBackground,
          perspective: '1000px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" style={{ transformStyle: 'preserve-3d' }} dangerouslySetInnerHTML={{ __html: processedSvgContent }}
          onClick={(e) => {
            if (isPathEditing) return;
            const target = e.target as HTMLElement;
            const id = target.getAttribute('id') || target.closest('[id]')?.getAttribute('id');
            if (id) onSelectLayer(id);
          }}
          onDoubleClick={(e) => {
            if (isPathEditing) return;
            const target = e.target as HTMLElement;
            const id = target.getAttribute('id') || target.closest('[id]')?.getAttribute('id');
            if (id && onEnterPathEdit) onEnterPathEdit(id);
          }}
        />
      </div>

      {primarySelectedId && overlayRect && !isPathEditing && (
        <div className="absolute border-2 border-orange-500 pointer-events-auto cursor-move z-40 transition-shadow hover:shadow-lg"
          style={{ 
            top: overlayRect.top, 
            left: overlayRect.left, 
            width: overlayRect.width, 
            height: overlayRect.height 
          }}
          onMouseDown={handleDrag}
        >
          <div className="absolute inset-0 border-[1.5px] border-[#3B82F6] opacity-70 pointer-events-none" />
          
          {/* Corner Handles (Uniform Scale) */}
          {['nw', 'ne', 'sw', 'se'].map(h => (
            <div key={h} onMouseDown={(e) => handleScale(e, h)} className={`absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-nwse-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform ${h==='nw'?'top-0 left-0':h==='ne'?'top-0 left-full':h==='sw'?'top-full left-0':'top-full left-full'}`} />
          ))}

          {/* Side Handles (Non-Uniform Scale) */}
          <div onMouseDown={(e) => handleScale(e, 'n')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-0 left-1/2" />
          <div onMouseDown={(e) => handleScale(e, 's')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ns-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-full left-1/2" />
          <div onMouseDown={(e) => handleScale(e, 'w')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-1/2 left-0" />
          <div onMouseDown={(e) => handleScale(e, 'e')} className="absolute w-3 h-3 bg-white border-2 border-orange-500 rounded-sm cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 shadow-sm hover:scale-125 transition-transform top-1/2 left-full" />

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
            <span className="text-[10px] font-bold text-gray-600">{state.isPlaying ? 'Active' : 'Paused'}</span>
          </div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Focus Mode</span>
          <span className="text-[10px] font-bold text-orange-500">{primarySelectedId ? (isPathEditing ? `PATH: ${primarySelectedId}` : primarySelectedId) : 'Artboard'}</span>
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
