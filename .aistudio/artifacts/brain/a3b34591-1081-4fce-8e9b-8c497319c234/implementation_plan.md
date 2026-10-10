# Implementation Plan: 100% In-Browser Passport & MRZ Scanner with Interactive Cropping

## Problem Statement & Objectives
The user needs a modernized, high-accuracy passport scanner that operates **100% locally in the device browser** with **zero server picture transmission**, featuring:
1. **Interactive In-Browser Image Cropper**: Crop, rotate, zoom, and adjust passport images or camera captures directly on an HTML5 canvas before scanning, including a 1-click "Isolate MRZ Zone" helper.
2. **100% Accuracy Local MRZ Extraction Engine**: Multi-threshold canvas image pre-processing (Otsu & Sauvola binarization, contrast stretching, sharpening for OCR-B font), horizontal projection band extraction, and constrained character whitelisting in Tesseract.js.
3. **ICAO Doc 9303 Mathematical Auto-Repair**: Modulo-10 (7-3-1 weighting) validation on document number, date of birth, expiry date, and composite checksums with single-character mathematical correction.
4. **Universal Name Parser**: Complete support for standard double-chevron (`SURNAME<<GIVEN<NAMES`), natural single-chevron order (`GIVEN NAMES SURNAME`), Arabic family prefixes (`AL-`, `EL-`), and compound multi-word names without character corruption.

---

## Architecture & Data Flow

```
[Camera or File Upload]
        │
        ▼ (Local Browser Memory Only - No Network Upload)
[Interactive Canvas Cropper & Transformer]
  ├── Interactive Bounding Box & Corner Drag Handles
  ├── 90° Incremental Rotation & Fine-Tuning Angle Slider
  ├── Preset Aspect Ratios (Standard Passport Page, Bottom MRZ Zone, Freeform)
  └── High-Resolution Canvas Export
        │
        ▼
[Multi-Pass Local Pre-Processing Pipeline]
  ├── Pass A: Grayscale + Contrast Stretch + Sharpening (Preserves subtle characters)
  ├── Pass B: Otsu Adaptive Binarization (Optimal separation for standard lighting)
  ├── Pass C: Sauvola Local Window Thresholding (Corrects glare and shadow gradients)
  └── MRZ Band Isolation (Detects bottom 2 lines of text)
        │
        ▼
[In-Browser Tesseract.js OCR Engine]
  ├── Restricted Character Whitelist: [A-Z 0-9 <]
  ├── Page Segmentation Mode (PSM 6: Uniform text block)
  └── Raw MRZ Lines Output (Line 1: 44 chars, Line 2: 44 chars)
        │
        ▼
[Deterministic ICAO Doc 9303 Verification & Repair]
  ├── Document Number Checksum (Pos 0-9, weight 7-3-1)
  ├── Date of Birth Checksum (Pos 13-19, weight 7-3-1)
  ├── Expiration Date Checksum (Pos 21-27, weight 7-3-1)
  ├── Composite Checksum (Full string verification)
  ├── Single-Character Mathematical Substitution (0/O, 1/I, 5/S, 8/B, </A)
  └── Robust Name Extraction (Double chevron, single chevron, Arabic patronymics)
        │
        ▼
[Interactive Review UI & Client Form Population]
  ├── Visual MRZ Strip with Color-Coded Checksum Badges
  ├── 1-Click Name Inversion & Field Editing
  └── Seamless Client Creation in Database
```

---

## Detailed Implementation Tasks

### 1. Interactive Client-Side Canvas Cropper Component
- **File**: `src/components/PassportImageCropper.tsx` (New Component)
- **Features**:
  - HTML5 Canvas overlay with smooth touch & mouse drag handles (corners and edges).
  - Rotation tools: 90° clockwise/counter-clockwise buttons plus a fine-tuning level slider (-15° to +15°) to rectify skewed mobile camera captures.
  - Quick Aspect Ratio buttons:
    - **Full ID Page (3:2 / 4:3)**: Automatically encompasses the full identity page.
    - **MRZ Zone Focus (Bottom 25%)**: Instantly crops only the bottom Machine Readable Zone for maximum OCR clarity.
    - **Freeform**: Allows arbitrary bounding box selection.
  - Real-time zoom and pan controls for high-resolution images.
  - "Apply & Scan" button exporting cropped and deskewed pixels directly into the local OCR engine.

