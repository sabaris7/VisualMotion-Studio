
import React, { useRef, useState, useEffect } from 'react';
import { EditorState, AnimatableProperty, Keyframe, TimelineMarker, SelectedKeyframe } from '../types';
import { PIXELS_PER_SECOND, PROPERTY_LABELS } from '../constants';

interface TimelineProps {
  state: EditorState;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  onUpdateDuration: (duration: number) => void;
  onRemoveKeyframe: (layerId: string, property: AnimatableProperty, kfId: string) => void;
  onDeleteSelectedKeyframes: () => void;
  onUpdateKeyframeTime?: (layerId: string, property: AnimatableProperty, kfId: string, newTime: number, skipHistory: boolean) => void;
  onFinalizeKeyframeDrag: () => void;
  setSelectedKeyframes: (kfs: SelectedKeyframe[]) => void;
  onAddMarker: () => void;
  onRemoveMarker: (id: string) => void;
  setPlaybackOptions: (opts: Partial<Pick<EditorState, 'isLooping' | 'isYoyo' | 'playbackSpeed' | 'timelineZoom'>>) => void;
}

const Timeline: React.FC<TimelineProps> = ({ state, setCurrentTime, setPlaying, onUpdateDuration, onRemoveKeyframe, onDeleteSelectedKeyframes, onUpdateKeyframeTime, onFinalizeKeyframeDrag, setSelectedKeyframes, onAddMarker, onRemoveMarker, setPlaybackOptions }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const { duration, currentTime, isPlaying, animations, markers, isLooping, isYoyo, playbackSpeed, timelineZoom, selectedKeyframes } = state;
  const [draggingKf, setDraggingKf] = useState<{ layerId: string, property: AnimatableProperty, kfId: string } | null>(null);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState(duration.toString());
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const pixelsPerSecond = PIXELS_PER_SECOND * timelineZoom;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedKeyframes.length > 0) {
          onDeleteSelectedKeyframes();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframes, onDeleteSelectedKeyframes]);

  const seekToX = (clientX: number) => {
    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const x = clientX - rect.left + scrollLeft;
    const time = Math.max(0, Math.min(duration, x / pixelsPerSecond));
    setCurrentTime(time);
  };

  const handleTimelineMouseDown = (e: React.MouseEvent) => {
    // Check if target is a keyframe
    const target = e.target as HTMLElement;
    if (target.classList.contains('keyframe-diamond')) return;

    if (draggingKf) return;
    
    // Jump to seek immediately on click
    seekToX(e.clientX);

    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const startX = e.clientX - rect.left + scrollLeft;
    const startY = e.clientY - rect.top;

    if (!e.shiftKey) {
      setSelectedKeyframes([]);
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.clientX - rect.left + scrollLeft;
      const currentY = moveEvent.clientY - rect.top;
      
      const dx = Math.abs(currentX - startX);
      const dy = Math.abs(currentY - startY);

      // If moving significantly and we clicked background, start marquee selection
      // Otherwise, continuous seek
      if (dx > 5 || dy > 5) {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);
        setSelectionBox({ x, y, w, h });

        // Hit test keyframes
        const found: SelectedKeyframe[] = [];
        animations.forEach((anim, animIdx) => {
          anim.tracks.forEach((track, trackIdx) => {
            const rowIdx = animations.slice(0, animIdx).reduce((acc, curr) => acc + curr.tracks.length + 1, 0) + trackIdx + 1;
            const rowTop = rowIdx * 23 + 40; 
            const rowBottom = rowTop + 23;

            if (y < rowBottom && y + h > rowTop) {
              track.keyframes.forEach(kf => {
                const kfX = kf.time * pixelsPerSecond;
                if (kfX >= x && kfX <= x + w) {
                  found.push({ layerId: anim.layerId, property: track.property, kfId: kf.id });
                }
              });
            }
          });
        });

        if (e.shiftKey) {
          const combined = [...selectedKeyframes];
          found.forEach(f => {
            if (!combined.some(c => c.kfId === f.kfId)) combined.push(f);
          });
          setSelectedKeyframes(combined);
        } else {
          setSelectedKeyframes(found);
        }
      } else {
        seekToX(moveEvent.clientX);
      }
    };

    const onMouseUp = () => {
      setSelectionBox(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDragPlayhead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) setPlaying(false);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      seekToX(moveEvent.clientX);
    };

    const onMouseUp = () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleKfMouseDown = (e: React.MouseEvent, layerId: string, property: AnimatableProperty, kfId: string) => {
    e.stopPropagation();
    
    let currentSelected = [...selectedKeyframes];
    const isAlreadySelected = currentSelected.some(sk => sk.kfId === kfId);

    if (e.shiftKey) {
      if (isAlreadySelected) {
        currentSelected = currentSelected.filter(sk => sk.kfId !== kfId);
      } else {
        currentSelected.push({ layerId, property, kfId });
      }
      setSelectedKeyframes(currentSelected);
    } else if (!isAlreadySelected) {
      currentSelected = [{ layerId, property, kfId }];
      setSelectedKeyframes(currentSelected);
    }

    setDraggingKf({ layerId, property, kfId });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = trackAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scrollLeft = scrollRef.current?.scrollLeft || 0;
      const x = moveEvent.clientX - rect.left + scrollLeft;
      const newTime = Math.max(0, Math.min(duration, x / pixelsPerSecond));
      if (onUpdateKeyframeTime) {
        onUpdateKeyframeTime(layerId, property, kfId, newTime, true);
      }
    };

    const onMouseUp = () => {
      setDraggingKf(null);
      onFinalizeKeyframeDrag();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleDurationBlur = () => {
    setIsEditingDuration(false);
    const val = parseFloat(durationInput);
    if (!isNaN(val) && val > 0) {
      onUpdateDuration(val);
    } else {
      setDurationInput(duration.toString());
    }
  };

  const ticks = [];
  const tickStep = timelineZoom < 0.8 ? 1 : 0.5;
  for (let i = 0; i <= duration; i += tickStep) {
    ticks.push(
      <div key={i} className="absolute h-full border-l border-white/5 flex flex-col justify-between py-1 pointer-events-none" style={{ left: `${i * pixelsPerSecond}px` }}>
        <span className="text-[9px] text-gray-500 font-mono -translate-x-1/2 tracking-tighter bg-[#1a1a1a] px-1">{i.toFixed(1)}s</span>
        <div className={`h-2 w-px ${i % 1 === 0 ? 'bg-gray-600' : 'bg-gray-700'}`}></div>
      </div>
    );
  }

  return (
    <div className="h-80 bg-[#121212] border-t border-gray-800 flex flex-col text-gray-300 z-20">
      {/* Controls Bar */}
      <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-[#181818] shrink-0">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setPlaying(!isPlaying)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isPlaying ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' : 'bg-[#252525] text-gray-400 hover:bg-[#333]'
            }`}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M5 3l14 9-14 9V3z"/></svg>
            )}
          </button>
          
          <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-[11px] font-mono font-bold text-orange-500">{Math.abs(currentTime).toFixed(3)}s</span>
            <span className="text-xs text-gray-700">/</span>
            {isEditingDuration ? (
              <input 
                type="text" 
                value={durationInput} 
                autoFocus
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={handleDurationBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleDurationBlur()}
                className="text-[11px] font-mono bg-orange-500/10 border border-orange-500/30 text-orange-400 outline-none w-12 text-center rounded"
              />
            ) : (
              <span 
                className="text-[11px] font-mono text-gray-600 hover:text-orange-400 cursor-pointer transition-colors"
                onClick={() => { setDurationInput(duration.toString()); setIsEditingDuration(true); }}
              >
                {duration.toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-4">
            <button 
              onClick={() => setPlaybackOptions({ isLooping: !isLooping })}
              className={`p-2 rounded-lg hover:bg-white/5 transition-all ${isLooping ? 'text-orange-500 bg-orange-500/10' : 'text-gray-600'}`}
              title="Toggle Loop"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            </button>
            <button 
              onClick={() => setPlaybackOptions({ isYoyo: !isYoyo })}
              className={`p-2 rounded-lg hover:bg-white/5 transition-all ${isYoyo ? 'text-orange-500 bg-orange-500/10' : 'text-gray-600'}`}
              title="Toggle Yoyo"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="7 13 3 17 7 21"/><polyline points="17 11 21 7 17 3"/><path d="M21 7H3v10h18V7z"/></svg>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={onAddMarker}
            className="text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl transition-all border border-white/10 hover:border-white/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Add Marker
          </button>
          
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <button 
              onClick={() => setPlaybackOptions({ timelineZoom: Math.max(0.4, timelineZoom - 0.2) })}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span className="text-[10px] font-mono font-bold w-12 text-center text-orange-400">{Math.round(timelineZoom * 100)}%</span>
            <button 
              onClick={() => setPlaybackOptions({ timelineZoom: Math.min(3, timelineZoom + 0.2) })}
              className="p-1.5 text-gray-500 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Track Headers */}
        <div className="w-56 border-r border-white/5 flex flex-col bg-[#181818] shrink-0">
          <div className="h-10 border-b border-white/5 bg-[#1a1a1a] flex items-center px-4 shrink-0">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Track Name</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 select-none">
            {animations.map(anim => (
              <div key={anim.layerId} className="border-b border-white/5">
                <div className={`px-4 py-2.5 flex items-center gap-2.5 text-[11px] font-bold ${state.selectedLayerIds.includes(anim.layerId) ? 'bg-orange-500/10 text-orange-400' : 'text-gray-400'}`}>
                   <div className={`w-1.5 h-1.5 rounded-full ${state.selectedLayerIds.includes(anim.layerId) ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-gray-600'}`}></div>
                   <span className="truncate">{anim.layerId}</span>
                </div>
                {anim.tracks.map(track => (
                  <div key={track.property} className="pl-9 pr-4 py-1.5 text-[10px] text-gray-500 flex items-center group hover:bg-white/5 transition-colors">
                    <span className="truncate">{PROPERTY_LABELS[track.property]}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable Timeline Area */}
        <div className="flex-1 overflow-x-auto relative scrollbar-thin scrollbar-thumb-white/10" ref={scrollRef}>
          <div 
            className="h-full relative bg-[#0f0f0f] min-w-full" 
            style={{ 
              width: `${duration * pixelsPerSecond}px`,
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: `${pixelsPerSecond}px 100%`
            }} 
            onMouseDown={handleTimelineMouseDown}
            ref={trackAreaRef}
          >
            {/* Selection Box */}
            {selectionBox && (
              <div 
                className="absolute border border-orange-500 bg-orange-500/10 z-40 pointer-events-none"
                style={{ 
                  left: selectionBox.x, 
                  top: selectionBox.y, 
                  width: selectionBox.w, 
                  height: selectionBox.h 
                }}
              />
            )}

            {/* Ruler Header */}
            <div className="h-10 border-b border-white/5 bg-[#1a1a1a] sticky top-0 z-20 pointer-events-none">
              {ticks}
              {markers.map(m => (
                <div key={m.id} className="absolute top-0 bottom-0 w-px z-10 flex flex-col items-center" style={{ left: `${m.time * pixelsPerSecond}px` }}>
                  <div className="mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap pointer-events-auto cursor-pointer shadow-lg active:scale-95 transition-transform"
                    style={{ backgroundColor: m.color }}
                    onClick={(e) => { e.stopPropagation(); onRemoveMarker(m.id); }}
                  >{m.label}</div>
                  <div className="w-px flex-1" style={{ backgroundColor: `${m.color}22` }}></div>
                </div>
              ))}
            </div>

            {/* Tracks Area */}
            <div className="flex flex-col relative">
              {animations.map(anim => (
                <div key={anim.layerId} className="border-b border-white/5">
                  <div className="h-[31px] w-full"></div> {/* Space for Layer Header */}
                  {anim.tracks.map(track => (
                    <div key={track.property} className="track-row h-[23px] w-full border-t border-white/5 relative flex items-center group">
                       {/* Track Background Shimmer */}
                       <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-colors pointer-events-none"></div>
                       
                       {/* Keyframe Connecting Line */}
                       {track.keyframes.length > 1 && (
                         <div className="absolute h-[1.5px] bg-orange-500/20 rounded-full"
                          style={{ 
                            left: `${track.keyframes[0].time * pixelsPerSecond}px`, 
                            width: `${(track.keyframes[track.keyframes.length-1].time - track.keyframes[0].time) * pixelsPerSecond}px` 
                          }}
                         ></div>
                       )}

                       {/* Keyframes (Diamonds) */}
                       {track.keyframes.map(kf => {
                         const isSelected = selectedKeyframes.some(sk => sk.kfId === kf.id);
                         return (
                           <div 
                            key={kf.id} 
                            onMouseDown={(e) => handleKfMouseDown(e, anim.layerId, track.property, kf.id)}
                            className={`keyframe-diamond absolute w-[10px] h-[10px] rotate-45 border border-white/30 cursor-pointer hover:scale-125 transition-all z-10 shadow-lg ${
                              isSelected 
                                ? 'bg-white scale-150 ring-2 ring-orange-500 ring-offset-1 ring-offset-[#0f0f0f] shadow-orange-500/50' 
                                : 'bg-orange-500 shadow-orange-900/40'
                            } ${
                              Math.abs(kf.time - currentTime) < 0.05 && !isSelected ? 'scale-125 ring-2 ring-white/50' : ''
                            }`}
                            style={{ left: `${kf.time * pixelsPerSecond - 5}px` }}
                            title={`Time: ${kf.time.toFixed(3)}s\nValue: ${kf.value}`}
                           ></div>
                         );
                       })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Active Playhead Marker */}
            <div 
              className="absolute top-0 h-full w-[1.5px] bg-orange-500 z-30 pointer-events-none shadow-[0_0_15px_rgba(249,115,22,0.6)]" 
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              <div 
                className="w-4 h-7 -ml-[7.25px] bg-orange-500 rounded-b-lg flex items-center justify-center cursor-ew-resize pointer-events-auto shadow-2xl hover:bg-orange-400 active:scale-110 transition-all" 
                onMouseDown={handleDragPlayhead}
              >
                <div className="w-[1.5px] h-3 bg-white/50 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
