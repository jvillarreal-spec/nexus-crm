
import { UnifiedMessage, ChannelAdapter } from '../channels/channel.interface';
import { TelegramAdapter } from '../channels/telegram/telegram.adapter';

export class BotLogic {
    constructor(private adapter: ChannelAdapter) { }

    async handleIncomingMessage(message: UnifiedMessage) {
        const text = message.body.toLowerCase().trim();

        // 1. Handle Start Command
        if (text === '/start') {
            await this.sendWelcomeMessage(message.chatId);
            return;
        }

        // 2. Handle Menu Command
        if (text === '/menu') {
            await this.sendMainMenu(message.chatId);
            return;
        }

        // 3. Handle Menu Selections (Callback Queries typically, but for now simple text matching if using reply keyboard, or just commands)
        // For inline buttons, the payload comes as a callback_query, which needs specific handling in the adapter.
        // Assuming we handle text responses here:

        // Default: Pass to CRM (Store in DB)
        console.log(`[BotLogic] Message from ${message.senderName}: ${message.body}`);
        // Here we will call the DB service to store the message
    }

    async sendWelcomeMessage(chatId: string) {
        const welcome = `¡Hola! 👋 Bienvenido a NexusCRM Demo.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte hoy?`;
        await this.adapter.sendTextMessage(chatId, welcome);
        await this.sendMainMenu(chatId);
    }

    async sendMainMenu(chatId: string) {
        await this.adapter.sendInteractiveMenu(chatId, {
            text: 'Selecciona una opción:',
            options: [
                { label: '💰 Precios', value: 'prices' },
                { label: '📦 Productos', value: 'products' },
                { label: '🛠️ Soporte', value: 'support' },
                { label: '👤 Hablar con asesor', value: 'human_agent' },
            ],
        });
    }
}
