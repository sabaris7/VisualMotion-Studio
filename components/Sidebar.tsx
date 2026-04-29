
import React, { useState, useRef, useEffect } from 'react';
import { SVGLayer } from '../types';

interface SidebarProps {
  layers: SVGLayer[];
  selectedIds: string[];
  hiddenIds: string[];
  onSelect: (id: string, multi: boolean) => void;
  onGroup: () => void;
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  onDelete: (id: string) => void;
  onDeleteSelected: () => void;
  onToggleVisibility: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

type DragOverState = {
  id: string;
  position: 'top' | 'bottom';
};

const LayerItem: React.FC<{ 
  layer: SVGLayer, 
  selectedIds: string[], 
  hiddenIds: string[],
  onSelect: (id: string, multi: boolean) => void, 
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after') => void,
  onDelete: (id: string) => void,
  onToggleVisibility: (id: string) => void,
  onRename: (id: string, newName: string) => void,
  depth: number,
  dragOverState: DragOverState | null,
  setDragOverState: (state: DragOverState | null) => void
}> = ({ layer, selectedIds, hiddenIds, onSelect, onReorder, onDelete, onToggleVisibility, onRename, depth, dragOverState, setDragOverState }) => {
  const isSelected = selectedIds.includes(layer.id);
  const isHidden = hiddenIds.includes(layer.id);
  const isDraggedOver = dragOverState?.id === layer.id;
  const dropPosition = isDraggedOver ? dragOverState?.position : null;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(layer.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", layer.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    // Determine if we are in the top half or bottom half
    const isTopHalf = offsetY < rect.height / 2;
    const position = isTopHalf ? 'top' : 'bottom';

    if (dragOverState?.id !== layer.id || dragOverState?.position !== position) {
      setDragOverState({ id: layer.id, position });
    }
  };

  const handleDragEnd = () => {
    setDragOverState(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverState(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    
    if (sourceId && sourceId !== layer.id) {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const isTopHalf = offsetY < rect.height / 2;
      const position = isTopHalf ? 'before' : 'after';
      onReorder(sourceId, layer.id, position);
    }
  };

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const handleRename = () => {
    onRename(layer.id, editName);
    setIsEditing(false);
  };

  return (
    <div
      ref={itemRef}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      className="group relative"
    >
      {/* Drop Indicator Line */}
      {isDraggedOver && (
        <div 
          className={`absolute left-0 right-0 h-0.5 bg-orange-500 z-20 pointer-events-none ${dropPosition === 'top' ? 'top-0' : 'bottom-0'}`} 
        />
      )}
      
      <div 
        onClick={(e) => {
          if (isEditing) return;
          onSelect(layer.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }}
        onDoubleClick={() => setIsEditing(true)}
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-l-2 ${
          isSelected ? 'bg-orange-50 border-orange-500 text-orange-900 font-medium' : 'hover:bg-gray-50 border-transparent text-gray-500'
        } ${isHidden ? 'opacity-50 grayscale' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing p-1 shrink-0 pointer-events-none">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM14 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
          </svg>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(layer.id); }}
          className={`shrink-0 transition-colors ${isHidden ? 'text-gray-400' : 'text-orange-500'}`}
          title={isHidden ? 'Show Layer' : 'Hide Layer'}
        >
          {isHidden ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
        </button>

        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 pointer-events-none ${isSelected ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {layer.tagName === 'circle' && <circle cx="12" cy="12" r="10" />}
            {layer.tagName === 'rect' && <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />}
            {layer.tagName === 'path' && <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />}
            {layer.tagName === 'g' && <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />}
          </svg>
        </div>
        
        <div className="flex flex-col truncate flex-1 min-w-0 pointer-events-none">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="text-[11px] font-bold leading-tight bg-white border border-orange-500 rounded outline-none px-1 w-full pointer-events-auto"
            />
          ) : (
            <span className="text-[11px] font-bold leading-tight truncate">{layer.id}</span>
          )}
          <span className="text-[9px] opacity-60 uppercase font-bold tracking-tighter">{layer.tagName}</span>
        </div>
        
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onDelete(layer.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-400" title="Delete Layer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
      {layer.children?.map(child => (
        <LayerItem 
          key={child.id} 
          layer={child} 
          selectedIds={selectedIds} 
          hiddenIds={hiddenIds}
          onSelect={onSelect} 
          onReorder={onReorder} 
          onDelete={onDelete} 
          onToggleVisibility={onToggleVisibility}
          onRename={onRename}
          depth={depth + 1}
          dragOverState={dragOverState}
          setDragOverState={setDragOverState}
        />
      ))}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ layers, selectedIds, hiddenIds, onSelect, onGroup, onReorder, onDelete, onDeleteSelected, onToggleVisibility, onRename }) => {
  const [dragOverState, setDragOverState] = useState<DragOverState | null>(null);

  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleGlobalDrop = () => {
    setDragOverState(null);
  };

  return (
    <aside 
      className="w-64 bg-white border-r flex flex-col z-10 shadow-sm overflow-hidden"
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
    >
      <div className="p-4 border-b flex items-center justify-between bg-white shrink-0">
        <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Layers</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={onDeleteSelected}
            disabled={selectedIds.length === 0}
            className={`p-1.5 rounded-lg transition-all border ${selectedIds.length > 0 ? 'text-red-500 bg-red-50 border-red-100 hover:bg-red-100' : 'text-gray-300 bg-gray-50 border-transparent'}`}
            title="Delete Selected"
          >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
          <button 
            onClick={onGroup}
            disabled={selectedIds.length < 2}
            className={`p-1.5 rounded-lg transition-all border ${selectedIds.length >= 2 ? 'text-orange-500 bg-orange-50 border-orange-100 hover:bg-orange-100' : 'text-gray-300 bg-gray-50 border-transparent'}`}
            title="Group Selected (Select 2+)"
          >
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
        {layers.map(layer => (
          <LayerItem 
            key={layer.id} 
            layer={layer} 
            selectedIds={selectedIds} 
            hiddenIds={hiddenIds}
            onSelect={onSelect} 
            onReorder={onReorder} 
            onDelete={onDelete} 
            onToggleVisibility={onToggleVisibility}
            onRename={onRename}
            depth={0} 
            dragOverState={dragOverState}
            setDragOverState={setDragOverState}
          />
        ))}
        {layers.length === 0 && (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2"><path d="M12 2v10M12 22v-6M2 12h10M22 12h-6"/></svg>
             </div>
             <p className="text-[11px] text-gray-400 font-medium italic">Drop or Paste an SVG</p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
