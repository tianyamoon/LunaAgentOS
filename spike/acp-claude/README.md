# LunaAgentOS ACP Claude Spike

Backend-only probe: drive Claude through the Agent Client Protocol via
`@agentclientprotocol/claude-agent-acp`, no UI involved.

## Goal

Validate three points before writing any Rust integration:

1. We can spawn the ACP adapter and complete the `initialize` handshake.
2. We can create a session and run a `session/prompt` turn end to end.
3. We can observe structured `session/update` notifications (text chunks,
   tool calls, permission requests).

## Run

```pwsh
cd F:\codes\LunaAgentOS\spike\acp-claude
npm.cmd install
node acp-spike.mjs "what is your name?"
```

Optional second turn (verifies session continuity):

```pwsh
$env:ACP_SECOND_TURN = "1"
node acp-spike.mjs "what is your name?"
```

## Auth

`@agentclientprotocol/claude-agent-acp` reuses Claude Agent SDK auth. If you
already use the local `claude` CLI, the SDK should pick up the same login.
Otherwise set `ANTHROPIC_API_KEY` in the environment before running.

## Notes

- This is throwaway-quality. Once the protocol path is confirmed, the real
  integration moves into the Tauri Rust backend behind the
  `RuntimeSessionManager` abstraction.
- Permission requests are auto-accepted in the spike. Production will route
  them to the LunaAgentOS UI.
