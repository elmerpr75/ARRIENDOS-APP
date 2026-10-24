import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Eraser, Check, PenTool, RefreshCw } from 'lucide-react';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (signatureDataUrl: string) => void;
  initialSignatureUrl?: string;
  companyName?: string;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
  initialSignatureUrl,
  companyName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and scale canvas for high DPI
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#0f172a'; // Deep slate / navy ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw initial signature image if provided and canvas hasn't been drawn on
    if (initialSignatureUrl && !hasDrawn) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialSignatureUrl;
    }
  }, [initialSignatureUrl, hasDrawn]);

  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow modal animation / layout rendering
      const timer = setTimeout(() => {
        setupCanvas();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setupCanvas]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCoordinates(e);
    lastPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCoords = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentCoords.x, currentCoords.y);
    ctx.stroke();

    lastPointRef.current = currentCoords;
    if (!hasDrawn) setHasDrawn(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      e.preventDefault();
      e.stopPropagation();
      setIsDrawing(false);
      lastPointRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture release throws
      }
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasDrawn) {
      alert('Por favor dibuje su firma en la pantalla antes de guardar.');
      return;
    }

    // Convert canvas content to PNG Data URL
    const dataUrl = canvas.toDataURL('image/png');
    onSaveSignature(dataUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-sky-600/30 text-sky-400 rounded-xl border border-sky-500/30">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Dibujar Firma Digital del Administrador
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {companyName || 'Crear firma con pantalla touch, lápiz o ratón'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Signature Canvas Container */}
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Panel Táctil de Firma</span>
              <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                ✨ Compatible con Pantalla Touch / Stylus / Ratón
              </span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Trace su firma dentro del recuadro usando su dedo, lápiz digital o cursor.
            </p>
          </div>

          {/* Interactive Canvas */}
          <div className="relative w-full h-52 sm:h-60 bg-white dark:bg-slate-950 rounded-2xl border-2 border-dashed border-sky-300 dark:border-sky-800/80 shadow-inner overflow-hidden select-none">
            {!hasDrawn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-4 text-center text-slate-400 dark:text-slate-600">
                <PenTool className="w-8 h-8 mb-2 opacity-50 text-sky-500 animate-pulse" />
                <span className="text-xs font-semibold">
                  Dibuje aquí su firma en pantalla
                </span>
                <span className="text-[10px] opacity-75 mt-1">
                  (En celulares y tablets, deslice su dedo directamente)
                </span>
              </div>
            )}

            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ touchAction: 'none' }}
              className="w-full h-full cursor-crosshair relative z-10"
            />

            {/* Guideline baseline for standard signature posture */}
            <div className="absolute bottom-10 left-8 right-8 border-b border-slate-200 dark:border-slate-800/60 pointer-events-none z-0" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={clearCanvas}
              disabled={!hasDrawn}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Eraser className="w-4 h-4 text-slate-500" />
              <span>Limpiar Pantalla</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasDrawn}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Firma</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
