import React from 'react';
import { ThemeMode } from '../utils/theme';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { SupportedLanguage, translations } from '../utils/i18n';

interface ThemeSelectorProps {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  lang?: SupportedLanguage;
  variant?: 'segmented' | 'cards' | 'compact';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onThemeChange,
  lang = 'es',
  variant = 'segmented',
}) => {
  const t = translations[lang] || translations.es;

  const options: {
    id: ThemeMode;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'light',
      label: t.themeLight,
      description: t.themeLightDesc,
      icon: <Sun className="w-4 h-4 text-amber-500" />,
    },
    {
      id: 'dark',
      label: t.themeDark,
      description: t.themeDarkDesc,
      icon: <Moon className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'system',
      label: t.themeSystem,
      description: t.themeSystemDesc,
      icon: <Laptop className="w-4 h-4 text-slate-400" />,
    },
  ];

  if (variant === 'compact') {
    const nextModeMap: Record<ThemeMode, ThemeMode> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    const active = options.find((o) => o.id === currentTheme) || options[2];

    return (
      <button
        type="button"
        onClick={() => onThemeChange(nextModeMap[currentTheme])}
        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
        title={`${t.themeTitle}: ${active.label} (Clic para cambiar / Click to cycle)`}
      >
        {active.icon}
        <span className="hidden lg:inline text-[11px]">{active.label.split(' ')[0]}</span>
      </button>
    );
  }

  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map((opt) => {
          const isSelected = currentTheme === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onThemeChange(opt.id)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between relative cursor-pointer ${
                isSelected
                  ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
              }`}
            >
              <div className="flex items-start justify-between w-full mb-2">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    opt.id === 'light'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                      : opt.id === 'dark'
                      ? 'bg-slate-900 text-sky-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.icon}
                </div>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>

              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{opt.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: Segmented bar
  return (
    <div className="inline-flex rounded-xl bg-slate-800/90 p-0.5 border border-slate-700 shadow-2xs">
      {options.map((opt) => {
        const isSelected = currentTheme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onThemeChange(opt.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              isSelected
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title={opt.description}
          >
            {opt.icon}
            <span className="text-[11px]">
              {opt.id === 'light'
                ? (lang === 'en' ? 'Light' : 'Claro')
                : opt.id === 'dark'
                ? (lang === 'en' ? 'Dark' : 'Oscuro')
                : (lang === 'en' ? 'Device' : 'Equipo')}
            </span>
          </button>
        );
      })}
    </div>
  );
};
