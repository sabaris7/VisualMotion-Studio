
import React from 'react';

interface HeaderProps {
  onExport: () => void;
  onUpload: (content: string) => void;
  stageZoom: number;
  onStageZoom: (zoom: number) => void;
  onZoomToFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const Header: React.FC<HeaderProps> = ({ 
  onExport, 
  onUpload, 
  stageZoom, 
  onStageZoom,
  onZoomToFit,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text.includes('<svg')) {
          onUpload(text);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-gray-900 leading-none">VisualMotion <span className="text-orange-500">Studio</span></h1>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">V1.0.4 BETA</p>
          </div>
        </div>

        <div className="h-6 w-px bg-gray-100"></div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={onUndo} 
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-lg transition-all ${canUndo ? 'text-gray-600 hover:bg-gray-100 hover:text-orange-500' : 'text-gray-300'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          </button>
          <button 
            onClick={onRedo} 
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className={`p-1.5 rounded-lg transition-all ${canRedo ? 'text-gray-600 hover:bg-gray-100 hover:text-orange-500' : 'text-gray-300'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
          <span className="text-[9px] font-bold text-gray-400 uppercase mr-1">Stage</span>
          <button onClick={() => onStageZoom(Math.max(0.5, stageZoom - 0.1))} className="p-1 text-gray-400 hover:text-gray-900 transition-colors" title="Zoom Out">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span className="text-[10px] font-mono font-bold w-10 text-center text-gray-600">{Math.round(stageZoom * 100)}%</span>
          <button onClick={() => onStageZoom(Math.min(3, stageZoom + 0.1))} className="p-1 text-gray-400 hover:text-gray-900 transition-colors" title="Zoom In">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button onClick={onZoomToFit} className="p-1 text-gray-400 hover:text-orange-500 transition-colors border-l border-gray-200 ml-1 pl-2" title="Zoom to Fit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>

        <div className="flex items-center gap-4 border-l border-gray-100 pl-6">
          <label className="cursor-pointer text-xs font-semibold px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import SVG
            <input type="file" accept=".svg" className="hidden" onChange={handleFileChange} />
          </label>
          
          <button 
            onClick={onExport}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-5 py-2 rounded-full shadow-md shadow-orange-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
            Export Assets
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
