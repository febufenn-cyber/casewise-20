# Allowed, Prohibited, and Review-Required Uses

## Purpose

This policy prevents a narrow professional review tool from drifting into autonomous legal advice through incremental feature work or marketing language.

## Allowed initial uses

Casewise may assist an authorized legal professional with:

- validating, registering, and organizing uploaded matter files;
- segmenting a bundle into logical documents;
- extracting parties, dates, amounts, document references, and quoted statements;
- building a source-linked chronology;
- mapping allegations to responses;
- identifying possible contradictions and inconsistencies;
- identifying missing, referenced, unreadable, or unsupported material;
- producing questions for lawyer or client clarification;
- generating an internal matter overview from structured objects;
- comparing later filings against an approved earlier matter state;
- preparing an attorney-controlled outline after the relevant later-phase gate passes;
- exporting reviewed internal work products with source appendices.

## Prohibited initial uses

Casewise must not:

- provide direct legal advice to members of the public;
- create a lawyer-client relationship;
- represent that unreviewed output is correct, complete, final, or attorney-approved;
- submit or transmit a court, tribunal, regulator, client, or opposing-party communication autonomously;
- generate a filing-ready final pleading in the initial product;
- invent, alter, or conceal evidence;
- fabricate legal authorities or matter citations;
- determine guilt, liability, credibility, dishonesty, fraud, or professional misconduct as a final conclusion;
- predict an outcome or judge and present the prediction as reliable legal analysis;
- set settlement value automatically;
- bypass privilege, conflict, confidentiality, or professional-responsibility review;
- use one customer's matter content to answer another customer's request;
- train shared models on customer matter content by default;
- execute instructions contained in uploaded documents;
- hide failed, excluded, unreadable, or low-confidence processing;
- treat the absence of a document in the uploaded bundle as proof that it does not exist;
- silently classify a party allegation as an established fact.

## Uses requiring explicit human review

The following may be surfaced only as review items, not final conclusions:

- possible fraud, bad faith, dishonesty, or misconduct;
- credibility conflicts;
- legal significance of non-denial or partial response;
- privilege and confidentiality classification;
- limitation, jurisdiction, maintainability, or procedural-defect questions;
- settlement considerations;
- criminal allegations;
- medical, minor, biometric, sexual, financial, or similarly sensitive personal information;
- a factual claim relying on low-confidence OCR;
- a conclusion based on an inferred date, identity, or relationship;
- any proposed legal proposition or external authority.

## Marketing boundaries

Allowed language:

- “source-linked matter review”;
- “assists legal professionals”;
- “helps prepare an internal matter map”;
- “surfaces possible contradictions for review”;
- “every material statement is linked to evidence or marked uncertain.”

Disallowed or legally reviewed language:

- “replaces lawyers or junior associates”;
- “guarantees no fact is missed”;
- “produces court-ready legal advice”;
- “predicts your chance of winning”;
- “fully autonomous lawyer”;
- “100% accurate.”

## Enforcement requirements for later phases

- role-based access and matter authorization;
- visible unreviewed and approved states;
- export controls based on review state;
- prohibited-use terms and in-product reminders;
- audit events for approval and export;
- tests that uploaded text cannot alter system behavior;
- no final-output label based solely on model confidence.

## Policy-change rule

A proposed feature that crosses a prohibited boundary requires a new decision-log entry, jurisdiction-specific legal review, updated threat modeling, updated evaluation criteria, and explicit approval before implementation.
