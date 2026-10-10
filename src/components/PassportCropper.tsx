import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  RotateCw,
  RotateCcw,
  Check,
  X,
  Maximize2,
  Scan,
  Sliders,
  Layers,
  ZoomIn,
} from 'lucide-react';

export interface CropArea {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  width: number; // percentage 0 - 100
  height: number; // percentage 0 - 100
}

interface PassportCropperProps {
  imageSrc: string;
  onApplyCrop: (croppedDataUrl: string, filterMode?: 'normal' | 'contrast' | 'binarized') => void;
  onCancel: () => void;
  onQuickScanFull?: () => void;
}

export const PassportCropper: React.FC<PassportCropperProps> = ({
  imageSrc,
  onApplyCrop,
  onCancel,
  onQuickScanFull,
}) => {
  // Current rotation in degrees (0, 90, 180, 270)
  const [rotation, setRotation] = useState<number>(0);

  // Upright rendered image data URL (rotates pixel bitmap so canvas & DOM coordinates remain 1:1)
  const [uprightImageSrc, setUprightImageSrc] = useState<string>(imageSrc);

  // Crop area in percentage (0 to 100)
  const [crop, setCrop] = useState<CropArea>({
    x: 2,
    y: 68,
    width: 96,
    height: 30,
  });

  const [filterMode, setFilterMode] = useState<'normal' | 'contrast' | 'binarized'>('contrast');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Interaction dragging states
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; crop: CropArea } | null>(null);

  // Render upright image whenever rotation or imageSrc changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const rot = (rotation % 360 + 360) % 360;
      if (rot === 0) {
        setUprightImageSrc(imageSrc);
        return;
      }

      const is90or270 = rot === 90 || rot === 270;
      const rotW = is90or270 ? img.naturalHeight : img.naturalWidth;
      const rotH = is90or270 ? img.naturalWidth : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = rotW;
      canvas.height = rotH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.translate(rotW / 2, rotH / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      setUprightImageSrc(canvas.toDataURL('image/png'));
    };
    img.src = imageSrc;
  }, [imageSrc, rotation]);

  // Preset handlers
  const setPresetMrzStrip = () => {
    setCrop({
      x: 2,
      y: 68,
      width: 96,
      height: 30,
    });
  };

  const setPresetBottomHalf = () => {
    setCrop({
      x: 2,
      y: 48,
      width: 96,
      height: 50,
    });
  };

  const setPresetFullDocument = () => {
    setCrop({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  };

  const rotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const rotateLeft = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  };

  // Generate cropped preview data whenever crop or upright image changes
  const generateCroppedCanvas = useCallback(
    (targetFilter = filterMode): string | null => {
      if (!imageRef.current) return null;
      const img = imageRef.current;
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      if (imgW <= 0 || imgH <= 0) return null;

      const pxX = Math.max(0, Math.round((crop.x / 100) * imgW));
      const pxY = Math.max(0, Math.round((crop.y / 100) * imgH));
      const pxW = Math.min(imgW - pxX, Math.round((crop.width / 100) * imgW));
      const pxH = Math.min(imgH - pxY, Math.round((crop.height / 100) * imgH));

      if (pxW <= 0 || pxH <= 0) return null;

      const offscreen = document.createElement('canvas');
      offscreen.width = pxW;
      offscreen.height = pxH;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, pxX, pxY, pxW, pxH, 0, 0, pxW, pxH);

      // Pre-OCR contrast filtering
      if (targetFilter === 'contrast') {
        const imgData = ctx.getImageData(0, 0, pxW, pxH);
        const d = imgData.data;
        const factor = 1.45;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          let v = (gray - 128) * factor + 128;
          v = Math.min(255, Math.max(0, v));
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      } else if (targetFilter === 'binarized') {
        const imgData = ctx.getImageData(0, 0, pxW, pxH);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const v = gray < 135 ? 0 : 255;
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      return offscreen.toDataURL('image/png');
    },
    [crop, filterMode]
  );

  // Update live preview thumbnail
  useEffect(() => {
    const timer = setTimeout(() => {
      const dataUrl = generateCroppedCanvas();
      if (dataUrl) {
        setPreviewDataUrl(dataUrl);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [generateCroppedCanvas]);

  // Handle Dragging Crop Box & Resize Handles
  const handleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      crop: { ...crop },
    });
  };

  const handleTouchStart = (e: React.TouchEvent, handle: string) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    setActiveHandle(handle);
    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      crop: { ...crop },
    });
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!activeHandle || !dragStart || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((clientX - dragStart.x) / rect.width) * 100;
      const deltaYPercent = ((clientY - dragStart.y) / rect.height) * 100;

      const init = dragStart.crop;
      let next = { ...crop };

      if (activeHandle === 'move') {
        let newX = init.x + deltaXPercent;
        let newY = init.y + deltaYPercent;
        newX = Math.max(0, Math.min(100 - init.width, newX));
        newY = Math.max(0, Math.min(100 - init.height, newY));
        next = { ...next, x: newX, y: newY };
      } else {
        // Handle edges & corners
        if (activeHandle.includes('e')) {
          const maxW = 100 - init.x;
          next.width = Math.max(10, Math.min(maxW, init.width + deltaXPercent));
        }
        if (activeHandle.includes('s')) {
          const maxH = 100 - init.y;
          next.height = Math.max(8, Math.min(maxH, init.height + deltaYPercent));
        }
        if (activeHandle.includes('w')) {
          const rightEdge = init.x + init.width;
          const newX = Math.max(0, Math.min(rightEdge - 10, init.x + deltaXPercent));
          next.x = newX;
          next.width = rightEdge - newX;
        }
        if (activeHandle.includes('n')) {
          const bottomEdge = init.y + init.height;
          const newY = Math.max(0, Math.min(bottomEdge - 8, init.y + deltaYPercent));
          next.y = newY;
          next.height = bottomEdge - newY;
        }
      }

      setCrop(next);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      setActiveHandle(null);
      setDragStart(null);
    };

    if (activeHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [activeHandle, dragStart, crop]);

  const handleApply = () => {
    const croppedUrl = generateCroppedCanvas(filterMode);
    if (croppedUrl) {
      onApplyCrop(croppedUrl, filterMode);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[85vh]">
      {/* Top Toolbar */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>Precision MRZ &amp; Document Cropper</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
                Manual Framing
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Drag the blue frame over the 2 lines of MRZ text or rotate as needed
            </p>
          </div>
        </div>

        {/* Framing & Rotation Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={setPresetMrzStrip}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-950/80 hover:bg-sky-900 text-sky-300 border border-sky-700/60 shadow-xs transition flex items-center gap-1.5"
            title="Snap frame directly to bottom MRZ zone (28%)"
          >
            <Layers className="w-3 h-3 text-sky-400" />
            <span>MRZ Strip (28%)</span>
          </button>
          <button
            type="button"
            onClick={setPresetBottomHalf}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1"
            title="Frame bottom half of the passport"
          >
            <Layers className="w-3 h-3" />
            <span>Bottom Half (50%)</span>
          </button>
          <button
            type="button"
            onClick={setPresetFullDocument}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1"
            title="Reset frame to entire document"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Full Document</span>
          </button>
          <div className="h-4 w-px bg-slate-800 mx-1" />
          <button
            type="button"
            onClick={rotateLeft}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Rotate 90° Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={rotateRight}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Cropper Workspace */}
      <div className="flex-1 overflow-hidden p-3 sm:p-5 flex flex-col md:flex-row gap-4 items-center justify-center bg-slate-950/50">
        {/* Interactive Image Frame */}
        <div className="relative max-w-full max-h-[52vh] sm:max-h-[58vh] flex items-center justify-center select-none overflow-hidden rounded-xl border border-slate-800 bg-black/60 shadow-inner">
          <div
            ref={containerRef}
            className="relative inline-block overflow-hidden"
          >
            <img
              ref={imageRef}
              src={uprightImageSrc}
              alt="Passport Document"
              className="max-h-[50vh] max-w-full object-contain pointer-events-none block"
              onLoad={() => {
                const url = generateCroppedCanvas();
                if (url) setPreviewDataUrl(url);
              }}
            />

            {/* Darkened overlay outside the crop rect */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: `0 0 0 9999px rgba(15, 23, 42, 0.65)`,
              }}
            />

            {/* Active Draggable Crop Box */}
            <div
              className="absolute border-2 border-sky-400 bg-sky-400/10 cursor-move shadow-[0_0_12px_rgba(56,189,248,0.4)]"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              onTouchStart={(e) => handleTouchStart(e, 'move')}
            >
              {/* MRZ helper watermark */}
              <div className="absolute top-1 left-1.5 px-1.5 py-0.5 bg-slate-900/90 text-[10px] font-mono font-bold text-sky-300 rounded pointer-events-none tracking-wider">
                MRZ OCR FRAME
              </div>

              {/* Grid Lines */}
              <div className="absolute inset-0 pointer-events-none border-t border-b border-sky-400/30 top-1/2 -translate-y-1/2" />
              <div className="absolute inset-0 pointer-events-none border-l border-r border-sky-400/30 left-1/2 -translate-x-1/2" />

              {/* Corner Handles */}
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                onTouchStart={(e) => handleTouchStart(e, 'nw')}
              />
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                onTouchStart={(e) => handleTouchStart(e, 'ne')}
              />
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-sky-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                onTouchStart={(e) => handleTouchStart(e, 'sw')}
              />
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-sky-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'se')}
                onTouchStart={(e) => handleTouchStart(e, 'se')}
              />

              {/* Edge Handles */}
              <div
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-sky-400 border border-slate-900 rounded-xs cursor-ns-resize shadow-sm"
                onMouseDown={(e) => handleMouseDown(e, 'n')}
                onTouchStart={(e) => handleTouchStart(e, 'n')}
              />
              <div
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-sky-400 border border-slate-900 rounded-xs cursor-ns-resize shadow-sm"
                onMouseDown={(e) => handleMouseDown(e, 's')}
                onTouchStart={(e) => handleTouchStart(e, 's')}
              />
              <div
                className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-8 w-3 bg-sky-400 border border-slate-900 rounded-xs cursor-ew-resize shadow-sm"
                onMouseDown={(e) => handleMouseDown(e, 'w')}
                onTouchStart={(e) => handleTouchStart(e, 'w')}
              />
              <div
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-8 w-3 bg-sky-400 border border-slate-900 rounded-xs cursor-ew-resize shadow-sm"
                onMouseDown={(e) => handleMouseDown(e, 'e')}
                onTouchStart={(e) => handleTouchStart(e, 'e')}
              />
            </div>
          </div>
        </div>

        {/* Live Preview & Filter Panel */}
        <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <ZoomIn className="w-3.5 h-3.5 text-sky-400" />
                <span>Cropped Region Feed</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Ready for OCR</span>
            </div>

            {/* Mini preview canvas */}
            <div className="bg-slate-950 rounded-lg p-2 border border-slate-800 min-h-[70px] flex items-center justify-center overflow-hidden">
              {previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt="Cropped Zone"
                  className="max-h-[90px] w-full object-contain"
                />
              ) : (
                <span className="text-[11px] text-slate-500">Generating preview...</span>
              )}
            </div>

            {/* Filter Toggle */}
            <div className="pt-1 border-t border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Sliders className="w-3 h-3 text-sky-400" />
                <span>Pre-Scan Filter:</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterMode('contrast')}
                  className={`py-1 rounded px-1 text-center transition ${
                    filterMode === 'contrast'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  High Contrast
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('binarized')}
                  className={`py-1 rounded px-1 text-center transition ${
                    filterMode === 'binarized'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  B&amp;W Clean
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('normal')}
                  className={`py-1 rounded px-1 text-center transition ${
                    filterMode === 'normal'
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Raw Photo
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-sky-950/40 p-2.5 rounded-xl border border-sky-900/40 space-y-1">
            <span className="font-semibold text-sky-300 block">Pro Tip for 100% Accuracy:</span>
            <span>Make sure the two lines containing chevrons <code className="text-sky-300">&lt;&lt;&lt;&lt;</code> are clearly visible inside the blue crop box.</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
          {onQuickScanFull && (
            <button
              type="button"
              onClick={onQuickScanFull}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Scan Full Without Cropping
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
        >
          <Scan className="w-4 h-4" />
          <span>Crop &amp; Scan MRZ Now</span>
        </button>
      </div>
    </div>
  );
};
