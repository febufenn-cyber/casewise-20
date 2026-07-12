# PDF processing pipeline

The isolated processor verifies the PDF signature, runs qpdf structural checks, rejects encrypted or over-limit inputs, flags active-content markers, renders canonical PNG pages with MuPDF, extracts native text with Poppler, and runs Tesseract only where native text is sparse. It uploads artifacts with a job-scoped capability and returns an HMAC-authenticated manifest. It has no database, R2, queue, or model-provider credentials. Partial and unreadable results remain visible in the coverage ledger.
