// OnkostenNotaDocumentService.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { SPHttpClient } from '@microsoft/sp-http';
import { ResponseType } from '@microsoft/microsoft-graph-client';
import { IOnkostenNotaProps } from './IOnkostenNotaProps';
import { OnkostenNotaPathService } from './OnkostenNotaPathService';

export interface IGeneratedOnkostenNota {
  pdfBlob: Blob;
  pdfFileName: string;
  // Optionally, if you upload the PDF to SharePoint:
  pdfSharePointUrl?: string;
  docxSharePointUrl?: string;
}

export class OnkostenNotaDocumentService {
  private readonly _context: WebPartContext;
  private readonly _userDisplayName: string;
  private readonly _pathService: OnkostenNotaPathService;

  /**
   * Construct the service from the web part props.
   * All URL related concerns (site, library, folders, ...) are delegated
   * to OnkostenNotaPathService.
   */
  constructor(props: IOnkostenNotaProps) {
    this._context = props.context;
    this._userDisplayName = props.userDisplayName;
    this._pathService = new OnkostenNotaPathService(props);
  }

  /**
   * Main entry point: generate a filled PDF from template + form values.
   * `formValues` is a simple object { omschrijving: '...', bedrag: '...', ... }.
   * /sites/SSM-Personeel/Gedeelde documenten/financieel/forms/onkostennota_template.docx
   * /sites/SSM-Personeel/Gedeelde documenten/financieel/temp
   */
  public async generatePdfFromTemplate(
    formValues: { [key: string]: any },
  ): Promise<IGeneratedOnkostenNota> {

    // 1. Download template as ArrayBuffer
    const templateBuffer = await this._downloadTemplate();

    // 2. Fill template with data (using your preferred DOCX library)
    const filledDocxBuffer = await this._fillTemplateWithData(templateBuffer, formValues);

    // 3. Upload the filled DOCX back to SharePoint (to a temp folder)
    const safeUser = this._sanitizeFileName(this._userDisplayName);
    const timestamp = Date.now();
    const docxFileName = `Onkostennota_${safeUser}_${timestamp}.docx`;

    const uploadResult = await this._uploadFilledDocx(filledDocxBuffer, docxFileName);
    console.log('Uploaded DOCX info:', uploadResult);

    // 4. Convert uploaded DOCX to PDF via Graph
    const pdfBlob = await this._convertDriveItemToPdf(uploadResult.driveId, uploadResult.itemId);

    // 5. (Optional) upload PDF to SharePoint as well
    const pdfFileName = docxFileName.replace(/\.docx$/i, '.pdf');
    let pdfSharePointUrl: string | undefined;
    try {
      const pdfUploadResult = await this._uploadPdf(pdfBlob, pdfFileName);
      if (pdfUploadResult) {
        pdfSharePointUrl = pdfUploadResult.fileUrl;
      }
    } catch (e) {
      console.error('Failed to upload generated PDF, continuing with blob only', e);
    }

    return {
      pdfBlob,
      pdfFileName,
      pdfSharePointUrl,
      docxSharePointUrl: uploadResult.fileUrl
    };
  }

  // --------------------------------------------------
  // 1. Download template from SharePoint
  // --------------------------------------------------

