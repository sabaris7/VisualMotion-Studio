
import React, { useMemo, useState } from 'react';
import { EditorState, AnimatableProperty, EasingType, TriggerType } from '../types';
import { easings } from '../utils/easings';
import { interpolateColor } from '../utils/colors';
import BezierEditor from './BezierEditor';
import MotionAI from './MotionAI';

interface PropertyInspectorProps {
  state: EditorState;
  onAddKeyframe: (layerId: string, property: AnimatableProperty, value: number | string, time?: number, easing?: EasingType, skip?: boolean, bezier?: [number, number, number, number]) => void;
  onUpdateKeyframeEasing: (layerId: string, property: AnimatableProperty, kfId: string, easing: EasingType, bezier?: [number, number, number, number]) => void;
  onUpdateTrigger: (layerId: string, trigger: TriggerType) => void;
  onToggleTransform: () => void;
  onUpdateArtboard: (props: Partial<Pick<EditorState, 'artboardWidth' | 'artboardHeight' | 'artboardBackground' | 'isClipContent'>>) => void;
  onUpdateGradientColor: (gradientId: string, stopIndex: number, color: string) => void;
  onAddGradientStop: (gradientId: string) => void;
  onRemoveGradientStop: (gradientId: string, index: number) => void;
  onReorderGradientStop: (gradientId: string, index: number, direction: 'up' | 'down') => void;
}

const EASING_OPTIONS: EasingType[] = ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'bounce', 'custom'];

