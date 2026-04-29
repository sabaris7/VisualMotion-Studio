
import React, { useRef, useEffect } from 'react';

interface BezierEditorProps {
  params: [number, number, number, number];
  onChange: (params: [number, number, number, number]) => void;
}

const BezierEditor: React.FC<BezierEditorProps> = ({ params, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 100;
  const padding = 20;
  const totalSize = size + padding * 2;

  const toCanvas = (x: number, y: number) => ({
    x: x * size + padding,
    y: (1 - y) * size + padding
  });

  const fromCanvas = (x: number, y: number) => ({
    x: Math.max(0, Math.min(1, (x - padding) / size)),
    y: Math.max(-0.5, Math.min(1.5, 1 - (y - padding) / size))
  });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, totalSize, totalSize);
    
    // Grid
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const p = i * 0.25;
      const { x: x1, y: y1 } = toCanvas(p, 0);
      const { x: x2, y: y2 } = toCanvas(p, 1);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      const { x: x3, y: y3 } = toCanvas(0, p);
      const { x: x4, y: y4 } = toCanvas(1, p);
      ctx.moveTo(x3, y3); ctx.lineTo(x4, y4);
    }
    ctx.stroke();

    const p0 = toCanvas(0, 0);
    const p1 = toCanvas(params[0], params[1]);
    const p2 = toCanvas(params[2], params[3]);
    const p3 = toCanvas(1, 1);

    // Handles
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.stroke();

    // Control Points
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    [p1, p2].forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, [params, totalSize]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    const p1 = toCanvas(params[0], params[1]);
    const p2 = toCanvas(params[2], params[3]);
    
    const d1 = Math.hypot(startX - p1.x, startY - p1.y);
    const d2 = Math.hypot(startX - p2.x, startY - p2.y);
    
    const handleIndex = d1 < 15 ? 0 : d2 < 15 ? 1 : -1;
    if (handleIndex === -1) return;

    let rAF: number | null = null;
    const onMouseMove = (me: MouseEvent) => {
      if (rAF) return;
      rAF = requestAnimationFrame(() => {
        const mx = me.clientX - rect.left;
        const my = me.clientY - rect.top;
        const { x, y } = fromCanvas(mx, my);
        const newParams = [...params] as [number, number, number, number];
        if (handleIndex === 0) { newParams[0] = x; newParams[1] = y; }
        else { newParams[2] = x; newParams[3] = y; }
        onChange(newParams);
        rAF = null;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-2 mt-2 flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        width={totalSize} 
        height={totalSize} 
        className="cursor-crosshair bg-white rounded border border-gray-100"
        onMouseDown={handleMouseDown}
      />
      <span className="text-[8px] font-mono mt-1 text-gray-400">
        cubic-bezier({params.map(p => p.toFixed(2)).join(', ')})
      </span>
    </div>
  );
};

export default BezierEditor;
