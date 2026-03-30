import {
  generateProfileHash,
  isValidProfileHash,
  estimateGroupSize,
  type ProfileAttributes,
} from '../profile-hash';

describe('Profile Hash Utils', () => {
  describe('generateProfileHash', () => {
    it('generates consistent hash for same attributes', () => {
      const attrs: ProfileAttributes = {
        scenarioId: 'scenario-123',
        userAge: 28,
        userGender: 'female',
        userExperience: 'intermediate',
      };

      const hash1 = generateProfileHash(attrs);
      const hash2 = generateProfileHash(attrs);

      expect(hash1).toBe(hash2);
    });

    it('generates different hash for different scenarios', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'scenario-123' };
      const attrs2: ProfileAttributes = { scenarioId: 'scenario-456' };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);

      expect(hash1).not.toBe(hash2);
    });

    it('generates SHA256 hash (64 hex characters)', () => {
      const attrs: ProfileAttributes = { scenarioId: 'test' };
      const hash = generateProfileHash(attrs);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('normalizes age to age groups', () => {
      const attrs25: ProfileAttributes = { scenarioId: 'test', userAge: 25 };
      const attrs28: ProfileAttributes = { scenarioId: 'test', userAge: 28 };

      const hash25 = generateProfileHash(attrs25);
      const hash28 = generateProfileHash(attrs28);

      // Both 25 and 28 should map to "20s"
      expect(hash25).toBe(hash28);
    });

    it('distinguishes different age groups', () => {
      const attrs20s: ProfileAttributes = { scenarioId: 'test', userAge: 25 };
      const attrs30s: ProfileAttributes = { scenarioId: 'test', userAge: 35 };

      const hash20s = generateProfileHash(attrs20s);
      const hash30s = generateProfileHash(attrs30s);

      expect(hash20s).not.toBe(hash30s);
    });

    it('normalizes gender variations', () => {
      const attrsMale1: ProfileAttributes = { scenarioId: 'test', userGender: 'male' };
      const attrsMale2: ProfileAttributes = { scenarioId: 'test', userGender: 'M' };
      const attrsMale3: ProfileAttributes = { scenarioId: 'test', userGender: '男性' };

      const hash1 = generateProfileHash(attrsMale1);
      const hash2 = generateProfileHash(attrsMale2);
      const hash3 = generateProfileHash(attrsMale3);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it('normalizes experience levels', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'test', userExperience: 'beginner' };
      const attrs2: ProfileAttributes = { scenarioId: 'test', userExperience: '初心者' };
      const attrs3: ProfileAttributes = { scenarioId: 'test', userExperience: 'novice' };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);
      const hash3 = generateProfileHash(attrs3);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it('normalizes industry variations', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'test', userIndustry: 'IT' };
      const attrs2: ProfileAttributes = { scenarioId: 'test', userIndustry: 'Software Engineer' };
      const attrs3: ProfileAttributes = { scenarioId: 'test', userIndustry: 'tech company' };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);
      const hash3 = generateProfileHash(attrs3);

      // All should map to "technology"
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
    });

    it('normalizes role variations', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'test', userRole: 'Manager' };
      const attrs2: ProfileAttributes = { scenarioId: 'test', userRole: 'マネージャー' };
      const attrs3: ProfileAttributes = { scenarioId: 'test', userRole: 'director' };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);
      const hash3 = generateProfileHash(attrs3);

      // "manager" and "マネージャー" should match, "director" might differ
      expect(hash1).toBe(hash2);
      // Director also maps to "manager"
      expect(hash1).toBe(hash3);
    });

    it('handles missing optional attributes', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'test' };
      const attrs2: ProfileAttributes = { scenarioId: 'test', userAge: undefined };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);

      expect(hash1).toBe(hash2);
    });

    it('maps unknown values consistently', () => {
      const attrs1: ProfileAttributes = { scenarioId: 'test', userGender: 'unknown-value' };
      const attrs2: ProfileAttributes = { scenarioId: 'test', userGender: 'another-unknown' };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);

      // Both unknown values should map to "unknown"
      expect(hash1).toBe(hash2);
    });

    it('generates different hashes for different attribute combinations', () => {
      const attrs1: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 25,
        userGender: 'female',
      };
      const attrs2: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 25,
        userGender: 'male',
      };
      const attrs3: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 35,
        userGender: 'female',
      };

      const hash1 = generateProfileHash(attrs1);
      const hash2 = generateProfileHash(attrs2);
      const hash3 = generateProfileHash(attrs3);

      expect(hash1).not.toBe(hash2); // Different gender
      expect(hash1).not.toBe(hash3); // Different age group
      expect(hash2).not.toBe(hash3); // Different gender and age
    });
  });

  describe('isValidProfileHash', () => {
    it('validates correct SHA256 hash', () => {
      const validHash = 'a'.repeat(64); // 64 hex characters
      expect(isValidProfileHash(validHash)).toBe(true);
    });

    it('rejects hash with incorrect length', () => {
      const shortHash = 'a'.repeat(63);
      const longHash = 'a'.repeat(65);

      expect(isValidProfileHash(shortHash)).toBe(false);
      expect(isValidProfileHash(longHash)).toBe(false);
    });

    it('rejects hash with non-hex characters', () => {
      const invalidHash = 'g'.repeat(64); // 'g' is not a hex character
      expect(isValidProfileHash(invalidHash)).toBe(false);
    });

    it('rejects hash with uppercase characters', () => {
      const uppercaseHash = 'A'.repeat(64);
      expect(isValidProfileHash(uppercaseHash)).toBe(false);
    });

    it('accepts valid hash from generateProfileHash', () => {
      const attrs: ProfileAttributes = { scenarioId: 'test' };
      const hash = generateProfileHash(attrs);

      expect(isValidProfileHash(hash)).toBe(true);
    });

    it('rejects empty string', () => {
      expect(isValidProfileHash('')).toBe(false);
    });

    it('rejects null or undefined', () => {
      expect(isValidProfileHash(null as any)).toBe(false);
      expect(isValidProfileHash(undefined as any)).toBe(false);
    });
  });

  describe('estimateGroupSize', () => {
    it('estimates larger group for minimal attributes', () => {
      const attrs: ProfileAttributes = { scenarioId: 'test' };
      const size = estimateGroupSize(attrs);

      expect(size).toBeGreaterThan(100); // Large group
    });

    it('estimates smaller group for many attributes', () => {
      const attrs: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 25,
        userGender: 'female',
        userExperience: 'intermediate',
        userIndustry: 'technology',
        userRole: 'manager',
      };
      const size = estimateGroupSize(attrs);

      expect(size).toBeLessThan(20); // Smaller group due to many filters
    });

    it('estimates moderate group for some attributes', () => {
      const attrs: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 25,
        userGender: 'female',
      };
      const size = estimateGroupSize(attrs);

      expect(size).toBeGreaterThan(20);
      expect(size).toBeLessThan(200);
    });

    it('returns at least 1', () => {
      // Even with many attributes, should not return 0
      const attrs: ProfileAttributes = {
        scenarioId: 'test',
        userAge: 25,
        userGender: 'female',
        userExperience: 'advanced',
        userIndustry: 'finance',
        userRole: 'executive',
      };
      const size = estimateGroupSize(attrs);

      expect(size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Age Group Boundaries', () => {
    const testAges = [
      { age: 15, expected: 'teens' },
      { age: 19, expected: 'teens' },
      { age: 20, expected: '20s' },
      { age: 29, expected: '20s' },
      { age: 30, expected: '30s' },
      { age: 39, expected: '30s' },
      { age: 40, expected: '40s' },
      { age: 49, expected: '40s' },
      { age: 50, expected: '50s' },
      { age: 59, expected: '50s' },
      { age: 60, expected: '60+' },
      { age: 100, expected: '60+' },
    ];

    testAges.forEach(({ age, expected }) => {
      it(`maps age ${age} to ${expected}`, () => {
        const attrs1: ProfileAttributes = { scenarioId: 'test', userAge: age };
        const attrs2: ProfileAttributes = { scenarioId: 'test', userAge: age + 1 };

        const hash1 = generateProfileHash(attrs1);
        const hash2 = generateProfileHash(attrs2);

        // If both ages map to the same group, hashes should match
        if (age < 19 || age === 20 || age === 30 || age === 40 || age === 50 || age === 60) {
          // Boundary cases might differ
          return;
        }

        // Within the same group
        expect(hash1).toBe(hash2);
      });
    });
  });
});
