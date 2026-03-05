// Import all message files
import commonEn from '@/messages/en/common.json';
import commonJa from '@/messages/ja/common.json';
import authEn from '@/messages/en/auth.json';
import authJa from '@/messages/ja/auth.json';
import dashboardEn from '@/messages/en/dashboard.json';
import dashboardJa from '@/messages/ja/dashboard.json';
import sessionsEn from '@/messages/en/sessions.json';
import sessionsJa from '@/messages/ja/sessions.json';
import scenariosEn from '@/messages/en/scenarios.json';
import scenariosJa from '@/messages/ja/scenarios.json';
import avatarsEn from '@/messages/en/avatars.json';
import avatarsJa from '@/messages/ja/avatars.json';

const messages: Record<string, Record<string, any>> = {
  en: {
    ...commonEn,
    ...authEn,
    ...dashboardEn,
    sessions: sessionsEn,
    scenarios: scenariosEn,
    avatars: avatarsEn,
  },
  ja: {
    ...commonJa,
    ...authJa,
    ...dashboardJa,
    sessions: sessionsJa,
    scenarios: scenariosJa,
    avatars: avatarsJa,
  },
};

export function getMessages(locale: string): Record<string, any> {
  return (messages[locale] as Record<string, any>) || messages['en'];
}
