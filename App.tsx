
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PropertyInspector from './components/PropertyInspector';
import Timeline from './components/Timeline';
import Stage from './components/Stage';
import ExportModal from './components/ExportModal';
import { EditorState, SVGLayer, AnimatableProperty, EasingType, TriggerType, Keyframe, SelectedKeyframe } from './types';
import { INITIAL_SVG, DEFAULT_DURATION, TICK_INTERVAL } from './constants';

const App: React.FC = () => {
  const [state, setState] = useState<EditorState>({
    svgContent: INITIAL_SVG,
    layers: [],
    selectedLayerIds: [],
    hiddenLayerIds: [],
    selectedKeyframes: [],
    animations: [],
    currentTime: 0,
    duration: DEFAULT_DURATION,
    isPlaying: false,
    isLooping: true,
    isYoyo: false,
    playbackSpeed: 1,
    timelineZoom: 1,
    stageZoom: 1,
    markers: [],
    isTransformMode: true,
    artboardWidth: 400,
    artboardHeight: 400,
    artboardBackground: '#FFFFFF',
    isClipContent: false,
    editingPathId: null,
  });

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [history, setHistory] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [clipboard, setClipboard] = useState<{ property: AnimatableProperty, value: number | string, easing: EasingType, bezier?: [number, number, number, number], relativeTime: number }[]>([]);
  
  const pushToHistory = useCallback((currentState: EditorState) => {
    setHistory(prev => [...prev.slice(-49), currentState]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [state, ...f]);
    setHistory(h => h.slice(0, -1));
    setState(prev);
  }, [history, state]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, state]);
    setFuture(f => f.slice(1));
    setState(next);
  }, [future, state]);

  // --- Animation & Keyframes ---

  const addKeyframe = useCallback((layerId: string, property: AnimatableProperty, value: number | string, time?: number, easing: EasingType = 'easeInOutQuad', skipHistory: boolean = false, bezier?: [number, number, number, number]) => {
    if (!skipHistory) pushToHistory(state);
    setState(prev => {
      const newAnimations = [...prev.animations];
      let layerAnim = newAnimations.find(a => a.layerId === layerId);
      if (!layerAnim) { layerAnim = { layerId, tracks: [], trigger: 'on_load' }; newAnimations.push(layerAnim); }
      let track = layerAnim.tracks.find(t => t.property === property);
      if (!track) { track = { property, keyframes: [] }; layerAnim.tracks.push(track); }
      const targetTime = time !== undefined ? time : prev.currentTime;
      const existingIdx = track.keyframes.findIndex(kf => Math.abs(kf.time - targetTime) < 0.01);
      const newKeyframe: Keyframe = { id: Math.random().toString(36).substr(2, 9), time: targetTime, value, easing, bezierParams: bezier };
      if (existingIdx > -1) track.keyframes[existingIdx] = newKeyframe;
      else { track.keyframes.push(newKeyframe); track.keyframes.sort((a, b) => a.time - b.time); }
      return { ...prev, animations: newAnimations };
    });
  }, [pushToHistory, state]);

  const copyKeyframes = useCallback(() => {
    if (state.selectedKeyframes.length === 0) return;
    let minTime = Infinity;
    const kfsToCopy: any[] = [];
    state.selectedKeyframes.forEach(sk => {
      const anim = state.animations.find(a => a.layerId === sk.layerId);
      const track = anim?.tracks.find(t => t.property === sk.property);
      const kf = track?.keyframes.find(k => k.id === sk.kfId);
      if (kf) {
        minTime = Math.min(minTime, kf.time);
        kfsToCopy.push({ ...kf, property: sk.property });
      }
    });
    const result = kfsToCopy.map(k => ({
      property: k.property,
      value: k.value,
      easing: k.easing,
      bezier: k.bezierParams,
      relativeTime: k.time - minTime
    }));
    setClipboard(result);
  }, [state.selectedKeyframes, state.animations]);

  const pasteKeyframes = useCallback(() => {
    if (clipboard.length === 0 || state.selectedLayerIds.length === 0) return;
    pushToHistory(state);
    const targetLayerId = state.selectedLayerIds[0];
    clipboard.forEach(item => {
      addKeyframe(targetLayerId, item.property, item.value, state.currentTime + item.relativeTime, item.easing, true, item.bezier);
    });
  }, [clipboard, state.selectedLayerIds, state.currentTime, addKeyframe, pushToHistory, state]);

  const updateKeyframeTime = useCallback((layerId: string, property: AnimatableProperty, kfId: string, newTime: number, skipHistory: boolean = false) => {
    if (!skipHistory) pushToHistory(state);
    setState(prev => {
      const isGroupMove = prev.selectedKeyframes.some(sk => sk.kfId === kfId);
      const selectedKfs = isGroupMove ? prev.selectedKeyframes : [{ layerId, property, kfId }];
      const targetKf = prev.animations.find(a => a.layerId === layerId)?.tracks.find(t => t.property === property)?.keyframes.find(k => k.id === kfId);
      if (!targetKf) return prev;
      const delta = newTime - targetKf.time;
      const newAnimations = prev.animations.map(anim => {
        const matchingKfs = selectedKfs.filter(sk => sk.layerId === anim.layerId);
        if (matchingKfs.length === 0) return anim;
        return {
          ...anim,
          tracks: anim.tracks.map(track => {
            const trackMatchingKfs = matchingKfs.filter(sk => sk.property === track.property);
            if (trackMatchingKfs.length === 0) return track;
            return {
              ...track,
              keyframes: track.keyframes.map(kf => {
                const isSelected = trackMatchingKfs.some(sk => sk.kfId === kf.id);
                if (!isSelected) return kf;
                return { ...kf, time: Math.max(0, Math.min(prev.duration, kf.time + delta)) };
              }).sort((a, b) => a.time - b.time)
            };
          })
        };
      });
      return { ...prev, animations: newAnimations };
    });
  }, [pushToHistory, state]);

  const deleteKeyframes = useCallback((selectedKfs: SelectedKeyframe[]) => {
    pushToHistory(state);
    setState(prev => ({
      ...prev,
      selectedKeyframes: [],
      animations: prev.animations.map(anim => ({
        ...anim,
        tracks: anim.tracks.map(track => ({
          ...track,
          keyframes: track.keyframes.filter(kf => !selectedKfs.some(sk => sk.layerId === anim.layerId && sk.property === track.property && sk.kfId === kf.id))
        })).filter(t => t.keyframes.length > 0)
      })).filter(a => a.tracks.length > 0)
    }));
  }, [pushToHistory, state]);

  const handleUpdateTrigger = useCallback((layerId: string, trigger: TriggerType) => {
    pushToHistory(state);
    setState(prev => ({
      ...prev,
      animations: prev.animations.map(anim => anim.layerId === layerId ? { ...anim, trigger } : anim)
    }));
  }, [pushToHistory, state]);


  // --- Layer Management ---

  const handleGroupLayers = useCallback(() => {
    if (state.selectedLayerIds.length < 2) return;
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const group = doc.createElementNS("http://www.w3.org/2000/svg", "g");
      const groupId = `group-${Math.random().toString(36).substr(2, 9)}`;
      group.setAttribute("id", groupId);

      // Find all elements
      const elements: Element[] = [];
      prev.selectedLayerIds.forEach(id => {
        const el = doc.getElementById(id);
        if (el) elements.push(el);
      });

      if (elements.length === 0) return prev;

      // Insert group before the first selected element
      const firstEl = elements[0];
      if (firstEl.parentNode) {
        firstEl.parentNode.insertBefore(group, firstEl);
      }

      // Move elements into group
      elements.forEach(el => group.appendChild(el));

      return { 
        ...prev, 
        svgContent: new XMLSerializer().serializeToString(doc),
        selectedLayerIds: [groupId] 
      };
    });
  }, [pushToHistory, state]);

  const handleReorderLayers = useCallback((sourceId: string, targetId: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const sourceEl = doc.getElementById(sourceId);
      const targetEl = doc.getElementById(targetId);

      if (sourceEl && targetEl && sourceEl.parentNode === targetEl.parentNode) {
        // Insert before target
        targetEl.parentNode.insertBefore(sourceEl, targetEl);
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);

  const handleRenameLayer = useCallback((id: string, newName: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const el = doc.getElementById(id);
      
      if (el) {
        el.setAttribute("id", newName);
      }

      // Also update animations references
      const newAnimations = prev.animations.map(anim => 
        anim.layerId === id ? { ...anim, layerId: newName } : anim
      );

      return { 
        ...prev, 
        svgContent: new XMLSerializer().serializeToString(doc),
        animations: newAnimations,
        selectedLayerIds: prev.selectedLayerIds.map(sid => sid === id ? newName : sid)
      };
    });
  }, [pushToHistory, state]);

  const handleDeleteLayer = useCallback((id: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const el = doc.getElementById(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
      return { 
        ...prev, 
        svgContent: new XMLSerializer().serializeToString(doc),
        selectedLayerIds: prev.selectedLayerIds.filter(sid => sid !== id),
        animations: prev.animations.filter(a => a.layerId !== id)
      };
    });
  }, [pushToHistory, state]);

  // --- Gradient Management ---

  const updateGradientColor = useCallback((gradientId: string, stopIndex: number, color: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const grad = doc.getElementById(gradientId);
      if (grad) {
        const stops = grad.querySelectorAll('stop');
        if (stops[stopIndex]) {
          stops[stopIndex].setAttribute('stop-color', color);
        }
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);

  const addGradientStop = useCallback((gradientId: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const grad = doc.getElementById(gradientId);
      if (grad) {
        const newStop = doc.createElementNS("http://www.w3.org/2000/svg", "stop");
        newStop.setAttribute("offset", "1");
        newStop.setAttribute("stop-color", "#F97316");
        grad.appendChild(newStop);
        
        // Redistribute offsets evenly
        const allStops = grad.querySelectorAll('stop');
        allStops.forEach((s, i) => {
          s.setAttribute("offset", (i / Math.max(1, allStops.length - 1)).toString());
        });
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);

  const removeGradientStop = useCallback((gradientId: string, index: number) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const grad = doc.getElementById(gradientId);
      if (grad) {
        const stops = grad.querySelectorAll('stop');
        if (stops.length > 2 && stops[index]) {
          grad.removeChild(stops[index]);
          // Redistribute offsets
          const remainingStops = grad.querySelectorAll('stop');
          remainingStops.forEach((s, i) => {
            s.setAttribute("offset", (i / Math.max(1, remainingStops.length - 1)).toString());
          });
        }
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);

  const reorderGradientStop = useCallback((gradientId: string, index: number, direction: 'up' | 'down') => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const grad = doc.getElementById(gradientId);
      if (grad) {
        const stops = Array.from(grad.querySelectorAll('stop'));
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        if (targetIndex >= 0 && targetIndex < stops.length) {
          const stopA = stops[index];
          const stopB = stops[targetIndex];
          
          // Swap based on DOM structure
          if (direction === 'up') {
            grad.insertBefore(stopA, stopB);
          } else {
             // To move down, we insert B before A
             grad.insertBefore(stopB, stopA);
          }

          // Redistribute offsets to ensure linear progression
          const newStops = grad.querySelectorAll('stop');
          newStops.forEach((s, i) => {
            s.setAttribute("offset", (i / Math.max(1, newStops.length - 1)).toString());
          });
        }
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);


  // --- SVG Content ---

  const updateSvgPath = useCallback((id: string, pathData: string) => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const el = doc.getElementById(id);
      if (el) {
        el.setAttribute('d', pathData);
      }
      return { ...prev, svgContent: new XMLSerializer().serializeToString(doc) };
    });
  }, [pushToHistory, state]);

  const zoomToFit = useCallback(() => {
    const stageContainer = document.querySelector('main');
    if (!stageContainer) return;
    const { width: cW, height: cH } = stageContainer.getBoundingClientRect();
    const padding = 120;
    const zoomX = (cW - padding) / state.artboardWidth;
    const zoomY = (cH - padding) / state.artboardHeight;
    const newZoom = Math.max(0.1, Math.min(4, Math.min(zoomX, zoomY)));
    setState(prev => ({ ...prev, stageZoom: newZoom }));
  }, [state.artboardWidth, state.artboardHeight]);

  // --- Markers ---

  const handleAddMarker = useCallback(() => {
    const newMarker = {
      id: Math.random().toString(36).substr(2, 9),
      time: state.currentTime,
      label: 'Marker',
      color: '#F59E0B'
    };
    setState(prev => ({ ...prev, markers: [...prev.markers, newMarker] }));
  }, [state.currentTime]);

  const handleRemoveMarker = useCallback((id: string) => {
    setState(prev => ({ ...prev, markers: prev.markers.filter(m => m.id !== id) }));
  }, []);

  // --- Animation Loop ---

  const requestRef = useRef<number | undefined>(undefined);
  const yoyoDirection = useRef<number>(1);

  const animate = useCallback(() => {
    setState(prev => {
      if (!prev.isPlaying) return prev;
      let delta = TICK_INTERVAL * prev.playbackSpeed * yoyoDirection.current;
      let nextTime = prev.currentTime + delta;
      if (prev.isYoyo) {
        if (nextTime >= prev.duration) { nextTime = prev.duration; yoyoDirection.current = -1; }
        else if (nextTime <= 0) { nextTime = 0; yoyoDirection.current = 1; if (!prev.isLooping) return { ...prev, isPlaying: false, currentTime: 0 }; }
      } else {
        if (nextTime >= prev.duration) { if (prev.isLooping) nextTime = 0; else { nextTime = prev.duration; return { ...prev, isPlaying: false, currentTime: nextTime }; } }
        else if (nextTime < 0) nextTime = 0;
      }
      return { ...prev, currentTime: nextTime };
    });
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (state.isPlaying) requestRef.current = requestAnimationFrame(animate);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [state.isPlaying, animate]);

  // --- Shortcuts & Global Events ---
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmd = isMac ? e.metaKey : e.ctrlKey;

      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
      }
      
      if (cmd && e.code === 'KeyC') {
        copyKeyframes();
      }
      
      if (cmd && e.code === 'KeyV') {
        pasteKeyframes();
      }

      if (cmd && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [copyKeyframes, pasteKeyframes, undo, redo]);

  // --- SVG Parsing ---
  
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');
    if (svgElement) {
      const extractLayers = (element: Element): SVGLayer[] => {
        return Array.from(element.children)
          .filter(child => !['defs', 'style', 'title', 'desc'].includes(child.tagName.toLowerCase()))
          .map(child => {
            const id = child.getAttribute('id') || `layer-${Math.random().toString(36).substr(2, 9)}`;
            if (!child.getAttribute('id')) child.setAttribute('id', id);
            return { id, tagName: child.tagName, className: child.getAttribute('class') || '', children: extractLayers(child) };
          });
      };
      setState(prev => ({ ...prev, layers: extractLayers(svgElement) }));
    }
  }, [state.svgContent]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 select-none">
      <Header 
        onExport={() => setIsExportModalOpen(true)} 
        onUpload={(c) => { pushToHistory(state); setState(prev => ({ ...prev, svgContent: c, animations: [] })); }} 
        stageZoom={state.stageZoom} 
        onStageZoom={(z) => setState(prev => ({ ...prev, stageZoom: z }))} 
        onZoomToFit={zoomToFit}
        onUndo={undo} 
        onRedo={redo} 
        canUndo={history.length > 0} 
        canRedo={future.length > 0} 
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar 
          layers={state.layers} 
          selectedIds={state.selectedLayerIds} 
          hiddenIds={state.hiddenLayerIds} 
          onSelect={(id, multi) => setState(prev => ({ ...prev, selectedLayerIds: multi ? [...prev.selectedLayerIds, id] : [id] }))} 
          onGroup={handleGroupLayers} 
          onReorder={handleReorderLayers} 
          onDelete={(id) => handleDeleteLayer(id)}
          onDeleteSelected={() => deleteKeyframes(state.selectedKeyframes)} 
          onToggleVisibility={(id) => setState(prev => ({ ...prev, hiddenLayerIds: prev.hiddenLayerIds.includes(id) ? prev.hiddenLayerIds.filter(l => l !== id) : [...prev.hiddenLayerIds, id] }))} 
          onRename={handleRenameLayer} 
        />
        <main className="flex-1 flex flex-col min-w-0 bg-gray-100 relative">
          <Stage 
            state={state} 
            onSelectLayer={(id) => setState(prev => ({ ...prev, selectedLayerIds: id ? [id] : [] }))} 
            onUpdateTransform={(lid, prop, val) => addKeyframe(lid, prop, val, undefined, 'easeInOutQuad', true)} 
            onFinalizeTransform={() => pushToHistory(state)}
            onEnterPathEdit={(id) => setState(prev => ({ ...prev, editingPathId: id }))}
            onExitPathEdit={() => setState(prev => ({ ...prev, editingPathId: null }))}
            onUpdatePath={updateSvgPath}
          />
          <Timeline 
            state={state} 
            setCurrentTime={(t) => setState(prev => ({ ...prev, currentTime: t }))} 
            setPlaying={(p) => setState(prev => ({ ...prev, isPlaying: p }))} 
            onUpdateDuration={(d) => { pushToHistory(state); setState(prev => ({ ...prev, duration: d })); }} 
            onRemoveKeyframe={(lid, prop, kfId) => deleteKeyframes([{ layerId: lid, property: prop, kfId }])} 
            onDeleteSelectedKeyframes={() => deleteKeyframes(state.selectedKeyframes)}
            onUpdateKeyframeTime={updateKeyframeTime} 
            onFinalizeKeyframeDrag={() => pushToHistory(state)}
            setSelectedKeyframes={(kfs) => setState(prev => ({ ...prev, selectedKeyframes: kfs }))}
            onAddMarker={handleAddMarker} 
            onRemoveMarker={handleRemoveMarker} 
            setPlaybackOptions={(o) => setState(prev => ({ ...prev, ...o }))} 
          />
        </main>
        <div className="w-72 border-l bg-white flex flex-col shrink-0 overflow-hidden shadow-2xl">
          <PropertyInspector 
            state={state} 
            onAddKeyframe={addKeyframe} 
            onUpdateKeyframeEasing={(lid, prop, kfId, easing, bezier) => { pushToHistory(state); setState(prev => ({ ...prev, animations: prev.animations.map(a => a.layerId === lid ? { ...a, tracks: a.tracks.map(t => t.property === prop ? { ...t, keyframes: t.keyframes.map(kf => kf.id === kfId ? { ...kf, easing, bezierParams: bezier } : kf) } : t) } : a) })) }} 
            onUpdateTrigger={handleUpdateTrigger} 
            onToggleTransform={() => setState(prev => ({ ...prev, isTransformMode: !prev.isTransformMode }))} 
            onUpdateArtboard={(p) => { pushToHistory(state); setState(prev => ({ ...prev, ...p })); }} 
            onUpdateGradientColor={updateGradientColor}
            onAddGradientStop={addGradientStop}
            onRemoveGradientStop={removeGradientStop}
            onReorderGradientStop={reorderGradientStop}
          />
        </div>
      </div>
      {isExportModalOpen && <ExportModal state={state} onClose={() => setIsExportModalOpen(false)} />}
    </div>
  );
};

export default App;
