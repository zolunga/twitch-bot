import crypto from "crypto";
import WebSocket from "ws";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const OP_HELLO = 0;
const OP_IDENTIFY = 1;
const OP_IDENTIFIED = 2;
const OP_REQUEST = 6;
const OP_REQUEST_RESPONSE = 7;

interface ObsAuthenticationChallenge {
  salt: string;
  challenge: string;
}

interface ObsHelloMessage {
  op: typeof OP_HELLO;
  d?: {
    authentication?: ObsAuthenticationChallenge;
  };
}

interface ObsIdentifiedMessage {
  op: typeof OP_IDENTIFIED;
}

interface ObsRequestResponseMessage {
  op: typeof OP_REQUEST_RESPONSE;
  d?: {
    requestId?: string;
    requestStatus?: {
      result: boolean;
      code?: number;
      comment?: string;
    };
    responseData?: unknown;
  };
}

type ObsMessage = ObsHelloMessage | ObsIdentifiedMessage | ObsRequestResponseMessage | { op: number; d?: unknown };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export class ObsService {
  private socket?: WebSocket;
  private connectPromise?: Promise<WebSocket>;
  private requestId = 0;
  private readonly pendingRequests = new Map<string, PendingRequest>();

  async restartMediaInput(inputName: string): Promise<void> {
    await this.sendRequest("TriggerMediaInputAction", {
      inputName,
      mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART"
    });
  }

  async stopMediaInput(inputName: string): Promise<void> {
    await this.sendRequest("TriggerMediaInputAction", {
      inputName,
      mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP"
    });
  }

  async stopMediaInputs(inputNames: string[]): Promise<void> {
    for (const inputName of inputNames) {
      await this.stopMediaInput(inputName);
    }
  }

  private async sendRequest(requestType: string, requestData: Record<string, unknown>): Promise<unknown> {
    const ws = await this.connect();
    const requestId = String(++this.requestId);

    const responsePromise = new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      setTimeout(() => {
        if (!this.pendingRequests.delete(requestId)) {
          return;
        }

        reject(new Error(`OBS request timed out: ${requestType}`));
      }, config.obs.requestTimeoutMs);
    });

    ws.send(
      JSON.stringify({
        op: OP_REQUEST,
        d: {
          requestType,
          requestId,
          requestData
        }
      })
    );

    return responsePromise;
  }

  private async connect(): Promise<WebSocket> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    this.connectPromise ??= this.openSocket().finally(() => {
      this.connectPromise = undefined;
    });

    return this.connectPromise;
  }

  private openSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(config.obs.websocketUrl);

      const fail = (error: Error): void => {
        cleanup();
        reject(error);
      };

      const cleanup = (): void => {
        ws.off("error", fail);
      };

      ws.once("error", fail);

      ws.on("close", () => {
        if (this.socket === ws) {
          this.socket = undefined;
        }

        for (const pending of this.pendingRequests.values()) {
          pending.reject(new Error("OBS WebSocket disconnected."));
        }

        this.pendingRequests.clear();
      });

      ws.on("message", (data) => {
        this.handleMessage(ws, data.toString(), resolve, reject, cleanup);
      });
    });
  }

  private handleMessage(
    ws: WebSocket,
    rawMessage: string,
    resolveConnection: (socket: WebSocket) => void,
    rejectConnection: (error: Error) => void,
    cleanup: () => void
  ): void {
    let message: ObsMessage;

    try {
      message = JSON.parse(rawMessage) as ObsMessage;
    } catch (error) {
      logger.warn("Received invalid OBS WebSocket message", error);
      return;
    }

    if (message.op === OP_HELLO) {
      const hello = message as ObsHelloMessage;

      try {
        ws.send(
          JSON.stringify({
            op: OP_IDENTIFY,
            d: {
              rpcVersion: 1,
              authentication: hello.d?.authentication
                ? this.createAuthentication(hello.d.authentication)
                : undefined
            }
          })
        );
      } catch (error) {
        cleanup();
        rejectConnection(error instanceof Error ? error : new Error(String(error)));
      }

      return;
    }

    if (message.op === OP_IDENTIFIED) {
      cleanup();
      this.socket = ws;
      logger.info("Connected to OBS WebSocket.");
      resolveConnection(ws);
      return;
    }

    if (message.op !== OP_REQUEST_RESPONSE) {
      return;
    }

    const response = message as ObsRequestResponseMessage;
    const requestId = response.d?.requestId;
    if (!requestId) {
      return;
    }

    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(requestId);

    if (response.d?.requestStatus?.result) {
      pending.resolve(response.d.responseData);
      return;
    }

    const status = response.d?.requestStatus;
    pending.reject(new Error(`OBS request failed: ${status?.comment || status?.code || "unknown error"}`));
  }

  private createAuthentication(authentication: ObsAuthenticationChallenge): string {
    if (!config.obs.password) {
      throw new Error("OBS WebSocket requires a password, but OBS_WEBSOCKET_PASSWORD is not set.");
    }

    const secret = crypto
      .createHash("sha256")
      .update(config.obs.password + authentication.salt)
      .digest("base64");

    return crypto
      .createHash("sha256")
      .update(secret + authentication.challenge)
      .digest("base64");
  }
}
