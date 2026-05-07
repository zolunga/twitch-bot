# Twitch Engagement + Moderation Bot MVP

Local Node.js + TypeScript Twitch chat bot that reads Twitch chat with EventSub WebSocket, handles simple engagement commands, calls OpenAI for `!ask`, sends replies through the Twitch Chat Messages API, and logs basic moderation alerts.

## Features

- Twitch EventSub WebSocket connection with reconnect handling.
- `channel.chat.message` subscription for one broadcaster.
- Chat replies through `POST /helix/chat/messages`.
- Commands:
  - `!ping` -> `pong`
  - `!hola` -> greets the viewer
  - `!redes` -> placeholder social links
  - `!ask <question>` -> short OpenAI answer
  - `!help` -> command list
- Basic moderation alerts for repeated messages, promo spam phrases, and suspicious links.
- In-memory cooldowns for AI usage.
- No database.

## Requirements

- Node.js 22+ recommended.
- A Twitch developer application.
- A Twitch user access token for the bot account.
- An OpenAI API key.

## Setup

```bash
npm install
cp .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill `.env`:

```dotenv
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_BOT_ACCESS_TOKEN=your_bot_user_access_token
TWITCH_BOT_USER_ID=your_bot_user_id
TWITCH_BROADCASTER_USER_ID=your_channel_broadcaster_user_id
OPENAI_API_KEY=your_openai_api_key
BOT_USERNAME=your_bot_username
```

Optional:

```dotenv
OPENAI_MODEL=gpt-5.2
```

## Twitch App + Token Notes

1. Create a Twitch app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Set an OAuth redirect URL for your local token flow, for example `http://localhost:3000/auth/twitch/callback`.
3. Generate a **user access token for the bot account**, not an app access token, for this MVP.
4. Required scopes for this implementation:
   - `user:read:chat` to subscribe to `channel.chat.message` with EventSub WebSocket.
   - `user:write:chat` to send messages through the Twitch Chat Messages API.
5. Put the bot account user ID in `TWITCH_BOT_USER_ID`.
6. Put the streamer channel user ID in `TWITCH_BROADCASTER_USER_ID`.

If the bot account is separate from the broadcaster, make sure the broadcaster allows the bot to participate in chat. Making the bot a moderator is usually the simplest local testing path.

Useful official docs:

- [Twitch EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events)
- [Twitch chat authentication](https://dev.twitch.tv/docs/chat/authenticating/)
- [Twitch `channel.chat.message`](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage)
- [Twitch Send Chat Message API](https://dev.twitch.tv/docs/api/reference/#send-chat-message)

## Run Locally

Development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Start built app:

```bash
npm start
```

## Moderation Behavior

The bot does **not** ban or timeout users in v1.

It only logs alerts like:

```text
[MOD ALERT] possible spam from viewer123: suspicious link
```

Detected cases:

- Repeated identical messages from the same user inside a short window.
- Promo phrases:
  - `buy followers`
  - `promote your channel`
  - `viewers guaranteed`
  - `cheap viewers`
- Suspicious links.

## TODO

- OBS integration.
- TTS.
- Memory / viewer context.
- Automatic timeout or ban after a confidence threshold.
- OpenClaw integration for clips/OBS later.
