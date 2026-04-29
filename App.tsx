
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PropertyInspector from './components/PropertyInspector';
import Timeline from './components/Timeline';
import Stage from './components/Stage';
import ExportModal from './components/ExportModal';
import { EditorState, SVGLayer, AnimatableProperty, EasingType, TriggerType, Keyframe, SelectedKeyframe } from './types';
import { INITIAL_SVG, DEFAULT_DURATION, TICK_INTERVAL } from './constants';
import { easings } from './utils/easings';

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
    viewX: 0,
    viewY: 0,
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
  
  // Refs for managing Spacebar interaction (Tap vs Hold)
  const spaceDownRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);

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
      const targetTime = time !== undefined ? time : prev.currentTime;
      
      // Find if this property already has an animation track
      const existingAnim = prev.animations.find(a => a.layerId === layerId);
      const existingTrack = existingAnim?.tracks.find(t => t.property === property);
      const hasKeyframes = existingTrack && existingTrack.keyframes.length > 0;

      const newKeyframesToAdd: Keyframe[] = [];

      // If this is the first keyframe and it's not at t=0, 
      // we should insert a default keyframe at t=0 to prevent retroactive jumps
      if (!hasKeyframes && targetTime > 0.001) {
        // Determine default value
        let defaultValue: number | string = 0;
        if (['scale', 'scaleX', 'scaleY', 'opacity'].includes(property)) defaultValue = 1;
        if (['anchorX', 'anchorY'].includes(property)) defaultValue = 0.5;
        if (property === 'fill' || property === 'stroke') {
           // Try to get from SVG
           const parser = new DOMParser();
           const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
           const el = doc.getElementById(layerId);
           if (el) {
             defaultValue = el.getAttribute(property) || (el.style as any)[property] || (property === 'fill' ? '#000000' : 'none');
           }
        }

        newKeyframesToAdd.push({
          id: Math.random().toString(36).substr(2, 9),
          time: 0,
          value: defaultValue,
          easing: 'linear'
        });
      }

      const mainKeyframe: Keyframe = { 
        id: Math.random().toString(36).substr(2, 9), 
        time: targetTime, 
        value, 
        easing, 
        bezierParams: bezier 
      };
      newKeyframesToAdd.push(mainKeyframe);

      // Immutably update animations
      const existingAnimIndex = prev.animations.findIndex(a => a.layerId === layerId);
      let newAnimations;

      if (existingAnimIndex === -1) {
        // Create new animation record
        newAnimations = [
          ...prev.animations,
          {
            layerId,
            trigger: 'on_load' as TriggerType,
            tracks: [{ property, keyframes: newKeyframesToAdd.sort((a, b) => a.time - b.time) }]
          }
        ];
      } else {
        // Update existing animation record
        newAnimations = prev.animations.map((anim, i) => {
          if (i !== existingAnimIndex) return anim;

          const existingTrackIndex = anim.tracks.findIndex(t => t.property === property);
          let newTracks;

          if (existingTrackIndex === -1) {
            // Create new track
            newTracks = [...anim.tracks, { property, keyframes: newKeyframesToAdd.sort((a, b) => a.time - b.time) }];
          } else {
            // Update existing track
            newTracks = anim.tracks.map((track, j) => {
              if (j !== existingTrackIndex) return track;
              
              let updatedKeyframes = [...track.keyframes];
              
              newKeyframesToAdd.forEach(newKf => {
                const existingKfIndex = updatedKeyframes.findIndex(kf => Math.abs(kf.time - newKf.time) < 0.01);
                if (existingKfIndex > -1) {
                   updatedKeyframes[existingKfIndex] = { ...newKf, id: updatedKeyframes[existingKfIndex].id };
                } else {
                   updatedKeyframes.push(newKf);
                }
              });

              return { ...track, keyframes: updatedKeyframes.sort((a, b) => a.time - b.time) };
            });
          }

          return { ...anim, tracks: newTracks };
        });
      }

      return { ...prev, animations: newAnimations };
    });
  }, [pushToHistory, state]);

  // Helper to get current value
  const getCurrentValue = useCallback((layerId: string, property: AnimatableProperty, time: number) => {
    const anim = state.animations.find(a => a.layerId === layerId);
    if (!anim) return 0;
    const track = anim.tracks.find(t => t.property === property);
    if (!track || track.keyframes.length === 0) return 0;

    let value = track.keyframes[0].value;
    const kfs = track.keyframes;

    if (time <= kfs[0].time) {
      value = kfs[0].value;
    } else if (time >= kfs[kfs.length - 1].time) {
      value = kfs[kfs.length - 1].value;
    } else {
      for (let i = 0; i < kfs.length - 1; i++) {
        if (time <= kfs[i + 1].time) {
          const prev = kfs[i];
          const next = kfs[i + 1];
          const dt = next.time - prev.time;
          if (dt > 0.000001) {
            const rawT = (time - prev.time) / dt;
            const ease = next.easing === 'custom' && next.bezierParams 
                  ? easings.custom(next.bezierParams[0], next.bezierParams[1], next.bezierParams[2], next.bezierParams[3])
                  : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
            const t = ease(rawT);
            if (typeof prev.value === 'number' && typeof next.value === 'number') {
              value = prev.value + (next.value - prev.value) * t;
            } else {
              value = prev.value;
            }
          }
          break;
        }
      }
    }
    return typeof value === 'number' ? value : 0;
  }, [state.animations]);

  const handleAlign = useCallback((type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distribute-h' | 'distribute-v') => {
    if (state.selectedLayerIds.length < 2) return;
    pushToHistory(state);

    const positions = state.selectedLayerIds.map(id => ({
      id,
      x: getCurrentValue(id, 'x', state.currentTime),
      y: getCurrentValue(id, 'y', state.currentTime)
    }));

    if (type === 'distribute-h') {
        positions.sort((a, b) => a.x - b.x);
        const min = positions[0].x;
        const max = positions[positions.length - 1].x;
        const gap = (max - min) / (positions.length - 1);
        positions.forEach((p, i) => {
            if (i > 0 && i < positions.length - 1) {
                addKeyframe(p.id, 'x', min + gap * i, state.currentTime, 'easeInOutQuad', true);
            }
        });
    } else if (type === 'distribute-v') {
        positions.sort((a, b) => a.y - b.y);
        const min = positions[0].y;
        const max = positions[positions.length - 1].y;
        const gap = (max - min) / (positions.length - 1);
        positions.forEach((p, i) => {
            if (i > 0 && i < positions.length - 1) {
                addKeyframe(p.id, 'y', min + gap * i, state.currentTime, 'easeInOutQuad', true);
            }
        });
    } else {
        const xs = positions.map(p => p.x);
        const ys = positions.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const avgX = (minX + maxX) / 2;
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const avgY = (minY + maxY) / 2;

        state.selectedLayerIds.forEach(id => {
            switch(type) {
                case 'left': addKeyframe(id, 'x', minX, state.currentTime, 'easeInOutQuad', true); break;
                case 'center': addKeyframe(id, 'x', avgX, state.currentTime, 'easeInOutQuad', true); break;
                case 'right': addKeyframe(id, 'x', maxX, state.currentTime, 'easeInOutQuad', true); break;
                case 'top': addKeyframe(id, 'y', minY, state.currentTime, 'easeInOutQuad', true); break;
                case 'middle': addKeyframe(id, 'y', avgY, state.currentTime, 'easeInOutQuad', true); break;
                case 'bottom': addKeyframe(id, 'y', maxY, state.currentTime, 'easeInOutQuad', true); break;
            }
        });
    }
  }, [state.selectedLayerIds, state.currentTime, getCurrentValue, addKeyframe, pushToHistory, state]);

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

  const handleReorderLayers = useCallback((sourceId: string, targetId: string, position: 'before' | 'after' = 'before') => {
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      const sourceEl = doc.getElementById(sourceId);
      const targetEl = doc.getElementById(targetId);

      if (sourceEl && targetEl && sourceEl.parentNode === targetEl.parentNode) {
        if (position === 'before') {
            targetEl.parentNode.insertBefore(sourceEl, targetEl);
        } else {
            // Insert after: insert before target's next sibling
            targetEl.parentNode.insertBefore(sourceEl, targetEl.nextSibling);
        }
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

      // Update selected keyframes references
      const newSelectedKeyframes = prev.selectedKeyframes.map(sk => 
        sk.layerId === id ? { ...sk, layerId: newName } : sk
      );

      return { 
        ...prev, 
        svgContent: new XMLSerializer().serializeToString(doc),
        animations: newAnimations,
        selectedLayerIds: prev.selectedLayerIds.map(sid => sid === id ? newName : sid),
        selectedKeyframes: newSelectedKeyframes
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
        animations: prev.animations.filter(a => a.layerId !== id),
        selectedKeyframes: prev.selectedKeyframes.filter(sk => sk.layerId !== id)
      };
    });
  }, [pushToHistory, state]);

  const handleDeleteLayers = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    pushToHistory(state);
    setState(prev => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(prev.svgContent, 'image/svg+xml');
      ids.forEach(id => {
        const el = doc.getElementById(id);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      return {
        ...prev,
        svgContent: new XMLSerializer().serializeToString(doc),
        selectedLayerIds: prev.selectedLayerIds.filter(sid => !ids.includes(sid)),
        animations: prev.animations.filter(a => !ids.includes(a.layerId)),
        selectedKeyframes: prev.selectedKeyframes.filter(sk => !ids.includes(sk.layerId))
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
    setState(prev => ({ ...prev, stageZoom: newZoom, viewX: 0, viewY: 0 }));
  }, [state.artboardWidth, state.artboardHeight]);

  const handleUpload = useCallback((content: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    
    if (svg) {
      // Parse dimensions
      let width = 400;
      let height = 400;
      const wAttr = svg.getAttribute('width');
      const hAttr = svg.getAttribute('height');
      const vbAttr = svg.getAttribute('viewBox');

      if (wAttr && hAttr && !wAttr.includes('%') && !hAttr.includes('%')) {
        width = parseFloat(wAttr) || 400;
        height = parseFloat(hAttr) || 400;
      } else if (vbAttr) {
        const parts = vbAttr.split(/[\s,]+/).filter(Boolean).map(parseFloat);
        if (parts.length === 4) {
          width = parts[2];
          height = parts[3];
        }
      }

      // Ensure IDs on all elements
      let idCounter = 0;
      const ensureIds = (el: Element) => {
        if (!el.getAttribute('id')) {
          el.setAttribute('id', `layer-${Date.now()}-${idCounter++}`);
        }
        Array.from(el.children).forEach(child => {
          if (!['defs', 'style', 'title', 'desc', 'metadata'].includes(child.tagName.toLowerCase())) {
             ensureIds(child);
          }
        });
      };
      ensureIds(svg);
      
      const serializer = new XMLSerializer();
      const processedContent = serializer.serializeToString(doc);

      pushToHistory(state);
      setState(prev => ({ 
        ...prev, 
        svgContent: processedContent, 
        artboardWidth: width,
        artboardHeight: height,
        animations: [],
        layers: [], // Will be repopulated by useEffect
        selectedLayerIds: [],
        viewX: 0,
        viewY: 0
      }));
    }
  }, [pushToHistory, state]);

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

      if (e.code === 'Space' && e.target === document.body && !e.repeat) {
        e.preventDefault();
        spaceDownRef.current = Date.now();
        // Stage handles cursor via key state, we manage logic here
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Prevent backspace from navigating back if not in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        
        if (state.selectedKeyframes.length > 0) {
          deleteKeyframes(state.selectedKeyframes);
        } else if (state.selectedLayerIds.length > 0) {
          handleDeleteLayers(state.selectedLayerIds);
        }
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        if (spaceDownRef.current) {
           const duration = Date.now() - spaceDownRef.current;
           // If brief press and didn't pan, toggle play
           if (duration < 200 && !isPanningRef.current) {
              setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
           }
        }
        spaceDownRef.current = null;
        isPanningRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [copyKeyframes, pasteKeyframes, undo, redo, deleteKeyframes, handleDeleteLayers, state.selectedKeyframes, state.selectedLayerIds]);

  // --- SVG Parsing & ID Sync ---
  
  useEffect(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(state.svgContent, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');
    if (svgElement) {
      let modified = false;
      let idCounter = 0;

      const extractLayers = (element: Element): SVGLayer[] => {
        return Array.from(element.children)
          .filter(child => !['defs', 'style', 'title', 'desc', 'metadata'].includes(child.tagName.toLowerCase()))
          .map(child => {
            let id = child.getAttribute('id');
            if (!id) {
              id = `layer-${Date.now()}-${idCounter++}`;
              child.setAttribute('id', id);
              modified = true;
            }
            return { 
              id, 
              tagName: child.tagName, 
              className: child.getAttribute('class') || '', 
              children: extractLayers(child) 
            };
          });
      };

      const newLayers = extractLayers(svgElement);
      
      if (modified) {
        const newSvgContent = new XMLSerializer().serializeToString(doc);
        setState(prev => ({ ...prev, layers: newLayers, svgContent: newSvgContent }));
      } else {
        setState(prev => ({ ...prev, layers: newLayers }));
      }
    }
  }, [state.svgContent]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 select-none">
      <Header 
        onExport={() => setIsExportModalOpen(true)} 
        onUpload={handleUpload} 
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
          onSelect={(id, multi) => setState(prev => ({ ...prev, selectedLayerIds: multi ? [...prev.selectedLayerIds, id] : [id], selectedKeyframes: [] }))} 
          onGroup={handleGroupLayers} 
          onReorder={handleReorderLayers} 
          onDelete={(id) => handleDeleteLayer(id)}
          onDeleteSelected={() => handleDeleteLayers(state.selectedLayerIds)} 
          onToggleVisibility={(id) => setState(prev => ({ ...prev, hiddenLayerIds: prev.hiddenLayerIds.includes(id) ? prev.hiddenLayerIds.filter(l => l !== id) : [...prev.hiddenLayerIds, id] }))} 
          onRename={handleRenameLayer} 
        />
        <main className="flex-1 flex flex-col min-w-0 bg-gray-100 relative">
          <Stage 
            state={state} 
            onSelectLayer={(id) => setState(prev => ({ ...prev, selectedLayerIds: id ? [id] : [], selectedKeyframes: [] }))} 
            onUpdateTransform={(lid, prop, val) => addKeyframe(lid, prop, val, undefined, 'easeInOutQuad', true)} 
            onFinalizeTransform={() => pushToHistory(state)}
            onEnterPathEdit={(id) => setState(prev => ({ ...prev, editingPathId: id }))}
            onExitPathEdit={() => setState(prev => ({ ...prev, editingPathId: null }))}
            onUpdatePath={updateSvgPath}
            onPanStart={() => { isPanningRef.current = true; }}
            onUpdateView={(vx, vy) => setState(prev => ({ ...prev, viewX: vx, viewY: vy }))}
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
            onAlign={handleAlign}
          />
        </div>
      </div>
      {isExportModalOpen && <ExportModal state={state} onClose={() => setIsExportModalOpen(false)} />}
    </div>
  );
};

export default App;
