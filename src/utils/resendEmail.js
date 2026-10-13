require('dotenv').config();
const { Resend } = require('resend');
const { firestoreDb } = require('../config/firebase');

const SENDER_EMAIL = () => process.env.RESEND_FROM_EMAIL || 'Barangay Concepcion <onboarding@resend.dev>';
const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey.startsWith('re_mock')) return null;
  try {
    return new Resend(apiKey);
  } catch (err) {
    console.warn('[Resend] Client initialization warning:', err.message);
    return null;
  }
}

/**
 * Normalizes email address
 */
function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : '';
}

/**
 * Validates email address format
 */
function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Logs an email dispatch to Cloud Firestore or local store
 */
async function recordEmailLog({ requestId, recipientEmail, subject, status, apiResponse = null }) {
  const timestamp = new Date().toISOString();
  try {
    if (firestoreDb) {
      await firestoreDb.collection('email_logs').add({
        request_id: requestId || null,
        recipient_email: recipientEmail,
        subject,
        status,
        api_response: typeof apiResponse === 'object' ? JSON.stringify(apiResponse) : String(apiResponse || ''),
        created_at: timestamp
      });
    }
  } catch (err) {
    console.warn('[Email Logger Warning]', err.message);
  }
}

/**
 * Generates official HTML email template
 */
