# Casewise

> upload legal filings or transcripts, agent produces a structured issue summary and drafts a response outline with citations.

**Alternative to the product-shape pioneered by Casetext (YC S13)** — rank #20 of 500 in the [YC-500 Fable 5 Venture Blueprint](https://github.com/) (score 7.05/10).

## Why this exists
Proved lawyers pay for AI that drafts and summarizes case documents. The buildable wedge: deposition/brief summarizer for a single practice area.

## MVP scope
- [ ] Doc upload
- [ ] issue extraction
- [ ] summary
- [ ] outline draft
- [ ] citation list

## Architecture
`Workers+Supabase+Claude` — Cloudflare Workers + Hono API, Supabase (Postgres + RLS + Auth + pgvector), Claude API via Agent SDK (claude-fable-5 for agent reasoning, claude-haiku-4-5 for volume), wrangler deploys.

**Integrations:** Claude; PDF text extract
**Data:** Uploaded filings; summary schema
**Agent core:** Agent reads filings, extracts issues, and drafts a response outline.

## Business
| | |
|---|---|
| Monetization | Per-seat $59-129/month for solo lawyers |
| First customer | Solo litigators and paralegals |
| GTM wedge | Legal content SEO; bar-association newsletters |
| Competition risk | High: CoCounsel, Harvey dominate legal AI |
| Regulatory/trust risk | High: citation hallucination and UPL risk |
| India angle | Indian court filing summarization; regional language angle |
| Difficulty / build time | Medium / 2-3 weeks |

## 30-day plan
- **W1:** core loop — Doc upload + issue extraction
- **W2:** summary + outline draft + citation list + auth + billing
- **W3:** polish, instrument events, seed first users via: Legal content SEO; bar-association newsletters
- **W4:** launch + first revenue; kill/scale decision

---
*Built with Fable 5 (Claude Code). Blueprint row: inspired by Casetext — "AI legal research and CoCounsel assistant for lawyers; acquired by Thomson Reuters."*