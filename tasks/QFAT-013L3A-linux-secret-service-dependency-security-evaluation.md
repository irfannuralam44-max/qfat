# QFAT-013L3A — Linux Secret Service Dependency and Security Evaluation

- **Status:** READY FOR EXECUTION — Phase A only
- **Authorization:** Owner said “lanjut” on 2026-11-13, authorizing this bounded evaluation only
- **Repository:** `irfannuralam44-max/qfat`
- **Target branch:** `main`
- **Parent proposal:** `docs/proposals/QFAT-013L3-linux-secret-service-production-integration-proposal.md`
- **Parent workstream:** QFAT-013 Linux credential storage
- **Report:** `reports/QFAT-013L3A-linux-secret-service-dependency-security-evaluation.md`

## 1. Objective

Complete Phase A from the QFAT-013L3 proposal: evaluate whether `@napi-rs/keyring@2.1.2` is a suitable and supportable Linux Secret Service client for QFAT, identify material alternatives where necessary, and provide evidence-based recommendations for the owner.

This is an evaluation/documentation task only. It does not authorize dependency adoption or production integration.

## 2. Required reading

Read completely, as relevant:

- `AGENTS.md`
- `docs/AI-DEVELOPMENT-WORKFLOW.md`
- `docs/decisions/ADR-004-temporary-encrypted-local-credential-storage.md`
- `docs/decisions/ADR-005-local-only-verification-no-hosted-ci.md`
- `docs/CREDENTIAL-STORAGE-QFAT-013.md`
- `docs/ARCHITECTURE-QFAT-MVP.md`
- `docs/proposals/QFAT-013L3-linux-secret-service-production-integration-proposal.md`
- `tasks/QFAT-013L2-linux-secret-service-crud-persistence-validation.md`
- `reports/QFAT-013L2-linux-secret-service-crud-persistence-validation-report.md`
- Existing credential provider source and tests, for compatibility context only.

## 3. Scope

### 3.1 Candidate package review

Evaluate the exact candidate `@napi-rs/keyring@2.1.2` using authoritative public sources and record source URLs plus access/retrieval date:

1. Published license and whether the package and distributed native components have compatible, clearly identifiable licensing.
2. Repository ownership, maintainers, release history, issue/PR activity, security policy, and signs of ongoing maintenance.
3. Package provenance and publication integrity signals available from npm/GitHub (for example provenance/attestations, release/tag correspondence, publisher identity, and reproducibility information). State clearly what cannot be verified.
4. Dependency tree and native/prebuilt binary distribution model, supported Linux architectures/libc environments, and runtime requirements.
5. Known vulnerabilities/advisories affecting the exact version and relevant transitive/native dependencies. Distinguish a clean search from proof of absence.
6. Exact documented API for Linux backend pinning, item identity/attributes, create-if-absent behavior, retrieval, deletion, and error surfaces.
7. Secret Service collection behavior: whether the API can select a collection, what default/login collection is used, and behavior when locked, missing, unavailable, or denied.
8. Error classification quality: stable codes/types versus message parsing; identify any ambiguity that would affect fail-closed behavior.
9. Compatibility risks for QFAT's supported Node.js/Linux deployment model.

Do not claim a security guarantee merely because no advisory or issue was found. Cite every material finding with direct source URLs and explain evidence strength.

### 3.2 Alternatives review

Identify at least one credible alternative only if it is materially relevant. Consider (without presuming suitability): another maintained Node.js Secret Service client, a narrow D-Bus integration, or a small native/system helper around the Secret Service API.

Compare alternatives on:
- Maintenance and licensing;
- Native/runtime dependencies and packaging;
- Explicit collection selection;
- Backend pinning and fallback behavior;
- Error semantics and testability;
- Operational complexity and security boundary.

Do not expand into a broad survey of unrelated credential managers or cross-platform Windows solutions.

### 3.3 Decision recommendation

Provide a concise decision matrix and recommendation:

