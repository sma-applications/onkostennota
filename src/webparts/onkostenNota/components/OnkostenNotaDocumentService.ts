// OnkostenNotaDocumentService.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { SPHttpClient } from '@microsoft/sp-http';
import { ResponseType } from '@microsoft/microsoft-graph-client';

export interface IGeneratedOnkostenNota {
  pdfBlob: Blob;
  pdfFileName: string;
  // Optionally, if you upload the PDF to SharePoint:
  pdfSharePointUrl?: string;
  docxSharePointUrl?: string;
}

export class OnkostenNotaDocumentService {
  private _context: WebPartContext;

  constructor(context: WebPartContext) {
    this._context = context;
  }

  /**
   * Main entry point: generate a filled PDF from template + form values.
   * `formValues` is a simple object { omschrijving: '...', bedrag: '...', ... }.
   */
  public async generatePdfFromTemplate(
    formValues: { [key: string]: any },
    templateFileUrl: string
  ): Promise<IGeneratedOnkostenNota> {

    // 1. Download template as ArrayBuffer
    const templateBuffer = await this._downloadTemplate(templateFileUrl);

    // 2. Fill template with data (using your preferred DOCX library)
    const filledDocxBuffer = await this._fillTemplateWithData(templateBuffer, formValues);

    // 3. Upload the filled DOCX back to SharePoint (to a library of your choice)
    const uploadResult = await this._uploadFilledDocx(filledDocxBuffer, 'Onkostennota_filled.docx');

    // 4. Convert that file to PDF via Microsoft Graph
    const pdfBlob = await this._convertDriveItemToPdf(uploadResult.driveId, uploadResult.itemId);

    // 5. (Optional) upload the PDF to SharePoint as well
    const pdfUploadResult = await this._uploadPdf(pdfBlob, 'Onkostennota_filled.pdf');

    return {
      pdfBlob,
      pdfFileName: 'Onkostennota_filled.pdf',
      pdfSharePointUrl: pdfUploadResult?.fileUrl,
      docxSharePointUrl: uploadResult.fileUrl
    };
  }

  // --------------------------------------------------
  // 1. Download template
  // --------------------------------------------------

  private async _downloadTemplate(templateFileUrl: string): Promise<ArrayBuffer> {
    // If templateFileUrl is a server-relative or absolute SharePoint URL
    // you can use SPHttpClient here. Example:

    const response = await this._context.spHttpClient.get(
      templateFileUrl,
      SPHttpClient.configurations.v1 /* SPHttpClient.configurations.v1 */
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
  // 3. Upload filled DOCX to SharePoint
  // --------------------------------------------------

  private async _uploadFilledDocx(
    filledBuffer: ArrayBuffer,
    fileName: string
  ): Promise<{ driveId: string; itemId: string; fileUrl: string }> {

    // Decide which library/folder you want to use:
    // e.g. /sites/YourSite/Shared Documents/Onkostennota/
    const folderServerRelativeUrl = `${this._context.pageContext.web.serverRelativeUrl}/Shared Documents/Onkostennota`;

    const uploadUrl = `${this._context.pageContext.web.absoluteUrl}` +
      `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderServerRelativeUrl)}')/Files/add(overwrite=true, url='${encodeURIComponent(fileName)}')`;

    const response = await this._context.spHttpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1, // SPHttpClient.configurations.v1
      {
        body: filledBuffer
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload DOCX: ${response.statusText}`);
    }

    //const fileInfo: any = await response.json();

    // Get driveId & itemId for Graph from ListItemAllFields
    // const listItemUrl = fileInfo.ListItemAllFields['__deferred']?.uri;
    // You might use an extra call to _api/web/lists/getbytitle(...)/items(id)?$select=File/UniqueId, etc.
    // For brevity, I'll sketch the idea and then use Graph to resolve drive+item:

    const graphClient = await this._getGraphClient();

    const driveItem = await graphClient
      .api(`/sites/${this._context.pageContext.site.id}/drive/root:/Shared Documents/Onkostennota/${fileName}`)
      .get();

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
    // GET /drives/{driveId}/items/{itemId}/content?format=pdf :contentReference[oaicite:1]{index=1}
    const response = await graphClient
      .api(`/drives/${driveId}/items/${itemId}/content`)
      .query({ format: 'pdf' })
      .responseType(ResponseType.ARRAYBUFFER)
      .get();

    // `response` is an ArrayBuffer
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
    // If you want to keep everything in memory only,
    // just return null here instead of uploading.

    const arrayBuffer = await pdfBlob.arrayBuffer();

    const folderServerRelativeUrl = `${this._context.pageContext.web.serverRelativeUrl}/Shared Documents/Onkostennota`;
    const uploadUrl = `${this._context.pageContext.web.absoluteUrl}` +
      `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderServerRelativeUrl)}')/Files/add(overwrite=true, url='${encodeURIComponent(fileName)}')`;

    const response = await this._context.spHttpClient.post(
      uploadUrl,
      SPHttpClient.configurations.v1,
      {
        body: arrayBuffer
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload PDF: ${response.statusText}`);
    }

    const fileInfo: any = await response.json();
    return {
      fileUrl: fileInfo.ServerRelativeUrl || fileInfo.ServerRelativeUrl
    };
  }

  // --------------------------------------------------
  // Graph client helper
  // --------------------------------------------------

  private async _getGraphClient(): Promise<MSGraphClientV3> {
    return await this._context.msGraphClientFactory.getClient("3");  
  }
}
