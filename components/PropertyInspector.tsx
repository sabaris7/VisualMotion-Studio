
import React, { useMemo, useState } from 'react';
import { EditorState, AnimatableProperty, EasingType, TriggerType, LayerAnimation } from '../types';
import { easings } from '../utils/easings';
import { interpolateColor, toHex } from '../utils/colors';
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
  onAlign?: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => void;
}

const EASING_OPTIONS: EasingType[] = ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'bounce', 'custom'];

const PRESETS = [
  { id: 'fadeIn', label: 'Fade In', category: 'Standard' },
  { id: 'fadeOut', label: 'Fade Out', category: 'Standard' },
  { id: 'slideLeft', label: 'Slide In Left', category: 'Standard' },
  { id: 'slideOutLeft', label: 'Slide Out Left', category: 'Standard' },
  { id: 'slideRight', label: 'Slide In Right', category: 'Standard' },
  { id: 'slideOutRight', label: 'Slide Out Right', category: 'Standard' },
  { id: 'slideTop', label: 'Slide In Top', category: 'Standard' },
  { id: 'slideOutTop', label: 'Slide Out Top', category: 'Standard' },
  { id: 'slideBottom', label: 'Slide In Bottom', category: 'Standard' },
  { id: 'slideOutBottom', label: 'Slide Out Bottom', category: 'Standard' },
  { id: 'bounceInLeft', label: 'Bounce In Left', category: 'Standard' },
  { id: 'bounceInRight', label: 'Bounce In Right', category: 'Standard' },
  { id: 'bounceInUp', label: 'Bounce In Up', category: 'Standard' },
  { id: 'bounceInDown', label: 'Bounce In Down', category: 'Standard' },
  { id: 'backInLeft', label: 'Back In Left', category: 'Standard' },
  { id: 'backInRight', label: 'Back In Right', category: 'Standard' },
  { id: 'backInUp', label: 'Back In Up', category: 'Standard' },
  { id: 'backInDown', label: 'Back In Down', category: 'Standard' },
  { id: 'scaleUp', label: 'Scale Up', category: 'Standard' },
  { id: 'scaleDown', label: 'Scale Down', category: 'Standard' },
  { id: 'expandX', label: 'Expand Width', category: 'Standard' },
  { id: 'expandY', label: 'Expand Height', category: 'Standard' },
  { id: 'rollInLeft', label: 'Roll In Left', category: 'Standard' },
  { id: 'rollOutRight', label: 'Roll Out Right', category: 'Standard' },
  { id: 'spiralIn', label: 'Spiral In', category: 'Standard' },
  { id: 'spiralOut', label: 'Spiral Out', category: 'Standard' },
  { id: 'zoomInDown', label: 'Zoom In Down', category: 'Standard' },
  { id: 'zoomOutUp', label: 'Zoom Out Up', category: 'Standard' },
  { id: 'bounce', label: 'Bounce In', category: 'Standard' },
  { id: 'swing', label: 'Swing', category: 'Standard' },
  { id: 'tada', label: 'Tada', category: 'Standard' },
  { id: 'popIn', label: 'Pop In', category: 'Standard' },
  { id: 'rubberBand', label: 'Rubber Band', category: 'Standard' },
  { id: 'heartbeat', label: 'Heartbeat', category: 'Standard' },
  { id: 'headShake', label: 'Head Shake', category: 'Standard' },
  { id: 'rotateIn', label: 'Rotate In', category: 'Standard' },
  { id: 'rotateOut', label: 'Rotate Out', category: 'Standard' },
  { id: 'flipInX', label: 'Flip In X', category: 'Standard' },
  { id: 'flipInY', label: 'Flip In Y', category: 'Standard' },
  { id: 'flipOutX', label: 'Flip Out X', category: 'Standard' },
  { id: 'flipOutY', label: 'Flip Out Y', category: 'Standard' },
  { id: 'pulse', label: 'Pulse', category: 'Standard' },
  { id: 'flash', label: 'Flash', category: 'Standard' },
  { id: 'shake', label: 'Shake', category: 'Standard' },
  { id: 'wobble', label: 'Wobble', category: 'Standard' },
  { id: 'spin', label: 'Spin', category: 'Standard' },
  { id: 'wiggle', label: 'Wiggle', category: 'Standard' },
  { id: 'cinematicIn', label: 'Cinematic In', category: 'Standard' },
  { id: 'cinematicOut', label: 'Cinematic Out', category: 'Standard' },
  { id: 'glitch', label: 'Glitch', category: 'Standard' },
  { id: 'dropIn', label: 'Drop In', category: 'Standard' },
  { id: 'float', label: 'Float', category: 'Standard' },
  { id: 'sway', label: 'Sway', category: 'Standard' },
  { id: 'slitInVertical', label: 'Slit In Vertical', category: 'Standard' },
  { id: 'slitInHorizontal', label: 'Slit In Horizontal', category: 'Standard' },
  { id: 'fadeUp', label: 'Fade Up', category: 'Standard' },
  { id: 'fadeDown', label: 'Fade Down', category: 'Standard' },
  { id: 'focusIn', label: 'Focus In', category: 'Standard' },
  { id: 'squeeze', label: 'Squeeze', category: 'Standard' },
  { id: 'jello', label: 'Jello', category: 'Standard' },
  { id: 'flow_dotted_linear', label: 'Dotted Flow (Linear)', category: 'Core' },
  { id: 'flow_dotted_chain', label: 'Dotted Flow (Chain)', category: 'Core' },
  { id: 'flow_dotted_bidirectional', label: 'Dotted Flow (Bi-dir)', category: 'Core' },
  { id: 'scan_single_pass', label: 'Scan (Single Pass)', category: 'Core' },
  { id: 'scan_dual_side', label: 'Scan (Dual Side)', category: 'Core' },
  { id: 'scan_delayed_secondary', label: 'Scan (Delayed)', category: 'Core' },
  { id: 'pulse_soft', label: 'Ripple (Soft)', category: 'Core' },
  { id: 'pulse_strong', label: 'Ripple (Strong)', category: 'Core' },
  { id: 'pulse_network', label: 'Ripple (Network)', category: 'Core' },
  { id: 'highlight_success', label: 'Highlight (Success)', category: 'Core' },
  { id: 'highlight_warning', label: 'Highlight (Warning)', category: 'Core' },
  { id: 'highlight_processing', label: 'Highlight (Processing)', category: 'Core' },
  { id: 'checklist_success', label: 'Checklist (Success)', category: 'Core' },
  { id: 'checklist_with_exception', label: 'Checklist (Exception)', category: 'Core' },
  { id: 'count_up', label: 'Count Up', category: 'Core' },
  { id: 'count_down', label: 'Count Down', category: 'Core' },
  { id: 'count_odometer', label: 'Count (Odometer)', category: 'Core' },
  { id: 'line_draw', label: 'Path (Draw)', category: 'Core' },
  { id: 'line_travel', label: 'Path (Travel)', category: 'Core' },
  { id: 'line_loop', label: 'Path (Loop)', category: 'Core' },
  { id: 'packet_single', label: 'Packet (Single)', category: 'Core' },
  { id: 'packet_multiple', label: 'Packet (Multiple)', category: 'Core' },
  { id: 'packet_random', label: 'Packet (Random)', category: 'Core' },
  { id: 'shine_fast', label: 'Shine (Fast)', category: 'Core' },
  { id: 'shine_soft', label: 'Shine (Soft)', category: 'Core' },
  { id: 'scroll_click', label: 'Scroll (Click)', category: 'Core' },
  { id: 'scroll_auto', label: 'Scroll (Auto)', category: 'Core' },
  { id: 'node_flow_loop', label: 'Node Flow (Loop)', category: 'Core' },
];

