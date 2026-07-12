# Isolated PDF processor

The processor receives one HMAC-signed job, downloads one scoped input, writes artifacts only through a scoped capability, and reports an authenticated manifest. It has no Supabase, R2, queue, or model-provider credentials. The container installs qpdf, Poppler, MuPDF, and Tesseract and never executes instructions found in document text.
