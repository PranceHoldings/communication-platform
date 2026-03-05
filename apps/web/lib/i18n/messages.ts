// Import all message files
import commonEn from '@/messages/en/common.json';
import commonJa from '@/messages/ja/common.json';
import authEn from '@/messages/en/auth.json';
import authJa from '@/messages/ja/auth.json';
import dashboardEn from '@/messages/en/dashboard.json';
import dashboardJa from '@/messages/ja/dashboard.json';

const messages: Record<string, Record<string, any>> = {
  en: {
    ...commonEn,
    ...authEn,
    ...dashboardEn,
  },
  ja: {
    ...commonJa,
    ...authJa,
    ...dashboardJa,
  },
};

export function getMessages(locale: string): Record<string, any> {
  return messages[locale] || messages.en;
}
