import nodemailer from 'nodemailer';
import { criterionContacts } from '../config/notifications.js';

// Transporter-Konfiguration über Umgebungsvariablen (.env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '://deinefirma.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true für 465, false für andere Ports
  auth: {
    user: process.env.SMTP_USER || 'shopfloor-alert@firma.com',
    pass: process.env.SMTP_PASS || 'DeinSicheresPasswort'
  }
});

export const sendStatusAlert = async (machineId, criterion, note, author) => {
  const contact = criterionContacts[criterion];
  
  // Falls kein Kontakt für dieses Kriterium hinterlegt ist, brechen wir ab
  if (!contact || !contact.email) {
    console.log(`Keine E-Mail-Adresse für Kriterium "${criterion}" hinterlegt.`);
    return;
  }

  const mailOptions = {
    from: `"FactoryAI Alert" <${process.env.SMTP_USER || 'shopfloor-alert@firma.com'}>`,
    to: contact.email,
    subject: `⚠️ ALARM: Status ROT bei Spalte ${machineId} (${criterion})`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; max-width: 600px;">
        <h2 style="color: #ef4444; margin-top: 0;">⚠️ Shopfloor Alert – Handlungsbedarf!</h2>
        <p>Am Shopfloor-Panel wurde soeben ein Kriterium auf <strong>ROT</strong> gesetzt.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Maschine / Spalte:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${machineId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Kriterium / Bereich:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${criterion} (${contact.label})</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Gemeldet von:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${author || 'Anonym am Terminal'}</td>
          </tr>
        </table>

        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 15px;">
          <strong>Hinterlegte Notiz / Grund:</strong><br>
          <span style="font-style: italic; color: #991b1b;">"${note || 'Keine nähere Beschreibung angegeben.'}"</span>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Diese E-Mail wurde automatisch vom FactoryAI Shopfloor-System generiert. Bitte nicht direkt antworten.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Alert-Mail erfolgreich an ${contact.email} gesendet.`);
  } catch (error) {
    console.error('Fehler beim Senden der Alert-Mail:', error);
  }
};
