import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  // Android / Chromium / Desktop prompt triggered directly
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition"
        title="Instalar como app en tu celular o PC"
      >
        <Smartphone className="w-4 h-4" />
        <span>Instalar App</span>
      </button>
    );
  }

  // Fallback button with step-by-step help modal for Android Chrome & Windows
  return (
    <>
      <button
        onClick={() => setShowHelpModal(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
        title="Ver cómo instalar la app con icono en tu celular o PC"
      >
        <Download className="w-3.5 h-3.5 text-sky-400" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-sky-500" />
                Cómo instalar la App con icono
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800">
                <p className="font-bold text-sky-900 dark:text-sky-200 mb-1">
                  📱 En Celular Android (Google Chrome):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                  <li>Toca los <strong>3 puntos verticales (⋮)</strong> arriba a la derecha en Chrome.</li>
                  <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                  <li>Confirma en <strong>Instalar</strong>. El icono aparecerá en tu menú de aplicaciones como una app real.</li>
                </ol>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-1">
                  💻 En la PC (Chrome o Edge en Windows):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
                  <li>En la barra de direcciones arriba verás un icono de pantalla con flecha <strong>(Instalar ARRIENDOS - Rent Manager)</strong>.</li>
                  <li>O haz clic en los 3 puntos (⋮) &gt; <strong>Guardar y compartir</strong> &gt; <strong>Instalar ARRIENDOS - Rent Manager</strong>.</li>
                  <li>Se creará automáticamente el acceso directo en tu Escritorio y Menú Inicio.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-500 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
