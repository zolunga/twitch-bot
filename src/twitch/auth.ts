import { config } from "../config.js";

export interface TwitchTokenValidation {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
}

export async function validateBotAccessToken(): Promise<TwitchTokenValidation> {
  return validateTwitchAccessToken(config.twitch.botAccessToken);
}

export async function validateBroadcasterAccessToken(): Promise<TwitchTokenValidation | undefined> {
  if (!config.twitch.broadcasterAccessToken) {
    return undefined;
  }

  return validateTwitchAccessToken(config.twitch.broadcasterAccessToken);
}

async function validateTwitchAccessToken(accessToken: string): Promise<TwitchTokenValidation> {
  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `OAuth ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Twitch token validation failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<TwitchTokenValidation>;
}
