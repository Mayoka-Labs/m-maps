/*
 * M Maps download page: pure release helpers.
 *
 * index.html loads this file as window.MMapsRelease, and Node tests load it
 * with require(). Nothing here touches the DOM or the network, so the rules
 * that decide which GitHub asset is which can be tested offline.
 *
 * Asset names must match the files uploaded by
 * .github/workflows/macos-release.yml (the updater in mmaps/updater.py uses
 * the same exact-name rule for the Mac DMGs).
 *
 * Downloads never need this file or the GitHub API: latestDownloadUrl() gives
 * GitHub's own "latest release" redirect for each exact file name, which
 * answers with the file itself. The API is only used for details (version,
 * date, sizes, SHA-256) and to learn which files a release really contains.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.MMapsRelease = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var REPO = "Mayoka-Labs/m-maps";
  var RELEASES_PAGE = "https://github.com/" + REPO + "/releases/latest";
  // GitHub answers <this base> + <exact asset name> with a redirect to that
  // file in the newest non-pre-release, so the browser downloads it at once.
  var LATEST_DOWNLOAD_BASE = "https://github.com/" + REPO + "/releases/latest/download/";
  var API_LATEST = "https://api.github.com/repos/" + REPO + "/releases/latest";

  // Exact file names published by the tag release workflow.
  var ASSET_NAMES = Object.freeze({
    macArm: "M-Maps-arm64.dmg",
    macIntel: "M-Maps-x86_64.dmg",
    windows: "M-Maps-windows-x86_64.zip",
    linux: "M-Maps-linux-x86_64.tar.gz",
    apk: "M-Maps-android-companion.apk"
  });
  var ASSET_KEYS = Object.freeze(["macArm", "macIntel", "windows", "linux", "apk"]);
  // Release v1.0.6 predates the workflow: its only file, "M Maps.dmg" (GitHub
  // stores the space as a dot), is an Apple silicon build uploaded by hand.
  // It stands in for macArm when the release has no M-Maps-arm64.dmg. It is
  // never used for Intel.
  var LEGACY_ASSET_NAMES = Object.freeze({
    macArm: Object.freeze(["M.Maps.dmg"])
  });
  var CHECKSUM_SUFFIX = ".sha256";
  // Short links served by Cloudflare Pages (site/public/_redirects): each path
  // answers with GitHub's latest-release redirect for one exact file, so
  // https://m-maps.mayoka.io/mac downloads the Mac app in one click.
  var SHORT_LINKS = Object.freeze({
    mac: "macArm",
    "mac-intel": "macIntel",
    windows: "windows",
    linux: "linux",
    android: "apk"
  });
  // Which "Install" guide on the page follows each download.
  var INSTALL_GUIDES = Object.freeze({
    macArm: "mac",
    macIntel: "mac",
    windows: "windows",
    linux: "linux",
    apk: "android"
  });

  // A URL segment that cannot be "." or ".." and has no percent escapes, so
  // a link can only ever point at this repository's release downloads.
  var SEGMENT = "[A-Za-z0-9][A-Za-z0-9._+-]{0,127}";
  var DOWNLOAD_URL = new RegExp(
    "^https://github\\.com/Mayoka-Labs/m-maps/releases/download/" + SEGMENT + "/" + SEGMENT + "$"
  );
  var LATEST_DOWNLOAD_URL = new RegExp(
    "^https://github\\.com/Mayoka-Labs/m-maps/releases/latest/download/" + SEGMENT + "$"
  );
  var RELEASE_TAG_URL = new RegExp(
    "^https://github\\.com/Mayoka-Labs/m-maps/releases/tag/" + SEGMENT + "$"
  );
  var SHA256_DIGEST = /^sha256:([0-9a-fA-F]{64})$/;
  var VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,39}$/;
  // Arm CPU names that appear in Windows and Linux user agents and in
  // navigator.platform ("Linux aarch64", "Linux armv7l", "Windows NT 10.0; ARM64").
  var ARM_NAME = /\b(?:aarch64|arm64|armv[5-9][a-z0-9]*)\b/i;

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function knownName(name) {
    for (var i = 0; i < ASSET_KEYS.length; i++) {
      if (ASSET_NAMES[ASSET_KEYS[i]] === name) {
        return true;
      }
    }
    return false;
  }

  /** File names a download may have in a release: the exact name first, then legacy ones. */
  function acceptedNames(key) {
    var legacy = Object.prototype.hasOwnProperty.call(LEGACY_ASSET_NAMES, key)
      ? LEGACY_ASSET_NAMES[key]
      : [];
    return [ASSET_NAMES[key]].concat(legacy);
  }

  function legacyName(name) {
    for (var i = 0; i < ASSET_KEYS.length; i++) {
      if (acceptedNames(ASSET_KEYS[i]).indexOf(name) > 0) {
        return true;
      }
    }
    return false;
  }

  /** True when url is a release download from this repository for `name`. */
  function isTrustedDownloadUrl(url, name) {
    if (typeof url !== "string" || !DOWNLOAD_URL.test(url)) {
      return false;
    }
    if (typeof name === "string") {
      return url.slice(-(name.length + 1)) === "/" + name;
    }
    return true;
  }

  /**
   * GitHub's "latest release" download redirect for a download key ("macArm",
   * "windows", ...): it needs no API call and downloads the file at once.
   * Returns null for an unknown key.
   */
  function latestDownloadUrl(key) {
    if (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(ASSET_NAMES, key)) {
      return null;
    }
    return LATEST_DOWNLOAD_BASE + ASSET_NAMES[key];
  }

  /** True when url is this repository's latest-release download redirect (for `name`, when given). */
  function isTrustedLatestDownloadUrl(url, name) {
    if (typeof url !== "string" || !LATEST_DOWNLOAD_URL.test(url)) {
      return false;
    }
    if (typeof name === "string") {
      return url.slice(-(name.length + 1)) === "/" + name;
    }
    return true;
  }

  /**
   * The download key ("macArm", "windows", ...) a trusted download URL fetches:
   * a release file of this repository (exact or legacy name) or the
   * latest-release redirect for an exact name. Anything else returns null, so a
   * link to a page or a foreign host never counts as a download.
   */
  function keyForDownloadUrl(url) {
    if (!isTrustedDownloadUrl(url) && !isTrustedLatestDownloadUrl(url)) {
      return null;
    }
    var file = url.slice(url.lastIndexOf("/") + 1);
    for (var i = 0; i < ASSET_KEYS.length; i++) {
      var names = acceptedNames(ASSET_KEYS[i]);
      // The latest-release redirect only ever serves the exact workflow names.
      if (isTrustedLatestDownloadUrl(url) ? names[0] === file : names.indexOf(file) >= 0) {
        return ASSET_KEYS[i];
      }
    }
    return null;
  }

  /** "sha256:<64 hex>" from the GitHub API, returned as lowercase hex, else null. */
  function parseSha256(digest) {
    var match = typeof digest === "string" ? SHA256_DIGEST.exec(digest) : null;
    return match ? match[1].toLowerCase() : null;
  }

  function normalizeAsset(asset) {
    if (!isObject(asset) || typeof asset.name !== "string") {
      return null;
    }
    // Only finished uploads are downloadable; older API payloads omit state.
    if (asset.state !== undefined && asset.state !== "uploaded") {
      return null;
    }
    var url = asset.browser_download_url;
    if (!isTrustedDownloadUrl(url, asset.name)) {
      return null;
    }
    var size = typeof asset.size === "number" && isFinite(asset.size) && asset.size >= 0
      ? asset.size
      : null;
    return {
      name: asset.name,
      url: url,
      size: size,
      sha256: parseSha256(asset.digest),
      checksumUrl: null
    };
  }

  /**
   * Sort a GitHub release's assets into the downloads this page offers.
   *
   * Returns {macArm, macIntel, windows, linux, apk, checksums}. Each download
   * is {name, url, size, sha256, checksumUrl} or null when the release does not
   * contain it. `checksums` maps a download's file name to its `.sha256` asset
   * ({name, url, size}). Unknown, unfinished, or untrusted assets are ignored.
   *
   * A release without M-Maps-arm64.dmg but with the legacy "M.Maps.dmg" (see
   * LEGACY_ASSET_NAMES) reports that file as macArm, under its real name.
   */
  function classifyAssets(release) {
    var result = {
      macArm: null,
      macIntel: null,
      windows: null,
      linux: null,
      apk: null,
      checksums: {}
    };
    var assets = isObject(release) && Array.isArray(release.assets) ? release.assets : [];
    var byName = {};
    for (var i = 0; i < assets.length; i++) {
      var asset = normalizeAsset(assets[i]);
      if (!asset) {
        continue;
      }
      var name = asset.name;
      if (knownName(name) || legacyName(name)) {
        if (!Object.prototype.hasOwnProperty.call(byName, name)) {
          byName[name] = asset;
        }
        continue;
      }
      var suffixAt = name.length - CHECKSUM_SUFFIX.length;
      if (suffixAt > 0 && name.slice(suffixAt) === CHECKSUM_SUFFIX) {
        var target = name.slice(0, suffixAt);
        if (knownName(target) && !Object.prototype.hasOwnProperty.call(result.checksums, target)) {
          result.checksums[target] = { name: name, url: asset.url, size: asset.size };
        }
      }
    }
    for (var k = 0; k < ASSET_KEYS.length; k++) {
      var key = ASSET_KEYS[k];
      var names = acceptedNames(key);
      var found = null;
      for (var n = 0; n < names.length && !found; n++) {
        if (Object.prototype.hasOwnProperty.call(byName, names[n])) {
          found = byName[names[n]];
        }
      }
      if (found && Object.prototype.hasOwnProperty.call(result.checksums, found.name)) {
        found.checksumUrl = result.checksums[found.name].url;
      }
      result[key] = found;
    }
    return result;
  }

  /** The latest-release endpoint already skips drafts and pre-releases; check anyway. */
  function isUsableRelease(release) {
    return isObject(release)
      && release.draft !== true
      && release.prerelease !== true
      && typeof release.tag_name === "string"
      && release.tag_name.length > 0;
  }

  /** "v1.0.6" -> "1.0.6"; anything unexpected -> null (never shown). */
  function releaseVersion(release) {
    if (!isObject(release) || typeof release.tag_name !== "string") {
      return null;
    }
    var version = release.tag_name.trim().replace(/^v/i, "");
    return VERSION.test(version) ? version : null;
  }

  /** The release's own page when it is this repository's, else the latest page. */
  function releasePageUrl(release) {
    var url = isObject(release) ? release.html_url : null;
    return typeof url === "string" && RELEASE_TAG_URL.test(url) ? url : RELEASES_PAGE;
  }

  /** Finder-style decimal sizes: 1 KB = 1000 bytes. */
  function formatBytes(bytes) {
    if (typeof bytes !== "number" || !isFinite(bytes) || bytes < 0) {
      return "";
    }
    if (bytes < 1000) {
      return Math.round(bytes) + (Math.round(bytes) === 1 ? " byte" : " bytes");
    }
    var units = ["KB", "MB", "GB"];
    var value = bytes;
    var unit = -1;
    do {
      value /= 1000;
      unit += 1;
    } while (value >= 999.95 && unit < units.length - 1);
    return (value >= 100 ? value.toFixed(0) : value.toFixed(1)) + " " + units[unit];
  }

  function parseDate(iso) {
    if (typeof iso !== "string" || iso.length === 0) {
      return null;
    }
    var date = new Date(iso);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Human date for an ISO timestamp; "" when it is missing or invalid.
   *
   * The day is the UTC calendar day unless another time zone is passed, so
   * the visible text always names the same day as isoDay() puts in the
   * <time datetime> attribute, whatever the visitor's own time zone is.
   */
  function formatDate(iso, locale, timeZone) {
    var date = parseDate(iso);
    if (!date) {
      return "";
    }
    var options = { year: "numeric", month: "long", day: "numeric", timeZone: timeZone || "UTC" };
    try {
      return date.toLocaleDateString(locale || undefined, options);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  /** "YYYY-MM-DD" (UTC) for a <time datetime> attribute; "" when invalid. */
  function isoDay(iso) {
    var date = parseDate(iso);
    return date ? date.toISOString().slice(0, 10) : "";
  }

  /**
   * Work out the visitor's system from navigator facts.
   *
   * info: {userAgent, platform, maxTouchPoints, uaPlatform, architecture}
   * where uaPlatform is navigator.userAgentData.platform and architecture is
   * the "architecture" high-entropy hint ("arm" or "x86"). Safari exposes no
   * architecture, so a Mac's arch stays null there. On Windows and Linux an
   * Arm CPU named in the user agent or navigator.platform (Firefox on
   * aarch64 Linux, for example) counts when the hint is missing.
   * ChromeOS is reported as "unknown": none of the downloads targets it.
   * Returns {os: "mac"|"windows"|"linux"|"android"|"ios"|"unknown", arch: "arm"|"x86"|null}.
   */
  function detectPlatform(info) {
    var facts = isObject(info) ? info : {};
    var ua = typeof facts.userAgent === "string" ? facts.userAgent : "";
    var platform = typeof facts.platform === "string" ? facts.platform : "";
    var uaPlatform = typeof facts.uaPlatform === "string" ? facts.uaPlatform : "";
    var touchPoints = typeof facts.maxTouchPoints === "number" ? facts.maxTouchPoints : 0;
    var os = "unknown";

    if (/^android$/i.test(uaPlatform) || /Android/i.test(ua)) {
      os = "android";
    } else if (/^iOS$/i.test(uaPlatform) || /iPhone|iPad|iPod/.test(ua)
        || (/Macintosh/.test(ua) && touchPoints > 1)) {
      // iPadOS Safari reports a Mac user agent but has a touch screen.
      os = "ios";
    } else if (/^macOS$/i.test(uaPlatform) || /^Mac/.test(platform) || /Macintosh|Mac OS X/.test(ua)) {
      os = "mac";
    } else if (/^Windows$/i.test(uaPlatform) || /^Win/.test(platform) || /Windows/.test(ua)) {
      os = "windows";
    } else if (/CrOS|Chrome OS|ChromeOS/i.test(ua + " " + uaPlatform)) {
      os = "unknown";
    } else if (/^Linux$/i.test(uaPlatform) || /Linux/.test(platform) || /Linux|X11/.test(ua)) {
      os = "linux";
    }

    var hint = typeof facts.architecture === "string" ? facts.architecture.toLowerCase() : "";
    var arch = null;
    if (hint === "arm" || hint === "arm64") {
      arch = "arm";
    } else if (hint === "x86" || hint === "x86_64") {
      arch = "x86";
    } else if ((os === "windows" || os === "linux") && ARM_NAME.test(ua + " " + platform)) {
      // A Mac user agent always says "Intel", so this is never used for macOS.
      arch = "arm";
    }
    return { os: os, arch: arch };
  }

  /**
   * Which download leads the page. Apple silicon is the default Mac build
   * because Safari cannot report the architecture; "alternate" is the other
   * Mac build where one applies, otherwise null.
   *
   * primary is null when no download fits this device: the Windows and Linux
   * hosts are x86_64 builds, so an Arm PC gets none, and an unknown system
   * (ChromeOS, for example) is not offered a Mac DMG it cannot open. The page
   * then points at the full download list instead.
   */
  function recommendDownload(platform) {
    var os = isObject(platform) ? platform.os : "unknown";
    var arch = isObject(platform) ? platform.arch : null;
    if (os === "mac" && arch === "x86") {
      return { primary: "macIntel", alternate: "macArm", archKnown: true };
    }
    if (os === "mac") {
      return { primary: "macArm", alternate: "macIntel", archKnown: arch === "arm" };
    }
    if ((os === "windows" || os === "linux") && arch === "arm") {
      return { primary: null, alternate: null, archKnown: true };
    }
    if (os === "windows") {
      return { primary: "windows", alternate: null, archKnown: false };
    }
    if (os === "linux") {
      return { primary: "linux", alternate: null, archKnown: false };
    }
    if (os === "android") {
      return { primary: "apk", alternate: null, archKnown: false };
    }
    if (os === "ios") {
      // The Mac app is what controls an iPhone; the page says to get it on a Mac.
      return { primary: "macArm", alternate: "macIntel", archKnown: false };
    }
    return { primary: null, alternate: null, archKnown: false };
  }

  return {
    REPO: REPO,
    RELEASES_PAGE: RELEASES_PAGE,
    API_LATEST: API_LATEST,
    LATEST_DOWNLOAD_BASE: LATEST_DOWNLOAD_BASE,
    ASSET_NAMES: ASSET_NAMES,
    ASSET_KEYS: ASSET_KEYS,
    LEGACY_ASSET_NAMES: LEGACY_ASSET_NAMES,
    SHORT_LINKS: SHORT_LINKS,
    INSTALL_GUIDES: INSTALL_GUIDES,
    keyForDownloadUrl: keyForDownloadUrl,
    classifyAssets: classifyAssets,
    isUsableRelease: isUsableRelease,
    isTrustedDownloadUrl: isTrustedDownloadUrl,
    latestDownloadUrl: latestDownloadUrl,
    isTrustedLatestDownloadUrl: isTrustedLatestDownloadUrl,
    parseSha256: parseSha256,
    releaseVersion: releaseVersion,
    releasePageUrl: releasePageUrl,
    formatBytes: formatBytes,
    formatDate: formatDate,
    isoDay: isoDay,
    detectPlatform: detectPlatform,
    recommendDownload: recommendDownload
  };
}));
