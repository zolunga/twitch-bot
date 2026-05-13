# Twitch Bot Repo Skills

Use this guide when working on this repository. The project is a local Node.js + TypeScript Twitch chat bot MVP for streamer engagement, basic moderation, and OpenAI-assisted chat responses.

## Project Snapshot

- Runtime: Node.js with TypeScript ESM.
- Entry point: `src/main.ts`.
- Build output: `dist/`.
- Package scripts:
  - `npm run dev` starts `tsx watch src/main.ts`.
  - `npm run build` runs `tsc`.
  - `npm start` runs `node dist/main.js`.
- No database in v1. Short chat context is in memory; viewer metadata is persisted to local JSON.
- Secrets live in `.env`; never commit `.env`.

## Core Architecture

- `src/config.ts`
  - Loads `.env` with `dotenv`.
  - Validates required Twitch/OpenAI variables.
  - Defines optional feature flags, cooldowns, command messages, memory limits, stream cache TTL, and engagement messages.

- `src/main.ts`
  - Wires all services together.
  - Receives chat messages from EventSub.
  - Ignores empty messages and, by default, ignores messages from the bot itself.
  - Runs moderation before memory, engagement, welcomes, and command handling.
  - Skips engagement and memory updates for messages flagged by moderation.

- `src/twitch/eventsub.ts`
  - Connects to Twitch EventSub WebSocket.
  - Handles `session_welcome`, `session_keepalive`, `session_reconnect`, notifications, revocations, and reconnects.
  - Subscribes to `channel.chat.message`.

- `src/twitch/chat.ts`
  - Sends messages to Twitch chat with `POST /helix/chat/messages`.
  - Uses `TWITCH_BOT_ACCESS_TOKEN`, `TWITCH_CLIENT_ID`, broadcaster ID, and bot user ID.

- `src/twitch/api.ts`
  - Fetches current stream/channel context.
  - Uses `GET /helix/channels` for title, game/category, and tags.
  - Uses `GET /helix/streams` for live state, viewer count, and live metadata.
  - Caches results using `STREAM_CONTEXT_CACHE_MINUTES`.

- `src/twitch/auth.ts`
  - Validates the bot user access token against Twitch.

- `src/commands/index.ts`
  - Implements chat commands:
    - `!ping`
    - `!hola`
    - `!redes`
    - `!ask <question>`
    - `!help`
  - Applies global AI cooldown and per-user `!ask` cooldown.
  - Loads the `!redes` response from `SOCIAL_LINKS_MESSAGE`.
  - Splits `SOCIAL_LINKS_MESSAGE` by `||` or `\n` and sends each segment as a separate chat message.
  - Runs `inspectAskQuestion` before calling OpenAI.
  - Adds recent chat memory and Twitch stream context to OpenAI calls.

- `src/openai/client.ts`
  - Wraps the official `openai` SDK.
  - Generates short answers for `!ask`.
  - Converts OpenAI API failures into `OpenAiUnavailableError` to avoid noisy raw error handling in command code.

- `src/moderation/rules.ts`
  - Detects repeated messages from the same user.
  - Detects promo phrases like `buy followers`, `promote your channel`, `viewers guaranteed`, and `cheap viewers`.
  - Detects suspicious links.
  - Logs alerts only. It does not ban or timeout users.

- `src/moderation/askGuard.ts`
  - Blocks abusive or expensive `!ask` prompts before OpenAI is called.
  - Blocks very long prompts, too many words, prompt injection, prompt extraction, large generation requests, and unsafe hacking/phishing-style requests.

- `src/memory/chatMemory.ts`
  - Stores recent non-command chat messages in memory.
  - Used as lightweight context for `!ask`.
  - Memory is lost on restart.

- `src/memory/viewerMemory.ts`
  - Persists basic viewer metadata to `data/viewers.json`.
  - Tracks first seen, last seen, message count, command count, and welcomed time.
  - `data/` is ignored by git because it contains real chat activity.

- `src/engagement/reminder.ts`
  - Sends periodic reminder messages only if chat has been active recently.
  - Avoids posting when chat is quiet.

- `src/engagement/firstChatWelcome.ts`
  - Welcomes users first seen in persistent viewer memory.
  - Ignores command-only first messages.
  - Uses a global cooldown to avoid welcome spam.
  - Picks a random local welcome template from `WELCOME_FIRST_CHAT_MESSAGES`.

