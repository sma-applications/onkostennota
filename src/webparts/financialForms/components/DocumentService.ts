// OnkostenNotaDocumentService.ts
import { IFinancialFormsProps } from './IFinancialFormsProps';
import { PDFDocument, StandardFonts, rgb, PDFPage } from 'pdf-lib';

// Pas deze paden aan als jouw assets-map anders heet
// In SPFx kun je ook import gebruiken i.p.v. require, als je dat verkiest.
const arcadiaLogoUrl: string = require('../assets/arcadia.png');
const smaLogoUrl: string = require('../assets/SMA_logo.png');

export class DocumentService {
  private readonly _userDisplayName: string;

  constructor(props: IFinancialFormsProps) {
    this._userDisplayName = props.userDisplayName;
  }

  /**
   * Bouwt de Onkostennota-PDF volledig in-memory met pdf-lib,
   * en voegt de factuur (pdf of afbeelding) toe als extra pagina's.
   *
   * `formValues` is het object dat je in OnkostenNota.tsx maakt uit FormData:
   *   {
   *     omschrijving,
   *     categorie,
   *     bedrag,
   *     rekeningnummer,
   *     doorgerekend,
   *     uitstapOfVak?,
   *     bedragLeerlingen?,
   *     klassenOfLeerlingen?,
   *     factuur: File,
   *   }
   */
  public async generatePdfFromTemplate(
    formValues: { [key: string]: any }
  ): Promise<Blob> {

    // 1. Basis onkostennota-PDF bouwen
    const basePdfBytes = await this._buildOnkostenNotaPdf(formValues);
    const basePdfBlob = new Blob([basePdfBytes], { type: 'application/pdf' });

    // 2. Factuur-bestand (File) uit formValues halen
    const invoiceFiles =
      (formValues['facturen'] as File[] | undefined)?.filter(
        (f) => f && f.size > 0
      ) ?? [];

    if (invoiceFiles.length > 0) {
      const merged = await this.mergePdfWithInvoices(basePdfBlob, invoiceFiles);
      return merged.pdfBlob;
    }

    // Geen factuur (zou normaal niet gebeuren door de validator) → enkel basis-pdf
    return basePdfBlob;
  }

  // --------------------------------------------------
  // 1. Basis Onkostennota-pagina opbouwen
  // --------------------------------------------------

