# Portable SheetPilot HTML

Build with `npm run build:standalone`. The default output is `../SheetPilot.html` relative to this repository. To choose another destination, run `npm run build:standalone -- /path/to/SheetPilot.html`.

The portable edition embeds application JavaScript, styles, fonts, favicon, ExcelJS, and both calculation and import workers. Its workers use bundled classic-worker code in Blob URLs, so they do not need separate worker files or module imports. The original Vite application continues to use its existing module workers and lazy XLSX chunks; the portable transformation applies only in the separate build script.

Download the HTML, then open it in a current Chrome or Edge browser that permits local HTML applications. No Node.js, development server, Excel installation, or API key is needed to use it. Dataset processing remains local. Browsers may handle local-file storage and clipboard permissions differently; downloading full project files provides portable backups, and CSV/XLSX export is available independently of clipboard access.

`npm run test:standalone` runs the same acceptance suite against this edition with browser networking disabled and without starting a web server. The managed cloud Chromium policy blocks direct `file://` navigation. Tests therefore read the file through the authorized filesystem and supply its exact contents as one intercepted loopback document. Any request for another HTTP resource fails the test. The test covers offline calculations, workers, CSV/XLSX import/export, persistence, visual operations, mobile layout, and pipelines; direct local-file opening remains dependent on the user's browser policy.

The standalone file has the same function-level compatibility limits as the main app. See [COMPATIBILITY.md](COMPATIBILITY.md).
