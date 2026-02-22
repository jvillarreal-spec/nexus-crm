import nodemailer from 'nodemailer';

interface ClientData {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    channel_id?: string;
    username?: string;
}

export class EmailService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD,
            },
        });
    }

    /**
     * Sends a support ticket email to the company's support address.
     */
    async sendSupportTicket(to: string, clientData: ClientData, issueDetails: string, conversationId: string): Promise<{ success: boolean; error?: string }> {
        if (!to) {
            console.error('EmailService: No support email provided.');
            return { success: false, error: 'No se proporcionó un correo de soporte.' };
        }

        try {
            const info = await this.transporter.sendMail({
                from: `"NexusCRM Support" <${process.env.GMAIL_USER}>`,
                to: to,
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

            console.log('EmailService: Support ticket sent successfully to', to);
            return { success: true };
        } catch (error: any) {
            console.error('EmailService Error:', error);
            return { success: false, error: error.message || 'Error inesperado en el servicio de email.' };
        }
    }

    /**
     * Sends a welcome email to a new company administrator.
     */
    async sendCompanyWelcomeEmail(to: string, adminName: string, companyName: string, password?: string): Promise<{ success: boolean; error?: string }> {
        if (!to) {
            console.error('EmailService: No target email provided.');
            return { success: false, error: 'No se proporcionó un destinatario.' };
        }

        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-crm-ulmv.vercel.app';

            const passwordSection = password ? `
                <div style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Tus Credenciales de Acceso</p>
                    <div style="display: inline-block; text-align: left; background: white; padding: 15px 25px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p style="margin: 0; font-family: monospace; font-size: 14px; color: #1e293b;"><strong>Email:</strong> ${to}</p>
                        <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 14px; color: #1e293b;"><strong>Clave:</strong> <span style="background-color: #fef9c3; padding: 2px 6px; border-radius: 4px; border: 1px solid #fef08a;">${password}</span></p>
                    </div>
                    <p style="margin: 15px 0 0 0; font-size: 12px; color: #ef4444; font-weight: bold;">* Se te pedirá cambiar esta clave al ingresar.</p>
                </div>
            ` : '';

            const info = await this.transporter.sendMail({
                from: `"NexusCRM" <${process.env.GMAIL_USER}>`,
                to: to,
                subject: `¡Bienvenido a NexusCRM, ${companyName}!`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1d27; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="background-color: #1a1d27; padding: 40px 20px; text-align: center;">
                            <h1 style="color: #2AABEE; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">NexusCRM</h1>
                            <p style="color: #8b8fa3; margin-top: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Onboarding de Empresa</p>
                        </div>
                        
                        <div style="padding: 40px; background-color: #ffffff;">
                            <h2 style="color: #1a1d27; margin-top: 0;">¡Hola, ${adminName}!</h2>
                            <p style="font-size: 16px; line-height: 1.6; color: #4a4e5d;">
                                Es un placer darte la bienvenida a <strong>NexusCRM</strong>. Tu organización, <strong>${companyName}</strong>, ha sido creada con éxito en nuestra plataforma.
                            </p>
                            
                            ${passwordSection}

                            <div style="background-color: #f8faff; border-left: 4px solid #2AABEE; padding: 20px; margin: 30px 0; border-radius: 8px;">
                                <p style="margin: 0; font-size: 14px; color: #4a4e5d;">
                                    <strong>¿Qué sigue ahora?</strong><br>
                                    Ya puedes acceder al panel de control para configurar tus canales de Telegram y empezar a gestionar tus leads con el poder de la Inteligencia Artificial.
                                </p>
                            </div>

                            <div style="text-align: center; margin-top: 40px;">
                                <a href="${appUrl}/login" style="background-color: #2AABEE; color: #ffffff; padding: 18px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Acceder a mi Panel</a>
                            </div>

                            <p style="margin-top: 40px; font-size: 14px; color: #8b8fa3; text-align: center;">
                                Si tienes alguna duda, responde a este correo o contacta a tu Super Administrador.
                            </p>
                        </div>
                        
                        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                            <p style="margin: 0; font-size: 12px; color: #bbb;">
                                &copy; 2026 NexusCRM. Todos los derechos reservados.
                            </p>
                        </div>
                    </div>
                `
            });

            console.log('EmailService: Welcome email sent successfully to', to);
            return { success: true };
        } catch (error: any) {
            console.error('EmailService Error:', error);
            return { success: false, error: error.message || 'Error inesperado en el servicio de email.' };
        }
    }
}
