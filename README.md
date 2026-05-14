# Twitch Engagement + Moderation Bot MVP

Local Node.js + TypeScript Twitch chat bot that reads Twitch chat with EventSub WebSocket, handles simple engagement commands, calls OpenAI for `!ask`, sends replies through the Twitch Chat Messages API, and logs basic moderation alerts.

## Features

- Twitch EventSub WebSocket connection with reconnect handling.
- `channel.chat.message` subscription for one broadcaster.
- Chat replies through `POST /helix/chat/messages`.
- Commands:
  - `!ping` -> `pong`
  - `!hola` -> greets the viewer
  - `!redes` -> social links loaded from `SOCIAL_LINKS_MESSAGE`; use `||` to send multiple chat messages
  - `!ask <question>` -> short OpenAI answer
  - `!sounds` -> lists enabled OBS sounds
  - `!sound <name>` -> broadcaster/mods play a sound for free; viewers must use Bits, for example `cheer50 !sound risa`
  - `!sound stop` -> broadcaster/mods stop all enabled sound media sources
  - `!help` -> command list
- Channel Points reward support for a custom reward named `Reproducir sonido`; the reward input is treated as the sound name.
- OBS WebSocket media-source control with one OBS media source per sound.
- Basic moderation alerts for repeated messages, promo spam phrases, and suspicious links.
- `!ask` abuse guard for long, expensive, prompt-injection, and unsafe requests.
- Configurable bot personality and stream context for OpenAI replies.
- Short in-memory chat memory for recent non-command messages.
- Twitch stream context lookup for title, category/game, tags, live state, and viewer count.
- Optional engagement reminder that only posts when chat has been active recently.
- First-chat welcome messages for viewers first seen in persistent viewer memory.
- Persistent viewer memory in local JSON.
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
TWITCH_BROADCASTER_ACCESS_TOKEN=your_broadcaster_user_access_token_for_channel_points
TWITCH_BOT_USER_ID=your_bot_user_id
TWITCH_BROADCASTER_USER_ID=your_channel_broadcaster_user_id
OPENAI_API_KEY=your_openai_api_key
BOT_USERNAME=your_bot_username
```

Optional:

```dotenv
OPENAI_MODEL=gpt-5.2
BOT_PERSONALITY=Eres ZolungaBot, compa relajado del stream. Respondes en espanol casual, con humor seco, breve y sin exagerar.
STREAM_CONTEXT=El canal habla de gaming, desarrollo, IA y proyectos creativos. Ayuda a mantener el chat activo.
SOCIAL_LINKS_MESSAGE=Discord: https://example.com/discord || Instagram: https://example.com/instagram || TikTok: https://example.com/tiktok
SOCIAL_LINKS_MESSAGE_DELAY_MS=2500
ALLOW_BOT_SELF_MESSAGES=false
ENGAGEMENT_REMINDERS_ENABLED=true
ENGAGEMENT_REMINDER_INTERVAL_MINUTES=30
ENGAGEMENT_ACTIVE_CHAT_WINDOW_MINUTES=10
ENGAGEMENT_REMINDER_MESSAGE=Estoy por aqui tambien: usa !help para ver comandos, o !ask <pregunta> para preguntarme algo corto.
WELCOME_FIRST_CHAT_ENABLED=true
WELCOME_FIRST_CHAT_COOLDOWN_SECONDS=90
WELCOME_FIRST_CHAT_MESSAGES=Bienvenido @{username}, que gusto verte por aqui. Usa !help si quieres ver comandos. || Hey @{username}, bienvenido al chat. Ponte comodo y disfruta el stream. || Buenas @{username}, llegaste justo a tiempo.
MEMORY_RECENT_CHAT_MESSAGES=20
MEMORY_PROMPT_CHAT_MESSAGES=8
STREAM_CONTEXT_CACHE_MINUTES=2
OBS_WEBSOCKET_URL=ws://127.0.0.1:4455
OBS_WEBSOCKET_PASSWORD=
OBS_REQUEST_TIMEOUT_MS=5000
SOUND_GLOBAL_COOLDOWN_MS=10000
SOUND_PER_USER_COOLDOWN_MS=60000
SOUND_REWARD_TITLE=Reproducir sonido
SOUND_REGISTRY_JSON=[{"name":"risa","obsSourceName":"risa","minBits":50,"enabled":true}]
```

`SOUND_REGISTRY_JSON` maps public chat names to OBS media input names and minimum Bits cost:

```json
[
  {
    "name": "risa",
    "obsSourceName": "risa",
    "minBits": 50,
    "enabled": true
  }
]
```

## Twitch App + Token Notes

1. Create a Twitch app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Set an OAuth redirect URL for your local token flow, for example `http://localhost:3000/auth/twitch/callback`.
3. Generate a **user access token for the bot account**, not an app access token, for this MVP.
4. Required scopes for this implementation:
   - `user:read:chat` to subscribe to `channel.chat.message` with EventSub WebSocket.
   - `user:write:chat` to send messages through the Twitch Chat Messages API.
   - `channel:read:redemptions` to subscribe to Channel Points custom reward redemption events.
