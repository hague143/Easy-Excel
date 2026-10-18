# Download SheetPilot

- [Download the standalone HTML](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/SheetPilot.html)
- [Download the HTML as a ZIP](https://github.com/hague143/Easy-Excel/raw/refs/heads/main/downloads/SheetPilot-HTML.zip)
- [Download all source code](https://github.com/hague143/Easy-Excel/archive/refs/heads/main.zip)

Extract the ZIP and open `SheetPilot.html` in a current Chrome or Edge browser. It contains the application, fonts, calculation workers, and CSV/XLSX support; no installation, API key, or development server is needed. Browser or organization policy can restrict local HTML applications. For source installation, see the [project README](../README.md).

The portable edition passed the 16 acceptance workflows with networking disabled. The cloud browser blocks direct `file://` navigation, so those tests use the exact HTML contents through an intercepted loopback document and reject additional asset requests. See [standalone validation details](../docs/STANDALONE.md).
