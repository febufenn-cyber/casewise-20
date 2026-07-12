# Assumptions Register

An assumption remains unvalidated until evidence is linked. Repetition in planning documents does not convert an assumption into a fact.

| ID | Assumption | Evidence needed | Current confidence | Decision if false | Status |
|---|---|---|---|---|---|
| A-001 | Boutique Indian commercial-litigation and arbitration firms are the best first customer | Interviews across users and buyers; pack access; payment signal | Low | Narrow to arbitration, LPO, or another repeatable segment | Open |
| A-002 | Junior associates or senior paralegals perform the initial matter-map work | Workflow observation and actual work products | Medium | Redesign primary user and interface | Open |
| A-003 | Partners will pay to reduce review and rework time | Pilot pricing and procurement discussion | Low | Change buyer, pricing unit, or service model | Open |
| A-004 | A matter map is valuable before final drafting | Output ranking and paid-pilot scope | Medium | Narrow to chronology/delta or reconsider wedge | Open |
| A-005 | English commercial-dispute bundles share enough structure | Compare at least five packs across firms | Low | Narrow document or matter subtype | Open |
| A-006 | Exact page-linked citations materially reduce review time | Timed source-verification sessions | Medium | Rework viewer and review model | Open |
| A-007 | Users can provide permissible evaluation packs | Concrete pack transfer path and permissions | Low | Use public/synthetic packs or pause | Open |
| A-008 | Cloud processing can meet pilot confidentiality requirements | Buyer/security requirements and provider review | Low | Private deployment study or segment change | Open |
| A-009 | OCR quality is sufficient with exception review | Adversarial packs and lawyer adjudication | Low | Restrict supported scans or add stronger OCR/manual service | Open |
| A-010 | Claim-support verification can keep unsupported output below the pilot threshold | Gold annotations and verifier results | Low | Reduce generated prose and increase review constraints | Open |
| A-011 | Net lawyer time saved stays positive after review | Baseline and post-Casewise timing | Low | Improve review UI, narrow task, or kill | Open |
| A-012 | Subscription plus pages or per-matter pricing is acceptable | Buyer interviews and paid pilot | Low | Test alternative packaging | Open |
| A-013 | The original stack direction can satisfy isolation, async processing, and cost needs | Architecture spike and threat tests | Medium | Change components without changing product invariants | Open |
| A-014 | Filing-to-filing delta analysis will produce repeat use | Second-use behavior on later filing | Low | Find another retention loop | Open |
| A-015 | Customers accept explicit uncertainty instead of demanding confident completion | Prototype review sessions | Medium | Improve explanation; reject unsafe market demand | Open |

## Update rule

When evidence changes an assumption:

1. link the evidence;
2. update confidence and status;
3. record the product or architecture consequence;
4. add or amend a decision-log entry when the consequence is material.
