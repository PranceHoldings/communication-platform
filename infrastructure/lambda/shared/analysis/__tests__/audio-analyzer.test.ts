/**
 * AudioAnalyzer Unit Tests
 */

import { AudioAnalyzer } from '../audio-analyzer';
import * as fs from 'fs';
import * as path from 'path';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  describe('detectFillerWords', () => {
    it('should detect English filler words', () => {
      const transcript = 'Um, I think, like, you know, it is actually good, basically';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBeGreaterThan(0);
      expect(result.words).toContain('um');
      expect(result.words).toContain('like');
      expect(result.words).toContain('you know');
      expect(result.words).toContain('actually');
      expect(result.words).toContain('basically');
      expect(result.frequency['um']).toBe(1);
      expect(result.frequency['like']).toBe(1);
    });

    it('should detect Japanese filler words', () => {
      const transcript = 'ええと、あの、その、まあ、なんか良いと思います';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBeGreaterThan(0);
      expect(result.words.length).toBeGreaterThanOrEqual(3);
      expect(result.frequency).toBeDefined();
    });

    it('should handle mixed English and Japanese filler words', () => {
      const transcript = 'Um, ええと、I think あの、like、その、you know';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBeGreaterThan(0);
      expect(result.words.length).toBeGreaterThanOrEqual(4);
    });

    it('should return empty result for text without filler words', () => {
      const transcript = 'This is a clean sentence with no filler words.';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBe(0);
      expect(result.words).toHaveLength(0);
    });

    it('should count frequency correctly', () => {
      const transcript = 'um um um like like you know';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.frequency['um']).toBe(3);
      expect(result.frequency['like']).toBe(2);
      expect(result.frequency['you know']).toBe(1);
    });
  });

  describe('calculateSpeakingRate', () => {
    it('should calculate speaking rate correctly', () => {
      const transcript = 'This is a test sentence with exactly ten words here today';
      const duration = 30; // 30 seconds
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      // 10 words / 30 seconds = 0.333 words/sec = 20 WPM
      expect(rate).toBe(20);
    });

    it('should handle 60 second duration', () => {
      const transcript = 'This sentence has exactly five words'; // 5 words
      const duration = 60; // 60 seconds
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      // 5 words / 60 seconds = 5 WPM
      expect(rate).toBe(5);
    });

    it('should calculate normal speaking rate (120-150 WPM)', () => {
      // Average English speaker: ~130 WPM
      const transcript = Array(130).fill('word').join(' '); // 130 words
      const duration = 60; // 1 minute
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(130);
      expect(rate).toBeGreaterThanOrEqual(120);
      expect(rate).toBeLessThanOrEqual(150);
    });

    it('should handle fast speaking rate (180+ WPM)', () => {
      const transcript = Array(180).fill('word').join(' '); // 180 words
      const duration = 60; // 1 minute
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(180);
      expect(rate).toBeGreaterThan(150);
    });

    it('should handle slow speaking rate (<100 WPM)', () => {
      const transcript = Array(80).fill('word').join(' '); // 80 words
      const duration = 60; // 1 minute
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(80);
      expect(rate).toBeLessThan(100);
    });

    it('should return 0 for zero duration', () => {
      const transcript = 'This has some words';
      const duration = 0;
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(0);
    });

    it('should handle empty transcript', () => {
      const transcript = '';
      const duration = 60;
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(0);
    });

    it('should handle whitespace-only transcript', () => {
      const transcript = '   \n\t  ';
      const duration = 60;
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      expect(rate).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should initialize with correct ffmpeg paths', () => {
      const analyzer = new AudioAnalyzer();

      expect(analyzer['ffmpegPath']).toBeDefined();
      expect(analyzer['ffprobePath']).toBeDefined();

      // Should be either Lambda path or system PATH
      expect(
        analyzer['ffmpegPath'] === '/opt/bin/ffmpeg' || analyzer['ffmpegPath'] === 'ffmpeg'
      ).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long transcript', () => {
      const transcript = Array(10000).fill('word').join(' '); // 10,000 words
      const duration = 3600; // 1 hour
      const rate = analyzer['calculateSpeakingRate'](transcript, duration);

      // 10,000 words / 60 minutes = ~167 WPM
      expect(rate).toBeCloseTo(167, 0);
    });

    it('should handle punctuation in filler word detection', () => {
      const transcript = 'Um, like, you know, actually... basically!';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBeGreaterThan(0);
      // Punctuation should not prevent detection
      expect(result.words).toContain('um');
      expect(result.words).toContain('like');
    });

    it('should handle case insensitivity', () => {
      const transcript = 'UM Like YOU KNOW Actually';
      const result = analyzer['detectFillerWords'](transcript);

      expect(result.count).toBeGreaterThan(0);
      // All should be lowercase in result
      expect(result.words.every(word => word === word.toLowerCase())).toBe(true);
    });

    it('should not detect filler words within other words', () => {
      // "umbrella" contains "um", but should not be detected
      const transcript = 'I brought my umbrella today';
      const result = analyzer['detectFillerWords'](transcript);

      // Should not detect "um" from "umbrella"
      expect(result.words).not.toContain('um');
    });
  });

  describe('Performance', () => {
    it('should process large transcript quickly', () => {
      const largeTranscript = Array(5000).fill('This is a test sentence with filler words like um and you know').join(' ');

      const startTime = Date.now();
      const result = analyzer['detectFillerWords'](largeTranscript);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in <100ms
      expect(result.count).toBeGreaterThan(0);
    });

    it('should calculate speaking rate for long audio quickly', () => {
      const largeTranscript = Array(10000).fill('word').join(' ');

      const startTime = Date.now();
      const rate = analyzer['calculateSpeakingRate'](largeTranscript, 3600);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50); // Should complete in <50ms
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('Realistic Scenarios', () => {
    it('should analyze job interview response', () => {
      const transcript = `
        Um, well, I have been working in software development for about 5 years.
        Like, I started as a junior developer, you know, and worked my way up.
        I think, actually, my biggest strength is problem-solving.
        Basically, I enjoy tackling complex challenges and finding efficient solutions.
      `;

      const fillerResult = analyzer['detectFillerWords'](transcript);
      const speakingRate = analyzer['calculateSpeakingRate'](transcript, 30); // 30 seconds

      // Should detect multiple filler words
      expect(fillerResult.count).toBeGreaterThanOrEqual(6);
      expect(fillerResult.words).toContain('um');
      expect(fillerResult.words).toContain('like');
      expect(fillerResult.words).toContain('you know');

      // Speaking rate should be normal (120-150 WPM)
      expect(speakingRate).toBeGreaterThanOrEqual(80);
      expect(speakingRate).toBeLessThanOrEqual(200);
    });

    it('should analyze confident presentation', () => {
      const transcript = `
        Today I will present our quarterly results.
        Revenue increased by 25 percent compared to last quarter.
        We successfully launched three new products.
        Customer satisfaction scores improved significantly.
      `;

      const fillerResult = analyzer['detectFillerWords'](transcript);

      // Confident speaker should have few or no filler words
      expect(fillerResult.count).toBeLessThan(2);
    });

    it('should analyze nervous speaker', () => {
      const transcript = `
        Um, so, like, I was thinking, you know, that we could, er, maybe, sort of,
        try to, um, implement this feature, I mean, if that's, like, okay with everyone.
      `;

      const fillerResult = analyzer['detectFillerWords'](transcript);

      // Nervous speaker should have many filler words
      expect(fillerResult.count).toBeGreaterThanOrEqual(8);
      expect(fillerResult.frequency['um']).toBeGreaterThanOrEqual(2);
    });
  });
});
