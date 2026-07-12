# Initial Risk Register

Scales: likelihood and impact are Low, Medium, High, or Critical. Owners are roles until a team exists.

| ID | Risk | Likelihood | Impact | Early evidence/test | Mitigation or decision | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-001 | Lawyers will not upload permissible matter files | High | Critical | Ask for public, synthetic, redacted, or consented packs during interview | Require pack commitment for design-partner qualification; explore private deployment only if economically viable | Founder | Open |
| R-002 | Generic AI already satisfies the job | Medium | High | Run the same matter workflow with general tools and compare provenance/review time | Differentiate through matter graph, exact citations, coverage, correction lineage, and delta analysis | Product | Open |
| R-003 | OCR corrupts dates, amounts, names, or negations | High | Critical | Adversarial OCR packs and critical-token scoring | Preserve page images/confidence; alternate pass; exception review; block unsupported approval | Engineering | Open |
| R-004 | A real passage is cited for an unsupported conclusion | High | Critical | Claim-support and scope adjudication | Separate location and entailment verification; split compound claims; human review | AI/Evals | Open |
| R-005 | Party allegation is presented as fact | Medium | Critical | Ontology and output review tests | Mandatory assertion attribution and contested status; UI and schema constraints | Product | Mitigated by design |
| R-006 | Cross-matter data leakage | Medium | Critical | Automated isolation, adversarial retrieval, and worker tests | Matter authorization envelope, RLS, retrieval filters, narrow worker credentials | Security | Open |
| R-007 | Processing failure is hidden | Medium | Critical | Corrupt/unsupported file packs | Coverage ledger; no complete status with unresolved failures | Engineering | Open |
| R-008 | Junior time saved increases partner review time | Medium | High | Baseline and post-Casewise review-time measurement | Exception-focused review; source highlighting; kill if net time is negative | Product/Pilot | Open |
| R-009 | Matter types vary too widely | High | High | Compare ontology across design-partner packs | Narrow to commercial litigation/arbitration or a smaller subtype | Product | Open |
| R-010 | Cloud confidentiality concern blocks adoption | High | Critical | Ask buyer and policy owner for non-negotiables | Conservative data policy; provider review; later restricted/private tier only if viable | Founder/Security | Open |
| R-011 | Provider terms conflict with product promise | Medium | Critical | Review retention, training, access, location, deletion, subprocessors | Do not use provider for production until approved; minimize data | Security/Legal | Open |
| R-012 | Processing cost has a heavy tail | High | High | Measure native/OCR/model cost by matter band | Quotas, approval for large packs, bounded retries, page-based pricing | Engineering/Finance | Open |
| R-013 | Product drifts into unauthorized autonomy | Medium | Critical | Review roadmap and marketing against use policy | Constitution, explicit prohibited uses, approval and export states | Product | Mitigated by policy |
| R-014 | Evaluation packs are unrepresentative | High | High | Compare public/synthetic packs against design-partner workflow | Diverse packs, holdout, adversarial cases, reviewer adjudication | Evals | Open |
| R-015 | Design partners are polite but noncommittal | High | High | Require files, repeated sessions, workflow artifacts, or payment | Scorecard and proceed gate; ignore compliments without behavior | Founder | Open |
| R-016 | Corrections do not generalize and become bespoke service | Medium | High | Compare correction categories across packs and firms | Build shared ontology only where repeatable; price concierge work separately; pivot if necessary | Product | Open |
| R-017 | Missing evidence is misrepresented as nonexistent | Medium | Critical | Test absent annexures and out-of-scope documents | Use “not located in processed scope”; display coverage and references | Product/AI | Mitigated by design |
| R-018 | New source versions leave approved output stale | Medium | High | Replace or amend source after approval | Dependency graph, stale state, re-review requirement | Engineering | Open |
| R-019 | Support staff gain routine content access | Low | Critical | Access-control design and support simulation | Deny by default; break-glass approval, expiry, and customer-visible logging | Security | Open |
| R-020 | Customer data enters logs or evaluation accidentally | Medium | Critical | Log and repository scans | Metadata-only logs; environment separation; dataset provenance checks | Security/Evals | Open |
| R-021 | Legal or privacy obligations vary by jurisdiction | High | High | Counsel review before production expansion | Initial narrow geography/use; legal review; configurable lifecycle later | Founder/Legal | Open |
| R-022 | Filing-ready drafting becomes required for sale | Medium | High | Ask buyer to price matter map separately | Do not build unsafe shortcut; test outline only after provenance gates; pivot or kill if autonomy is mandatory | Product | Open |
| R-023 | Source viewer is too slow for practical review | Medium | High | Timed review sessions | Pre-rendered pages, precise highlights, keyboard navigation, cached metadata | Engineering | Open |
| R-024 | Chat interface hides structured omissions | Medium | High | Compare blank-chat behavior to guided workspace | Structured workspace is primary; chat uses same graph and coverage rules | Product | Mitigated by design |

## Review cadence

- review before authorizing Phase 1;
- review at each phase boundary;
- update after material pilot failure, security finding, provider change, or scope change;
- never close a risk solely because a document describes a future mitigation.
