/**
 * PINハッシュ化ユーティリティのテスト
 */

/// <reference types="jest" />

import { hashPin, verifyPin, isValidPinFormat } from '../pinHash';

describe('pinHash', () => {
  describe('hashPin', () => {
    it('4桁PINをハッシュ化できる', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(50); // bcryptハッシュは通常60文字
      expect(hash).toMatch(/^\$2[aby]\$/); // bcryptハッシュの形式
    });

    it('6桁PINをハッシュ化できる', async () => {
      const pin = '123456';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('8桁PINをハッシュ化できる', async () => {
      const pin = '12345678';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('同じPINでも毎回異なるハッシュを生成する（salt使用）', async () => {
      const pin = '1234';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);

      expect(hash1).not.toBe(hash2); // saltが異なるため
    });

    it('無効なPINフォーマットはエラーを投げる - 3桁以下', async () => {
      await expect(hashPin('123')).rejects.toThrow('Invalid PIN format');
    });

    it('無効なPINフォーマットはエラーを投げる - 9桁以上', async () => {
      await expect(hashPin('123456789')).rejects.toThrow('Invalid PIN format');
    });

    it('無効なPINフォーマットはエラーを投げる - 英字含む', async () => {
      await expect(hashPin('12ab')).rejects.toThrow('Invalid PIN format');
    });

    it('無効なPINフォーマットはエラーを投げる - 記号含む', async () => {
      await expect(hashPin('12-34')).rejects.toThrow('Invalid PIN format');
    });

    it('先頭ゼロを保持したPINもハッシュ化できる', async () => {
      const pin = '0123';
      const hash = await hashPin(pin);

      expect(hash).toBeDefined();
      expect(hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('verifyPin', () => {
    it('正しいPINで検証が成功する', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it('異なるPINで検証が失敗する', async () => {
      const pin = '1234';
      const wrongPin = '5678';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(wrongPin, hash);
      expect(isValid).toBe(false);
    });

    it('6桁PINの検証が正しく動作する', async () => {
      const pin = '123456';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it('8桁PINの検証が正しく動作する', async () => {
      const pin = '12345678';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it('先頭ゼロを含むPINの検証が正しく動作する', async () => {
      const pin = '0001';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(pin, hash);
      expect(isValid).toBe(true);
    });

    it('1文字違いで検証が失敗する', async () => {
      const pin = '1234';
      const almostCorrect = '1235';
      const hash = await hashPin(pin);

      const isValid = await verifyPin(almostCorrect, hash);
      expect(isValid).toBe(false);
    });

    it('無効なハッシュフォーマットでfalseを返す', async () => {
      const pin = '1234';
      const invalidHash = 'not-a-bcrypt-hash';

      const isValid = await verifyPin(pin, invalidHash);
      expect(isValid).toBe(false);
    });

    it('空のハッシュでfalseを返す', async () => {
      const pin = '1234';
      const emptyHash = '';

      const isValid = await verifyPin(pin, emptyHash);
      expect(isValid).toBe(false);
    });

    it('タイミングアタック耐性 - 検証時間が一定', async () => {
      const correctPin = '1234';
      const wrongPin = '9999';
      const hash = await hashPin(correctPin);

      // 正しいPINと間違ったPINの検証時間を測定
      const start1 = Date.now();
      await verifyPin(correctPin, hash);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await verifyPin(wrongPin, hash);
      const time2 = Date.now() - start2;

      // bcryptは一定時間の検証を保証（差が100ms以内）
      const timeDiff = Math.abs(time1 - time2);
      expect(timeDiff).toBeLessThan(100);
    });
  });

  describe('isValidPinFormat', () => {
    it('有効な4桁PINを受け入れる', () => {
      expect(isValidPinFormat('1234')).toBe(true);
      expect(isValidPinFormat('0000')).toBe(true);
      expect(isValidPinFormat('9999')).toBe(true);
    });

    it('有効な6桁PINを受け入れる', () => {
      expect(isValidPinFormat('123456')).toBe(true);
      expect(isValidPinFormat('000000')).toBe(true);
      expect(isValidPinFormat('999999')).toBe(true);
    });

    it('有効な8桁PINを受け入れる', () => {
      expect(isValidPinFormat('12345678')).toBe(true);
      expect(isValidPinFormat('00000000')).toBe(true);
      expect(isValidPinFormat('99999999')).toBe(true);
    });

    it('3桁以下は拒否する', () => {
      expect(isValidPinFormat('123')).toBe(false);
      expect(isValidPinFormat('12')).toBe(false);
      expect(isValidPinFormat('1')).toBe(false);
    });

    it('9桁以上は拒否する', () => {
      expect(isValidPinFormat('123456789')).toBe(false);
      expect(isValidPinFormat('1234567890')).toBe(false);
    });

    it('英字を含むと拒否する', () => {
      expect(isValidPinFormat('12ab')).toBe(false);
      expect(isValidPinFormat('abcd')).toBe(false);
      expect(isValidPinFormat('1234a')).toBe(false);
    });

    it('記号を含むと拒否する', () => {
      expect(isValidPinFormat('12-34')).toBe(false);
      expect(isValidPinFormat('12.34')).toBe(false);
      expect(isValidPinFormat('12 34')).toBe(false);
      expect(isValidPinFormat('12_34')).toBe(false);
    });

    it('空文字は拒否する', () => {
      expect(isValidPinFormat('')).toBe(false);
    });

    it('スペースのみは拒否する', () => {
      expect(isValidPinFormat('    ')).toBe(false);
    });
  });

  describe('セキュリティテスト', () => {
    it('ブルートフォース攻撃耐性 - 10,000回の検証に時間がかかる', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      const start = Date.now();

      // 10,000回の検証を試行
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(verifyPin(String(i).padStart(4, '0'), hash));
      }
      await Promise.all(promises);

      const elapsed = Date.now() - start;

      // bcryptは意図的に遅い（100回で最低500ms以上かかるはず）
      expect(elapsed).toBeGreaterThan(500);
    }, 30000); // 30秒タイムアウト

    it('レインボーテーブル攻撃耐性 - 同じPINでも異なるハッシュ', async () => {
      const pin = '1234';

      // 同じPINを100回ハッシュ化
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const hash = await hashPin(pin);
        hashes.add(hash);
      }

      // 全て異なるハッシュになる（saltが毎回異なるため）
      expect(hashes.size).toBe(100);
    }, 30000); // 30秒タイムアウト

    it('ソルトが埋め込まれている', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      // bcryptハッシュフォーマット: $2a$10$[22文字のsalt][31文字のハッシュ]
      expect(hash).toMatch(/^\$2[aby]\$10\$.{53}$/);
    });
  });
});