const PropertyRow: React.FC<{ 
  label: string; 
  property?: AnimatableProperty;
  value: number | string; 
  min?: number; 
  max?: number; 
  step?: number;
  type?: 'number' | 'color';
  activeKf?: { id: string, easing: EasingType, bezier?: [number, number, number, number] };
  onAdd: (val: number | string) => void; 
  onUpdateEasing?: (kfId: string, easing: EasingType, bezier?: [number, number, number, number]) => void;
  onUpdateGradientColor?: (gradientId: string, stopIndex: number, color: string) => void;
  onAddGradientStop?: (gradientId: string) => void;
  onRemoveGradientStop?: (gradientId: string, index: number) => void;
  onReorderGradientStop?: (gradientId: string, index: number, direction: 'up' | 'down') => void;
  onReset?: () => void;
  hideAction?: boolean;
  svgContent?: string;
}> = ({ label, property, value, min = -500, max = 500, step = 1, type = 'number', activeKf, onAdd, onUpdateEasing, onUpdateGradientColor, onAddGradientStop, onRemoveGradientStop, onReorderGradientStop, onReset, hideAction, svgContent }) => {
  const isHexColor = typeof value === 'string' && value.startsWith('#');
  const isGradient = typeof value === 'string' && value.toLowerCase().startsWith('url(');
  const isNone = value === 'none';

  const gradientInfo = useMemo(() => {
    if (!isGradient || !svgContent) return null;
    const match = value.match(/url\(#([^)]+)\)/);
    if (!match) return null;
    const id = match[1];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const grad = doc.getElementById(id);
    if (!grad) return null;

    const stops = Array.from(grad.querySelectorAll('stop')).map(s => ({
      offset: s.getAttribute('offset') || '0',
      color: s.getAttribute('stop-color') || '#000',
      opacity: s.getAttribute('stop-opacity') || '1'
    }));

    if (stops.length < 2) return null;
    const cssGradient = `linear-gradient(to bottom right, ${stops.map(s => `${s.color} ${parseFloat(s.offset) * 100}%`).join(', ')})`;
    return { id, cssGradient, stops };
  }, [value, isGradient, svgContent]);

  if (type === 'color') {
    return (
      <div className="flex flex-col gap-2 py-4 border-b border-gray-100 last:border-none">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          <div className="flex items-center gap-2">
             <input 
              type="checkbox" 
              checked={!!activeKf} 
              onChange={() => onAdd(value)} 
              className="w-3.5 h-3.5 rounded border-gray-300 accent-orange-500 cursor-pointer" 
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 relative group transition-all hover:border-orange-100">
          <div className="flex items-center gap-4">
            <div 
              className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 shrink-0 shadow-sm flex items-center justify-center bg-white"
            >
              {isGradient && gradientInfo ? (
                <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: gradientInfo.cssGradient }} />
              ) : isGradient ? (
                <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-br from-gray-300 to-gray-500" />
              ) : null}
              <input 
                type="color" 
                value={isHexColor ? value as string : '#F97316'} 
                onChange={(e) => onAdd(e.target.value)}
                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer z-20 border-none p-0 opacity-0" 
              />
              {!isGradient && !isNone && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: value as string }} />}
            </div>
            
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[12px] font-bold text-gray-900 uppercase truncate tracking-tight">
                {isGradient ? (gradientInfo ? `${gradientInfo.id.toUpperCase()}` : 'GRADIENT') : isNone ? 'TRANSPARENT' : value}
              </span>
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 leading-none">
                {isGradient ? 'GRADIENT DETECTED' : 'SOLID COLOR'}
              </span>
            </div>

            <div className="p-1.5 bg-white border border-gray-100 rounded-lg text-gray-300 shadow-sm">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          {isGradient && gradientInfo && (
            <div className="mt-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjust Gradient Colors</span>
                <button 
                  onClick={() => onAddGradientStop?.(gradientInfo.id)}
                  className="w-6 h-6 rounded-md bg-orange-50 text-orange-500 flex items-center justify-center hover:bg-orange-100 transition-colors border border-orange-100 shadow-sm"
                  title="Add New Stop"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              
              <div className="flex flex-col gap-2.5">
                {gradientInfo.stops.map((stop, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm hover:border-orange-200 transition-all group/stop">
                    <div className="relative w-10 h-10 rounded-lg border border-gray-100 overflow-hidden shrink-0 shadow-inner">
                      <div className="absolute inset-0 z-0" style={{ backgroundColor: stop.color }} />
                      <input 
                        type="color" 
                        value={stop.color} 
                        onChange={(e) => onUpdateGradientColor?.(gradientInfo.id, idx, e.target.value)}
                        className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer border-none p-0 opacity-0 z-10" 
                      />
                    </div>
                    
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[11px] font-mono font-bold text-gray-800 uppercase tracking-tight">{stop.color}</span>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">STOP {idx + 1} ({Math.round(parseFloat(stop.offset) * 100)}%)</span>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <button 
                        disabled={idx === 0}
                        onClick={() => onReorderGradientStop?.(gradientInfo.id, idx, 'up')}
                        className={`p-0.5 rounded text-gray-300 hover:text-orange-500 transition-colors ${idx === 0 ? 'opacity-20' : ''}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="18 15 12 9 6 15"/></svg>
                      </button>
                      <button 
                         disabled={idx === gradientInfo.stops.length - 1}
                         onClick={() => onReorderGradientStop?.(gradientInfo.id, idx, 'down')}
                         className={`p-0.5 rounded text-gray-300 hover:text-orange-500 transition-colors ${idx === gradientInfo.stops.length - 1 ? 'opacity-20' : ''}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </div>

                    <button 
                      onClick={() => onRemoveGradientStop?.(gradientInfo.id, idx)}
                      disabled={gradientInfo.stops.length <= 2}
                      className={`p-1 text-gray-200 hover:text-red-400 transition-colors ${gradientInfo.stops.length <= 2 ? 'hidden' : ''}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-gray-100 last:border-none">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
        <div className="flex items-center gap-3">
          {activeKf && (
            <select 
              value={activeKf.easing}
              onChange={(e) => onUpdateEasing?.(activeKf.id, e.target.value as EasingType, activeKf.bezier)}
              className="text-[9px] bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 font-bold outline-none cursor-pointer text-orange-600 appearance-none"
            >
              {EASING_OPTIONS.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
            </select>
          )}
          <input 
            type="checkbox" 
            checked={!!activeKf} 
            onChange={() => onAdd(value)} 
            className="w-3.5 h-3.5 rounded border-gray-300 accent-orange-500 cursor-pointer" 
          />
        </div>
      </div>

      <div className="flex items-center gap-4 relative">
        <div className="flex-1 relative flex items-center">
           <input 
            type="range" 
            min={min} max={max} step={step} 
            value={typeof value === 'number' ? value : 0} 
            onChange={(e) => onAdd(parseFloat(e.target.value))} 
            className="w-full accent-orange-500 h-1 bg-gray-100 rounded-full cursor-pointer appearance-none" 
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input 
            type="number" 
            value={typeof value === 'number' ? parseFloat(value.toFixed(1)) : 0} 
            onChange={(e) => onAdd(parseFloat(e.target.value))} 
            className="w-11 bg-gray-50 text-[10px] font-mono font-bold text-center py-1.5 rounded-lg border border-gray-100 outline-none focus:border-orange-500 text-gray-600" 
          />
          <div className="flex flex-col gap-0.5">
            {!hideAction && (
              <button 
                onClick={() => onAdd(value)}
                className={`w-4 h-4 rounded-md flex items-center justify-center transition-all shrink-0 ${
                  activeKf ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-100 text-gray-200 hover:text-orange-500 hover:border-orange-200'
                }`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            )}
            {onReset && (
              <button 
                onClick={onReset}
                className="w-4 h-4 rounded-md flex items-center justify-center bg-gray-50 border border-gray-100 text-gray-300 hover:text-blue-500 hover:border-blue-200 transition-all shrink-0"
                title="Reset to default"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {activeKf?.easing === 'custom' && (
        <BezierEditor 
          params={activeKf.bezier || [0.4, 0, 0.2, 1]} 
          onChange={(bezier) => onUpdateEasing?.(activeKf.id, 'custom', bezier)}
        />
      )}
    </div>
  );
};

const PropertyInspector: React.FC<PropertyInspectorProps> = ({ state, onAddKeyframe, onUpdateKeyframeEasing, onUpdateTrigger, onToggleTransform, onUpdateArtboard, onUpdateGradientColor, onAddGradientStop, onRemoveGradientStop, onReorderGradientStop }) => {
  const { selectedLayerIds, currentTime, animations, isTransformMode, artboardWidth, artboardHeight, artboardBackground, isClipContent, svgContent } = state;
  const selectedLayerId = selectedLayerIds[0];

  const baseValues = useMemo(() => {
    if (!selectedLayerId) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const el = doc.getElementById(selectedLayerId);
    if (!el) return null;
    
    let originalTransform = { x: 0, y: 0, z: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0 };
    if (el.tagName.toLowerCase() === 'circle') {
      originalTransform.x = parseFloat(el.getAttribute('cx') || '0') - 200;
      originalTransform.y = parseFloat(el.getAttribute('cy') || '0') - 200;
    }

    return {
      fill: el.getAttribute('fill') || 'none',
      stroke: el.getAttribute('stroke') || 'none',
      opacity: parseFloat(el.getAttribute('opacity') || '1'),
      ...originalTransform
    };
  }, [selectedLayerId, svgContent]);

  if (!selectedLayerId) {
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-100 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <h2 className="text-xs font-bold text-gray-900 tracking-tight uppercase">Artboard</h2>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-2.5 py-1 bg-gray-50 rounded-full border border-gray-100">Global</span>
          </div>
          
          <div className="space-y-4">
            <PropertyRow label="ARTBOARD WIDTH" value={artboardWidth} min={100} max={2000} hideAction onAdd={(val) => onUpdateArtboard({ artboardWidth: val as number })} />
            <PropertyRow label="ARTBOARD HEIGHT" value={artboardHeight} min={100} max={2000} hideAction onAdd={(val) => onUpdateArtboard({ artboardHeight: val as number })} />
            <PropertyRow label="ARTBOARD COLOR" value={artboardBackground} type="color" hideAction onAdd={(val) => onUpdateArtboard({ artboardBackground: val as string })} />
            
            <div className="flex items-center justify-between py-4 border-t border-gray-100">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clip Content</label>
                <span className="text-[9px] text-gray-300">Hide layers outside artboard</span>
              </div>
              <input 
                type="checkbox" 
                checked={isClipContent} 
                onChange={(e) => onUpdateArtboard({ isClipContent: e.target.checked })} 
                className="w-4 h-4 rounded border-gray-300 accent-orange-500 cursor-pointer" 
              />
            </div>
          </div>
        </div>
        <MotionAI 
          state={state} 
          onApplyAnimation={(layerId, property, value, time, easing) => onAddKeyframe(layerId, property, value, time, easing, false)} 
        />
      </div>
    );
  }

  const anim = animations.find(a => a.layerId === selectedLayerId);
  const getActiveKf = (prop: AnimatableProperty) => {
    if (!anim) return undefined;
    const track = anim.tracks.find(t => t.property === prop);
    const kf = track?.keyframes.find(k => Math.abs(k.time - currentTime) < 0.05);
    return kf ? { id: kf.id, easing: kf.easing, bezier: kf.bezierParams } : undefined;
  };

  const getCurrentValue = (prop: AnimatableProperty): number | string => {
    const track = anim?.tracks.find(t => t.property === prop);
    if (track && track.keyframes.length > 0) {
      let prev = track.keyframes[0], next = track.keyframes[track.keyframes.length - 1];
      for (let kf of track.keyframes) { if (kf.time <= currentTime) prev = kf; if (kf.time >= currentTime) { next = kf; break; } }
      if (prev === next) return prev.value;
      const t = (currentTime - prev.time) / (next.time - prev.time);
      const ease = next.easing === 'custom' && next.bezierParams 
        ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3]) 
        : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
      const easedT = ease(t);
      if (typeof prev.value === 'number' && typeof next.value === 'number') return (prev.value as number) + ((next.value as number) - (prev.value as number)) * easedT;
      if (typeof prev.value === 'string' && typeof next.value === 'string' && prev.value.startsWith('#') && next.value.startsWith('#')) return interpolateColor(prev.value, next.value, easedT);
      return next.value;
    }
    if (baseValues) {
      if (prop === 'fill') return baseValues.fill;
      if (prop === 'stroke') return baseValues.stroke;
      if (prop === 'opacity') return baseValues.opacity;
    }
    return (prop === 'scale' || prop === 'scaleX' || prop === 'scaleY' || prop === 'opacity') ? 1 : 0;
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-20 shadow-sm shrink-0">
        <h2 className="text-sm font-bold text-gray-900 truncate tracking-tight uppercase max-w-[140px]">{selectedLayerId}</h2>
        <div className="flex items-center gap-2">
           <button onClick={onToggleTransform} className={`p-2 rounded-xl transition-all shadow-sm ${isTransformMode ? 'bg-orange-500 text-white shadow-orange-100' : 'text-gray-400 hover:bg-gray-100'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"/><path d="m14 10 7-7"/><path d="M9 21H3v-6"/><path d="m10 14-7 7"/></svg>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-100 p-6">
        {/* Transform Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Transform</h3>
          <PropertyRow label="X POSITION" value={getCurrentValue('x')} onReset={() => onAddKeyframe(selectedLayerId, 'x', 0)} activeKf={getActiveKf('x')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'x', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'x', kfId, easing, bezier)} />
          <PropertyRow label="Y POSITION" value={getCurrentValue('y')} onReset={() => onAddKeyframe(selectedLayerId, 'y', 0)} activeKf={getActiveKf('y')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'y', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'y', kfId, easing, bezier)} />
          <PropertyRow label="Z POSITION (3D)" value={getCurrentValue('z')} onReset={() => onAddKeyframe(selectedLayerId, 'z', 0)} activeKf={getActiveKf('z')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'z', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'z', kfId, easing, bezier)} />
          <PropertyRow label="SCALE" value={getCurrentValue('scale')} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scale', 1)} activeKf={getActiveKf('scale')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scale', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scale', kfId, easing, bezier)} />
          <PropertyRow label="SCALE X" value={getCurrentValue('scaleX')} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scaleX', 1)} activeKf={getActiveKf('scaleX')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scaleX', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scaleX', kfId, easing, bezier)} />
          <PropertyRow label="SCALE Y" value={getCurrentValue('scaleY')} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scaleY', 1)} activeKf={getActiveKf('scaleY')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scaleY', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scaleY', kfId, easing, bezier)} />
        </div>

        {/* Rotation Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Rotation</h3>
          <PropertyRow label="ROTATE Z" value={getCurrentValue('rotate')} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotate', 0)} activeKf={getActiveKf('rotate')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotate', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotate', kfId, easing, bezier)} />
          <PropertyRow label="ROTATE X (3D)" value={getCurrentValue('rotateX')} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotateX', 0)} activeKf={getActiveKf('rotateX')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotateX', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotateX', kfId, easing, bezier)} />
          <PropertyRow label="ROTATE Y (3D)" value={getCurrentValue('rotateY')} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotateY', 0)} activeKf={getActiveKf('rotateY')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotateY', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotateY', kfId, easing, bezier)} />
        </div>

        {/* Visual Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Appearance</h3>
          <PropertyRow label="OPACITY" value={getCurrentValue('opacity')} min={0} max={1} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'opacity', 1)} activeKf={getActiveKf('opacity')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'opacity', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'opacity', kfId, easing, bezier)} />
          <PropertyRow 
            label="FILL COLOR" 
            value={getCurrentValue('fill')} 
            type="color" 
            svgContent={svgContent} 
            activeKf={getActiveKf('fill')} 
            onAdd={(val) => onAddKeyframe(selectedLayerId, 'fill', val)} 
            onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'fill', kfId, easing, bezier)} 
            onUpdateGradientColor={onUpdateGradientColor}
            onAddGradientStop={onAddGradientStop}
            onRemoveGradientStop={onRemoveGradientStop}
            onReorderGradientStop={onReorderGradientStop}
            onReset={() => onAddKeyframe(selectedLayerId, 'fill', baseValues?.fill || '#000000')}
          />
        </div>
      </div>
      <MotionAI 
        state={state} 
        onApplyAnimation={(layerId, property, value, time, easing) => onAddKeyframe(layerId, property, value, time, easing, false)} 
      />
    </div>
  );
};

export default PropertyInspector;