const AnimationPresets: React.FC<{
  onApply: (presetId: string) => void;
  disabled: boolean;
}> = ({ onApply, disabled }) => {
  const categories = useMemo(() => {
    const cats: Record<string, typeof PRESETS> = {};
    PRESETS.forEach(p => {
      const cat = p.category || 'Standard';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(p);
    });
    return cats;
  }, []);

  return (
    <div className="mb-4">
      <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Presets</h3>
      {disabled ? (
        <div className="text-[10px] text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-dashed border-gray-200 text-center">
          Select a layer to apply presets
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 pr-1 space-y-4">
          {Object.entries(categories).map(([cat, presets]) => (
            <div key={cat}>
              <h4 className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</h4>
              <div className="grid grid-cols-2 gap-2">
                {(presets as typeof PRESETS).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => onApply(preset.id)}
                    className="px-3 py-2 bg-gray-50 hover:bg-orange-50 hover:text-orange-600 border border-gray-100 hover:border-orange-200 rounded-lg text-[10px] font-bold text-gray-600 transition-all text-left flex items-center justify-between group"
                  >
                    <span className="truncate">{preset.label}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-0 group-hover:opacity-100 transition-opacity text-orange-400 shrink-0 ml-1">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PropertyRow: React.FC<{ 
  label: string; 
  property?: AnimatableProperty;
  value: number | string; 
  min?: number; 
  max?: number; 
  step?: number;
  type?: 'number' | 'color' | 'text';
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
  selectedLayerId?: string;
  onAddKeyframe?: any;
  currentTime?: number;
  getCurrentValue?: (prop: AnimatableProperty) => number | string | undefined;
  layerAnimation?: LayerAnimation;
}> = ({ label, property, value, min = -500, max = 500, step = 1, type = 'number', activeKf, onAdd, onUpdateEasing, onUpdateGradientColor, onAddGradientStop, onRemoveGradientStop, onReorderGradientStop, onReset, hideAction, svgContent, selectedLayerId, onAddKeyframe, currentTime, getCurrentValue, layerAnimation }) => {
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

    const stops = Array.from(grad.querySelectorAll('stop')).map(s => {
      let color = s.getAttribute('stop-color');
      if (!color && s.style && s.style.stopColor) {
        color = s.style.stopColor;
      }
      return {
        offset: s.getAttribute('offset') || '0',
        color: color || '#000',
        opacity: s.getAttribute('stop-opacity') || '1'
      };
    });
    
    // Parse coordinates
    const coords = {
        x1: parseFloat(grad.getAttribute('x1') || '0'),
        y1: parseFloat(grad.getAttribute('y1') || '0'),
        x2: parseFloat(grad.getAttribute('x2') || '100'),
        y2: parseFloat(grad.getAttribute('y2') || '0')
    };

    if (stops.length < 2) return null;
    const cssGradient = `linear-gradient(to bottom right, ${stops.map(s => `${s.color} ${parseFloat(s.offset) * 100}%`).join(', ')})`;
    return { id, cssGradient, stops, coords };
  }, [value, isGradient, svgContent]);

  if (type === 'text') {
    return (
      <div className="flex flex-col gap-2 py-4 border-b border-gray-100 last:border-none">
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</label>
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={!!activeKf} 
              onChange={() => onAdd(value)} 
              className="w-3.5 h-3.5 rounded border-gray-300 accent-orange-500 cursor-pointer" 
            />
          </div>
        </div>
        <textarea 
          value={value as string}
          onChange={(e) => onAdd(e.target.value)}
          className="w-full h-16 bg-gray-50 text-[10px] font-mono border border-gray-200 rounded-lg p-2 outline-none focus:border-orange-500 resize-none text-gray-600 leading-relaxed"
          placeholder="M0 0 L100 100..."
        />
      </div>
    );
  }

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
          </div>

          {isGradient && gradientInfo && (
            <>
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
                    {gradientInfo.stops.map((stop, idx) => {
                        const propName = `stopColor${idx}` as AnimatableProperty;
                        const activeVal = getCurrentValue ? getCurrentValue(propName) : undefined;
                        // Use animated value if available, otherwise static value. 
                        // IMPORTANT: Convert to Hex for input[type="color"] as it doesn't support rgba
                        const displayColor = (typeof activeVal === 'string') ? activeVal : stop.color;
                        const inputColor = toHex(displayColor);

                        return (
                            <div key={idx} className="flex items-center gap-3 bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm hover:border-orange-200 transition-all group/stop">
                                <div className="relative w-10 h-10 rounded-lg border border-gray-100 overflow-hidden shrink-0 shadow-inner">
                                <div className="absolute inset-0 z-0" style={{ backgroundColor: displayColor }} />
                                <input 
                                    type="color" 
                                    value={inputColor} 
                                    onChange={(e) => {
                                        // If selectedLayerId is present, we are animating the layer's usage of this gradient
                                        if(selectedLayerId && onAddKeyframe) {
                                            const track = layerAnimation?.tracks.find(t => t.property === propName);
                                            const hasKeyframes = track && track.keyframes.length > 0;
                                            
                                            // Auto-insert start keyframe if we are at t > 0 and no keyframes exist yet
                                            if (!hasKeyframes && (currentTime || 0) > 0) {
                                                onAddKeyframe(selectedLayerId, propName, stop.color, 0);
                                            }
                                            onAddKeyframe(selectedLayerId, propName, e.target.value);
                                        } else {
                                            // Fallback to static update if no animation context (though we prefer animation)
                                            onUpdateGradientColor?.(gradientInfo.id, idx, e.target.value);
                                        }
                                    }}
                                    className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer border-none p-0 opacity-0 z-10" 
                                />
                                </div>
                                
                                <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-[11px] font-mono font-bold text-gray-800 uppercase tracking-tight truncate" title={displayColor}>{displayColor}</span>
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
                        );
                    })}
                </div>
                </div>

                {/* Gradient Direction */}
                <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gradient Transform</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <PropertyRow label="Start X" value={gradientInfo.coords.x1} hideAction onAdd={(v) => onAddKeyframe && selectedLayerId && onAddKeyframe(selectedLayerId, 'gradientX1', v)} />
                        <PropertyRow label="Start Y" value={gradientInfo.coords.y1} hideAction onAdd={(v) => onAddKeyframe && selectedLayerId && onAddKeyframe(selectedLayerId, 'gradientY1', v)} />
                        <PropertyRow label="End X" value={gradientInfo.coords.x2} hideAction onAdd={(v) => onAddKeyframe && selectedLayerId && onAddKeyframe(selectedLayerId, 'gradientX2', v)} />
                        <PropertyRow label="End Y" value={gradientInfo.coords.y2} hideAction onAdd={(v) => onAddKeyframe && selectedLayerId && onAddKeyframe(selectedLayerId, 'gradientY2', v)} />
                    </div>
                </div>
            </>
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

const PropertyInspector: React.FC<PropertyInspectorProps> = ({ state, onAddKeyframe, onUpdateKeyframeEasing, onUpdateTrigger, onToggleTransform, onUpdateArtboard, onUpdateGradientColor, onAddGradientStop, onRemoveGradientStop, onReorderGradientStop, onAlign }) => {
  const { selectedLayerIds, currentTime, animations, isTransformMode, artboardWidth, artboardHeight, artboardBackground, isClipContent, svgContent } = state;
  const selectedLayerId = selectedLayerIds[0];

  const baseValues = useMemo(() => {
    if (!selectedLayerId) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const el = doc.getElementById(selectedLayerId);
    if (!el) return null;
    
    // We treat x, y, rotate, scale as relative offsets from the base SVG state,
    // so their base values in the animation system are 0 (or 1 for scale).
    let originalTransform = { x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0 };

    return {
      fill: el.getAttribute('fill') || (el.style as any).fill || 'none',
      stroke: el.getAttribute('stroke') || (el.style as any).stroke || 'none',
      opacity: parseFloat(el.getAttribute('opacity') || (el.style as any).opacity || '1'),
      ...originalTransform
    };
  }, [selectedLayerId, svgContent]);

  if (!selectedLayerId && selectedLayerIds.length > 0) {
      return null; 
  }

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

  const getCurrentValue = (prop: AnimatableProperty): number | string | undefined => {
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
      if (typeof prev.value === 'string' && typeof next.value === 'string') return interpolateColor(prev.value, next.value, easedT);
      return next.value;
    }
    // Return undefined if not tracking, so caller can decide fallback (e.g. static SVG value)
    if (baseValues) {
      if (prop === 'fill') return baseValues.fill;
      if (prop === 'stroke') return baseValues.stroke;
      if (prop === 'opacity') return baseValues.opacity;
    }
    // Specific fallbacks
    if (prop === 'scale' || prop === 'scaleX' || prop === 'scaleY' || prop === 'opacity') return 1;
    if (prop === 'anchorX' || prop === 'anchorY') return 0.5;
    if (['x','y','z','rotate','rotateX','rotateY'].includes(prop)) return 0;
    
    return undefined;
  };

  const handleApplyPreset = (presetId: string) => {
    if (!selectedLayerId) return;
    
    const getNum = (prop: AnimatableProperty, def: number) => {
        const val = getCurrentValue(prop);
        return typeof val === 'number' ? val : def;
    };

    const currentX = getNum('x', 0);
    const currentY = getNum('y', 0);
    
    const actions: { p: AnimatableProperty, v: number | string, t: number, e?: EasingType }[] = [];

    switch(presetId) {
        // Standard Presets
        case 'fadeIn':
            actions.push({ p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 });
            break;
        case 'fadeOut':
            actions.push({ p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 });
            break;
        case 'slideLeft': 
            actions.push(
                { p: 'x', v: currentX - 100, t: 0 }, { p: 'x', v: currentX, t: 0.5, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'slideRight':
            actions.push(
                { p: 'x', v: currentX + 100, t: 0 }, { p: 'x', v: currentX, t: 0.5, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'slideTop':
            actions.push(
                { p: 'y', v: currentY - 100, t: 0 }, { p: 'y', v: currentY, t: 0.5, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'slideBottom':
            actions.push(
                { p: 'y', v: currentY + 100, t: 0 }, { p: 'y', v: currentY, t: 0.5, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'slideOutLeft':
            actions.push(
                { p: 'x', v: currentX, t: 0 }, { p: 'x', v: currentX - 100, t: 0.5, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'slideOutRight':
            actions.push(
                { p: 'x', v: currentX, t: 0 }, { p: 'x', v: currentX + 100, t: 0.5, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'slideOutTop':
            actions.push(
                { p: 'y', v: currentY, t: 0 }, { p: 'y', v: currentY - 100, t: 0.5, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'slideOutBottom':
            actions.push(
                { p: 'y', v: currentY, t: 0 }, { p: 'y', v: currentY + 100, t: 0.5, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'rollInLeft':
            actions.push(
              { p: 'x', v: currentX - 100, t: 0 }, { p: 'x', v: currentX, t: 0.6, e: 'easeOutQuad' },
              { p: 'rotate', v: -120, t: 0 }, { p: 'rotate', v: 0, t: 0.6, e: 'easeOutQuad' },
              { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.6 }
            );
            break;
        case 'rollOutRight':
            actions.push(
              { p: 'x', v: currentX, t: 0 }, { p: 'x', v: currentX + 100, t: 0.6, e: 'easeInQuad' },
              { p: 'rotate', v: 0, t: 0 }, { p: 'rotate', v: 120, t: 0.6, e: 'easeInQuad' },
              { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.6 }
            );
            break;
        case 'scaleUp':
            actions.push(
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1, t: 0.5, e: 'easeOutBack' as any },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'scaleDown':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 0, t: 0.5, e: 'easeInBack' as any },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'zoomInDown':
            actions.push(
              { p: 'scale', v: 0.1, t: 0 }, { p: 'scale', v: 1, t: 0.6, e: 'easeOutCubic' },
              { p: 'y', v: currentY - 200, t: 0 }, { p: 'y', v: currentY, t: 0.6, e: 'easeOutCubic' },
              { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.6 }
            );
            break;
        case 'zoomOutUp':
            actions.push(
              { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 0.1, t: 0.6, e: 'easeInCubic' },
              { p: 'y', v: currentY, t: 0 }, { p: 'y', v: currentY - 200, t: 0.6, e: 'easeInCubic' },
              { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.6 }
            );
            break;
        case 'bounce':
            actions.push(
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1, t: 0.8, e: 'bounce' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'popIn':
            actions.push(
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1.1, t: 0.35, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.5, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.35 }
            );
            break;
        case 'rubberBand':
            actions.push(
              { p: 'scaleX', v: 1, t: 0 }, { p: 'scaleY', v: 1, t: 0 },
              { p: 'scaleX', v: 1.25, t: 0.3 }, { p: 'scaleY', v: 0.75, t: 0.3 },
              { p: 'scaleX', v: 0.75, t: 0.4 }, { p: 'scaleY', v: 1.25, t: 0.4 },
              { p: 'scaleX', v: 1.15, t: 0.5 }, { p: 'scaleY', v: 0.85, t: 0.5 },
              { p: 'scaleX', v: 0.95, t: 0.65 }, { p: 'scaleY', v: 1.05, t: 0.65 },
              { p: 'scaleX', v: 1, t: 0.8 }, { p: 'scaleY', v: 1, t: 0.8 }
            );
            break;
        case 'heartbeat':
            actions.push(
              { p: 'scale', v: 1, t: 0 },
              { p: 'scale', v: 1.3, t: 0.14, e: 'easeInOutQuad' },
              { p: 'scale', v: 1, t: 0.28, e: 'easeInOutQuad' },
              { p: 'scale', v: 1.3, t: 0.42, e: 'easeInOutQuad' },
              { p: 'scale', v: 1, t: 0.7, e: 'easeInOutQuad' }
            );
            break;
        case 'rotateIn':
            actions.push(
                { p: 'rotate', v: -180, t: 0 }, { p: 'rotate', v: 0, t: 0.5, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.5 }
            );
            break;
        case 'rotateOut':
            const r = getNum('rotate', 0);
            actions.push(
                { p: 'rotate', v: r, t: 0 }, { p: 'rotate', v: r + 180, t: 0.5, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'flipInX':
            actions.push(
              { p: 'rotateX', v: 90, t: 0 }, { p: 'rotateX', v: -20, t: 0.4, e: 'easeOutQuad' },
              { p: 'rotateX', v: 10, t: 0.6, e: 'easeInOutQuad' }, { p: 'rotateX', v: -5, t: 0.8, e: 'easeInOutQuad' },
              { p: 'rotateX', v: 0, t: 1, e: 'easeInOutQuad' },
              { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.4 }
            );
            break;
        case 'flipInY':
            actions.push(
              { p: 'rotateY', v: 90, t: 0 }, { p: 'rotateY', v: -20, t: 0.4, e: 'easeOutQuad' },
              { p: 'rotateY', v: 10, t: 0.6, e: 'easeInOutQuad' }, { p: 'rotateY', v: -5, t: 0.8, e: 'easeInOutQuad' },
              { p: 'rotateY', v: 0, t: 1, e: 'easeInOutQuad' },
              { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.4 }
            );
            break;
        case 'pulse':
            actions.push(
                { p: 'scale', v: 1, t: 0 },
                { p: 'scale', v: 1.15, t: 0.2, e: 'easeInOutQuad' },
                { p: 'scale', v: 1, t: 0.4, e: 'easeInOutQuad' }
            );
            break;
        case 'flash':
            actions.push(
              { p: 'opacity', v: 1, t: 0 },
              { p: 'opacity', v: 0, t: 0.25 },
              { p: 'opacity', v: 1, t: 0.5 },
              { p: 'opacity', v: 0, t: 0.75 },
              { p: 'opacity', v: 1, t: 1 }
            );
            break;
        case 'shake':
            actions.push(
                { p: 'x', v: currentX, t: 0 },
                { p: 'x', v: currentX - 10, t: 0.1 },
                { p: 'x', v: currentX + 10, t: 0.2 },
                { p: 'x', v: currentX - 10, t: 0.3 },
                { p: 'x', v: currentX + 10, t: 0.4 },
                { p: 'x', v: currentX, t: 0.5 }
            );
            break;
        case 'wobble':
            actions.push(
              { p: 'x', v: currentX, t: 0 }, { p: 'rotate', v: 0, t: 0 },
              { p: 'x', v: currentX - 25, t: 0.15 }, { p: 'rotate', v: -5, t: 0.15 },
              { p: 'x', v: currentX + 20, t: 0.3 }, { p: 'rotate', v: 3, t: 0.3 },
              { p: 'x', v: currentX - 15, t: 0.45 }, { p: 'rotate', v: -3, t: 0.45 },
              { p: 'x', v: currentX + 10, t: 0.6 }, { p: 'rotate', v: 2, t: 0.6 },
              { p: 'x', v: currentX - 5, t: 0.75 }, { p: 'rotate', v: -1, t: 0.75 },
              { p: 'x', v: currentX, t: 1 }, { p: 'rotate', v: 0, t: 1 }
            );
            break;
        case 'spin':
            const currentRot = getNum('rotate', 0);
            actions.push(
                { p: 'rotate', v: currentRot, t: 0 },
                { p: 'rotate', v: currentRot + 360, t: 1, e: 'easeInOutCubic' }
            );
            break;
        case 'wiggle':
            const curRot = getNum('rotate', 0);
            actions.push(
                { p: 'rotate', v: curRot, t: 0 },
                { p: 'rotate', v: curRot - 15, t: 0.15 },
                { p: 'rotate', v: curRot + 15, t: 0.3 },
                { p: 'rotate', v: curRot - 15, t: 0.45 },
                { p: 'rotate', v: curRot + 15, t: 0.6 },
                { p: 'rotate', v: curRot, t: 0.75 }
            );
            break;

        // Core Presets
        case 'flow_dotted_linear':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 2, e: 'linear' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 1.8 }, { p: 'opacity', v: 0, t: 2 }
            );
            break;
        case 'flow_dotted_chain':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 2, e: 'linear' },
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1, t: 0.2 }, { p: 'scale', v: 1, t: 1.8 }, { p: 'scale', v: 0, t: 2 }
            );
            break;
        case 'flow_dotted_bidirectional':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 1, e: 'easeInOutQuad' }, { p: 'offsetDistance', v: 0, t: 2, e: 'easeInOutQuad' }
            );
            break;
        case 'scan_single_pass':
            actions.push(
                { p: 'x', v: currentX - 200, t: 0 }, { p: 'x', v: currentX + 200, t: 1.5, e: 'linear' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 1.3 }, { p: 'opacity', v: 0, t: 1.5 }
            );
            break;
        case 'scan_dual_side':
            actions.push(
                { p: 'x', v: currentX - 200, t: 0 }, { p: 'x', v: currentX + 200, t: 1.5, e: 'easeInOutQuad' }, { p: 'x', v: currentX - 200, t: 3, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 2.8 }, { p: 'opacity', v: 0, t: 3 }
            );
            break;
        case 'scan_delayed_secondary':
            actions.push(
                { p: 'x', v: currentX - 200, t: 0.5 }, { p: 'x', v: currentX + 200, t: 2, e: 'linear' },
                { p: 'opacity', v: 0, t: 0.5 }, { p: 'opacity', v: 1, t: 0.7 }, { p: 'opacity', v: 1, t: 1.8 }, { p: 'opacity', v: 0, t: 2 }
            );
            break;
        case 'pulse_soft':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 1.05, t: 0.5, e: 'easeInOutQuad' }, { p: 'scale', v: 1, t: 1, e: 'easeInOutQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0.8, t: 0.5, e: 'easeInOutQuad' }, { p: 'opacity', v: 1, t: 1, e: 'easeInOutQuad' }
            );
            break;
        case 'pulse_strong':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 1.2, t: 0.3, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.8, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0.5, t: 0.3, e: 'easeOutQuad' }, { p: 'opacity', v: 1, t: 0.8, e: 'easeInQuad' }
            );
            break;
        case 'pulse_network':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 1.1, t: 0.2, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.6, e: 'easeInQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0.2, t: 0.2, e: 'easeOutQuad' }, { p: 'opacity', v: 1, t: 0.6, e: 'easeInQuad' }
            );
            break;
        case 'highlight_success':
            actions.push(
                { p: 'fill', v: '#22c55e', t: 0.3, e: 'easeOutQuad' },
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 1.05, t: 0.15, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.3, e: 'easeInQuad' }
            );
            break;
        case 'highlight_warning':
            actions.push(
                { p: 'fill', v: '#eab308', t: 0.3, e: 'easeOutQuad' },
                { p: 'x', v: currentX, t: 0 }, { p: 'x', v: currentX - 5, t: 0.1 }, { p: 'x', v: currentX + 5, t: 0.2 }, { p: 'x', v: currentX, t: 0.3 }
            );
            break;
        case 'highlight_processing':
            actions.push(
                { p: 'fill', v: '#3b82f6', t: 0.3, e: 'easeOutQuad' },
                { p: 'opacity', v: 1, t: 0 }, { p: 'opacity', v: 0.5, t: 0.5, e: 'easeInOutQuad' }, { p: 'opacity', v: 1, t: 1, e: 'easeInOutQuad' }
            );
            break;
        case 'checklist_success':
            actions.push(
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1.2, t: 0.3, e: 'easeOutBack' as any }, { p: 'scale', v: 1, t: 0.5, e: 'easeInOutQuad' },
                { p: 'fill', v: '#22c55e', t: 0.5, e: 'easeOutQuad' }
            );
            break;
        case 'checklist_with_exception':
            actions.push(
                { p: 'scale', v: 0, t: 0 }, { p: 'scale', v: 1.2, t: 0.3, e: 'easeOutBack' as any }, { p: 'scale', v: 1, t: 0.5, e: 'easeInOutQuad' },
                { p: 'fill', v: '#ef4444', t: 0.5, e: 'easeOutQuad' },
                { p: 'x', v: currentX, t: 0.5 }, { p: 'x', v: currentX - 5, t: 0.6 }, { p: 'x', v: currentX + 5, t: 0.7 }, { p: 'x', v: currentX, t: 0.8 }
            );
            break;
        case 'count_up':
            actions.push(
                { p: 'scale', v: 0.8, t: 0 }, { p: 'scale', v: 1.1, t: 0.2, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.4, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }
            );
            break;
        case 'count_down':
            actions.push(
                { p: 'scale', v: 1.2, t: 0 }, { p: 'scale', v: 0.9, t: 0.2, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.4, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }
            );
            break;
        case 'count_odometer':
            actions.push(
                { p: 'y', v: currentY + 20, t: 0 }, { p: 'y', v: currentY, t: 0.3, e: 'easeOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.3 }
            );
            break;
        case 'line_draw':
            actions.push(
                { p: 'scaleX', v: 0, t: 0 }, { p: 'scaleX', v: 1, t: 1, e: 'easeInOutQuad' }
            );
            break;
        case 'line_travel':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 2, e: 'easeInOutQuad' }
            );
            break;
        case 'line_loop':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 2, e: 'linear' }
            );
            break;
        case 'packet_single':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 1.5, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 1.3 }, { p: 'opacity', v: 0, t: 1.5 }
            );
            break;
        case 'packet_multiple':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 1.5, e: 'linear' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 1.3 }, { p: 'opacity', v: 0, t: 1.5 }
            );
            break;
        case 'packet_random':
            actions.push(
                { p: 'offsetDistance', v: 0, t: 0 }, { p: 'offsetDistance', v: 100, t: 1.5, e: 'easeOutCubic' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 1, t: 0.2 }, { p: 'opacity', v: 1, t: 1.3 }, { p: 'opacity', v: 0, t: 1.5 }
            );
            break;
        case 'shine_fast':
            actions.push(
                { p: 'x', v: currentX - 150, t: 0 }, { p: 'x', v: currentX + 150, t: 0.5, e: 'linear' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 0.8, t: 0.25 }, { p: 'opacity', v: 0, t: 0.5 }
            );
            break;
        case 'shine_soft':
            actions.push(
                { p: 'x', v: currentX - 150, t: 0 }, { p: 'x', v: currentX + 150, t: 1.5, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0, t: 0 }, { p: 'opacity', v: 0.5, t: 0.75 }, { p: 'opacity', v: 0, t: 1.5 }
            );
            break;
        case 'scroll_click':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 0.9, t: 0.1, e: 'easeOutQuad' }, { p: 'scale', v: 1, t: 0.2, e: 'easeInQuad' }
            );
            break;
        case 'scroll_auto':
            actions.push(
                { p: 'y', v: currentY, t: 0 }, { p: 'y', v: currentY - 100, t: 1, e: 'easeInOutQuad' }
            );
            break;
        case 'node_flow_loop':
            actions.push(
                { p: 'scale', v: 1, t: 0 }, { p: 'scale', v: 1.1, t: 0.5, e: 'easeInOutQuad' }, { p: 'scale', v: 1, t: 1, e: 'easeInOutQuad' },
                { p: 'opacity', v: 0.5, t: 0 }, { p: 'opacity', v: 1, t: 0.5, e: 'easeInOutQuad' }, { p: 'opacity', v: 0.5, t: 1, e: 'easeInOutQuad' }
            );
            break;
    }

    actions.forEach((action, index) => {
        onAddKeyframe(
            selectedLayerId, 
            action.p, 
            action.v, 
            currentTime + action.t, 
            (action.e || 'linear') as EasingType, 
            index > 0 
        );
    });
  };

  const AlignmentToolbar = () => (
    <div className="flex items-center justify-between mb-6 p-2 bg-gray-50 rounded-xl border border-gray-100">
        <button onClick={() => onAlign?.('left')} title="Align Left" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="3"/><rect x="8" y="6" width="12" height="4"/><rect x="8" y="14" width="8" height="4"/></svg></button>
        <button onClick={() => onAlign?.('center')} title="Align Center" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="3" x2="12" y2="21"/><rect x="6" y="6" width="12" height="4"/><rect x="8" y="14" width="8" height="4"/></svg></button>
        <button onClick={() => onAlign?.('right')} title="Align Right" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="21" x2="20" y2="3"/><rect x="4" y="6" width="12" height="4"/><rect x="8" y="14" width="8" height="4"/></svg></button>
        <div className="w-px h-4 bg-gray-200 mx-1"></div>
        <button onClick={() => onAlign?.('top')} title="Align Top" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="4" x2="21" y2="4"/><rect x="6" y="8" width="4" height="12"/><rect x="14" y="8" width="4" height="8"/></svg></button>
        <button onClick={() => onAlign?.('middle')} title="Align Middle" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><rect x="6" y="6" width="4" height="12"/><rect x="14" y="8" width="4" height="8"/></svg></button>
        <button onClick={() => onAlign?.('bottom')} title="Align Bottom" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="20" x2="21" y2="20"/><rect x="6" y="4" width="4" height="12"/><rect x="14" y="8" width="4" height="8"/></svg></button>
        <div className="w-px h-4 bg-gray-200 mx-1"></div>
        <button onClick={() => onAlign?.('distribute-h')} title="Distribute Horizontal" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="2" height="12"/><rect x="18" y="6" width="2" height="12"/><path d="M8 12h8"/></svg></button>
        <button onClick={() => onAlign?.('distribute-v')} title="Distribute Vertical" className="p-1.5 rounded hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900 transition-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="12" height="2"/><rect x="6" y="18" width="12" height="2"/><path d="M12 8v8"/></svg></button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-20 shadow-sm shrink-0">
        <h2 className="text-sm font-bold text-gray-900 truncate tracking-tight uppercase max-w-[140px]">{selectedLayerIds.length > 1 ? `${selectedLayerIds.length} Items` : selectedLayerId}</h2>
        <div className="flex items-center gap-2">
           <button onClick={onToggleTransform} className={`p-2 rounded-xl transition-all shadow-sm ${isTransformMode ? 'bg-orange-500 text-white shadow-orange-100' : 'text-gray-400 hover:bg-gray-100'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6"/><path d="m14 10 7-7"/><path d="M9 21H3v-6"/><path d="m10 14-7 7"/></svg>
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-100 p-6">
        {selectedLayerIds.length > 1 && <AlignmentToolbar />}

        {/* Transform Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Transform</h3>
          <PropertyRow label="X POSITION" value={getCurrentValue('x') ?? 0} onReset={() => onAddKeyframe(selectedLayerId, 'x', 0)} activeKf={getActiveKf('x')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'x', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'x', kfId, easing, bezier)} />
          <PropertyRow label="Y POSITION" value={getCurrentValue('y') ?? 0} onReset={() => onAddKeyframe(selectedLayerId, 'y', 0)} activeKf={getActiveKf('y')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'y', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'y', kfId, easing, bezier)} />
          <PropertyRow label="Z POSITION (3D)" value={getCurrentValue('z') ?? 0} onReset={() => onAddKeyframe(selectedLayerId, 'z', 0)} activeKf={getActiveKf('z')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'z', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'z', kfId, easing, bezier)} />
          <PropertyRow label="SCALE" value={getCurrentValue('scale') ?? 1} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scale', 1)} activeKf={getActiveKf('scale')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scale', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scale', kfId, easing, bezier)} />
          <div className="grid grid-cols-2 gap-2">
             <PropertyRow label="SCALE X" value={getCurrentValue('scaleX') ?? 1} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scaleX', 1)} activeKf={getActiveKf('scaleX')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scaleX', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scaleX', kfId, easing, bezier)} />
             <PropertyRow label="SCALE Y" value={getCurrentValue('scaleY') ?? 1} min={0.1} max={5} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'scaleY', 1)} activeKf={getActiveKf('scaleY')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'scaleY', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'scaleY', kfId, easing, bezier)} />
          </div>
          
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-50">
             <PropertyRow label="ANCHOR X" value={getCurrentValue('anchorX') ?? 0.5} min={0} max={1} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'anchorX', 0.5)} activeKf={getActiveKf('anchorX')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'anchorX', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'anchorX', kfId, easing, bezier)} />
             <PropertyRow label="ANCHOR Y" value={getCurrentValue('anchorY') ?? 0.5} min={0} max={1} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'anchorY', 0.5)} activeKf={getActiveKf('anchorY')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'anchorY', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'anchorY', kfId, easing, bezier)} />
          </div>
        </div>

        {/* Motion Path Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Motion Path</h3>
          <PropertyRow label="PATH DATA" value={getCurrentValue('offsetPath') ?? ''} type="text" onReset={() => onAddKeyframe(selectedLayerId, 'offsetPath', '')} activeKf={getActiveKf('offsetPath')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'offsetPath', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'offsetPath', kfId, easing, bezier)} />
          <PropertyRow label="OFFSET DISTANCE (%)" value={getCurrentValue('offsetDistance') ?? 0} min={0} max={100} step={0.1} onReset={() => onAddKeyframe(selectedLayerId, 'offsetDistance', 0)} activeKf={getActiveKf('offsetDistance')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'offsetDistance', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'offsetDistance', kfId, easing, bezier)} />
          <PropertyRow label="OFFSET ROTATE" value={getCurrentValue('offsetRotate') ?? 'auto'} type="text" onReset={() => onAddKeyframe(selectedLayerId, 'offsetRotate', 'auto')} activeKf={getActiveKf('offsetRotate')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'offsetRotate', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'offsetRotate', kfId, easing, bezier)} />
        </div>

        {/* Rotation Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Rotation</h3>
          <PropertyRow label="ROTATE Z" value={getCurrentValue('rotate') ?? 0} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotate', 0)} activeKf={getActiveKf('rotate')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotate', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotate', kfId, easing, bezier)} />
          <div className="grid grid-cols-2 gap-2">
            <PropertyRow label="ROTATE X (3D)" value={getCurrentValue('rotateX') ?? 0} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotateX', 0)} activeKf={getActiveKf('rotateX')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotateX', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotateX', kfId, easing, bezier)} />
            <PropertyRow label="ROTATE Y (3D)" value={getCurrentValue('rotateY') ?? 0} min={-360} max={360} onReset={() => onAddKeyframe(selectedLayerId, 'rotateY', 0)} activeKf={getActiveKf('rotateY')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'rotateY', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'rotateY', kfId, easing, bezier)} />
          </div>
        </div>

        {/* Visual Controls */}
        <div className="mb-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Appearance</h3>
          <PropertyRow label="OPACITY" value={getCurrentValue('opacity') ?? 1} min={0} max={1} step={0.01} onReset={() => onAddKeyframe(selectedLayerId, 'opacity', 1)} activeKf={getActiveKf('opacity')} onAdd={(val) => onAddKeyframe(selectedLayerId, 'opacity', val)} onUpdateEasing={(kfId, easing, bezier) => onUpdateKeyframeEasing(selectedLayerId, 'opacity', kfId, easing, bezier)} />
          <PropertyRow 
            label="FILL COLOR" 
            value={getCurrentValue('fill') ?? (baseValues?.fill || '#000000')} 
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
            selectedLayerId={selectedLayerId}
            onAddKeyframe={onAddKeyframe}
            currentTime={currentTime}
            getCurrentValue={getCurrentValue}
            layerAnimation={anim}
          />
        </div>

        {/* Animation Presets */}
        <AnimationPresets onApply={handleApplyPreset} disabled={!selectedLayerId} />
      </div>
      <MotionAI 
        state={state} 
        onApplyAnimation={(layerId, property, value, time, easing) => onAddKeyframe(layerId, property, value, time, easing, false)} 
      />
    </div>
  );
};

export default PropertyInspector;