  private async _buildOnkostenNotaPdf(
    formValues: { [key: string]: any }
  ): Promise<Uint8Array> {

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
     const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const marginLeft = 50;
    const marginRight = 50;
    const contentWidth = width - marginLeft - marginRight;

    // ------------------ HEADER met logo's + adres ------------------
    const headerLines = [
      'Herseltsesteenweg 4, 3200 Aarschot',
      '016 30 08 20',
      'KBO 0409 949 615 / RPR Leuven'
    ];
    const headerFontSize = 9;

    let headerBottomY: number;

    try {
      // Logos laden vanuit bundel-URL
      const [arcadiaBuf, smaBuf] = await Promise.all([
        fetch(arcadiaLogoUrl).then(r => r.arrayBuffer()),
        fetch(smaLogoUrl).then(r => r.arrayBuffer())
      ]);

      const arcadiaImg = await pdfDoc.embedPng(arcadiaBuf);
      const smaImg = await pdfDoc.embedPng(smaBuf);

      const logoHeight = 40;
      const arcadiaWidth = (arcadiaImg.width / arcadiaImg.height) * logoHeight;
      const smaWidth = (smaImg.width / smaImg.height) * logoHeight;

      const logoY = height - 60 - logoHeight;

      // Linker logo
      page.drawImage(arcadiaImg, {
        x: marginLeft,
        y: logoY,
        width: arcadiaWidth,
        height: logoHeight
      });

      // Rechter logo
      page.drawImage(smaImg, {
        x: width - marginRight - smaWidth,
        y: logoY,
        width: smaWidth,
        height: logoHeight
      });

      // Adresblok gecentreerd tussen de logo's
      let headerY = logoY + logoHeight - headerFontSize;

      for (const line of headerLines) {
        const textWidth = font.widthOfTextAtSize(line, headerFontSize);
        const x = (width - textWidth) / 2;
        page.drawText(line, {
          x,
          y: headerY,
          size: headerFontSize,
          font,
          color: rgb(0, 0, 0)
        });
        headerY -= headerFontSize + 2;
      }

      headerBottomY = headerY;
    } catch (e) {
      // Fallback: geen logo's (pad fout of iets anders)
      let headerY = height - 80;
      for (const line of headerLines) {
        const textWidth = font.widthOfTextAtSize(line, headerFontSize);
        const x = (width - textWidth) / 2;
        page.drawText(line, {
          x,
          y: headerY,
          size: headerFontSize,
          font,
          color: rgb(0, 0, 0)
        });
        headerY -= headerFontSize + 2;
      }
      headerBottomY = headerY;
    }

    // Start van de hoofdinhoud een stukje onder de header
    let y = headerBottomY - 30;

    const drawText = (
      text: string,
      options?: { bold?: boolean; size?: number; lineGap?: number }
    ) => {
      const size = options?.size ?? 11;
      const lineGap = options?.lineGap ?? 4;
      const usedFont = options?.bold ? boldFont : font;

      if (text && text.trim().length > 0) {
        page.drawText(text, {
          x: marginLeft,
          y,
          size,
          font: usedFont,
          color: rgb(0, 0, 0)
        });
      }
      y -= size + lineGap;
    };

    const wrapAndDraw = (
      text: string,
      maxChars: number,
      options?: { bold?: boolean; size?: number; lineGap?: number }
    ) => {
      if (!text) {
        return;
      }
      const lines = this._wrapText(text, maxChars);
      for (const line of lines) {
        drawText(line, options);
      }
    };

    // ----- Titel -----
    drawText('Onkostennota', { bold: true, size: 18, lineGap: 10 });
    y -= 10;

    // ----- Basisgegevens -----
    const datum = this._formatDateDutch(new Date());
    const voornaamNaam =
      (formValues['voornaamNaam'] as string) || this._userDisplayName;

    drawText(`Voornaam en naam: ${voornaamNaam}   Datum: ${datum}`, {
      size: 11
    });
    y -= 10;

    

    drawText(
      'Heeft de toestemming verkregen via begroting of klasbudget voor:',
      { size: 11 }
    );
    y -= 10;

    // ------------------ Kader 1: toestemming + omschrijving + categorie ------------------
    const kader1TopY = y + 5;

    // ----- Omschrijving aankoop/kosten -----
    drawText('Omschrijving aankoop/kosten:', { bold: true });
    wrapAndDraw(String(formValues['omschrijving'] ?? ''), 90);
    y -= 10;

    // ----- Categorie -----
    drawText('Categorie:', { bold: true });
    drawText(String(formValues['categorie'] ?? ''), { size: 11 });
    drawText(
      'Aankoop B- of C-producten vereist VOORAF de toestemming van de preventiedienst',
      { size: 9 }
    );

    // Kader 1 tekenen rond bovenstaande blok
    this._drawSectionBox(
      page,
      marginLeft,
      contentWidth,
      kader1TopY,
      y
    );
    y -= 20;

    // ------------------ Kader 2: bedragen & rekeningnummer ------------------
    const kader2TopY = y+5;
    // ----- Bedragen & rekeningnummer -----
    const bedrag = this._formatEuro(formValues['bedrag']);
    const rekeningNummer = String(formValues['rekeningnummer'] ?? '');

    // In de Word template staat het bedrag twee keer; hier houden we
    // dezelfde informatie aan.

    drawText(
      `Volgend bedrag dient aan mij overgeschreven worden: € ${bedrag}`,
      { bold: true }
    );
    y -= 5;

    drawText(`Mijn rekeningnummer: ${rekeningNummer}`, { size: 11 });
    this._drawSectionBox(
      page,
      marginLeft,
      contentWidth,
      kader2TopY,
      y
    );
    y -= 20;

    // ----- Doorgerekend-blok (optioneel) -----
    const doorgerekend = String(formValues['doorgerekend'] ?? '').toLowerCase();

    if (doorgerekend === 'ja') {
      const uitstapOfVak = String(formValues['uitstapOfVak'] ?? '');
      const bedragLeerlingen = this._formatEuro(formValues['bedragLeerlingen']);
      const klassenOfLeerlingen = String(
        formValues['klassenOfLeerlingen'] ?? ''
      );

      drawText('Aankoop/onkosten door te rekenen aan de leerlingen', {
        bold: true
      });
      y -= 10;

      drawText(
        `Aankoop/onkosten voor vak of uitstap: ${uitstapOfVak}.`,
        { size: 11 }
      );
      y -= 5;
      drawText(
        `Van dit bedrag moet € ${bedragLeerlingen} worden doorgerekend aan de volgende leerlingen:`,
        { size: 11 }
      );
      wrapAndDraw(klassenOfLeerlingen, 90);
      y -= 10;
    }

    // ----- Factuur/kasbon -----
    drawText('Factuur of kassabon:', { bold: true });
    drawText('Zie bijlage.', { size: 11 });
    y -= 20;

    // Kleine code/versieregel zoals in de template
    drawText('CPD Arcadia-2021.02.10', { size: 8 });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }

