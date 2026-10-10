import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  RotateCcw,
  Crop,
  Check,
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Sparkles,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface CropRect {
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  width: number; // percentage 0..100
  height: number; // percentage 0..100
}

interface PassportImageCropperProps {
  imageSrc: string;
  onConfirmCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export const PassportImageCropper: React.FC<PassportImageCropperProps> = ({
  imageSrc,
  onConfirmCrop,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [fineAngle, setFineAngle] = useState<number>(0); // -15 to +15 degrees
  const [zoom, setZoom] = useState<number>(1);
  const [crop, setCrop] = useState<CropRect>({ x: 5, y: 10, width: 90, height: 80 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; crop: CropRect } | null>(null);
  const [previewMrz, setPreviewMrz] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Load natural image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Set preset: Focus MRZ Zone (bottom 28% of page)
  const setMrzFocusPreset = useCallback(() => {
    setCrop({
      x: 3,
      y: 65,
      width: 94,
      height: 32,
    });
  }, []);

  // Set preset: Full Passport ID page
  const setFullPagePreset = useCallback(() => {
    setCrop({
      x: 4,
      y: 4,
      width: 92,
      height: 92,
    });
  }, []);

  // Set preset: Standard 3:2 Passport ratio
  const setStandardPassportPreset = useCallback(() => {
    setCrop({
      x: 8,
      y: 12,
      width: 84,
      height: 76,
    });
  }, []);

  // Mouse & Touch event handlers for interactive handles
  const handlePointerDown = (handle: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    dragStartRef.current = {
      clientX,
      clientY,
      crop: { ...crop },
    };
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!activeHandle || !dragStartRef.current || !containerRef.current) return;

      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((clientX - dragStartRef.current.clientX) / rect.width) * 100;
      const deltaY = ((clientY - dragStartRef.current.clientY) / rect.height) * 100;

      const orig = dragStartRef.current.crop;
      let newCrop = { ...orig };

      if (activeHandle === 'move') {
        newCrop.x = Math.max(0, Math.min(100 - orig.width, orig.x + deltaX));
        newCrop.y = Math.max(0, Math.min(100 - orig.height, orig.y + deltaY));
      } else if (activeHandle === 'tl') {
        const x = Math.max(0, Math.min(orig.x + orig.width - 10, orig.x + deltaX));
        const y = Math.max(0, Math.min(orig.y + orig.height - 10, orig.y + deltaY));
        newCrop.width = orig.width + (orig.x - x);
        newCrop.height = orig.height + (orig.y - y);
        newCrop.x = x;
        newCrop.y = y;
      } else if (activeHandle === 'tr') {
        const y = Math.max(0, Math.min(orig.y + orig.height - 10, orig.y + deltaY));
        newCrop.width = Math.max(10, Math.min(100 - orig.x, orig.width + deltaX));
        newCrop.height = orig.height + (orig.y - y);
        newCrop.y = y;
      } else if (activeHandle === 'bl') {
        const x = Math.max(0, Math.min(orig.x + orig.width - 10, orig.x + deltaX));
        newCrop.width = orig.width + (orig.x - x);
        newCrop.height = Math.max(10, Math.min(100 - orig.y, orig.height + deltaY));
        newCrop.x = x;
      } else if (activeHandle === 'br') {
        newCrop.width = Math.max(10, Math.min(100 - orig.x, orig.width + deltaX));
        newCrop.height = Math.max(10, Math.min(100 - orig.y, orig.height + deltaY));
      } else if (activeHandle === 't') {
        const y = Math.max(0, Math.min(orig.y + orig.height - 10, orig.y + deltaY));
        newCrop.height = orig.height + (orig.y - y);
        newCrop.y = y;
      } else if (activeHandle === 'b') {
        newCrop.height = Math.max(10, Math.min(100 - orig.y, orig.height + deltaY));
      } else if (activeHandle === 'l') {
        const x = Math.max(0, Math.min(orig.x + orig.width - 10, orig.x + deltaX));
        newCrop.width = orig.width + (orig.x - x);
        newCrop.x = x;
      } else if (activeHandle === 'r') {
        newCrop.width = Math.max(10, Math.min(100 - orig.x, orig.width + deltaX));
      }

      setCrop(newCrop);
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [activeHandle]);

  // Rotate 90 degrees
  const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
  const rotateRight = () => setRotation((r) => (r + 90) % 360);
  const resetOrientation = () => {
    setRotation(0);
    setFineAngle(0);
    setZoom(1);
    setFullPagePreset();
  };

  // Perform Final Crop on Native Canvas
  const executeCrop = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const totalAngle = (rotation + fineAngle) * (Math.PI / 180);

      // Step 1: Draw rotated source image on an intermediate canvas
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      // Calculate bounding box of rotated image
      const absCos = Math.abs(Math.cos(totalAngle));
      const absSin = Math.abs(Math.sin(totalAngle));
      const rotatedW = Math.round(srcW * absCos + srcH * absSin);
      const rotatedH = Math.round(srcW * absSin + srcH * absCos);

      const rotCanvas = document.createElement('canvas');
      rotCanvas.width = rotatedW;
      rotCanvas.height = rotatedH;
      const rotCtx = rotCanvas.getContext('2d');
      if (!rotCtx) return;

      rotCtx.translate(rotatedW / 2, rotatedH / 2);
      rotCtx.rotate(totalAngle);
      rotCtx.drawImage(img, -srcW / 2, -srcH / 2);

      // Step 2: Slice the crop box from the rotated canvas
      const cropX = Math.round((crop.x / 100) * rotatedW);
      const cropY = Math.round((crop.y / 100) * rotatedH);
      const cropW = Math.max(10, Math.round((crop.width / 100) * rotatedW));
      const cropH = Math.max(10, Math.round((crop.height / 100) * rotatedH));

      const outCanvas = document.createElement('canvas');
      outCanvas.width = cropW;
      outCanvas.height = cropH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return;

      outCtx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedDataUrl = outCanvas.toDataURL('image/jpeg', 0.98);
      onConfirmCrop(croppedDataUrl);
    };
    img.src = imageSrc;
  };

