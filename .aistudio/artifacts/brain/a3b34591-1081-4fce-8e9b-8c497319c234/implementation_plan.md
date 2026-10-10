# Pure Algorithmic Embassy-Grade Passport Scanner (100% Deterministic — Zero AI)

Upgrade the passport scanner into an ultra-reliable, pure algorithmic document reader with **zero AI / LLM dependencies**. All image processing, OCR recognition, character error-correction, and data parsing run on deterministic computer vision and official ICAO Doc 9303 mathematical checksum algorithms.

> [!IMPORTANT]
> **Key Architecture Decisions for Review**
> - **Zero AI / No LLM**: Entirely eliminates any Gemini or external AI models. All operations run locally and deterministically using computer vision image processing, strict OCR-B character whitelisting, and mathematical algorithms.
> - **OCR-B Zone Binarization & Deskew**: Specifically targets the bottom 25% Machine Readable Zone (MRZ), applying adaptive binarization, contrast normalization, and aspect ratio calibration tuned exclusively for the standard ICAO OCR-B typeface.
> - **Deterministic ICAO Doc 9303 Modulo-10 Auto-Repair**: Utilizes the official 7-3-1 weighting modulo-10 algorithm to mathematically detect and auto-correct OCR character confusions (e.g. `0` vs `O`, `1` vs `I`, `8` vs `B`, and chevron `<` misread as `K` or `L`).
> - **Strict Token Delimiter Parsing**: Accurately parses compound surnames and given names (e.g. Yemeni, Arabic, Asian naming conventions) by resolving chevron boundary bleed (e.g. fixing `GUBRANK` -> `GUBRAN` while safely preserving names with legitimate K/L letters like `MALIK` or `KHALED`).

---

## 1. Overview & Core Concept

### What It Does
An instant, zero-cost, privacy-first passport scanning engine designed specifically for TD3 machine-readable travel documents. It takes raw passport images from uploads or webcams, applies deterministic image filters to extract the 2-line 44-character MRZ, runs high-contrast OCR constrained strictly to valid ICAO characters (`A-Z`, `0-9`, `<`), verifies every checksum field (Document Number, Date of Birth, Expiry Date, Composite), and auto-corrects optical ambiguities with mathematical certainty.

### Target Audience & Persona
- **Travel Agency Visa Specialists & Admins**: Processing international passports who require fast, private, and deterministic extraction with zero cloud AI latency, zero API costs, and 100% compliance with ICAO Doc 9303 standards.

### Key Value
- **Zero AI Dependency**: Fast, predictable, completely offline-capable, and private.
- **Mathematical Accuracy**: ICAO 7-3-1 check digit formulas guarantee error-free dates and document numbers.
- **Instant Processing**: Real-time extraction in under 1 second without external network round-trips.

---

## 2. User Experience & Visual Design

### Key User Flows

```
┌────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│ 1. Upload or Webcam    │ ───► │ 2. Assisted MRZ Overlay   │ ───► │ 3. Deterministic CV     │
│ High-res passport photo│      │ Visual viewfinder guide   │      │ Crop, Grayscale & Otsu  │
└────────────────────────┘      └──────────────────────────┘      └───────────┬─────────────┘
                                                                              │
                                                                              ▼
┌────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│ 6. Form Auto-Fill      │ ◄─── │ 5. Verified Data Review  │ ◄─── │ 4. ICAO Modulo-10 Engine│
│ Populate client record │      │ Badges: Document, DOB,   │      │ 7-3-1 Checksum repair & │
│ or new visa application│      │ Expiry, Composite Check  │      │ Chevron delimiter parser│
└────────────────────────┘      └──────────────────────────┘      └─────────────────────────┘
```

1. **Upload or Capture**: The user drops a passport photo or positions their document inside the webcam viewfinder.
2. **Assisted MRZ Overlay**: A clear guideline box highlights where the two MRZ lines should sit, ensuring optimal alignment and lighting.
3. **Computer Vision Preprocessing**: The system isolates the lower document zone, applies grayscale conversion, contrast stretching, and Otsu binarization to produce high-contrast black-on-white text.
4. **Modulo-10 Checksum Auto-Repair**: Runs OCR with an OCR-B character whitelist (`A-Z0-9<`). If a check digit fails, the engine tests common optical substitution candidates (`0`/`O`, `1`/`I`, `8`/`B`, `5`/`S`, `2`/`Z`, `<`/`K`/`L`) against the ICAO 7-3-1 formula to mathematically repair the erroneous character.
5. **Verified Inspection Review**: A clean, high-density modal presents the extracted fields with green verification checkmarks (`✓ Document No Checksum`, `✓ DOB Checksum`, `✓ Expiry Checksum`, `✓ Composite Checksum`).
6. **One-Click Auto-Fill**: Allows the user to verify the client profile, check for duplicates in the agency database, or create a visa application.