  /**
   * Download the DOCX template from SharePoint using SPHttpClient.
   * The exact URL is provided by the PathService.
   */
  private async _downloadTemplate(): Promise<ArrayBuffer> {
    const apiUrl = this._pathService.getTemplateDownloadUrl();

    console.log('Downloading template from:', apiUrl);

    const response = await this._context.spHttpClient.get(
      apiUrl,
      SPHttpClient.configurations.v1
    );

    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  // --------------------------------------------------
  // 2. Fill template with data
  // --------------------------------------------------

  private async _fillTemplateWithData(
    templateBuffer: ArrayBuffer,
    formValues: { [key: string]: any }
  ): Promise<ArrayBuffer> {
    // Here you plug in your DOCX manipulation of choice (docxtemplater, PizZip, etc.).
    // Pseudo-code:
    //
    // const zip = new PizZip(templateBuffer);
    // const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    // doc.setData(formValues);
    // doc.render();
    // const out = doc.getZip().generate({ type: 'arraybuffer' });
    // return out;
    //
    // For now, just return the template unchanged so the structure compiles:
    return templateBuffer;
  }

  // --------------------------------------------------
  // 3. Upload filled DOCX and resolve Graph drive/item
  // --------------------------------------------------

  private async _uploadFilledDocx(
    filledBuffer: ArrayBuffer,
    fileName: string
  ): Promise<{ driveId: string; itemId: string; fileUrl: string }> {

    const uploadUrl = this._pathService.getUploadDocxUrl(fileName);

    console.log('Uploading filled DOCX to:', uploadUrl);

    const response = await this._context.spHttpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1,
      { body: filledBuffer }
    );

    if (!response.ok) {
      const bodyText = await response.text();
      console.error('Failed to upload DOCX', response.status, response.statusText, bodyText);
      throw new Error(`Failed to upload DOCX (status ${response.status})`);
    }

    const fileInfo: any = await response.json();

    // fileInfo.ServerRelativeUrl is the file’s full path (not strictly needed anymore,
    // but logged for debugging purposes).
    console.log('Uploaded file serverRelativeUrl:', fileInfo.ServerRelativeUrl);

    // Resolve drive + item via Graph using the drive-relative path provided by PathService.
    const graphClient = await this._getGraphClient();

    // Graph path based purely on the configured temp folder + fileName
    const graphApiPath = await this._pathService.getGraphDocxInfoApiPath(fileName);

    let driveItem: any;
    try {
      driveItem = await graphClient
        .api(graphApiPath)
        .get();
    } catch (e) {
      console.error('Graph error when resolving driveItem from path:', e);
      throw e;
    }

    if (!driveItem || !driveItem.id || !driveItem.parentReference?.driveId) {
      throw new Error('Could not resolve driveId/itemId for uploaded DOCX via Graph');
    }

    return {
      driveId: driveItem.parentReference.driveId,
      itemId: driveItem.id,
      fileUrl: driveItem.webUrl
    };
  }

  // --------------------------------------------------
  // 4. Convert uploaded DOCX to PDF via Graph
  // --------------------------------------------------

  private async _convertDriveItemToPdf(driveId: string, itemId: string): Promise<Blob> {
    const graphClient = await this._getGraphClient();

    // Microsoft Graph file conversion endpoint:
    const apiPath = this._pathService.getGraphPdfContentApiPath(driveId, itemId);

    const response = await graphClient
      .api(apiPath)
      .responseType(ResponseType.ARRAYBUFFER)
      .get();

    const pdfArrayBuffer = response as ArrayBuffer;
    return new Blob([pdfArrayBuffer], { type: 'application/pdf' });
  }

  // --------------------------------------------------
  // 5. (Optional) upload PDF to SharePoint
  // --------------------------------------------------

  private async _uploadPdf(
    pdfBlob: Blob,
    fileName: string
  ): Promise<{ fileUrl: string } | null> {

    const arrayBuffer = await pdfBlob.arrayBuffer();

    const uploadUrl = this._pathService.getUploadPdfUrl(fileName);

    const response = await this._context.spHttpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1,
      { body: arrayBuffer }
    );

    if (!response.ok) {
      const bodyText = await response.text();
      console.error('Failed to upload PDF', response.status, response.statusText, bodyText);
      throw new Error(`Failed to upload PDF (status ${response.status})`);
    }

    const fileInfo: any = await response.json();
    const serverRelativeFileUrl: string = fileInfo.ServerRelativeUrl;

    return { fileUrl: serverRelativeFileUrl };
  }

  // --------------------------------------------------
  // Graph client helper
  // --------------------------------------------------

  private async _getGraphClient(): Promise<MSGraphClientV3> {
    return await this._context.msGraphClientFactory.getClient("3");
  }

  /**
   * Make username safe for filenames
   */
  private _sanitizeFileName(name: string): string {
    return name.replace(/[^a-z0-9_-]/gi, "_");
  }
}