### 2. Advanced Local Pre-Processing & Filter Engine
- **File**: `src/services/clientPassportScanner.ts` (Enhancement)
- **Features**:
  - **Otsu Global Binarization**: Computes optimal bimodal threshold to separate OCR-B characters from background security guilloche patterns.
  - **Sauvola Adaptive Local Binarization**: Handles smartphone camera flash glare, shadow gradients, and paper folds.
  - **Horizontal Projection Profile**: Analyzes row pixel densities to isolate the two dense lines of text corresponding to MRZ Line 1 and Line 2, cropping out distracting passport photo borders or coats of arms.
  - Multi-pass execution: If Pass 1 fails ICAO checksums, automatically retry on Pass 2 (adaptive binarization) or Pass 3 (contrast-stretched grayscale) entirely inside browser web workers.

### 3. Strict 100% Local Browser Policy & Privacy Guarantee
- **Files**: `src/services/api.ts`, `src/components/PassportScannerModal.tsx`, `src/components/CreateClientModal.tsx`
- **Features**:
  - Remove all server fallback HTTP calls for passport images; image processing will be strictly client-side to satisfy the zero-server-transmission requirement.
  - Display clear privacy indicators: *"Processed 100% locally in your browser. Document image never leaves your device."*

### 4. Mathematical Modulo-10 Checksum Repair & Enhanced Name Parsing
- **File**: `src/services/clientPassportScanner.ts`
- **Features**:
  - Full implementation of ICAO Doc 9303 Modulo-10 7-3-1 check digit validation on document number, birth date, expiration date, and overall composite checksum.
  - Single-digit auto-repair: If a checksum fails by a known OCR ambiguity (e.g., OCR read `O` instead of `0`, `<` instead of `A`, `S` instead of `5`, `B` instead of `8`), systematically test candidate substitutions and accept the valid checksum match.
  - Clean name parsing:
    - Protect genuine names containing `SS` (`Hussein`, `Hassan`, `Youssef`, `Nasser`), `LL` (`Abdallah`), and tokens ending in `S` (`Ahs`, `Fares`, `Anas`).
    - Parse Arabic tribal prefixes (`Alhalmany`, `Al-Eryani`, `Al-Otaibi`).
    - Support natural order single-chevron lines (`GIVEN NAMES SURNAME`) and double-chevron standard lines.

### 5. UI Integration & Review Workflow
- **File**: `src/components/PassportScannerModal.tsx`
- **Features**:
  - Seamless toggle between:
    - **Upload / Camera View**: Capture or upload source image.
    - **Crop & Adjust View**: Interactive cropping workspace with preview.
    - **Scan & Review View**: Displays extracted identity data, raw MRZ lines, checksum status badges, and field inputs for final confirmation before saving.
  - Fast-action "Re-crop" button if the user wants to adjust the area.

---

## Verification & Testing Plan
1. **Interactive Cropper Testing**:
   - Test mouse and touch drag on desktop and mobile viewports.
   - Test 90° rotation and fine angle rotation slider to ensure clean deskewing.
   - Test "MRZ Zone" 1-click crop preset.
2. **OCR & Checksum Accuracy Testing**:
   - Verify previously reported real passport examples:
     - `P<YEMALHALMANY<<OSAMAH<HUSSEIN<ABDU<AHS<<<<<<<<` -> Full name: `Osamah Hussein Abdu Ahs Alhalmany`.
     - `P<SENSECKSSFATIMATOUCLLLLCLLLLRL<<<<<<<<<<<<` -> Full name: `Fatimatou Seck`.
     - `PCSDNABDELFATAH<ALTAHIR<KHALID<<MOHAMED<<<<<` -> Full name: `Mohamed Abdelfatah Altahir Khalid`.
     - `P<MRTDADALLGUEWAD<<<<<<<<<<<<<<<<<<<<<<<<<<<` -> Full name: `Dadallguewad`.
   - Verify Modulo-10 7-3-1 mathematical check digits on document numbers, birth dates, and expiration dates.
3. **Privacy Audit**:
   - Verify Network tab in browser tools: Confirm 0 bytes of image data are sent to `/api/scan-passport` or any external server.
4. **Build & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation and TypeScript errors.