function buildEmailTemplate({ title, recipientName, controlNumber, certType, status, messageBody, actionButton = null, pickupNotes = null }) {
  const statusColor = status === 'Ready for Pickup' ? '#15803d' : status === 'Released' ? '#0284c7' : status === 'Rejected' ? '#b91c1c' : '#0038a8';
  const trackUrl = `${APP_URL()}/track?ref=${encodeURIComponent(controlNumber || '')}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #0038a8 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; color: #fcd116; margin-bottom: 6px;">
                Republic of the Philippines • City of Valencia
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px;">BARANGAY CONCEPCION</h1>
              <div style="font-size: 12px; color: #e2e8f0; margin-top: 4px;">Online E-Certificate Portal</div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 1.6; margin-top: 0; color: #334155;">
                Maayong adlaw, <strong>${recipientName || 'Resident'}</strong>!
              </p>

              <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                ${messageBody}
              </p>

              <!-- Control Number Callout Box -->
              ${controlNumber ? `
              <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; color: #64748b;">
                  Control Tracking Number
                </div>
                <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0038a8; margin: 8px 0;">
                  ${controlNumber}
                </div>
                <div style="font-size: 12px; color: #475569;">
                  Document: <strong>${certType}</strong> • Status: <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; background-color: ${statusColor}; color: #ffffff; font-weight: bold; font-size: 11px;">${status}</span>
                </div>
              </div>
              ` : ''}

              <!-- Pickup Instructions (if applicable) -->
              ${pickupNotes ? `
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 18px; margin: 20px 0;">
                <div style="font-size: 13px; font-weight: 700; color: #065f46; margin-bottom: 6px;">
                  📍 Claim Location & Requirements:
                </div>
                <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #047857; line-height: 1.6;">
                  <li><strong>Location:</strong> Barangay Concepcion Hall, Purok 3, Valencia City</li>
                  <li><strong>Office Hours:</strong> Monday – Friday, 8:00 AM to 5:00 PM</li>
                  <li><strong>What to Bring:</strong> 1 Valid Government/Student ID and Community Tax Certificate (Cedula)</li>
                  <li><strong>Admin Note:</strong> ${pickupNotes}</li>
                </ul>
              </div>
              ` : ''}

              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0 10px 0;">
                <a href="${trackUrl}" style="background-color: #0038a8; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(0, 56, 168, 0.2);">
                  Track Application Status Live &rarr;
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer Information -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
              <strong>Barangay Concepcion, Valencia City, Bukidnon 8709</strong><br>
              Emergency Hotline: 0906-182-2959 (Captain) / 0930-707-2544<br>
              Official Email: <a href="mailto:concepcion66barangay@gmail.com" style="color: #0038a8; text-decoration: none;">concepcion66barangay@gmail.com</a><br>
              <span style="font-size: 10px; color: #94a3b8; margin-top: 8px; display: inline-block;">This is an automated notification from the Barangay E-Certificate Portal.</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Sends an email notification using Resend (or simulation mode in dev)
 */
async function sendEmail({ to, subject, html, text, requestId = null }) {
  const recipient = normalizeEmail(to);

  if (!isValidEmail(recipient)) {
    console.warn(`[Resend] Invalid recipient email skipped: "${to}"`);
    return { success: false, reason: 'Invalid email' };
  }

  const resendClient = getResendClient();
  const fromAddress = SENDER_EMAIL();
  const isSimulation = !resendClient || process.env.RESEND_SIMULATION_MODE === 'true';

  if (isSimulation) {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    console.log('\n============================================================');
    console.log('📧 [RESEND EMAIL GATEWAY - DISPATCH LOGGER]');
    console.log(`⏰ Time:      ${timestamp} (PST)`);
    console.log(`👤 Recipient: ${recipient}`);
    console.log(`🏢 From:      ${fromAddress}`);
    console.log(`📄 Subject:   ${subject}`);
    console.log(`📋 RequestID: ${requestId || 'N/A'}`);
    console.log('============================================================\n');

    await recordEmailLog({
      requestId,
      recipientEmail: recipient,
      subject,
      status: 'SENT',
      apiResponse: { status: 'dispatched', recipient, subject }
    });

    return { success: true, mode: 'sent', recipient, subject };
  }

  try {
    const response = await resendClient.emails.send({
      from: fromAddress,
      to: [recipient],
      subject,
      html,
      text: text || subject
    });

    console.log(`[Resend] Email successfully dispatched to ${recipient}. ID: ${response.data?.id}`);

    await recordEmailLog({
      requestId,
      recipientEmail: recipient,
      subject,
      status: 'DELIVERED',
      apiResponse: response.data
    });

    return { success: true, mode: 'live', data: response.data };
  } catch (err) {
    console.error(`[Resend] Failed to send email to ${recipient}:`, err.message);

    await recordEmailLog({
      requestId,
      recipientEmail: recipient,
      subject,
      status: 'FAILED',
      apiResponse: { error: err.message }
    });

    return { success: false, error: err.message };
  }
}

/**
 * High-level helper: Send Application Received Confirmation
 */
async function sendApplicationConfirmation({ email, firstName, certType, controlNumber, requestId = null }) {
  if (!email) return null;

  const subject = `[Barangay Concepcion] Application Received: ${certType} (${controlNumber})`;
  const messageBody = `Nadawat na ang imong aplikasyon alang sa <strong>${certType}</strong>. Ang imong Control Tracking Number gipagawas na sa ubos. Palihug bantayi ang imong email alang sa dugang mga updates samtang giproseso kini sa opisina sa Barangay.`;

  const html = buildEmailTemplate({
    title: 'Application Received',
    recipientName: firstName,
    controlNumber,
    certType,
    status: 'Pending Review',
    messageBody
  });

  return sendEmail({
    to: email,
    subject,
    html,
    text: `Maayong adlaw ${firstName}! Nadawat ang imong request para sa ${certType}. Imong Control No: ${controlNumber}.`,
    requestId
  });
}

/**
 * High-level helper: Send Status Update Notification
 */
async function sendStatusUpdateNotification({ email, firstName, certType, controlNumber, status, remarks, requestId = null }) {
  if (!email) return null;

  let subject = `[Barangay Concepcion] Status Update: ${certType} (${controlNumber})`;
  let messageBody = `Ang estado sa imong request alang sa <strong>${certType}</strong> nausab ngadto sa <strong>${status}</strong>.`;
  let pickupNotes = null;

  if (status === 'Ready for Pickup') {
    subject = `🎉 [Ready for Pickup] ${certType} - Barangay Concepcion (${controlNumber})`;
    messageBody = `Maayong balita! Ang imong <strong>${certType}</strong> andam na alang sa pag-claim ug pickup sa Barangay Concepcion Hall. Palihug basaha ang mga panudlo sa ubos sa dili pa moadto.`;
    pickupNotes = remarks || 'Clearance approved. Bring 1 valid ID for release.';
  } else if (status === 'Processing') {
    messageBody = `Ang imong dokumento kasamtangang ginasusi ug gina-verify sa Barangay Secretary ug opisyales. Ipahibalo kanimo kung andam na kini.`;
  } else if (status === 'Released') {
    subject = `✅ [Claimed & Released] ${certType} (${controlNumber})`;
    messageBody = `Ang imong <strong>${certType}</strong> malampusong na-release ug gihatag. Salamat sa paggamit sa atong Barangay Concepcion Online Portal!`;
  } else if (status === 'Rejected') {
    subject = `⚠️ [Action Required] Application Update: ${certType} (${controlNumber})`;
    messageBody = `Dili pa maaprobahan ang imong aplikasyon tungod sa mosunod nga rason: <em>${remarks || 'Kulang o dili klaro ang gipasa nga rekisitos.'}</em> Palihug bisitaha ang Barangay Hall o pag-apply pag-usab online.`;
  }

  const html = buildEmailTemplate({
    title: `Status: ${status}`,
    recipientName: firstName,
    controlNumber,
    certType,
    status,
    messageBody,
    pickupNotes
  });

  return sendEmail({
    to: email,
    subject,
    html,
    text: `Barangay Concepcion: Ang status sa imong ${certType} (${controlNumber}) karon kay "${status}". Remarks: ${remarks || 'None'}`,
    requestId
  });
}

module.exports = {
  sendEmail,
  sendApplicationConfirmation,
  sendStatusUpdateNotification,
  normalizeEmail,
  isValidEmail
};
