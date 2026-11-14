# Call context service

This module retains its legacy package name and `personalAgent` API for installed clients. It no longer registers an Agent preset or injects a base persona.

For any conversation, the Client registers its Session through the `call` stream before microphone admission. Subsequent model requests receive `callPrompt` through System Prompt context. Hangup, disconnect, Session disposal and service unload withdraw registrations; concurrent clients are counted independently. Starting or ending calls neither submits user messages nor starts extra model requests.

Settings → Voice call instructions edits call guidance only. Legacy `basePreset` and `basePrompt` remain for configuration compatibility but are ignored. The existing conversation persona, tools and permissions are preserved.
