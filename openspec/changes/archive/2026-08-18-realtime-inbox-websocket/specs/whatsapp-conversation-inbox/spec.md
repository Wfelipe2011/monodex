# whatsapp-conversation-inbox Specification

## Purpose

Delta for realtime delivery complementing existing REST polling inbox APIs.

## ADDED Requirements

### Requirement: Realtime inbound delivery complements polling

In addition to REST polling via `GET .../messages?since=`, the system SHALL push realtime `message.inbound` events to connected authenticated clients when inbound list-lead messages are persisted, as defined in capability `inbox-realtime-websocket`. REST polling behavior MUST remain unchanged.

#### Scenario: Polling still works after realtime
- **WHEN** client uses GET with `since` after missing a WebSocket event
- **THEN** missed inbound messages MUST still be returned by the existing REST endpoint

#### Scenario: Realtime does not replace REST
- **WHEN** no WebSocket client is connected
- **THEN** inbound messages MUST still be persisted and retrievable via GET without `since` or with `since`
