/**
 * トークン・PIN生成ユーティリティのテスト
 */

/// <reference types="jest" />

import {
  generateToken,
  generatePin,
  validateCustomPin,
  generateTokenAndPin,
  generateInviteUrl,
} from '../tokenGenerator';

describe('tokenGenerator', () => {
  describe('generateToken', () => {
    it('32文字のトークンを生成する', () => {
      const token = generateToken();
      expect(token).toHaveLength(32);
    });

    it('ハイフンを含まない', () => {
      const token = generateToken();
      expect(token).not.toMatch(/-/);
    });

    it('16進数文字列である', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]{32}$/);
    });

    it('毎回異なるトークンを生成する', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('10,000個生成しても衝突しない', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        tokens.add(generateToken());
      }
      expect(tokens.size).toBe(10000);
    });
  });

  describe('generatePin', () => {
    it('デフォルトで4桁のPINを生成する', () => {
      const pin = generatePin();
      expect(pin).toHaveLength(4);
      expect(pin).toMatch(/^\d{4}$/);
    });

    it('6桁のPINを生成できる', () => {
      const pin = generatePin(6);
      expect(pin).toHaveLength(6);
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('8桁のPINを生成できる', () => {
      const pin = generatePin(8);
      expect(pin).toHaveLength(8);
      expect(pin).toMatch(/^\d{8}$/);
    });

    it('先頭ゼロを保持する', () => {
      // ランダムなので1000回試行して少なくとも1回は先頭ゼロが出るはず
      let hasLeadingZero = false;
      for (let i = 0; i < 1000; i++) {
        const pin = generatePin(4);
        if (pin.startsWith('0')) {
          hasLeadingZero = true;
          // 先頭ゼロのPINが正しく4桁であることを確認
          expect(pin).toHaveLength(4);
          expect(pin).toMatch(/^0\d{3}$/);
          break;
        }
      }
      // 統計的に先頭ゼロは10%の確率で出現
      // 1000回試行で1度も出ない確率は約0.000000004%（ほぼゼロ）
      expect(hasLeadingZero).toBe(true);
    });

    it('3桁以下はエラーを投げる', () => {
      expect(() => generatePin(3)).toThrow('PIN length must be between 4 and 8');
    });

    it('9桁以上はエラーを投げる', () => {
      expect(() => generatePin(9)).toThrow('PIN length must be between 4 and 8');
    });

    it('毎回異なるPINを生成する', () => {
      const pins = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        pins.add(generatePin());
      }
      // 4桁のPINは10,000通り
      // 1000個生成すると約10%をカバー、ほぼ全て異なるはず
      expect(pins.size).toBeGreaterThan(900);
    });
  });

  describe('validateCustomPin', () => {
    it('有効な4桁PINを受け入れる', () => {
      expect(validateCustomPin('1234')).toBe(true);
      expect(validateCustomPin('0000')).toBe(true);
      expect(validateCustomPin('9999')).toBe(true);
    });

    it('有効な6桁PINを受け入れる', () => {
      expect(validateCustomPin('123456')).toBe(true);
    });

    it('有効な8桁PINを受け入れる', () => {
      expect(validateCustomPin('12345678')).toBe(true);
    });

    it('3桁以下は拒否する', () => {
      expect(validateCustomPin('123')).toBe(false);
      expect(validateCustomPin('12')).toBe(false);
      expect(validateCustomPin('1')).toBe(false);
    });

    it('9桁以上は拒否する', () => {
      expect(validateCustomPin('123456789')).toBe(false);
    });

    it('英字を含むと拒否する', () => {
      expect(validateCustomPin('12ab')).toBe(false);
      expect(validateCustomPin('abcd')).toBe(false);
    });

    it('記号を含むと拒否する', () => {
      expect(validateCustomPin('12-34')).toBe(false);
      expect(validateCustomPin('12.34')).toBe(false);
    });

    it('空文字は拒否する', () => {
      expect(validateCustomPin('')).toBe(false);
    });
  });

  describe('generateTokenAndPin', () => {
    it('トークンとPINをセットで生成する', () => {
      const { token, pin } = generateTokenAndPin();
      expect(token).toHaveLength(32);
      expect(pin).toHaveLength(4);
    });

    it('指定した桁数のPINを生成する', () => {
      const { pin } = generateTokenAndPin(6);
      expect(pin).toHaveLength(6);
    });
  });

  describe('generateInviteUrl', () => {
    it('トークンからURLを生成する', () => {
      const token = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const url = generateInviteUrl(token, 'https://prance.app');
      expect(url).toBe('https://prance.app/guest/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6');
    });

    it('環境変数が未設定の場合はlocalhostを使用する', () => {
      const token = 'test123';
      const url = generateInviteUrl(token);
      expect(url).toMatch(/^http:\/\/localhost:3000\/guest\//);
    });
  });
});
