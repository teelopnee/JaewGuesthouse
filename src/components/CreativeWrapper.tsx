import React, { useState } from 'react';
import { useCreative } from '../context/CreativeContext';

interface CreativeWrapperProps {
  id: string;
  defaultText?: string;
  className?: string;
  tag?: keyof React.JSX.IntrinsicElements;
  children?: React.ReactNode;
}

/**
 * Marks an element the admin can restyle in creative mode.
 * Shows the admin's custom text if set, otherwise the original children (or defaultText).
 */
export const CreativeWrapper: React.FC<CreativeWrapperProps> = ({
  id,
  defaultText,
  className = '',
  tag = 'div',
  children,
}) => {
  const { isCreativeMode, selectedId, setSelectedId, getOverride, updateOverride } = useCreative();
  const override = getOverride(id);
  const [isEditingText, setIsEditingText] = useState(false);
  const [localText, setLocalText] = useState('');

  const isSelected = selectedId === id;
  const hasCustomText = typeof override?.customText === 'string' && override.customText.trim() !== '';
  const isTextElement = defaultText !== undefined;
  const editableText = hasCustomText ? override!.customText! : defaultText || '';

  const startEditing = () => {
    if (!isTextElement) return;
    setLocalText(editableText);
    setIsEditingText(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!isCreativeMode) return;
    e.stopPropagation();
    e.preventDefault();
    if (isSelected) startEditing();
    else setSelectedId(id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isCreativeMode) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    startEditing();
  };

  const handleTextSubmit = () => {
    setIsEditingText(false);
    const text = localText.trim();
    // Saving the original text again just clears the override.
    updateOverride(id, { customText: text === (defaultText || '').trim() ? '' : localText });
  };

  // Hidden elements stay visible (faded) for the admin so they can be brought back.
  if (override?.isHidden && !isCreativeMode) return null;

  const content = hasCustomText ? override!.customText : children !== undefined ? children : defaultText;

  const customStyle: React.CSSProperties = {
    fontSize: override?.fontSize || undefined,
    color: override?.textColor || undefined,
    backgroundColor: override?.bgColor || undefined,
    padding: override?.padding || undefined,
    borderRadius: override?.borderRadius || undefined,
    transform: override?.scale ? `scale(${override.scale})` : undefined,
    transformOrigin: override?.scale ? 'top left' : undefined,
    whiteSpace: hasCustomText ? 'pre-wrap' : undefined,
  };

  if (!isCreativeMode) {
    return React.createElement(tag, { className, style: customStyle }, content);
  }

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`relative group cursor-pointer transition-all duration-150 ${
        isSelected
          ? 'ring-2 ring-indigo-500 ring-offset-2 bg-indigo-500/10 rounded'
          : 'hover:ring-1 hover:ring-dashed hover:ring-indigo-400'
      } ${override?.isHidden ? 'opacity-40' : ''}`}
      title="คลิกเพื่อแก้ไข/ปรับแต่ง (Canva Mode)"
    >
      {isSelected && (
        <div className="absolute -top-7 left-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md z-50 flex items-center gap-1 whitespace-nowrap pointer-events-none">
          <span>🎨 #{id}</span>
          {override?.isHidden && <span>(ซ่อนอยู่)</span>}
        </div>
      )}

      {isEditingText ? (
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={handleTextSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleTextSubmit();
            }
            if (e.key === 'Escape') setIsEditingText(false);
          }}
          autoFocus
          rows={Math.min(5, Math.max(2, Math.ceil(localText.length / 40)))}
          className="bg-white text-slate-900 px-2 py-1 rounded shadow-inner border border-indigo-500 outline-none w-full text-sm font-sans resize-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        React.createElement(tag, { className, style: customStyle }, content)
      )}
    </div>
  );
};
