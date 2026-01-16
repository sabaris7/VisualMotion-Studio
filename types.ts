
export type AnimatableProperty = 'x' | 'y' | 'z' | 'scale' | 'scaleX' | 'scaleY' | 'rotate' | 'rotateX' | 'rotateY' | 'opacity' | 'strokeDashoffset' | 'fill' | 'stroke';

export type EasingType = 'linear' | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'bounce' | 'custom';

export type TriggerType = 'on_load' | 'on_hover' | 'on_click' | 'on_viewport';

export interface Keyframe {
  id: string;
  time: number; // in seconds
  value: number | string;
  easing: EasingType;
  bezierParams?: [number, number, number, number];
}

export interface PropertyTrack {
  property: AnimatableProperty;
  keyframes: Keyframe[];
}

export interface LayerAnimation {
  layerId: string;
  tracks: PropertyTrack[];
  trigger: TriggerType;
}

export interface SVGLayer {
  id: string;
  tagName: string;
  className: string;
  children?: SVGLayer[];
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface SelectedKeyframe {
  layerId: string;
  property: AnimatableProperty;
  kfId: string;
}

export interface EditorState {
  svgContent: string;
  layers: SVGLayer[];
  selectedLayerIds: string[];
  hiddenLayerIds: string[];
  selectedKeyframes: SelectedKeyframe[];
  animations: LayerAnimation[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  isYoyo: boolean;
  playbackSpeed: number;
  timelineZoom: number;
  stageZoom: number;
  markers: TimelineMarker[];
  isTransformMode: boolean;
  artboardWidth: number;
  artboardHeight: number;
  artboardBackground: string;
  isClipContent: boolean;
  editingPathId: string | null;
}
