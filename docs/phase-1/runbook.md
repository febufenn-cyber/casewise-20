# Phase 1 operations runbook

## Queue backlog

Inspect durable `processing_runs` before queue messages. Never replay jobs for deletion-pending matters. Reissue expired authorization envelopes rather than reusing them.

## Partial processing

Preserve successful pages, record every unreadable or failed page, and keep the file at `partial_success` until resolved or explicitly excluded.

## Deletion failure

Keep access revoked, mark the request `deletion_failed`, retry within the same matter scope, and verify that delayed workers cannot recreate artifacts. Never claim completion before verification.
