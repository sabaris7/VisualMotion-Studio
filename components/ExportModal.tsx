
import React, { useState, useRef } from 'react';
import { EditorState, EasingType } from '../types';
import { easings } from '../utils/easings';
import { interpolateColor } from '../utils/colors';

interface ExportModalProps {
  state: EditorState;
  onClose: () => void;
}

type ExportTab = 'mp4' | 'gif' | 'svg';

const ExportModal: React.FC<ExportModalProps> = ({ state, onClose }) => {
  const [tab, setTab] = useState<ExportTab>('mp4');
  const [copied, setCopied] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to get current value for interpolation
  const getInterpolatedValue = (track: any, time: number) => {
    const kfs = track.keyframes;
    if (kfs.length === 0) return 0; // Default fallback
    
    let prev = kfs[0];
    let next = kfs[kfs.length - 1];
    
    if (time <= prev.time) {
      next = prev;
    } else if (time >= next.time) {
      prev = next;
    } else {
      for (let i = 0; i < kfs.length - 1; i++) {
        if (time >= kfs[i].time && time <= kfs[i + 1].time) {
          prev = kfs[i];
          next = kfs[i + 1];
          break;
        }
      }
    }

    if (prev === next) return prev.value;

    const rawT = (time - prev.time) / (next.time - prev.time);
    const easeFn = prev.easing === 'custom' && prev.bezierParams 
      ? easings.custom(prev.bezierParams[0], prev.bezierParams[1], prev.bezierParams[2], prev.bezierParams[3])
      : (easings[next.easing as Exclude<EasingType, 'custom'>] || easings.linear);
    
    const t = easeFn(rawT);

    if (typeof prev.value === 'number' && typeof next.value === 'number') {
      return prev.value + (next.value - prev.value) * t;
    }
    
    if (typeof prev.value === 'string' && typeof next.value === 'string') {
      return interpolateColor(prev.value, next.value, t);
    }

    return next.value;
  };

  const applyStylesToClone = (cloneDoc: Document, time: number) => {
    state.animations.forEach(anim => {
      const el = cloneDoc.getElementById(anim.layerId);
      if (!el) return;

      // Resolve Gradient
      let gradientEl: Element | null = null;
      const fill = el.getAttribute('fill') || el.style.fill;
      if (fill && fill.indexOf('url(#') !== -1) {
         const match = fill.match(/url\(#([^)]+)\)/);
         if (match) {
            gradientEl = cloneDoc.getElementById(match[1]);
         }
      }

      let tx = 0, ty = 0, tz = 0, sc = 1, scX = 1, scY = 1, rx = 0, ry = 0, rz = 0;
      let anchorX = 0.5, anchorY = 0.5;
      let opacity = 1;
      let fillVal = null;
      let stroke = null;
      let strokeDash = null;
      let hasTransform = false;
      let offsetPath = '', offsetDistance = '', offsetRotate = '';

      anim.tracks.forEach(track => {
        const val = getInterpolatedValue(track, time);
        switch (track.property) {
          case 'x': tx = val as number; hasTransform = true; break;
          case 'y': ty = val as number; hasTransform = true; break;
          case 'z': tz = val as number; hasTransform = true; break;
          case 'scale': sc = val as number; hasTransform = true; break;
          case 'scaleX': scX = val as number; hasTransform = true; break;
          case 'scaleY': scY = val as number; hasTransform = true; break;
          case 'rotate': rz = val as number; hasTransform = true; break;
          case 'rotateX': rx = val as number; hasTransform = true; break;
          case 'rotateY': ry = val as number; hasTransform = true; break;
          case 'anchorX': anchorX = val as number; break;
          case 'anchorY': anchorY = val as number; break;
          case 'opacity': opacity = val as number; break;
          case 'fill': fillVal = val as string; break;
          case 'stroke': stroke = val as string; break;
          case 'strokeDashoffset': strokeDash = val as number; break;
          case 'offsetPath': offsetPath = `path('${val}')`; break;
          case 'offsetDistance': offsetDistance = `${val}%`; break;
          case 'offsetRotate': offsetRotate = String(val); break;
          
          case 'gradientX1': if(gradientEl) gradientEl.setAttribute('x1', String(val)); break;
          case 'gradientY1': if(gradientEl) gradientEl.setAttribute('y1', String(val)); break;
          case 'gradientX2': if(gradientEl) gradientEl.setAttribute('x2', String(val)); break;
          case 'gradientY2': if(gradientEl) gradientEl.setAttribute('y2', String(val)); break;
          case 'gradientCX': if(gradientEl) gradientEl.setAttribute('cx', String(val)); break;
          case 'gradientCY': if(gradientEl) gradientEl.setAttribute('cy', String(val)); break;
          case 'gradientR': if(gradientEl) gradientEl.setAttribute('r', String(val)); break;
          
          case 'stopOffset0': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[0]; if(s) s.setAttribute('offset', String(val)); } 
             break;
          case 'stopOffset1': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[1]; if(s) s.setAttribute('offset', String(val)); } 
             break;
          case 'stopOffset2': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[2]; if(s) s.setAttribute('offset', String(val)); } 
             break;
          case 'stopOffset3': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[3]; if(s) s.setAttribute('offset', String(val)); } 
             break;
          case 'stopOffset4': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[4]; if(s) s.setAttribute('offset', String(val)); } 
             break;
             
          case 'stopColor0': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[0]; if(s) { s.setAttribute('stop-color', String(val)); s.style.stopColor = String(val); } } 
             break;
          case 'stopColor1': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[1]; if(s) { s.setAttribute('stop-color', String(val)); s.style.stopColor = String(val); } } 
             break;
          case 'stopColor2': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[2]; if(s) { s.setAttribute('stop-color', String(val)); s.style.stopColor = String(val); } } 
             break;
          case 'stopColor3': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[3]; if(s) { s.setAttribute('stop-color', String(val)); s.style.stopColor = String(val); } } 
             break;
          case 'stopColor4': 
             if(gradientEl) { const s = gradientEl.querySelectorAll('stop')[4]; if(s) { s.setAttribute('stop-color', String(val)); s.style.stopColor = String(val); } } 
             break;
        }
      });

      if (hasTransform) {
        const finalScaleX = sc * scX;
        const finalScaleY = sc * scY;
        const translate = Math.abs(tz) < 0.001 ? `translate(${tx}px, ${ty}px)` : `translate3d(${tx}px, ${ty}px, ${tz}px)`;
        const rotate = (Math.abs(rx) < 0.001 && Math.abs(ry) < 0.001) ? `rotate(${rz}deg)` : `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
        el.style.transform = `${translate} scale(${finalScaleX}, ${finalScaleY}) ${rotate}`;
        el.style.transformBox = 'fill-box';
      }
      
      el.style.transformOrigin = `${anchorX * 100}% ${anchorY * 100}%`;
      el.style.opacity = opacity.toString();
      if (fillVal) el.style.fill = fillVal;
      if (stroke) el.style.stroke = stroke;
      if (strokeDash !== null) el.style.strokeDashoffset = strokeDash.toString();
      if (offsetPath) el.style.offsetPath = offsetPath;
      if (offsetDistance) el.style.offsetDistance = offsetDistance;
      if (offsetRotate) el.style.offsetRotate = offsetRotate;
    });
  };

  const renderFrame = async (time: number, width: number, height: number): Promise<HTMLImageElement> => {
    const parser = new DOMParser();
    // Wrap content in a full SVG to ensure correct viewBox and namespace
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: ${state.artboardBackground}; overflow: ${state.isClipContent ? 'hidden' : 'visible'}">
        ${state.svgContent}
      </svg>
    `;
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    
    // Fix IDs to prevent conflicts if we were to mount it, though here we serialize immediately
    // Applying styles
    applyStylesToClone(doc, time);

    const serializer = new XMLSerializer();
    const svgBlob = new Blob([serializer.serializeToString(doc.documentElement)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const handleRender = async () => {
    if (!canvasRef.current) return;
    setRendering(true);
    setProgress(0);

    const fps = 30; // Standard for export
    const totalFrames = Math.ceil(state.duration * fps);
    const width = state.artboardWidth;
    const height = state.artboardHeight;
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      setRendering(false);
      alert("Could not get canvas context");
      return;
    }

    try {
      if (tab === 'gif') {
        const gifencModule = await import('gifenc');
        // Handle potential default export wrapping from esm.sh
        const GIFEncoder = gifencModule.GIFEncoder || (gifencModule as any).default?.GIFEncoder || (gifencModule as any).default;
        const quantize = gifencModule.quantize || (gifencModule as any).default?.quantize;
        const applyPalette = gifencModule.applyPalette || (gifencModule as any).default?.applyPalette;

        if (!GIFEncoder) throw new Error("Failed to load GIFEncoder");

        const gif = GIFEncoder(); // Factory function
        
        for (let i = 0; i <= totalFrames; i++) {
          const time = (i / totalFrames) * state.duration;
          const img = await renderFrame(time, width, height);
          
          ctx.fillStyle = state.artboardBackground;
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);
          
          const data = ctx.getImageData(0, 0, width, height).data;
          const palette = quantize(data, 256);
          const index = applyPalette(data, palette);
          
          gif.writeFrame(index, width, height, {
            palette,
            delay: (1000 / fps), // delay in ms
          });

          setProgress(Math.round((i / totalFrames) * 100));
        }

        gif.finish();
        const blob = new Blob([gif.bytes()], { type: 'image/gif' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animation-${Date.now()}.gif`;
        a.click();
        URL.revokeObjectURL(url);

      } else if (tab === 'mp4') {
        if (typeof window.VideoEncoder === 'undefined') {
          throw new Error("Your browser does not support VideoEncoder (WebCodecs). Please use Chrome, Edge, or a recent version of Safari.");
        }

        const Mp4MuxerModule = await import('mp4-muxer');
        const Muxer = Mp4MuxerModule.Muxer || (Mp4MuxerModule as any).default?.Muxer;

        if (!Muxer) throw new Error("Failed to load Mp4Muxer");

        const muxer = new Muxer({
          target: new Mp4MuxerModule.ArrayBufferTarget(),
          video: {
            codec: 'avc', // h264
            width,
            height
          },
          fastStart: 'in-memory',
        });

        const videoEncoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error(e)
        });

        videoEncoder.configure({
          codec: 'avc1.42001f',
          width,
          height,
          bitrate: 2_000_000,
          framerate: fps
        });

        for (let i = 0; i <= totalFrames; i++) {
          const time = (i / totalFrames) * state.duration;
          const img = await renderFrame(time, width, height);
          
          ctx.fillStyle = state.artboardBackground;
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0);

          const frame = new VideoFrame(canvas, { timestamp: i * (1000000 / fps) }); // microseconds
          videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
          frame.close();

          setProgress(Math.round((i / totalFrames) * 100));
        }

        await videoEncoder.flush();
        muxer.finalize();

        const { buffer } = muxer.target;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `animation-${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      alert("Export failed: " + err.message);
    } finally {
      setRendering(false);
    }
  };

  const getCommonRuntime = () => {
    return `
  const animations = ${JSON.stringify(state.animations, null, 2)};
  const config = {
    duration: ${state.duration},
    isLooping: ${state.isLooping},
    isYoyo: ${state.isYoyo},
    speed: ${state.playbackSpeed},
    artboard: {
      width: ${state.artboardWidth},
      height: ${state.artboardHeight},
      background: "${state.artboardBackground}"
    }
  };

  const easings = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 * t - 2 * t * t),
    easeInCubic: t => t * t * t,
    easeOutCubic: t => 1 + --t * t * t,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 + --t * (2 * t - 2) * (2 * t - 2),
    bounce: t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      else return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };

  function hexToRgb(hex) {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
  }

  function interpolate(prev, next, t) {
    if (typeof prev === 'number' && typeof next === 'number') {
      return prev + (next - prev) * t;
    }
    if (typeof prev === 'string' && typeof next === 'string' && prev.startsWith('#') && next.startsWith('#')) {
      const c1 = hexToRgb(prev), c2 = hexToRgb(next);
      const r = Math.round(c1.r + (c2.r - c1.r) * t);
      const g = Math.round(c1.g + (c2.g - c1.g) * t);
      const b = Math.round(c1.b + (c2.b - c1.b) * t);
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    return t > 0.5 ? next : prev;
  }

  function runAnimation(anim, element) {
    let startTime = performance.now();
    function frame(now) {
      let elapsed = ((now - startTime) / 1000) * config.speed;
      let time = elapsed % config.duration;
      
      if (config.isYoyo) {
        let cycle = Math.floor(elapsed / config.duration);
        if (cycle % 2 === 1) time = config.duration - time;
      } else if (!config.isLooping && elapsed >= config.duration) {
        time = config.duration;
      }
      
      let transformParts = { x: 0, y: 0, z: 0, scale: 1, scaleX: 1, scaleY: 1, rotate: 0, rotateX: 0, rotateY: 0, anchorX: 0.5, anchorY: 0.5 };
      let hasTransform = false;
      let opacity = 1;
      let offsetPath = '', offsetDistance = '', offsetRotate = '';

      // Helper to find gradient element if needed
      let gradientEl = null;
      if(element) {
        const fill = element.getAttribute('fill') || element.style.fill;
        if(fill && fill.indexOf('url(#') !== -1) {
            const match = fill.match(/url\\(#([^)]+)\\)/);
            if (match) gradientEl = document.getElementById(match[1]);
        }
      }
      
      anim.tracks.forEach(track => {
        const kfs = track.keyframes;
        if (kfs.length === 0) return;
        let p = kfs[0], n = kfs[kfs.length - 1];
        if (time <= p.time) { n = p; }
        else if (time >= n.time) { p = n; }
        else {
          for (let i = 0; i < kfs.length - 1; i++) {
            if (time >= kfs[i].time && time <= kfs[i+1].time) {
              p = kfs[i]; n = kfs[i+1]; break;
            }
          }
        }
        const rawT = p === n ? 0 : (time - p.time) / (n.time - p.time);
        const t = (easings[n.easing] || easings.linear)(rawT);
        const val = interpolate(p.value, n.value, t);
        
        if (track.property === 'x') { transformParts.x = val; hasTransform = true; }
        else if (track.property === 'y') { transformParts.y = val; hasTransform = true; }
        else if (track.property === 'z') { transformParts.z = val; hasTransform = true; }
        else if (track.property === 'scale') { transformParts.scale = val; hasTransform = true; }
        else if (track.property === 'scaleX') { transformParts.scaleX = val; hasTransform = true; }
        else if (track.property === 'scaleY') { transformParts.scaleY = val; hasTransform = true; }
        else if (track.property === 'rotate') { transformParts.rotate = val; hasTransform = true; }
        else if (track.property === 'rotateX') { transformParts.rotateX = val; hasTransform = true; }
        else if (track.property === 'rotateY') { transformParts.rotateY = val; hasTransform = true; }
        else if (track.property === 'anchorX') { transformParts.anchorX = val; }
        else if (track.property === 'anchorY') { transformParts.anchorY = val; }
        else if (track.property === 'opacity') opacity = val;
        else if (track.property === 'fill') element.style.fill = val;
        else if (track.property === 'stroke') element.style.stroke = val;
        else if (track.property === 'strokeDashoffset') element.style.strokeDashoffset = val;
        else if (track.property === 'offsetPath') offsetPath = "path('" + val + "')";
        else if (track.property === 'offsetDistance') offsetDistance = val + "%";
        else if (track.property === 'offsetRotate') offsetRotate = val;
        
        // Gradient Colors
        else if (track.property.startsWith('stopColor') && gradientEl) {
             const idx = parseInt(track.property.replace('stopColor', ''));
             const stops = gradientEl.querySelectorAll('stop');
             if(stops[idx]) stops[idx].setAttribute('stop-color', val);
        }
      });
      
      if (hasTransform) {
        const translate = Math.abs(transformParts.z) < 0.001 ? \`translate(\${transformParts.x}px, \${transformParts.y}px)\` : \`translate3d(\${transformParts.x}px, \${transformParts.y}px, \${transformParts.z}px)\`;
        const rotate = (Math.abs(transformParts.rotateX) < 0.001 && Math.abs(transformParts.rotateY) < 0.001) ? \`rotate(\${transformParts.rotate}deg)\` : \`rotateX(\${transformParts.rotateX}deg) rotateY(\${transformParts.rotateY}deg) rotateZ(\${transformParts.rotate}deg)\`;
        element.style.transform = \`\${translate} scale(\${transformParts.scale * transformParts.scaleX}, \${transformParts.scale * transformParts.scaleY}) \${rotate}\`;
        element.style.transformBox = 'fill-box';
      }
      
      element.style.opacity = opacity;
      element.style.transformOrigin = \`\${transformParts.anchorX * 100}% \${transformParts.anchorY * 100}%\`;
      if (offsetPath) element.style.offsetPath = offsetPath;
      if (offsetDistance) element.style.offsetDistance = offsetDistance;
      if (offsetRotate) element.style.offsetRotate = offsetRotate;
      
      if (config.isLooping || elapsed < config.duration || (config.isYoyo && (elapsed < config.duration * 2 || config.isLooping))) {
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  }

  function init(container) {
    animations.forEach(anim => {
      const el = container.querySelector('#' + anim.layerId);
      if (!el) return;
      if (anim.trigger === 'on_load') runAnimation(anim, el);
      else if (anim.trigger === 'on_click') el.addEventListener('click', () => runAnimation(anim, el));
      else if (anim.trigger === 'on_hover') el.addEventListener('mouseenter', () => runAnimation(anim, el));
      else if (anim.trigger === 'on_viewport') {
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) { runAnimation(anim, el); observer.disconnect(); }
        });
        observer.observe(el);
      }
    });
  }`;
  };

  const generateAnimatedSVGCode = () => {
    const svg = state.svgContent.trim();
    const runtime = `
  <script type="text/javascript">
    <![CDATA[
    (function() {
      ${getCommonRuntime()}
      const svg = document.querySelector('svg');
      svg.style.backgroundColor = config.artboard.background;
      if (${state.isClipContent}) svg.style.overflow = 'hidden';
      else svg.style.overflow = 'visible';
      init(document);
    })();
    ]]>
  </script>
</svg>`;
    return svg.replace(/<\/svg>$/, runtime);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateAnimatedSVGCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    const blob = new Blob([generateAnimatedSVGCode()], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animation-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col border border-white/20">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/></svg>
             </div>
             <div>
               <h2 className="text-lg font-bold text-gray-900 leading-tight">Export Assets</h2>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em]">Mirroring Artboard & Animation Presets</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 shrink-0">
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200/50">
              <button onClick={() => setTab('mp4')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${tab === 'mp4' ? 'bg-white shadow-md text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>Video MP4</button>
              <button onClick={() => setTab('gif')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${tab === 'gif' ? 'bg-white shadow-md text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>GIF</button>
              <button onClick={() => setTab('svg')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${tab === 'svg' ? 'bg-white shadow-md text-orange-600' : 'text-gray-500 hover:text-gray-900'}`}>Animated SVG</button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 flex flex-col min-h-[300px] overflow-hidden">
            {tab === 'svg' ? (
              <div className="flex-1 bg-gray-900 rounded-2xl relative overflow-hidden group border border-gray-800 shadow-inner">
                <button onClick={handleCopy} className={`absolute top-4 right-4 z-20 px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2 backdrop-blur-md border ${copied ? 'bg-green-500/90 text-white border-green-400' : 'bg-white/10 hover:bg-orange-500 text-white border-white/10 opacity-0 group-hover:opacity-100'}`}>
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
                <div className="absolute inset-0 overflow-auto p-6 bg-[#0B0E14] scrollbar-thin scrollbar-thumb-gray-800 text-orange-400/90">
                  <pre className="font-mono text-[11px] leading-relaxed whitespace-pre break-words sm:break-normal">
                    {generateAnimatedSVGCode()}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                {rendering ? (
                   <div className="space-y-6 w-full max-w-xs animate-in fade-in zoom-in duration-300">
                      <div className="relative h-2 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                         <div className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">Rendering {tab.toUpperCase()}...</p>
                        <p className="text-xs text-gray-400 font-medium">Processing {Math.ceil(state.duration * 30)} frames</p>
                      </div>
                   </div>
                ) : (
                  <div className="space-y-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 mx-auto">
                       {tab === 'mp4' ? (
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                       ) : (
                         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                       )}
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-base font-bold text-gray-900">High-Resolution Export</h3>
                       <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">Exporting your animation as a high-quality {tab.toUpperCase()} file. Perfect for social media or presentation decks.</p>
                    </div>
                    <div className="flex gap-4 justify-center">
                       <div className="bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center min-w-[80px]">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">FPS</span>
                          <span className="text-xs font-bold text-gray-700">30</span>
                       </div>
                       <div className="bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center min-w-[80px]">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Res</span>
                          <span className="text-xs font-bold text-gray-700">{state.artboardWidth}p</span>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-500/10 rounded-full flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">Ready to ship</span>
               <span className="text-[10px] text-gray-400 font-medium">Fidelity {state.artboardWidth}x{state.artboardHeight}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
             <button 
              onClick={tab === 'svg' ? handleDownloadSVG : handleRender}
              disabled={rendering}
              className="px-8 py-3 bg-gray-900 text-white text-xs font-bold rounded-l-xl hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-gray-200 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {rendering ? 'Rendering...' : `Download ${tab.toUpperCase()}`}
            </button>
            <div className="relative">
               <button className="h-[40px] px-2 bg-gray-800 text-white rounded-r-xl border-l border-white/10 hover:bg-black transition-all">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
