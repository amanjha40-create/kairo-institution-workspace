# Institution API Contract Requirements

This document defines the backend capabilities the Kairo Institution Trust Workspace needs before it can be called production-ready.

It intentionally does not define final URL paths.

## Principles

- The frontend must not guess endpoint paths.
- Backend enforcement is required for every permission and tenant boundary.
- The backend should return only institution-authorized and consent-authorized data.
- Public verification tokens must be treated as secrets and stored hashed at rest.

## Institution signup application

Required request data:

- institution name
- institution type
- institution website
- institution domain
- institution country
- institution city
- primary verification email
- administrator full name
- administrator job title
- administrator work email
- administrator phone, if provided
- acknowledgement flags for terms, privacy, and authority
- verification method selected by the applicant
- optional manual-review note, if permitted

Required response data:

- application ID
- application status
- institution status
- membership status
- whether email is verified
- whether domain is verified
- whether workspace is active
- submitted timestamp
- next required step, if any

## Email verification and domain verification

Required capabilities:

- request institution verification email
- verify email code
- query current email verification state
- query current domain verification state
- initiate or validate DNS/domain verification flow

Security requirements:

- verification codes must expire
- codes must be rate-limited
- repeated failures must be throttled
- codes must not be returned to the frontend after issuance

## Institution approval status

Required response data:

- institution approval status
- membership approval status
- workspace activation status
- review notes safe for the institution admin, if applicable
- timestamps for the latest review state change

The backend must keep these concepts distinct:

- email verified
- domain verified
- institution approved
- membership approved
- workspace active

## Institution login and session

Required capabilities:

- institution sign-in
- sign-out
- current session lookup
- optional session refresh
- session expiry and re-authentication handling

Required session data:

- user ID
- institution ID
- institution name
- membership ID
- role
- account status
- institution workspace status
- expiry information

Security requirements:

- HTTP-only cookie sessions or another approved backend token model
- no trust in browser-editable role or membership data
- server-side institution isolation on every request
- backend session expiry enforcement

## Password reset

Required capabilities:

- request password reset
- validate password reset token
- complete password reset

Security requirements:

- reset tokens must expire
- tokens must be one-time-use
- reset completion must be rate-limited
- tokens must never be stored in plaintext at rest

## Current institution membership

Required response data:

- membership ID
- user ID
- institution ID
- role
- membership status
- invited or accepted timestamps
- last activity or last authenticated timestamp, if available

## Verification request list and detail

Required list data:

- request ID
- reference
- candidate name
- candidate identifier
- requesting organization
- request purpose
- request status
- received timestamp
- due timestamp, if applicable
- assigned reviewer, if applicable
- next action, if applicable
- candidate consent state

Required detail data:

- all list fields
- candidate-submitted claim
- institution record comparison
- exact, partial, no-match, or record-unavailable state
- evidence metadata
- internal notes
- timeline or activity feed

## Claim versus institution-record comparison

Required backend behavior:

- return claim and institution record as separate payloads
- return field-level comparison metadata when available
- preserve exact, partial, no-match, and record-unavailable states
- never auto-approve based on a match alone

## Confirm verification

Required request data:

- request ID
- responder membership ID or server-derived actor
- optional external note
- optional selected fields or confirmation scope, if required

Required response data:

- updated request status
- audit event reference
- updated timeline event

Security requirements:

- only authorized institution members may confirm
- idempotency protection for repeated submissions
- audit logging for actor, time, and outcome

## Report discrepancy

Required request data:

- request ID
- selected discrepancy fields
- factual explanation

Required response data:

- updated request status
- audit event reference
- updated timeline event

Security requirements:

- backend must reject abusive or duplicate submissions where appropriate
- stored language should remain factual and non-defamatory

## Request clarification

Required request data:

- request ID
- requested clarification fields
- message
- whether supporting evidence is requested

Required response data:

- updated request status
- audit event reference
- updated timeline event

## Internal notes

Required capabilities:

- list internal notes for authorized institution members
- add internal note
- optionally edit or resolve notes if approved later

Security requirements:

- internal notes must never leak into public magic-link responses
- note visibility must stay scoped to the institution workspace

## Institution people list and detail

Required list data:

- person ID
- institution relationship state
- trust state
- passport state
- degree or programme summary
- graduation summary
- consent-filtered professional summary fields

Required detail data:

- institution relationship details
- consent-filtered professional profile
- institution credentials
- verification activity
- person timeline

## Consent-filtered professional profile

Required backend behavior:

- return only fields that the individual has consented to share with that institution
- preserve the difference between `Not shared` and `Not available`
- do not send the full Trust Passport and expect the frontend to hide unauthorized fields

Potential fields:

- current title
- current company
- location
- professional licences
- external credentials
- profile last-updated timestamp

## Institution credentials

Required data:

- credential ID
- credential name
- issue date
- last updated timestamp
- current status
- status history
- revocation reason, if applicable

## Verification activity

Required data:

- verification activity ID
- requesting organization
- request date
- reviewer
- status
- result summary
- related verification request ID

## Team list, invite, update, suspend, and remove

Required capabilities:

- team list
- invite member
- resend invite
- update role
- suspend member
- restore member
- remove member

Required data:

- membership ID
- user ID, if activated
- name
- work email
- role
- status
- last active timestamp, if available

Security requirements:

- backend role enforcement for every action
- final active Owner protection
- invite rate limiting
- membership audit logging

## Settings

Required capabilities:

- institution profile read/update
- verification preference read/update
- connection status read
- active session read
- session revocation
- password update or delegated auth settings, if supported

## Magic-link lookup and response

Required lookup response:

- token state: valid, expired, revoked, completed, or invalid
- request reference
- requesting organization
- request purpose
- request date
- candidate consent state
- candidate-submitted claim
- public evidence metadata safe to expose
- expiry timestamp

Required response capabilities:

- confirm
- report discrepancy
- request clarification

Security requirements:

- token hashing at rest
- strict expiry
- replay prevention
- revocation handling
- idempotency or duplicate-submission protection
- no exposure of internal institution notes

## Audit events

Required backend behavior:

- record actor identity
- record institution and membership scope
- record action type
- record request ID or token context
- record timestamp
- record outcome or state transition

## Evidence download authorization

Required behavior:

- authorize evidence access for the specific institution member or valid public token context
- issue expiring URLs
- revoke access when the request or token is revoked or expired

## Cross-cutting security requirements

- institution isolation for every query and mutation
- membership authorization on every request
- backend role enforcement for owner, admin, and reviewer actions
- candidate consent validation before releasing professional information
- token hashing and expiry
- replay prevention for public verification links
- audit logging for security-sensitive actions
- idempotency for verification-response mutations where appropriate
- rate limiting for sign-in, password reset, verification codes, invites, and public token actions
- evidence URL expiry and revocation handling
