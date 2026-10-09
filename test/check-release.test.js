import { describe, expect, it } from 'vitest';

import {
  assertReleaseNotesPresent,
  assertTagMatchesPackageVersion,
  extractChangelogNotes,
  requiresRelease,
  validateRelease,
  validateTaggedRelease,
} from '../scripts/check-release.mjs';

const changelog = `# Changelog

## [1.0.1] - 2026-10-09

### Added

- Baseline.

## [1.0.0] - 2025-08-26

- Initial release.
`;

describe('release gate', () => {
  it('requires a release only for release-relevant files', () => {
    expect(requiresRelease(['README.md'])).toBe(false);
    expect(requiresRelease(['src/index.js'])).toBe(true);
    expect(requiresRelease(['package.json'])).toBe(true);
  });

  it('validates a version bump with non-empty changelog notes', () => {
    expect(() => validateRelease('1.0.0', '1.0.1', changelog)).not.toThrow();
    expect(extractChangelogNotes(changelog, '1.0.1')).toContain('Baseline.');
  });

  it('rejects an unchanged version or empty release notes', () => {
    expect(() => validateRelease('1.0.1', '1.0.1', changelog)).toThrow('package version must change');
    expect(() => assertReleaseNotesPresent('')).toThrow('release notes must not be empty');
  });

  it('validates tags against the package version', () => {
    expect(() => assertTagMatchesPackageVersion('v1.0.1', '1.0.1')).not.toThrow();
    expect(() => validateTaggedRelease({
      tagName: 'v1.0.1',
      packageVersion: '1.0.1',
      changelog,
      releaseNotes: 'Baseline.',
    })).not.toThrow();
  });
});
