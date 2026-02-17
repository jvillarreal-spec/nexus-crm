
import { ChannelAdapter, UnifiedMessage, SendOptions, MediaPayload, MenuPayload } from '../channel.interface';


export class TelegramAdapter implements ChannelAdapter {
    readonly channelName = 'telegram';
    private botToken: string;

    constructor(token?: string) {
        this.botToken = token || process.env.TELEGRAM_BOT_TOKEN || '';
    }

    private getApiBase() {
        return `https://api.telegram.org/bot${this.botToken}`;
    }

    /**
     * Parse incoming webhook payload from Telegram
     */
    parseIncoming(rawPayload: any): UnifiedMessage | null {
        // Handle normal messages or callback queries
        const message = rawPayload.message || rawPayload.callback_query?.message;
        const callbackQuery = rawPayload.callback_query;

        if (!message && !callbackQuery) return null;

        const effectiveMessage = message || {};
        const from = callbackQuery ? callbackQuery.from : effectiveMessage.from;

        if (!from) return null;

        const chatId = (callbackQuery ? callbackQuery.message.chat.id : effectiveMessage.chat.id).toString();
        const senderName = [from.first_name, from.last_name].filter(Boolean).join(' ');
        const senderUsername = from.username;

        // Determine content type
        let contentType: UnifiedMessage['contentType'] = 'text';
        let body = '';
        let mediaUrl: string | undefined;
        let callbackData: string | undefined;
        let isCallback = false;

        if (callbackQuery) {
            isCallback = true;
            contentType = 'callback';
            callbackData = callbackQuery.data;
            body = `[Bot Option: ${callbackData}]`;
        } else if (effectiveMessage.text) {
            contentType = 'text';
            body = effectiveMessage.text;
        } else if (effectiveMessage.photo) {
            contentType = 'image';
            const photo = effectiveMessage.photo[effectiveMessage.photo.length - 1];
            mediaUrl = photo.file_id;
            body = effectiveMessage.caption || '';
        } else if (effectiveMessage.document) {
            contentType = 'document';
            mediaUrl = effectiveMessage.document.file_id;
            body = effectiveMessage.caption || effectiveMessage.document.file_name || '';
        } else if (effectiveMessage.voice || effectiveMessage.audio) {
            contentType = 'audio';
            mediaUrl = (effectiveMessage.voice || effectiveMessage.audio).file_id;
        } else if (effectiveMessage.video) {
            contentType = 'video';
            mediaUrl = effectiveMessage.video.file_id;
            body = effectiveMessage.caption || '';
        } else if (effectiveMessage.contact) {
            contentType = 'contact';
            body = JSON.stringify(effectiveMessage.contact);
        } else if (effectiveMessage.sticker) {
            contentType = 'sticker';
            mediaUrl = effectiveMessage.sticker.file_id;
        }

        return {
            channelMessageId: (callbackQuery ? callbackQuery.id : effectiveMessage.message_id).toString(),
            channel: 'telegram',
            chatId,
            senderName,
            senderUsername,
            contentType,
            body,
            mediaUrl,
            callbackData,
            isCallback,
            timestamp: new Date((callbackQuery ? callbackQuery.message.date : effectiveMessage.date) * 1000),
            rawPayload,
        };
    }

    /**
     * Send a text message to Telegram
     */
    async sendTextMessage(chatId: string, text: string, options?: SendOptions): Promise<void> {
        const payload: any = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
        };

        if (options?.replyToMessageId) {
            payload.reply_to_message_id = options.replyToMessageId;
        }

        await this.callApi('sendMessage', payload);
    }

    /**
     * Send a media message to Telegram
     */
    async sendMedia(chatId: string, media: MediaPayload): Promise<void> {
        // TODO: Implement media sending logic (needs multipart/form-data for uploads or URL for existing files)
        // For MVP, handling existing URLs is easier
        const payload: any = {
            chat_id: chatId,
            caption: media.caption,
        };

        let method = 'sendMessage';
        if (media.type === 'image') {
            method = 'sendPhoto';
            payload.photo = media.url;
        } else if (media.type === 'document') {
            method = 'sendDocument';
            payload.document = media.url;
        }

        await this.callApi(method, payload);
    }

    /**
     * Send an interactive menu (Inline Keyboard)
     */
    async sendInteractiveMenu(chatId: string, menu: MenuPayload): Promise<void> {
        const payload = {
            chat_id: chatId,
            text: menu.text,
            reply_markup: {
                inline_keyboard: [
                    // Create rows of 2 buttons max
                    ...menu.options.reduce((rows: any[], option, index) => {
                        if (index % 2 === 0) rows.push([]);
                        rows[rows.length - 1].push({
                            text: option.label,
                            callback_data: option.value
                        });
                        return rows;
                    }, [])
                ]
            }
        };

        await this.callApi('sendMessage', payload);
    }

    /**
     * Helper to call Telegram API
     */
    private async callApi(method: string, body: any): Promise<any> {
        const response = await fetch(`${this.getApiBase()}/${method}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`Telegram API Error (${method}):`, error);
            throw new Error(`Telegram API Error: ${error.description}`);
        }

        return response.json();
    }
}
