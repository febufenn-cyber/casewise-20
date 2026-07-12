# ADR 0002: Signed job authorization envelopes

Every queued job is HMAC-bound to job, organization, matter, file, stage, pipeline version, expiry, and nonce. Consumers verify the signature and re-read stored matter and file state. Dispatch evidence is not permanent authorization. Jobs are rejected after access revocation, deletion, cancellation, expiry, or scope mismatch.