5. Put the bot account user ID in `TWITCH_BOT_USER_ID`.
6. Put the streamer channel user ID in `TWITCH_BROADCASTER_USER_ID`.
7. If the bot account is not the broadcaster account, put a broadcaster-owned token in `TWITCH_BROADCASTER_ACCESS_TOKEN` with `channel:read:redemptions` or `channel:manage:redemptions`.

If the bot account is separate from the broadcaster, make sure the broadcaster allows the bot to participate in chat. Making the bot a moderator is usually the simplest local testing path.

Useful official docs:

- [Twitch EventSub WebSocket](https://dev.twitch.tv/docs/eventsub/handling-websocket-events)
- [Twitch chat authentication](https://dev.twitch.tv/docs/chat/authenticating/)
- [Twitch `channel.chat.message`](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage)
- [Twitch Channel Points redemption EventSub](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchannel_points_custom_reward_redemptionadd)
- [Twitch Send Chat Message API](https://dev.twitch.tv/docs/api/reference/#send-chat-message)
- [Twitch Get Channel Information API](https://dev.twitch.tv/docs/api/reference/#get-channel-information)
- [Twitch Get Streams API](https://dev.twitch.tv/docs/api/reference/#get-streams)

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

Messages that trigger a moderation alert are not passed to engagement features. They will not be stored in chat memory, will not activate reminders, will not trigger first-chat welcomes, and will not run commands.

## AI Ask Guard

Before calling OpenAI, `!ask` rejects requests that are likely to waste tokens or abuse the bot:

- More than 240 characters.
- More than 45 words.
- Prompt-injection attempts like asking the bot to ignore system instructions.
- Attempts to reveal hidden prompts or internal instructions.
- Very large generation requests such as full apps, essays, books, or long scripts.
- Obviously unsafe requests involving phishing, malware, credential theft, or exploits.

Rejected `!ask` messages do not call OpenAI.

## Personality + Memory

The bot does not get persistent memory automatically from OpenAI. This MVP has two memory layers:

- Short in-memory chat context for `!ask`.
- Persistent viewer memory in `data/viewers.json`.

The chat context keeps a small in-memory list of recent non-command chat messages and sends only the latest few to OpenAI during `!ask`.

This memory:

- Helps answers react to the current chat vibe.
- Is not stored on disk.
- Is lost when the bot restarts.
- Excludes command messages like `!ping` and `!ask`.

The persistent viewer memory stores basic viewer metadata:

- user ID,
- username/login,
- first seen time,
- last seen time,
- message count,
- command count,
- welcomed time if the bot sent a welcome.

`data/viewers.json` is ignored by git because it contains real chat activity.

Configure personality and static channel context with:

```dotenv
BOT_PERSONALITY=Eres ZolungaBot, compa relajado del stream. Respondes en espanol casual, con humor seco, breve y sin exagerar.
STREAM_CONTEXT=El canal habla de gaming, desarrollo, IA y proyectos creativos. Ayuda a mantener el chat activo.
MEMORY_RECENT_CHAT_MESSAGES=20
MEMORY_PROMPT_CHAT_MESSAGES=8
```

## Twitch Stream Context

For `!ask`, the bot also fetches Twitch context and passes it to OpenAI:

- Stream title.
- Category/game.
- Tags.
- Whether the channel is live.
- Viewer count when live.

The data is cached for `STREAM_CONTEXT_CACHE_MINUTES` to avoid calling Twitch too often. Twitch's `Get Channel Information` and `Get Streams` endpoints work with an app access token or user access token, so the existing bot token is enough for this read-only context.

## Engagement Reminder

The bot can post a light reminder that it exists, but only if chat has been active recently.

Defaults:

- Checks every 30 minutes.
- Sends only if a non-command viewer message happened in the last 10 minutes.
- Does not send when chat is quiet.

Configure it with:

```dotenv
ENGAGEMENT_REMINDERS_ENABLED=true
ENGAGEMENT_REMINDER_INTERVAL_MINUTES=30
ENGAGEMENT_ACTIVE_CHAT_WINDOW_MINUTES=10
ENGAGEMENT_REMINDER_MESSAGE=Estoy por aqui tambien: usa !help para ver comandos, o !ask <pregunta> para preguntarme algo corto.
```

## First-Chat Welcomes

The bot can welcome a viewer the first time it sees them chat in persistent viewer memory.

Important: this starts tracking from the moment `data/viewers.json` exists. It cannot know older chat history from before the bot started tracking.

Defaults:

- Enabled.
- Ignores command-only first messages like `!help`.
- Uses a global cooldown of 90 seconds to avoid spam if many new users arrive together.
- Supports `{username}` in welcome messages.
- Picks one random welcome template from `WELCOME_FIRST_CHAT_MESSAGES`.
- Does not call OpenAI for welcomes.
- Does not run for messages flagged by moderation.

Configure it with:

```dotenv
WELCOME_FIRST_CHAT_ENABLED=true
WELCOME_FIRST_CHAT_COOLDOWN_SECONDS=90
WELCOME_FIRST_CHAT_MESSAGES=Bienvenido @{username}, que gusto verte por aqui. Usa !help si quieres ver comandos. || Hey @{username}, bienvenido al chat. Ponte comodo y disfruta el stream. || Buenas @{username}, llegaste justo a tiempo.
```

## TODO

- TTS.
- Automatic timeout or ban after a confidence threshold.
- OpenClaw integration for clips/OBS later.
