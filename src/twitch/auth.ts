import { config } from "../config.js";

export interface TwitchTokenValidation {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
}

export async function validateBotAccessToken(): Promise<TwitchTokenValidation> {
  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `OAuth ${config.twitch.botAccessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Twitch token validation failed: ${response.status} ${await response.text()}`);
  }

  return response.json() as Promise<TwitchTokenValidation>;
}
