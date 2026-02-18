import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ClientData {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    channel_id?: string;
    username?: string;
}

export class EmailService {
    /**
     * Sends a support ticket email to the company's support address.
     */
    async sendSupportTicket(to: string, clientData: ClientData, issueDetails: string, conversationId: string): Promise<boolean> {
        if (!to) {
            console.error('EmailService: No support email provided.');
            return false;
        }

        try {
            const { data, error } = await resend.emails.send({
                from: 'NexusCRM Support <onboarding@resend.dev>', // Update this with a verified domain if available
                to: [to],
                subject: `🔥 Nuevo Ticket de Soporte - ${clientData.first_name || 'Cliente'} (${clientData.channel_id})`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2 style="color: #2AABEE;">Nuevo Ticket de Soporte</h2>
                        <p>Un cliente ha solicitado ayuda a través del Bot de Telegram.</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        
                        <h3>👤 Datos del Cliente</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li><strong>Nombre:</strong> ${clientData.first_name || 'N/A'} ${clientData.last_name || ''}</li>
                            <li><strong>Usuario:</strong> ${clientData.username || 'N/A'}</li>
                            <li><strong>Teléfono/ID:</strong> ${clientData.phone || clientData.channel_id}</li>
                            <li><strong>Email:</strong> ${clientData.email || 'No proporcionado'}</li>
                        </ul>

                        <h3>⚠️ Detalle del Problema</h3>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #ff4d4f;">
                            ${issueDetails}
                        </div>

                        <p style="margin-top: 20px; font-size: 12px; color: #888;">
                            Ticket ID: ${conversationId} <br>
                            Enviado automáticamente por NexusCRM Bot.
                        </p>
                    </div>
                `
            });

            if (error) {
                console.error('EmailService Error:', error);
                return false;
            }

            console.log('EmailService: Support ticket sent successfully to', to);
            return true;
        } catch (error) {
            console.error('EmailService Exception:', error);
            return false;
        }
    }
}