  const totalDeg = rotation + fineAngle;

  return (
    <div className="flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 text-slate-100 max-h-[85vh]">
      {/* Top Header & Toolbar */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Crop className="w-5 h-5 text-sky-400" />
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Interactive Passport Crop &amp; Alignment</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-sky-950 text-sky-300 border border-sky-800/80 rounded-full">
                100% In-Browser Privacy
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Drag handles or pick a preset to isolate the bottom MRZ lines for 100% mathematical accuracy.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={executeCrop}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold shadow-lg flex items-center gap-1.5 transition active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Apply Crop &amp; Scan</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Workspace */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center p-4 min-h-[380px] max-h-[520px] select-none">
        {/* Background Dark Overlay Guide */}
        <div
          ref={containerRef}
          className="relative max-w-full max-h-full inline-block overflow-hidden rounded-lg shadow-2xl border border-slate-800"
          style={{
            transform: `rotate(${totalDeg}deg) scale(${zoom})`,
            transition: activeHandle ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {/* Loaded Image */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop Passport"
            className="max-h-[460px] max-w-full object-contain pointer-events-none block"
            draggable={false}
          />

          {/* Dimmer Masks outside crop */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `rgba(15, 23, 42, 0.65)`,
              clipPath: `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                ${crop.x}% ${crop.y}%, 
                ${crop.x + crop.width}% ${crop.y}%, 
                ${crop.x + crop.width}% ${crop.y + crop.height}%, 
                ${crop.x}% ${crop.y + crop.height}%, 
                ${crop.x}% ${crop.y}%
              )`,
            }}
          />

          {/* Active Bounding Crop Box */}
          <div
            className="absolute border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] cursor-move"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
            }}
            onMouseDown={(e) => handlePointerDown('move', e)}
            onTouchStart={(e) => handlePointerDown('move', e)}
          >
            {/* Rule-of-Thirds Grid */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
              <div className="border-r border-b border-sky-300" />
              <div className="border-r border-b border-sky-300" />
              <div className="border-b border-sky-300" />
              <div className="border-r border-b border-sky-300" />
              <div className="border-r border-b border-sky-300" />
              <div className="border-b border-sky-300" />
              <div className="border-r border-sky-300" />
              <div className="border-r border-sky-300" />
              <div />
            </div>

            {/* MRZ Zone Visual Target Guide */}
            <div className="absolute bottom-1 inset-x-1 border border-dashed border-sky-300/80 bg-sky-950/40 rounded px-2 py-0.5 text-[9px] font-mono text-sky-200 tracking-wider text-center pointer-events-none">
              ▼ ALIGN 2 MRZ LINES HERE (P&lt;... / 0123...) ▼
            </div>

            {/* 4 Corner Drag Handles */}
            <div
              className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-sky-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handlePointerDown('tl', e)}
              onTouchStart={(e) => handlePointerDown('tl', e)}
            />
            <div
              className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-sky-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handlePointerDown('tr', e)}
              onTouchStart={(e) => handlePointerDown('tr', e)}
            />
            <div
              className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-sky-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handlePointerDown('bl', e)}
              onTouchStart={(e) => handlePointerDown('bl', e)}
            />
            <div
              className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-sky-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform"
              onMouseDown={(e) => handlePointerDown('br', e)}
              onTouchStart={(e) => handlePointerDown('br', e)}
            />

