# Changelog

All notable changes to the Sunmi Printer Simulation Studio project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.1] - 2026-10-06

### Fixed
- **SVG & PNG Export**: Resolved export failures for ESC/POS payloads containing multi-byte commands (`ESC 3 n`, `ESC 2`, `ESC ! 0`, `GS B`) and Unicode box-drawing characters (`┌─┬─┐`, `│`, `└─┴─┘`).
- **Control Character Filtering**: Added strict sanitization of non-printable control characters (`\x00-\x1F`) to prevent illegal XML parsing errors when generating SVG and PNG images.
- **High-DPI Canvas Fallback**: Added guaranteed Canvas-based 2x high-resolution PNG rasterizer ensuring 100% reliable PNG downloads across all browser environments.
- **3D Animation Loop**: Fixed variable shadowing on `animationFrameId` in `Sunmi3DPrinter` and added direct fallback button to switch to 2D view on hardware acceleration failure.

---

## [1.2.0] - 2026-10-06

### Added
- **Flat Receipt Page**: Brand new, distraction-free flat receipt viewing page with clean layout and anti-clutter design.
- **Export Suite**: Comprehensive export actions on the flat receipt page including high-resolution 2x PNG download, crisp scalable SVG export, direct thermal print / PDF preview via `@media print`, formatted HTML code copy, clean plain text extraction, and raw ESC/POS `.bin` binary download.
- **Paper Finish & Theme Picker**: Added paper finish options (Pure White Thermal, Warm Cream POS Paper, and Inverted Monochromatic Dark mode).
- **Responsive Zoom & Scale**: Added responsive zoom levels (60% to 180%) with instant 100% reset.
- **Collapsible Quick Edit Drawer**: Slide-over content editor allowing real-time ESC/POS payload adjustments without cluttering the main document view.
- **Toast Notification Feedback**: Non-blocking toast alerts for copy and export operations.
- **What's New Modal**: Integrated changelog viewer accessible via the version badge in the application footer.

### Changed
- Standardized top navigation bar with clean segmented switching between "Studio" and "Flat Receipt".
- Enhanced printer media styles (`@media print`) so printing formats receipt paper directly without surrounding UI chrome.
- Refined typography hierarchy following the frontend design constitution (zero-pill metadata discipline, authentic thermal monospace layout).

---

## [1.1.0] - 2026-08-10

### Added
- Consistent `outputType` parameter handling across server endpoints, ServiceWorker API, and client interceptor (`base64`, `svg`, `html`, `dataurl`, `all`).
- OpenAPI 3.0 specification endpoint (`/api/openapi.json`) and interactive Swagger UI documentation at `/docs`.
- E-commerce & POS webhook endpoint (`/api/webhook`) converting JSON orders to ESC/POS receipts.

---

## [1.0.0] - 2026-04-29

### Added
- Initial release of Sunmi Printer Simulation Studio by Suhail Akhtar.
- 3D interactive Sunmi thermal printer with physical paper feed and guillotine blade cutting.
- ESC/POS escape code parser supporting text styles, barcodes, cash drawer kick pulses, and buzzer beeps.
- Standalone PWA offline support with Service Worker caching.
