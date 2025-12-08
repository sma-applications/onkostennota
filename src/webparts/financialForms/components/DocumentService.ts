// OnkostenNotaDocumentService.ts
import { IFinancialFormsProps } from './IFinancialFormsProps';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PdfLayoutHelper } from './pdf/PdfLayoutHelper';
import { createOnkostenNotaPdf } from './pdf/onkostenNotaPdf';
import { createOpenbaarVervoerPdf } from './pdf/openbaarVervoerPdf';


export class DocumentService {
  constructor(props: IFinancialFormsProps) {

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
    const basePdfBytes = await this._buildPdf(formValues);
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

  private async _buildPdf(
  formValues: { [key: string]: any }
): Promise<Uint8Array> {

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  //const { width } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const marginLeft = 50;
  const marginRight = 50;

  // Helper instantiëren
  const layout = new PdfLayoutHelper(
    pdfDoc,
    page,
    font,
    boldFont,
    marginLeft,
    marginRight
  );

  // ------------------ HEADER ------------------
  const headerBottomY = await layout.generateHeader();

  // Start van de hoofdinhoud een stukje onder de header
  layout.y = headerBottomY - 30;

  // ------------------ INHOUD ------------------
  if (formValues['formType'] === 'onkostennota') {
    // Onkostennota
    createOnkostenNotaPdf(layout, formValues);
  } else if (formValues['formType'] === 'verplaatsing') {
    // Verplaatsingsformulier 

  }// To be implemented
  else if (formValues['formType'] === 'openbaar_vervoer') {
    // Openbaar vervoer formulier
    createOpenbaarVervoerPdf(layout, formValues);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
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
