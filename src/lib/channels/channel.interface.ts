
export interface ChannelAdapter {
    readonly channelName: 'telegram' | 'whatsapp';

    /**
     * Parse incoming webhook payload into a unified message format
     */
    parseIncoming(rawPayload: any): UnifiedMessage | null;

    /**
     * Send a text message to a specific chat ID
     */
    sendTextMessage(chatId: string, text: string, options?: SendOptions): Promise<void>;

    /**
     * Send media (image, document, etc.)
     */
    sendMedia(chatId: string, media: MediaPayload): Promise<void>;

    /**
     * Send interactive menu (buttons/options)
     */
    sendInteractiveMenu(chatId: string, menu: MenuPayload): Promise<void>;
}

export interface UnifiedMessage {
    channelMessageId: string;
    channel: 'telegram' | 'whatsapp';
    chatId: string; // The external ID (e.g., Telegram chat_id)
    senderName: string;
    senderUsername?: string;
    contentType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact' | 'sticker';
    body: string;
    mediaUrl?: string;
    replyToId?: string;
    timestamp: Date;
    rawPayload: any;
}

export interface SendOptions {
    replyToMessageId?: string;
}

export interface MediaPayload {
    type: 'image' | 'document' | 'audio' | 'video';
    url: string;
    caption?: string;
}

export interface MenuPayload {
    text: string;
    options: {
        label: string;
        value: string; // The callback data or payload
    }[];
}