            {/* 4 Edge Drag Handles */}
            <div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-sky-300/90 rounded-full cursor-ns-resize hover:bg-sky-200"
              onMouseDown={(e) => handlePointerDown('t', e)}
              onTouchStart={(e) => handlePointerDown('t', e)}
            />
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-sky-300/90 rounded-full cursor-ns-resize hover:bg-sky-200"
              onMouseDown={(e) => handlePointerDown('b', e)}
              onTouchStart={(e) => handlePointerDown('b', e)}
            />
            <div
              className="absolute top-1/2 -left-1.5 -translate-y-1/2 h-8 w-3 bg-sky-300/90 rounded-full cursor-ew-resize hover:bg-sky-200"
              onMouseDown={(e) => handlePointerDown('l', e)}
              onTouchStart={(e) => handlePointerDown('l', e)}
            />
            <div
              className="absolute top-1/2 -right-1.5 -translate-y-1/2 h-8 w-3 bg-sky-300/90 rounded-full cursor-ew-resize hover:bg-sky-200"
              onMouseDown={(e) => handlePointerDown('r', e)}
              onTouchStart={(e) => handlePointerDown('r', e)}
            />
          </div>
        </div>
      </div>

      {/* Bottom Tool Bar Controls */}
      <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
        {/* Preset Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 mr-1">Crop Presets:</span>
          <button
            type="button"
            onClick={setMrzFocusPreset}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md font-semibold flex items-center gap-1 shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            <span>Focus MRZ Strip (Recommended)</span>
          </button>
          <button
            type="button"
            onClick={setStandardPassportPreset}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-medium transition"
          >
            Passport Page (3:2)
          </button>
          <button
            type="button"
            onClick={setFullPagePreset}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-medium transition"
          >
            Full Image
          </button>
        </div>

        {/* Orientation & Fine Angle Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 90 deg rotation */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={rotateLeft}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
              title="Rotate 90° Left"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={rotateRight}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
              title="Rotate 90° Right"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetOrientation}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              title="Reset Alignment"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fine Tuning Angle Slider */}
          <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-slate-400">Angle:</span>
            <input
              type="range"
              min="-15"
              max="15"
              step="0.5"
              value={fineAngle}
              onChange={(e) => setFineAngle(parseFloat(e.target.value))}
              className="w-20 accent-sky-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-300 min-w-[28px] text-right">
              {fineAngle > 0 ? `+${fineAngle}°` : `${fineAngle}°`}
            </span>
          </div>

          {/* Zoom Level */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              className="p-1 text-slate-300 hover:text-white rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1 text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
              className="p-1 text-slate-300 hover:text-white rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
