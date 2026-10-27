import { version } from '../package.json';

// The project's TypeScript config has no Node types; Jest runs from the root
const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const read = (path: string) => readFileSync(path, 'utf8');

// package.json holds the one app version; every target must report it
describe('app version', () => {
  it('Android takes its versionName from package.json', () => {
    const gradle = read('android/app/build.gradle');
    expect(gradle).toMatch(
      /versionName new groovy\.json\.JsonSlurper\(\)\.parse\(file\("\.\.\/\.\.\/package\.json"\)\)\.version/,
    );
    expect(gradle).not.toMatch(/versionName\s+"/);
  });

  it('every iOS/tvOS build configuration has the same version', () => {
    const versions = [
      ...read('ios/TvPhotoGallery.xcodeproj/project.pbxproj').matchAll(
        /MARKETING_VERSION = ([^;]+);/g,
      ),
    ].map(m => m[1]);
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([version]));
  });

  it('the build numbers agree', () => {
    const code = /versionCode (\d+)/.exec(
      read('android/app/build.gradle'),
    )?.[1];
    const builds = [
      ...read('ios/TvPhotoGallery.xcodeproj/project.pbxproj').matchAll(
        /CURRENT_PROJECT_VERSION = ([^;]+);/g,
      ),
    ].map(m => m[1]);
    expect(builds.length).toBeGreaterThan(0);
    expect(new Set(builds)).toEqual(new Set([code]));
  });
});
