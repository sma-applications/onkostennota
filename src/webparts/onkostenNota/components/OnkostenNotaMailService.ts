import { WebPartContext } from '@microsoft/sp-webpart-base';

export class OnkostenNotaMailService {
  private _context: WebPartContext;

  constructor(context: WebPartContext) {
    this._context = context;
  }

  public async sendOnkostenNotaMail(
    pdfBlob: Blob,
    notificationEmail: string,
    userDisplayName: string
  ): Promise<void> {

    if (!notificationEmail) {
      console.warn('Geen notificationEmail ingesteld, e-mail wordt niet verzonden.');
      return;
    }

    // 1. Blob -> base64 (voor Graph-attachment)
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const base64 = this._arrayBufferToBase64(arrayBuffer);

    const subject = `OnkostenNota van ${userDisplayName}`;
    const bodyText = `In bijlage vind je de onkostennota in PDF-formaat.`;

    // ===== Build dynamic filename =====
    const safeUser = userDisplayName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

    const timestamp = new Date().toISOString()
    .replace(/[:\-]/g, '_')       // replace colon & dash
    .replace(/\..+/, '');   
    
    const attachmentName = `onkostennota_${safeUser}_${timestamp}.pdf`;// drop milliseconds + Z

    const mail = {
      message: {
        subject,
        body: {
          contentType: 'Text',
          content: bodyText
        },
        toRecipients: [
          {
            emailAddress: {
              address: notificationEmail
            }
          }
        ],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachmentName,
            contentType: 'application/pdf',
            contentBytes: base64
          }
        ]
      },
      saveToSentItems: 'true'
    };

    // 2. Versturen via Microsoft Graph: /me/sendMail
    try {
        const client = await this._context.msGraphClientFactory.getClient('3');
        await client.api('/me/sendMail').post(mail);
    } catch (error) {
        console.error('Fout bij verzenden onkostennota e-mail via Graph:', error);
        if (error?.body) {
            console.error('Graph error body:', error.body);
        }
        throw new Error('Fout bij verzenden onkostennota e-mail: ' + error.message);
    }
    
  }

  private _arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