  // Tekent een rechthoek als kader rond een sectie
  private _drawSectionBox(
    page: PDFPage,
    x: number,
    width: number,
    sectionTopY: number,
    currentY: number
  ): void {
    const paddingTop = 6;
    const paddingBottom = 4;
    const paddingSides = 4;

    // sectionTopY is y vóór de eerste regel; currentY is y ná de laatste regel
    const boxTop = sectionTopY + paddingTop;
    const boxBottom = currentY - paddingBottom;
    const height = boxTop - boxBottom;

    page.drawRectangle({
      x: x - paddingSides,
      y: boxBottom,
      width: width + paddingSides * 2,
      height,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0)
    });
  }

  // --------------------------------------------------
  // Helpers: datum, euro, tekst-wrapping
  // --------------------------------------------------

  private _formatDateDutch(date: Date): string {
    return date.toLocaleDateString('nl-BE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private _formatEuro(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    const num =
      typeof value === 'number'
        ? value
        : parseFloat(String(value).replace(',', '.'));
    if (isNaN(num)) {
      return String(value);
    }
    return num.toFixed(2).replace('.', ',');
  }

  private _wrapText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        if (current.length > 0) {
          lines.push(current);
        }
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    if (current.length > 0) {
      lines.push(current);
    }
    return lines;
  }

  // --------------------------------------------------
  // 2. Mergen met factuur (pdf of afbeelding)
  // --------------------------------------------------

  public async mergePdfWithInvoices(
  formPdfBlob: Blob,
  invoiceFiles: File[]
): Promise<{ pdfBlob: Blob; pdfSharePointUrl?: string }> {

  const formPdfBytes = new Uint8Array(await formPdfBlob.arrayBuffer());
  const formPdfDoc = await PDFDocument.load(formPdfBytes);

  for (const invoiceFile of invoiceFiles) {
    const invoicePdfBytes = await this._ensureInvoicePdf(invoiceFile);
    const invoicePdfDoc = await PDFDocument.load(invoicePdfBytes);

    const pages = await formPdfDoc.copyPages(
      invoicePdfDoc,
      invoicePdfDoc.getPageIndices()
    );
    pages.forEach((p) => formPdfDoc.addPage(p));
  }

  const mergedBytes = await formPdfDoc.save();
  const mergedBlob = new Blob([mergedBytes.buffer], {
    type: 'application/pdf'
  });

  return { pdfBlob: mergedBlob };
}


  // Zorgt ervoor dat we altijd pdf-bytes krijgen: rechtstreeks of via image → pdf
  private async _ensureInvoicePdf(file: File): Promise<Uint8Array> {
    if (file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    }

    // Anders gaan we ervan uit dat het een afbeelding is (jpg/png/…)
    const imageBytes = new Uint8Array(await file.arrayBuffer());
    return this._imageToPdf(imageBytes, file);
  }

  // Afbeelding (jpg/png) in één pagina-pdf omzetten
  private async _imageToPdf(
    imageBytes: Uint8Array,
    file: File
  ): Promise<Uint8Array> {

    const pdfDoc = await PDFDocument.create();

    let embedded;
    if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      embedded = await pdfDoc.embedJpg(imageBytes);
    } else {
      // png of iets anders → probeer als png
      embedded = await pdfDoc.embedPng(imageBytes);
    }

    const { width, height } = embedded;
    const page = pdfDoc.addPage([width, height]);

    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width,
      height
    });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  }
}