- **Suitable for further implementation design**
- **Suitable only with documented limitations/mitigations**
- **Not recommended**

Address these owner decisions from the proposal with evidence:
1. Candidate dependency choice (or whether a different client should be evaluated).
2. Default/login collection limitation versus explicit collection selection.
3. First-run behavior when the collection is locked: fail with clear instructions versus explicit user-driven unlock/setup.
4. Confirm migration remains a separately invoked future task and the existing key file is retained until a separately approved retirement decision.
5. State whether Phase B can be planned, and list any owner decisions still blocking it.

Do not make these owner decisions on the owner's behalf. Recommendations must be clearly distinguished from decisions requiring owner approval.

## 4. Explicit exclusions and safety boundaries

This task MUST NOT:

- Add, remove, or update dependencies.
- Modify `package.json`, lockfiles, application source, tests, database schema, or migrations.
- Run `npm install`, `npm update`, package scripts, native build scripts, or install candidate packages.
- Access, unlock, create, modify, or delete items in the owner's real desktop keyring.
- Read, copy, migrate, rotate, or delete real credential/key material.
- Use live Google/YouTube/Meta accounts, OAuth tokens, or platform credentials.
- Implement an adapter, wire a provider, create a migration utility, or change runtime behavior.
- Perform Windows work.
- Create, enable, trigger, or rely on GitHub Actions or any hosted CI.

Use public documentation and metadata only. If any local inspection is useful, it must be read-only and must not install or execute the candidate package.

## 5. Acceptance criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Exact package version, published license, repository, release/tag, and publisher details are recorded with authoritative sources. |
| AC-02 | Maintenance and project health are assessed using dated, reproducible evidence rather than unsupported impressions. |
| AC-03 | Native/prebuilt binary model, supported platforms/architectures, runtime requirements, and packaging risks are documented. |
| AC-04 | Exact-version vulnerability/advisory review is recorded, including sources checked and limitations. |
| AC-05 | Backend pinning, collection selection/default behavior, CRUD semantics, and error handling are verified from source/API documentation or explicitly marked unverified. |
| AC-06 | At least one relevant alternative is compared, or the report explains why no credible alternative was found. |
| AC-07 | A reasoned recommendation addresses each of the five owner review questions without making owner decisions. |
| AC-08 | No dependency, source, test, schema, migration, keyring, or credential state is changed. |
| AC-09 | Report contains source URLs, retrieval date, evidence strength, unresolved risks, and exact local verification performed (or states why no runtime checks were appropriate). |
| AC-10 | Changes are limited to this task specification's report/documentation deliverable; no hosted CI is used. |

## 6. Verification and report requirements

This is a research/documentation-only task. Do not run project tests or install packages. Verify documentation changes with read-only Git inspection and, where available, Markdown/link checks that do not install dependencies. Record exact commands and outcomes; mark irrelevant checks as NOT APPLICABLE rather than PASS.

The report must include:
- Status: PASS / PASS WITH FINDINGS / FAIL / BLOCKED.
- Task path, repository, target branch, commit message, and full commit SHA.
- Scope and findings.
- Comparison matrix and recommendation.
- Evidence table with URL, source owner, retrieval date, and what the source establishes.
- Explicit unknowns and limitations.
- Confirmation that no dependencies/source/tests/keyring/credentials were changed or accessed.
- Exact local verification commands and outcomes.
- Required `## Git Publication` section per `docs/AI-DEVELOPMENT-WORKFLOW.md`.
- Handoff for GPT audit; do not claim owner acceptance.

## 7. Stop conditions

Stop and report BLOCKED if:
- Authoritative package/license/provenance data cannot be established sufficiently to support a safe recommendation.
- The exact package version cannot be distinguished from current/latest documentation.
- A source suggests an unreviewed native/system execution path or unexpected network/data-transfer behavior.
- Research would require installing/executing the package or touching the owner's keyring.
- Repository state or task scope conflicts with this specification.

Do not proceed to Phase B. After the report is pushed, stop for GPT audit and owner review.
