/**
 * Keyboard Shortcuts Help Component
 * Displays available keyboard shortcuts for the session player
 */

'use client';

import { useI18n } from '@/lib/i18n/provider';
import { useState } from 'react';

interface KeyboardShortcutsProps {
  className?: string;
}

export function KeyboardShortcuts({ className = '' }: KeyboardShortcutsProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts = [
    {
      key: 'Space',
      description: t('sessions.player.shortcuts.space'),
      icon: '▶️',
    },
    {
      key: 'Esc',
      description: t('sessions.player.shortcuts.escape'),
      icon: '⏹️',
    },
    {
      key: 'P',
      description: t('sessions.player.shortcuts.pause'),
      icon: '⏸️',
    },
    {
      key: 'M',
      description: t('sessions.player.shortcuts.mute'),
      icon: '🔇',
    },
    {
      key: '?',
      description: t('sessions.player.shortcuts.help'),
      icon: '❓',
    },
  ];

  return (
    <>
      {/* Help Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
        title={t('sessions.player.shortcuts.showHelp')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="hidden sm:inline">{t('sessions.player.shortcuts.title')}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('sessions.player.shortcuts.title')}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{shortcut.icon}</span>
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                  </div>
                  <kbd className="px-3 py-1.5 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-lg shadow-sm">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">{t('sessions.player.shortcuts.note')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
