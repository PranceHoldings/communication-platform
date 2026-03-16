/**
 * WebSocket Mock Helper for E2E Tests (Stage 2)
 *
 * Intercepts WebSocket connections and provides programmatic control over messages.
 */

import { Page } from '@playwright/test';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
}

export class WebSocketMock {
  private page: Page;
  // private messageQueue: WebSocketMessage[] = [];
  private isSetup = false;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Setup WebSocket interception
   */
  async setup(): Promise<void> {
    if (this.isSetup) return;

    // Inject WebSocket mock before page loads
    await this.page.addInitScript(() => {
      // Store original WebSocket
      const OriginalWebSocket = window.WebSocket;

      // Mock WebSocket class
      class MockWebSocket extends EventTarget {
        public url: string;
        public readyState: number = WebSocket.CONNECTING;
        public onopen: ((event: Event) => void) | null = null;
        public onmessage: ((event: MessageEvent) => void) | null = null;
        public onerror: ((event: Event) => void) | null = null;
        public onclose: ((event: CloseEvent) => void) | null = null;

        constructor(url: string) {
          super();
          this.url = url;

          // Store mock instance for external control
          (window as any).__mockWebSocket = this;

          // Simulate connection after short delay
          setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            const event = new Event('open');
            this.onopen?.(event);
            this.dispatchEvent(event);

            // Notify test that WebSocket is ready
            (window as any).__mockWebSocketReady = true;
          }, 100);
        }

        send(data: string | ArrayBuffer | Blob): void {
          console.log('[MockWebSocket] Send:', data);
          // Store sent messages for verification
          (window as any).__mockWebSocketSent = (window as any).__mockWebSocketSent || [];
          (window as any).__mockWebSocketSent.push(data);
        }

        close(): void {
          this.readyState = WebSocket.CLOSED;
          const event = new CloseEvent('close');
          this.onclose?.(event);
          this.dispatchEvent(event);
        }

        // Helper method to simulate receiving message
        __receiveMessage(data: string): void {
          if (this.readyState !== WebSocket.OPEN) return;

          const event = new MessageEvent('message', { data });
          this.onmessage?.(event);
          this.dispatchEvent(event);
        }
      }

      // Replace global WebSocket
      (window as any).WebSocket = MockWebSocket;
      (window as any).WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
      (window as any).WebSocket.OPEN = OriginalWebSocket.OPEN;
      (window as any).WebSocket.CLOSING = OriginalWebSocket.CLOSING;
      (window as any).WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    });

    this.isSetup = true;
  }

  /**
   * Wait for WebSocket connection
   */
  async waitForConnection(timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => (window as any).__mockWebSocketReady === true,
      { timeout }
    );
  }

  /**
   * Send message to client
   */
  async sendMessage(message: WebSocketMessage): Promise<void> {
    const messageStr = JSON.stringify(message);
    await this.page.evaluate((msg) => {
      const ws = (window as any).__mockWebSocket;
      if (ws) {
        ws.__receiveMessage(msg);
      }
    }, messageStr);
  }

  /**
   * Send authenticated message
   */
  async sendAuthenticated(sessionId: string, initialGreeting?: string): Promise<void> {
    await this.sendMessage({
      type: 'authenticated',
      sessionId,
      initialGreeting,
    });
  }

  /**
   * Send initial greeting
   */
  async sendGreeting(text: string, audioUrl?: string): Promise<void> {
    await this.sendMessage({
      type: 'greeting',
      text,
      audioUrl,
      timestamp: Date.now(),
    });
  }

  /**
   * Send transcript message
   */
  async sendTranscript(speaker: 'USER' | 'AI', text: string): Promise<void> {
    await this.sendMessage({
      type: 'transcript_final',
      speaker,
      text,
      timestamp: Date.now(),
      timestamp_start: Date.now() - 1000,
      timestamp_end: Date.now(),
    });
  }

  /**
   * Send AI avatar response
   */
  async sendAvatarResponse(text: string): Promise<void> {
    await this.sendMessage({
      type: 'avatar_response_final',
      text,
      timestamp: Date.now(),
    });
  }

  /**
   * Send audio response
   */
  async sendAudioResponse(audioUrl: string): Promise<void> {
    await this.sendMessage({
      type: 'audio_response',
      audioUrl,
      contentType: 'audio/mpeg',
      timestamp: Date.now(),
    });
  }

  /**
   * Send error message
   */
  async sendError(code: string, message: string): Promise<void> {
    await this.sendMessage({
      type: 'error',
      code,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Send session complete message
   */
  async sendSessionComplete(): Promise<void> {
    await this.sendMessage({
      type: 'session_complete',
      timestamp: Date.now(),
    });
  }

  /**
   * Get messages sent by client
   */
  async getSentMessages(): Promise<string[]> {
    return await this.page.evaluate(() => {
      return (window as any).__mockWebSocketSent || [];
    });
  }

  /**
   * Clear sent messages
   */
  async clearSentMessages(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__mockWebSocketSent = [];
    });
  }

  /**
   * Full conversation flow helper
   */
  async simulateConversation(userText: string, aiText: string, aiAudioUrl: string): Promise<void> {
    // 1. User transcript
    await this.sendTranscript('USER', userText);
    await this.page.waitForTimeout(500);

    // 2. AI response
    await this.sendAvatarResponse(aiText);
    await this.page.waitForTimeout(500);

    // 3. Audio URL
    await this.sendAudioResponse(aiAudioUrl);
  }
}
