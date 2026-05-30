// Custom Expo config plugin that hardens the iOS Info.plist against
// `expo prebuild --clean`.
//
// Two things kept getting clobbered:
//   1. UIBackgroundModes — the expo-audio plugin sets this to
//      ["audio"] and our `location` entry (needed for the
//      background geofence task) gets dropped. This plugin runs LAST
//      (it's the last entry in app.json's plugins array) so it
//      always gets the final word.
//   2. NSPhotoLibraryUsageDescription / NSCameraUsageDescription —
//      expo-image-picker's plugin should add these from its config,
//      but in practice they sometimes go missing. Belt and suspenders.
//
// To verify the plugin is doing its job, you can run:
//   npx expo prebuild --clean
//   grep -A 3 "UIBackgroundModes" ios/kazetune/Info.plist
// and you should see both "audio" and "location" listed.

const { withInfoPlist } = require('@expo/config-plugins');

const PHOTO_PERMISSION =
  'KazeTune needs access to your photo library so you can add a picture ' +
  'to your pins, playlists, and profile.';

const CAMERA_PERMISSION =
  'KazeTune uses the camera if you want to snap a fresh photo for a ' +
  'pin, playlist cover, or profile picture.';

const withKazetuneInfoPlist = (config) => {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // --- UIBackgroundModes: ensure both audio and location are present.
    const modes = Array.isArray(plist.UIBackgroundModes)
      ? [...plist.UIBackgroundModes]
      : [];
    if (!modes.includes('audio')) modes.push('audio');
    if (!modes.includes('location')) modes.push('location');
    plist.UIBackgroundModes = modes;

    // --- Permission strings: only set if missing so user edits to
    //     the wording in app.json's ios.infoPlist still win.
    if (!plist.NSPhotoLibraryUsageDescription) {
      plist.NSPhotoLibraryUsageDescription = PHOTO_PERMISSION;
    }
    if (!plist.NSCameraUsageDescription) {
      plist.NSCameraUsageDescription = CAMERA_PERMISSION;
    }

    return cfg;
  });
};

module.exports = withKazetuneInfoPlist;
