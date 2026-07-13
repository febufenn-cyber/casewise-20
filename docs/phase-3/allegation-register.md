# Allegation register contract

An allegation is a source-linked proposition attributed to an alleging party or source. It is not stored as an established fact.

Every active allegation records its proposition, exact source spans, alleging entity when identified, target entities when identified, document context, allegation type, materiality, creation method, processing version, warnings, and review status.

The register must preserve qualified language and negation. Deterministic duplicate proposals require the same alleging entity, target set, and normalized proposition; repeated wording is not treated as independent corroboration.

Corrections preserve previous and new values, mark dependent artifacts stale, and remain attributable to a reviewer. Rejected allegations remain in audit history rather than being silently deleted.
