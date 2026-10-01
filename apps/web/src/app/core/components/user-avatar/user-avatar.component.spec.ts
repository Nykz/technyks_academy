import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { initialsOf } from './user-avatar.component';

describe('initialsOf', () => {
  it('uses the first letters of the first and last names', () => {
    expect(initialsOf('Nikhil Agarwal')).toBe('NA');
    expect(initialsOf('  venkata subramanian raghunathan ')).toBe('VR');
  });

  it('handles single names, empty names and other scripts', () => {
    expect(initialsOf('nikhil')).toBe('N');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf('निखिल अग्रवाल')).toBe('नअ');
  });
});
