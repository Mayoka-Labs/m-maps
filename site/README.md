# M Maps download page

Static download page for M Maps, intended for `https://m-maps.mayoka.io/`.

**Status: not deployed.** Nothing in this folder has been published to Cloudflare
Pages, and no DNS record for `m-maps.mayoka.io` has been created. Deploying is a
separate, explicit release decision.

**Do not deploy before the first full release.** The page expects the file
names in the table below. In October 2026 the latest release (v1.0.6) has only
one asset, `M.Maps.dmg`, an Apple silicon build uploaded by hand before the
workflow existed. With JavaScript the page copes (the Apple silicon button
downloads that file and the other cards say "Not in this release yet"), but the
static links used without JavaScript, or when the release lookup fails, point
at the `M-Maps-*` names, which v1.0.6 does not have, and GitHub would answer
them with its not-found page. Deploy only after the first non-pre-release
built by `.github/workflows/macos-release.yml` (with the `M-Maps-*` files) is
published.

## Layout

Only `site/public/` is deployed. These notes stay in `site/` so they are not
published with the page.

| Path | Purpose |
| --- | --- |
| `public/index.html` | The page: inline CSS and JavaScript, the Mayoka mark as inline SVG |
| `public/release.js` | Pure release logic, loaded by the page and by the Node tests |
| `public/404.html` | Not-found page (see below) |
| `public/_headers` | Cloudflare Pages response headers (read by Pages, not served) |
| `public/_redirects` | One-click short links such as `/mac` (read by Pages, not served) |
| `public/assets/` | App icon, favicons, and Apple touch icon |

The page loads no third-party scripts, fonts, stylesheets, analytics, or
cookies. Its own files are referenced with root-relative URLs (`/release.js`,
`/assets/...`) so they resolve from any path.

`404.html` matters on Cloudflare Pages: without a top-level `404.html`, Pages
treats the project as a single-page app and answers every unknown path, such
as `/download/`, with `index.html` and HTTP 200. With it, unknown paths return
a real 404 with a link back to the download page.

## What the page does

The page shows one section at a time: Overview, Downloads, Install, Requirements,
and Privacy. A bar under the current name is the only marker, and choosing
another name changes the section. Each name is a normal link (`#overview`,
`#downloads`, `#install`, `#requirements`, `#privacy`), so this works with
JavaScript turned off. A link to something inside a section, such as
`#install-mac`, opens that section. Overview names the full pack (Mac Apple
silicon, Mac Intel, Windows, Linux, and the Android Companion) and links each
name to its download card.

A download button downloads. It never sends the visitor to a GitHub page.

