
import { ChannelAdapter, UnifiedMessage, SendOptions, MediaPayload, MenuPayload } from '../channel.interface';


export class TelegramAdapter implements ChannelAdapter {
    readonly channelName = 'telegram';

    private getApiBase() {
        return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    }

    /**
     * Parse incoming webhook payload from Telegram
     */
    parseIncoming(rawPayload: any): UnifiedMessage | null {
        // We only care about messages for now (not edited_message, etc.)
        const message = rawPayload.message;
        if (!message) return null;

        const chatId = message.chat.id.toString();
        const senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
        const senderUsername = message.from.username;

        // Determine content type
        let contentType: UnifiedMessage['contentType'] = 'text';
        let body = '';
        let mediaUrl: string | undefined;

        if (message.text) {
            contentType = 'text';
            body = message.text;
        } else if (message.photo) {
            contentType = 'image';
            // Get the largest photo
            const photo = message.photo[message.photo.length - 1];
            mediaUrl = photo.file_id; // For now store file_id, normally we'd fetch the URL
            body = message.caption || '';
        } else if (message.document) {
            contentType = 'document';
            mediaUrl = message.document.file_id;
            body = message.caption || message.document.file_name || '';
        } else if (message.voice || message.audio) {
            contentType = 'audio';
            mediaUrl = (message.voice || message.audio).file_id;
        } else if (message.video) {
            contentType = 'video';
            mediaUrl = message.video.file_id;
            body = message.caption || '';
        } else if (message.contact) {
            contentType = 'contact';
            body = JSON.stringify(message.contact);
        } else if (message.sticker) {
            contentType = 'sticker';
            mediaUrl = message.sticker.file_id;
        }

        return {
            channelMessageId: message.message_id.toString(),
            channel: 'telegram',
            chatId,
            senderName,
            senderUsername,
            contentType,
            body,
            mediaUrl,
            timestamp: new Date(message.date * 1000),
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
