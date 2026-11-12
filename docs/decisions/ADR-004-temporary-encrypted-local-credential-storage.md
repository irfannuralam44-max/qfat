# ADR-004: Temporary Encrypted Local Credential Storage

- **Status:** OWNER-APPROVED TEMPORARY DECISION
- **Date:** 2026-11-12
- **Related:** PRD-QFAT-MVP.md §4.2, §6.4, §7; QFAT-002R2 decisions #2–#3; QFAT-013
- **Supersedes:** No prior approved credential-storage implementation decision.

## Context

QFAT MVP needs a credential persistence path before Linux Secret Service (LSS) and Windows Credential Vault (WCV) have been validated. The owner explicitly approved a temporary alternative under PRD §6.4: credentials may be stored in the local QFAT SQLite database only when their values are encrypted and the encryption key is stored separately in a local key file.

This is a temporary implementation decision, not a claim that a key file provides the same protection as an OS-protected credential store.

## Decision

1. Store platform credential values in SQLite only as authenticated ciphertext. Never store token plaintext in SQLite, JSON files, logs, Git, API responses, or browser storage.
2. Use application-layer envelope encryption with Node.js built-in cryptography: AES-256-GCM, a cryptographically random 256-bit key, a fresh 96-bit nonce for every encryption, and the authentication tag stored with the ciphertext.
3. Store the key in a separate local key file under an OS-user-specific QFAT configuration directory, separate from the SQLite database location. Do not store the key in SQLite, environment variables, source code, or the repository.
4. Create the key once using an exclusive-create operation and restrictive directory/file permissions or ACLs appropriate to the OS. Never silently regenerate or replace a missing, unreadable, malformed, or invalid key when encrypted credentials already exist.
5. Fail closed if key creation, permission verification, key loading, encryption, decryption, or authentication fails. Do not fall back to plaintext, a machine-ID-derived key, a hardcoded key, or an alternate unapproved storage location.
6. Keep a `CredentialProvider` abstraction so the key-file implementation can later be replaced by an LSS/WCV-backed provider without changing account-management business logic.
7. The later migration to LSS/WCV is a separate task. It must preserve credentials, verify successful migration, and avoid exposing plaintext during migration.

## Security boundary and limitations

- This protects credential values in a copied or exposed SQLite database when the separate key file is not also compromised.
- It does **not** protect against malware or an attacker who can read both the QFAT data and key files, compromise the logged-in OS user, or inspect a running QFAT process.
- File permissions/ACLs are part of the security control. POSIX mode bits must not be assumed to provide Windows ACL protection.
- The implementation must validate the effective access restrictions on each supported OS. If Windows ACLs cannot be reliably restricted and verified with the available implementation, the application must fail closed on that platform and report the limitation; it must not claim cross-platform security based on POSIX `chmod`.
- This is not whole-database encryption. Non-secret account metadata and other SQLite records remain subject to their existing data-protection requirements.
- The owner understands and accepts these temporary limitations pending LSS/WCV validation.

## Consequences

- QFAT can build and test a reusable encrypted credential persistence layer before OS credential-store integration is complete.
- The key file becomes essential local application state. Losing it makes existing encrypted credentials unrecoverable; QFAT must explain this clearly and must not silently create a replacement key.
- Backup/restore procedures must treat the database and key file as separate but jointly required artifacts. Backup UX/policy is not defined by this ADR.
- No live platform credentials, OAuth flows, account connections, or publishing are authorized by this ADR.

## Approval boundary

This ADR records the owner's explicit approval on 2026-11-12 of encrypted SQLite credential values plus a separate local key file as a temporary alternative under PRD §6.4. It authorizes only the bounded QFAT-013 implementation task. It does not approve plaintext storage, a machine-ID-derived key, weakening fail-closed behavior, or skipping later LSS/WCV validation.


## Platform delivery sequence — owner decision (2026-11-12)

The owner has explicitly set a Linux-first delivery sequence:

1. Complete implementation, integration, verification, and readiness work for **Linux** first.
2. Begin **Windows** implementation and host-specific validation only after all Linux work is complete, as a separate platform stage on the owner's Windows PC.
3. Until that later Windows stage, the Windows credential provider must remain fail-closed. Windows ACL support and Windows readiness must not be claimed or treated as a prerequisite for completing Linux work.

This sequencing decision does not change the cryptographic design or weaken the fail-closed requirement. QFAT-013R is limited to Linux hardening. The Windows work is explicitly deferred, not cancelled.