- Every download link (the hero button, the "Intel Mac?" / "Apple silicon
  Mac?" link beside it, and each card's button) already has GitHub's
  direct-download address for the newest release as its `href`:

  ```text
  https://github.com/Mayoka-Labs/m-maps/releases/latest/download/<exact file name>
  ```

  GitHub answers that address with a redirect to the file itself, so the
  browser starts the download at once. It needs no JavaScript and no API call
  (so no rate limit), and it works for every release made by the workflow. The
  hero button defaults to `M-Maps-arm64.dmg` and the alternate link to
  `M-Maps-x86_64.dmg`; the hint text names both Mac files. The addresses are
  built by `latestDownloadUrl(key)` in `release.js`, and the page only uses
  one that matches `isTrustedLatestDownloadUrl()` (this repository, the
  `latest/download/` path, one plain file name).
- With JavaScript, the browser also asks GitHub's public API for
  `https://api.github.com/repos/Mayoka-Labs/m-maps/releases/latest`
  (unauthenticated, no cookies, no referrer). The answer only adds details and
  tells the page which files the release really contains:
  - the version and publication date (the UTC calendar day, in both the
    visible text and the `<time datetime>` value), with a link to the release
    notes;
  - the Mac DMG for the visitor's Mac first. Chromium browsers report the CPU
    architecture through `navigator.userAgentData.getHighEntropyValues`;
    Safari and Firefox cannot, so Apple silicon leads with an
    "Intel Mac?" link to the Intel DMG beside it;
  - the Windows or Linux package (Beta) on an x86_64 PC, which controls an
    Android phone or an iPhone on iOS 17.4 or later, and the Companion APK on
    an Android phone. An Arm Windows or Linux computer (the
    hosts are x86_64 builds), ChromeOS, or an unrecognized system gets no
    recommendation: the main button reads "See all downloads" and the hint
    explains why;
  - the file size and the SHA-256 of each file when the API returns an asset
    `digest`, otherwise a link to the matching `.sha256` release file;
  - a one-line setup hint for each download, plus requirements, the privacy
    line, and the educational-use note.
  When the API gives an asset, the button uses that asset's exact
  `browser_download_url` (only `releases/download/<tag>/<file>` URLs from this
  repository are ever accepted).
- Legacy release: v1.0.6 contains only `M.Maps.dmg`. When a release has no
  `M-Maps-arm64.dmg` but has `M.Maps.dmg`, that file is the Apple silicon Mac
  download (`macArm`), shown under its real name. It is never used for Intel,
  Windows, Linux, or the APK, and a real `M-Maps-arm64.dmg` always wins.
- A file the release does not contain (for example Intel, Windows, Linux, or
  the APK in v1.0.6) is shown as unavailable once the API has answered: the
  card's button becomes a plain "Not in this release yet" label with no
  `href` (`aria-disabled="true"`), and a calm note explains that the file
  appears as soon as a release includes it. If the recommended file for the
  visitor's device is missing, the hero says so and its button reads "See all
  downloads" (it scrolls to the list); a missing alternate Mac build reads
  "Intel Mac? Not in this release yet". If the API reports no release at all
  (404), every file is shown this way.
- Drafts and pre-releases are never shown (the `latest` endpoint already skips
  them, and the page checks again). When the lookup fails (a rate limit, HTTP
  403/429, a network error, or a bad answer) the page keeps the direct
  `latest/download` links, hides sizes and checksums, and says: "Release
  details could not be loaded right now, so sizes and checksums are not shown.
  The download buttons use the latest release's files."
- Links to GitHub remain only for things that are not downloads: the source
  code, the release notes of the shown version, "All releases", the security
  policy, and the license. The 404 page also links to the latest release.
- Text from the API is only ever written with `textContent`; links are used
  only when they are this repository's `releases/download/<tag>/<file>` URLs
  (or the `releases/latest/download/<file>` redirect above).

### One-click short links

`public/_redirects` gives every download a short address that downloads the
file in one click, with no page in between:

| Short link | Downloads |
| --- | --- |
| `https://m-maps.mayoka.io/mac` | `M-Maps-arm64.dmg` |
| `https://m-maps.mayoka.io/mac-intel` | `M-Maps-x86_64.dmg` |
| `https://m-maps.mayoka.io/windows` | `M-Maps-windows-x86_64.zip` |
| `https://m-maps.mayoka.io/linux` | `M-Maps-linux-x86_64.tar.gz` |
| `https://m-maps.mayoka.io/android` | `M-Maps-android-companion.apk` |

Each one (with or without a trailing slash) is a 302 to the file's
`releases/latest/download/<file>` address, so it always serves the newest
release and needs no redeploy when a release is published. Use them in posts,
the README or anywhere a link has to be short. They exist only once the site is
deployed on Cloudflare Pages (Python's preview server ignores `_redirects`).
`SHORT_LINKS` in `release.js` names the same links; a test keeps the two, and
the page's "One-click links to share" line, in step.

### After a click: Install in three steps

The page has an "Install in three steps" section with one card per platform
(Mac, Windows, Linux, Android Companion) that says what to do once the file has
downloaded: drag to Applications; Extract All, `run_m_maps.bat` and Windows'
"More info, then Run anyway" for the unsigned Beta; `tar -xzf` and
`./MMaps/run_m_maps.sh`; installing the APK and choosing the Mock location app.
It works without JavaScript. With JavaScript, a click on any download (the hero
button, the alternate Mac link, or a card) lets the browser download as usual
and then shows a bar pinned to the bottom of the window, wherever the click
was: "Your download of <file> should start now.", a link to the matching
install card (which is outlined and labelled "Your next step"), "Didn't start?
Download again" with the same file, and a close button (Escape also closes it).
Keyboard focus moves to the bar's "Next" link (without scrolling) and goes back
to the download when the bar is closed, and while the bar shows the page gains
room at the bottom so nothing stays hidden under it. A link that does not download (the "See all downloads" fallback or an
unavailable card) never shows it. `keyForDownloadUrl()` and `INSTALL_GUIDES` in
`release.js` decide which file and which card.

On an iPhone or Android phone the hero also offers "Send this page to your
computer" (an iPhone can be controlled from a Mac, or from a Windows or Linux
PC in Beta with iOS 17.4 or later, and the hint says so): the phone's share sheet, or a copied link where
there is none or the browser refuses it, for `https://m-maps.mayoka.io/`. On an
iPhone it replaces the Mac download button (a DMG cannot be opened there; the
Mac files stay in the list). A computer never sees it.

`release.js` holds the pure release logic (`classifyAssets`, platform
detection, version/size/date formatting). It has no DOM or network access and
works both as a browser script (`window.MMapsRelease`) and as a Node module, so
it can be tested offline.

The asset names it expects come from `.github/workflows/macos-release.yml`:

| Key | Release file | Checksum file |
| --- | --- | --- |
| `macArm` | `M-Maps-arm64.dmg` | `M-Maps-arm64.dmg.sha256` |
| `macIntel` | `M-Maps-x86_64.dmg` | `M-Maps-x86_64.dmg.sha256` |
| `windows` | `M-Maps-windows-x86_64.zip` | `M-Maps-windows-x86_64.zip.sha256` |
| `linux` | `M-Maps-linux-x86_64.tar.gz` | `M-Maps-linux-x86_64.tar.gz.sha256` |
| `apk` | `M-Maps-android-companion.apk` | none (API `digest` only) |

If the workflow renames a file, update `ASSET_NAMES` in `public/release.js`,
the file names and `latest/download` links in `public/index.html`, and this
table together. The legacy `M.Maps.dmg` (v1.0.6) is handled by
`LEGACY_ASSET_NAMES` in `release.js`.

`_headers` adds `frame-ancestors 'none'`, `nosniff`, and a no-referrer policy
on top of each page's own Content-Security-Policy meta tag.

## Content-Security-Policy hashes

The meta CSP in `index.html` and `404.html` allows their inline `<style>` and
`<script>` blocks by SHA-256 hash. After editing a block, recompute the hashes
and paste them into the `style-src` and `script-src` values, otherwise the
browser blocks the changed block:

```sh
python3 - <<'EOF'
import base64, hashlib, re
for page in ("site/public/index.html", "site/public/404.html"):
    html = open(page, encoding="utf-8").read()
    for tag in ("style", "script"):
        match = re.search(r"<%s>(.*?)</%s>" % (tag, tag), html, re.S)
        if match:
            digest = hashlib.sha256(match.group(1).encode()).digest()
            print(page, tag, "'sha256-%s'" % base64.b64encode(digest).decode())
EOF
```

The download-page test checks that the hashes in both pages match.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000 -d site/public
```

Open `http://localhost:8000/`. The page calls the real GitHub API from your
browser (read-only and unauthenticated, limited to 60 requests per hour per IP
address). While the latest release is v1.0.6, you should see the Apple silicon
button download `M.Maps.dmg` and every other card marked "Not in this release
yet".

To check the lookup-failure behaviour, block `api.github.com` in the browser's
developer tools or open the page with JavaScript disabled: every button then
points at its `releases/latest/download/<file>` address. For a release that
has the `M-Maps-*` names those addresses download the file; v1.0.6 has none of
them, so GitHub answers with its not-found page.
Python's server does not use `404.html` or `_redirects`; Cloudflare Pages does.

## Deploying to Cloudflare Pages

Prerequisites: a Cloudflare account that owns the `mayoka.io` zone, Node.js,
and `npx wrangler login` (or a `CLOUDFLARE_API_TOKEN` with Pages edit access).

1. Create the project once:

   ```sh
   npx wrangler pages project create m-maps-site --production-branch main
   ```

2. Deploy the public folder from the repository root:

   ```sh
   npx wrangler pages deploy site/public --project-name m-maps-site --branch main
   ```

   Deploy `site/public`, not `site`: wrangler uploads every file in the folder
   it is given, so deploying `site` would also publish this README at
   `/README.md`.

   Pass `--branch main` (the production branch chosen above). Without it,
   wrangler uses the current git branch, and a branch such as
   `cross-platform-preview` only produces a preview deployment on a
   `*.m-maps-site.pages.dev` address. Wrangler also warns about uncommitted
   changes; deploy from a clean, approved commit.

3. Check the `https://m-maps-site.pages.dev/` address before adding the domain.
   Also open a made-up path such as `/download/` and confirm it returns the
   not-found page, and open `/mac` and `/windows` to confirm each one starts
   its download.

There is no build step. Publishing a new GitHub release does not require a
redeploy, because each visitor's browser reads the latest release at view
time. Redeploy only when files in `site/public/` change.

## Custom domain and DNS

1. In the Cloudflare dashboard, open Workers & Pages, select `m-maps-site`,
   then Custom domains, and add `m-maps.mayoka.io`. Add the domain in Pages
   first; a DNS record alone without this step returns an error page.
2. If `mayoka.io` uses Cloudflare DNS, Cloudflare offers to create the record
   itself: a proxied `CNAME` named `mapp` pointing to `m-maps-site.pages.dev`.
   If the zone's DNS is hosted elsewhere, create that `CNAME` at the DNS host.
3. Wait for the domain to show Active. Cloudflare issues the TLS certificate
   automatically.

`m-maps.mayoka.io` (this page) is separate from `maps.mayoka.io`, the Cloudflare
Worker that serves the Apple MapKit JS bridge to the app. Do not reuse or
change the `maps` record, its Worker route, or its secrets when setting up the
download page.

## Privacy

The page sets no cookies, stores nothing, and uses no analytics. The only
request made by its script goes to `api.github.com`; a download button goes
straight to GitHub's release servers (`github.com`, then GitHub's file host). Cloudflare Pages may keep its standard request logs for the
hosting account. Leave Cloudflare Web Analytics off for this project: it would
inject a beacon script, which the page's Content-Security-Policy blocks and the
page's privacy promise rules out.
