import { db } from '../database/db.js';
import { telegramConfig } from '../database/schema.js';

interface TelegramConfig {
  id: string;
  botToken: string;
  chatId: string;
  enabled: boolean;
}

interface SendMessageResult {
  success: boolean;
  error?: string;
}

class TelegramService {
  private config: TelegramConfig | null = null;

  /**
   * Load Telegram configuration from database
   */
  async loadConfig(): Promise<TelegramConfig | null> {
    try {
      const configs = await db.select().from(telegramConfig).limit(1);
      if (configs.length > 0) {
        this.config = {
          id: configs[0].id,
          botToken: configs[0].botToken,
          chatId: configs[0].chatId,
          enabled: configs[0].enabled === 1,
        };
        return this.config;
      }
      return null;
    } catch (error) {
      console.error('[Telegram] Failed to load config:', error);
      return null;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TelegramConfig | null {
    return this.config;
  }

  /**
   * Check if Telegram is configured and enabled
   */
  isEnabled(): boolean {
    return this.config !== null && this.config.enabled;
  }

  /**
   * Send a message via Telegram
   */
  async sendMessage(message: string): Promise<SendMessageResult> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      return { success: false, error: 'Telegram not configured' };
    }

    if (!this.config.enabled) {
      return { success: false, error: 'Telegram alerts disabled' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json() as { ok: boolean; description?: string };

      if (!response.ok || !data.ok) {
        console.error('[Telegram] Failed to send message:', data);
        return { success: false, error: data.description || 'Failed to send message' };
      }

      console.log('[Telegram] Message sent successfully');
      return { success: true };
    } catch (error) {
      console.error('[Telegram] Error sending message:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send an alert message with formatting
   */
  async sendAlert(
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    details?: Record<string, string>
  ): Promise<SendMessageResult> {
    // Clean, minimal format without emojis
    const severityLabel = severity.toUpperCase();
    
    let formattedMessage = `<b>${title}</b>\n`;
    formattedMessage += `<code>${severityLabel}</code>\n\n`;
    formattedMessage += message;

    if (details && Object.keys(details).length > 0) {
      formattedMessage += '\n';
      for (const [key, value] of Object.entries(details)) {
        formattedMessage += `\n${key}: <code>${value}</code>`;
      }
    }

    // Minimal timestamp
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    formattedMessage += `\n\n<i>${time}</i>`;

    return this.sendMessage(formattedMessage);
  }

  /**
   * Test the Telegram configuration by sending a test message
   */
  async testConnection(botToken: string, chatId: string): Promise<SendMessageResult> {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: '<b>Computerzentrale</b>\n<code>TEST</code>\n\nTelegram alerts configured successfully.',
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json() as { ok: boolean; description?: string };

      if (!response.ok || !data.ok) {
        return { success: false, error: data.description || 'Failed to send test message' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Reload configuration (call after config changes)
   */
  async reloadConfig(): Promise<void> {
    await this.loadConfig();
  }
}

export const telegramService = new TelegramService();