- `src/utils/cooldown.ts`
  - Generic in-memory cooldown helper.

- `src/utils/logger.ts`
  - Simple timestamped logger.

## Required Environment

Required variables:

```dotenv
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_BOT_ACCESS_TOKEN=
TWITCH_BOT_USER_ID=
TWITCH_BROADCASTER_USER_ID=
OPENAI_API_KEY=
BOT_USERNAME=
```

Useful optional variables:

```dotenv
OPENAI_MODEL=gpt-5.2
BOT_PERSONALITY=
STREAM_CONTEXT=
SOCIAL_LINKS_MESSAGE=Discord: https://example.com/discord || Instagram: https://example.com/instagram || TikTok: https://example.com/tiktok
SOCIAL_LINKS_MESSAGE_DELAY_MS=2500
ALLOW_BOT_SELF_MESSAGES=false
ENGAGEMENT_REMINDERS_ENABLED=true
ENGAGEMENT_REMINDER_INTERVAL_MINUTES=30
ENGAGEMENT_ACTIVE_CHAT_WINDOW_MINUTES=10
ENGAGEMENT_REMINDER_MESSAGE=
WELCOME_FIRST_CHAT_ENABLED=true
WELCOME_FIRST_CHAT_COOLDOWN_SECONDS=90
WELCOME_FIRST_CHAT_MESSAGES=Bienvenido @{username}, que gusto verte por aqui. Usa !help si quieres ver comandos. || Hey @{username}, bienvenido al chat. Ponte comodo y disfruta el stream. || Buenas @{username}, llegaste justo a tiempo.
MEMORY_RECENT_CHAT_MESSAGES=20
MEMORY_PROMPT_CHAT_MESSAGES=8
STREAM_CONTEXT_CACHE_MINUTES=2
```

Keep `.env.example` updated when adding or renaming config.

## Twitch Requirements

The bot token must be a Twitch user access token for the account that should speak in chat.

Current required scopes:

- `user:read:chat`
- `user:write:chat`

Older IRC scopes like `chat:read` and `chat:edit` may be present, but this code sends messages through the Helix Chat Messages API, so `user:write:chat` matters.

If the bot replies as the streamer account, the access token belongs to the streamer account. To make it reply as another name, generate the token while logged into that bot account and update `TWITCH_BOT_ACCESS_TOKEN`, `TWITCH_BOT_USER_ID`, and `BOT_USERNAME`.

## OpenAI Behavior

- `!ask` uses OpenAI only after passing `askGuard` and cooldown checks.
- OpenAI quota/billing failures are caught and converted into short user-facing fallbacks.
- OpenAI does not provide automatic memory. This repo has short in-memory chat context plus local JSON viewer memory.

## Safety And Moderation Rules

- Do not auto-ban or auto-timeout in v1 unless explicitly requested.
- Existing moderation only logs:
  - repeated messages,
  - suspicious promo phrases,
  - suspicious links.
- Messages with moderation alerts must not trigger engagement, first-chat welcomes, chat memory, viewer memory, or commands.
- If adding automatic moderation later, gate it behind explicit env flags and confidence thresholds.

## Development Conventions

- Keep the MVP simple and readable.
- Prefer small modules by responsibility.
- Use TypeScript strict mode.
- Keep Twitch API calls wrapped in `src/twitch/*`.
- Keep OpenAI calls wrapped in `src/openai/client.ts`.
- Do not leak raw provider errors, headers, tokens, or cookies into chat.
- Avoid calling OpenAI for inputs already rejected by local guards.
- Run `npm run build` after code changes.

## Common Test Flow

1. Update `.env`.
2. Run:

```bash
npm run dev
```

3. In Twitch chat, test:

```text
!ping
!hola
!help
!redes
!ask dime algo breve sobre el stream
```

4. For local self-testing with the same bot account:

```dotenv
ALLOW_BOT_SELF_MESSAGES=true
```

Set it back to `false` for normal use.

## Future TODOs

- OBS integration.
- TTS.
- Persistent memory.
- Viewer profile memory.
- Automatic timeout/ban after confidence threshold.
- OpenClaw integration for clips/OBS.