### Visual Identity & Theme
- **Theme**: High-density enterprise dashboard (`slate-900`, `blue-600`, `emerald-600`).
- **Zero-Pill Restraint**: Checksum indicators and passport metadata display in clean tabular monospace (`font-mono tabular-nums`).
- **Deterministic Status**: Clear status indicators ("MRZ Isolated", "Binarized", "Checksum 100% Passed") giving full transparency into the algorithmic pipeline.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Pure Computer Vision & Local OCR Instead of AI
- **Chosen Approach**: Process images using HTML5 Canvas / Sharp image processing with custom binarization, paired with Tesseract OCR-B configuration (PSM 6, whitelist `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<`).
- **Why**: The user explicitly requested **no AI**. Deterministic computer vision combined with ICAO mathematical checksums provides higher predictability, zero API token cost, zero quota limits, and instant sub-second response times.
- **Alternatives Considered**: AI vision models (Gemini Flash) were completely eliminated per user direction.

### Decision 2: Mathematical 7-3-1 Candidate Substitution Engine
- **Chosen Approach**: For any field where the read checksum digit does not match the computed weighted sum:
  $$\sum (c_i \times w_i) \pmod{10}$$
  the engine tests substitution candidates on each position. Because each position's weight is 7, 3, or 1, and the valid character domain is constrained, single-character misreads have exactly one valid mathematical candidate.
- **Why**: Eliminates human typing errors and OCR font confusions automatically without guessing or using machine learning.

### Decision 3: Precision Chevron Tokenizer for Surnames & Given Names
- **Chosen Approach**:
  - Line 1 format: `P<ISS<<SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<`
  - In OCR outputs, `<` often gets misread as `K` or `L` (e.g. `GUBRAN<<` -> `GUBRANK<` or `GUBRANLK`).
  - The tokenizer cleans trailing noise letters immediately adjacent to `<` sequences while strictly maintaining legitimate names that contain `K` or `L` (such as `MALIK`, `KHALED`, `TARIQ`, `BILAL`).

---

## 4. Technical Architecture & File Plan

### Algorithmic Pipeline Flow
```
Raw Image (Upload/Webcam)
   │
   ├──► 1. Preprocessor (Crop lower 25% MRZ, Grayscale, Contrast Boost, Otsu Binarization)
   │
   ├──► 2. Whitelisted OCR (Engine configured for single uniform text block & OCR-B charset)
   │
   ├──► 3. Line Extractor (Extract exactly two 44-character strings: Line 1 & Line 2)
   │
   ├──► 4. ICAO Doc 9303 Checksum Validator & Repair Loop:
   │       • Doc Number (Positions 1-9) + Check Digit (Pos 10)
   │       • Date of Birth (Positions 14-19) + Check Digit (Pos 20)
   │       • Expiry Date (Positions 22-27) + Check Digit (Pos 28)
   │       • Composite Checksum (Positions 1-10, 14-20, 22-43) + Check Digit (Pos 44)
   │
   ├──► 5. Name & Nationality Tokenizer (Parse Issuing State, Surname, Given Names, Gender)
   │
   └──► 6. Result Delivery (Validated PassportData object with checksum badges)
```

### Components to Update
1. **`src/services/clientPassportScanner.ts`**:
   - Enhance the image binarization pipeline with high-contrast thresholding for MRZ lines.
   - Implement the full ICAO Doc 9303 Modulo-10 checksum calculator and automated single-character substitution repair.
   - Upgrade the regex tokenizer to correctly clean trailing chevron noise while preserving legitimate names with `K` or `L`.
2. **`server/services/passportScanner.ts`**:
   - Replace any lingering AI / Gemini calls with the pure deterministic Sharp image processor and ICAO Doc 9303 parser.
3. **`src/services/api.ts`**:
   - Ensure seamless local deterministic scanning without requiring any external AI API keys or endpoints.
4. **`src/components/PassportScannerModal.tsx`**:
   - Present a clean visual interface showing real-time checksum validation statuses (Doc Number Checksum, DOB Checksum, Expiry Checksum, Composite Checksum).
   - Display raw MRZ lines side-by-side with extracted fields so visa officers can visually verify every character instantly.
