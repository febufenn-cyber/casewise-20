# Secure upload protocol

An authenticated editor requests a matter-scoped upload session. The API creates a random quarantine key and a short-lived HMAC capability. The browser streams the PDF through the Worker to R2. The capability is usable only while the session is `authorized`; successful upload closes it. Finalization verifies object existence and exact size, creates an immutable file record, and prepares it for asynchronous intake.

User filenames never form object keys. Corrected files are new uploads, not overwrites. Normalized and rendered artifacts never replace original identity.
