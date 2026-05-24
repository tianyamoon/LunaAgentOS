# Security Policy

[中文](./SECURITY.zh-CN.md)

## Supported versions

LunaAgentOS is still evolving quickly. Security fixes, when available, are expected to land on `main` first and may be backported case by case.

The current security policy applies to this repository and its published source code. It does not create support commitments for external runtimes such as Claude Code, Hermes, WSL, IDE products, or third-party services.

## Reporting a vulnerability

Please do not disclose security-sensitive issues in a public GitHub issue.

Preferred path:

1. Use GitHub private vulnerability reporting for this repository if it is enabled.
2. If private reporting is not available yet, contact the maintainers through a private channel before public disclosure.
3. If no private channel is listed, open a minimal issue asking for a private contact path without including exploit details, secrets, or reproduction steps.

When reporting, include:

- affected area or component
- impact summary
- reproduction conditions
- affected version, commit, or branch when known
- whether secrets, local history, runtime credentials, workspace files, or external runtime sessions may be exposed
- any logs, screenshots, or proof-of-concept details that are safe to share privately

Please do not include:

- active secrets, tokens, credentials, cookies, or private keys
- private repository contents that are not needed to understand the issue
- public exploit instructions before maintainers have had a chance to assess the report

## Scope

Examples of issues that may be security-sensitive:

- unintended exposure of local session history
- unsafe handling of runtime credentials or profile configuration
- command execution paths that can be influenced by untrusted input
- path traversal, arbitrary file read/write, or unsafe import/export behavior
- vulnerabilities in the desktop app that affect local workspace confidentiality or integrity

Examples that are usually not security reports:

- feature requests
- general product bugs without confidentiality, integrity, or availability impact
- vulnerabilities only in an external runtime that LunaAgentOS does not control
- missing hardening that cannot be exploited in the current product

## Response expectations

We will aim to acknowledge valid reports promptly, assess impact, and coordinate a responsible disclosure path. Because the project is still early, response times and backports may depend on maintainer availability and issue severity.
