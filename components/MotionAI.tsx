
import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { EditorState, AnimatableProperty, EasingType } from '../types';

interface MotionAIProps {
  state: EditorState;
  onApplyAnimation: (layerId: string, property: AnimatableProperty, value: number | string, time: number, easing: EasingType) => void;
}

const MotionAI: React.FC<MotionAIProps> = ({ state, onApplyAnimation }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const availableLayers = state.layers.map(l => l.id).join(', ');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I have an SVG with layers: ${availableLayers}. 
        The user wants this animation: "${prompt}". 
        Create keyframes for this animation.
        Available properties:
        - x, y (position in px)
        - scale (number, default 1)
        - rotate (degrees)
        - opacity (0 to 1)
        - fill, stroke (HEX strings like #FF0000)
        - strokeDashoffset (number)
        Return a list of keyframe actions. Use multiple keyframes per property to create motion.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    layerId: { type: Type.STRING, description: "ID of the layer to animate" },
                    property: { type: Type.STRING, enum: ['x', 'y', 'scale', 'rotate', 'opacity', 'fill', 'stroke', 'strokeDashoffset'] },
                    time: { type: Type.NUMBER, description: `Time in seconds (0 to ${state.duration})` },
                    value: { type: Type.STRING, description: "Value for the property (number string or hex color)" },
                    easing: { type: Type.STRING, enum: ['linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'bounce'] }
                  },
                  required: ["layerId", "property", "time", "value", "easing"]
                }
              }
            },
            required: ["actions"]
          }
        }
      });

      // Fix: Ensure we handle undefined response text safely
      const text = response.text || '{}';
      const result = JSON.parse(text);
      if (result.actions) {
        result.actions.forEach((action: any) => {
          const val = isNaN(parseFloat(action.value)) || action.value.startsWith('#') ? action.value : parseFloat(action.value);
          // Fix: Parameter order for onApplyAnimation (which is App's addKeyframe) is (layerId, property, value, time, easing)
          onApplyAnimation(action.layerId, action.property as AnimatableProperty, val, action.time, action.easing as EasingType);
        });
        setPrompt('');
      }
    } catch (err: any) {
      console.error(err);
      setError("AI was unable to process this request. Try a simpler prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 border-t bg-gray-50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        </div>
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Motion AI Assistant</h3>
      </div>
      
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., 'Make the circle pulse and change color to blue'"
          className="w-full h-20 text-xs p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none resize-none transition-all placeholder:text-gray-400"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`absolute bottom-2 right-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
            isGenerating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black active:scale-95'
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-3 w-3 text-gray-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Thinking...
            </>
          ) : 'Generate'}
        </button>
      </div>
      {error && <p className="text-[10px] text-red-500 mt-2 font-medium">{error}</p>}
    </div>
  );
};

export default MotionAI;
