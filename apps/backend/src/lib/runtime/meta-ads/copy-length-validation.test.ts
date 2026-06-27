import { describe, it, expect } from 'vitest';
import {
  validateCopyLength,
  getCopyLengthRange,
  isCopyLengthValid,
} from '../meta-ads/copy-length-validation';

describe('copy-length-validation', () => {
  describe('validateCopyLength', () => {
    it('should validate short-form copy within range', () => {
      const copy = 'A'.repeat(500);
      const result = validateCopyLength(copy, 'short-form');
      expect(result.valid).toBe(true);
      expect(result.actualLength).toBe(500);
      expect(result.expectedMin).toBe(400);
      expect(result.expectedMax).toBe(600);
    });

    it('should reject short-form copy too short', () => {
      const copy = 'A'.repeat(300);
      const result = validateCopyLength(copy, 'short-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo corto');
    });

    it('should reject short-form copy too long', () => {
      const copy = 'A'.repeat(700);
      const result = validateCopyLength(copy, 'short-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo lungo');
    });

    it('should validate medium-form copy within range', () => {
      const copy = 'A'.repeat(900);
      const result = validateCopyLength(copy, 'medium-form');
      expect(result.valid).toBe(true);
      expect(result.actualLength).toBe(900);
      expect(result.expectedMin).toBe(800);
      expect(result.expectedMax).toBe(1000);
    });

    it('should reject medium-form copy too short', () => {
      const copy = 'A'.repeat(700);
      const result = validateCopyLength(copy, 'medium-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo corto');
    });

    it('should reject medium-form copy too long', () => {
      const copy = 'A'.repeat(1100);
      const result = validateCopyLength(copy, 'medium-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo lungo');
    });

    it('should validate long-form copy within range', () => {
      const copy = 'A'.repeat(1500);
      const result = validateCopyLength(copy, 'long-form');
      expect(result.valid).toBe(true);
      expect(result.actualLength).toBe(1500);
      expect(result.expectedMin).toBe(1200);
      expect(result.expectedMax).toBe(2000);
    });

    it('should reject long-form copy too short', () => {
      const copy = 'A'.repeat(1000);
      const result = validateCopyLength(copy, 'long-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo corto');
    });

    it('should reject long-form copy too long', () => {
      const copy = 'A'.repeat(2500);
      const result = validateCopyLength(copy, 'long-form');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('troppo lungo');
    });
  });

  describe('getCopyLengthRange', () => {
    it('should return correct range for short-form', () => {
      const range = getCopyLengthRange('short-form');
      expect(range.min).toBe(400);
      expect(range.max).toBe(600);
    });

    it('should return correct range for medium-form', () => {
      const range = getCopyLengthRange('medium-form');
      expect(range.min).toBe(800);
      expect(range.max).toBe(1000);
    });

    it('should return correct range for long-form', () => {
      const range = getCopyLengthRange('long-form');
      expect(range.min).toBe(1200);
      expect(range.max).toBe(2000);
    });
  });

  describe('isCopyLengthValid', () => {
    it('should return true for valid copy', () => {
      const copy = 'A'.repeat(500);
      expect(isCopyLengthValid(copy, 'short-form')).toBe(true);
    });

    it('should return false for invalid copy', () => {
      const copy = 'A'.repeat(300);
      expect(isCopyLengthValid(copy, 'short-form')).toBe(false);
    });
  });
});
