# Adapter Host

The Adapter Host loads adapter manifests, prepares runtime commands, manages adapter lifecycle, and emits normalized Runtime Session events.

## Responsibilities

- Discover installed registry and external adapters.
- Validate adapter manifests against the protocol schemas.
- Resolve runtime surfaces such as ACP stdio, PTY, SDK, gateway, and IDE bridge.
- Start, resume, load, and stop runtime sessions.
- Normalize native runtime messages into LunaAgentOS Runtime Events.
- Expose capabilities to the App without leaking product-specific routing logic into the UI.

## Extraction path

The current App backend already contains working ACP runtime paths for Claude Code and Hermes. The Adapter Host is the seam that will absorb that runtime logic as the contract matures.
