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
  private tempDirLocation: string;
  private _targetWebUrl: string;
  private _sitePrefix: string;          // <-- store the /sites/... prefix
  private _userDisplayName: string;     // <-- store username

  constructor(context: WebPartContext, tempDirLocation: string, userDisplayName: string) {
    this._context = context;
    this._userDisplayName = userDisplayName;

    this.tempDirLocation = tempDirLocation.replace(/\/$/, '');

    // Decide which library/folder you want to use:
    // e.g. /sites/YourSite/Shared Documents/Onkostennota/
    const folderServerRelativeUrl = this.tempDirLocation.trim();
    
    // 1. Extract the site part: "/sites/SSM-Personeel"
    const siteMatch = folderServerRelativeUrl.match(/^\/sites\/[^\/]+/);
    this._sitePrefix = siteMatch ? siteMatch[0] : "";
    const siteRelativeUrl = siteMatch
        ? siteMatch[0]
        : this._context.pageContext.web.serverRelativeUrl; // fallback

    // 2. Get the tenant root: "https://arcadiascholen.sharepoint.com"
    const tenantRoot = this._context.pageContext.site.absoluteUrl
        .split('/sites/')[0];

    // 3. Build the correct base URL for the API:
    this._targetWebUrl = `${tenantRoot}${siteRelativeUrl}`;
    // -> "https://arcadiascholen.sharepoint.com/sites/SSM-Personeel"
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
    console.log('Downloaded template:', templateBuffer);

    // 2. Fill template with data (using your preferred DOCX library)
    const filledDocxBuffer = await this._fillTemplateWithData(templateBuffer, formValues);

    // 3. Upload the filled DOCX back to SharePoint (to a library of your choice)
    // ---- Unique filename ----
    const safeUser = this._sanitizeFileName(this._userDisplayName);
    const timestamp = Date.now();

    const docxName = `Onkostennota_${safeUser}_${timestamp}.docx`;
    const pdfName  = `Onkostennota_${safeUser}_${timestamp}.pdf`;

    const uploadResult = await this._uploadFilledDocx(
      filledDocxBuffer,
      docxName
    );
    console.log('Uploaded filled DOCX to SharePoint:', uploadResult);

    // Clean the itemId before passing to Graph
    const cleanedItemId = this._stripSitePrefix(uploadResult.itemId);
    console.log('Cleaned itemId for Graph:', cleanedItemId);
    console.log('Site prefix:', this._sitePrefix);

    // 4. Convert the uploaded DOCX to PDF via Graph

    const pdfBlob = await this._convertDriveItemToPdf(
      uploadResult.driveId,
      cleanedItemId
    );

    // 5. (Optional) upload the PDF to SharePoint as well
    const pdfUploadResult = await this._uploadPdf(pdfBlob, pdfName);

    return {
      pdfBlob,
      pdfFileName: pdfName,
      pdfSharePointUrl: pdfUploadResult?.fileUrl,
      docxSharePointUrl: uploadResult.fileUrl
    };
  }

  // --------------------------------------------------
  // 1. Download template
  // --------------------------------------------------

  private async _downloadTemplate(templateFileUrl: string): Promise<ArrayBuffer> {
    const apiUrl =
        `${this._targetWebUrl}` +
        `/_api/web/GetFileByServerRelativeUrl('${templateFileUrl}')/$value`;

    console.log('Downloading template from:', apiUrl);

    const response = await this._context.spHttpClient.get(
      apiUrl,
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
    const folderServerRelativeUrl = this.tempDirLocation.trim();

    const uploadUrl =
    `${this._targetWebUrl}` +
    `/_api/web/GetFolderByServerRelativeUrl('${folderServerRelativeUrl}')` +
    `/Files/add(overwrite=true, url='${fileName}')`;

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

    // fileInfo.ServerRelativeUrl is the file’s full path
    const serverRelativeFileUrl: string = fileInfo.ServerRelativeUrl;

    console.log('Uploaded file serverRelativeUrl:', serverRelativeFileUrl);

    // Resolve drive + item via Graph using the server-relative URL
    const graphClient = await this._getGraphClient();

    // --- FIX: strip the /sites/SSM-Personeel prefix so Graph sees a drive-relative path ---
    let graphRelativePath: string;

    const hasPrefix =
        this._sitePrefix &&
        serverRelativeFileUrl.slice(0, this._sitePrefix.length) === this._sitePrefix;

    if (hasPrefix) {
        // Remove "/sites/SSM-Personeel" → "Gedeelde documenten/financieel/temp/..."
        graphRelativePath = serverRelativeFileUrl
        .substring(this._sitePrefix.length)
        .replace(/^\/+/, '');
    } else {
        // Fallback: use the web's serverRelativeUrl as before
        const webServerRelativeUrl = this._context.pageContext.web.serverRelativeUrl.replace(/\/$/, '');
        graphRelativePath = serverRelativeFileUrl
        .replace(webServerRelativeUrl, '')
        .replace(/^\/+/, '');
    }

    console.log('Graph relative path:', graphRelativePath);

    let driveItem: any;
    try {
        driveItem = await graphClient
        .api(
            `/sites/${this._context.pageContext.site.id}` +
            `/drive/root:/${encodeURI(graphRelativePath)}`
        )
        .get();
    } catch (e) {
        console.error('Graph error when resolving driveItem from path:', e);
        throw e;
    }

    console.log('Resolved driveItem:', driveItem);

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

    const arrayBuffer = await pdfBlob.arrayBuffer();

    const folderServerRelativeUrl = this.tempDirLocation;

    const uploadUrl =
        `${this._context.pageContext.web.absoluteUrl}` +
        `/_api/web/GetFolderByServerRelativeUrl('${folderServerRelativeUrl}')` +
        `/Files/add(overwrite=true, url='${fileName}')`;

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
    const serverRelativeFileUrl: string =
        fileInfo.ServerRelativeUrl || fileInfo.ServerRelativeUrl;

    return { fileUrl: serverRelativeFileUrl };
    }


  // --------------------------------------------------
  // Graph client helper
  // --------------------------------------------------

  private async _getGraphClient(): Promise<MSGraphClientV3> {
    return await this._context.msGraphClientFactory.getClient("3");  
  }

  /**
   * Remove "/sites/XYZ" prefix from itemId if present
   */
  private _stripSitePrefix(itemId: string): string {
    if (!this._sitePrefix) return itemId;
    return itemId.replace(this._sitePrefix, "").replace(/^\/+/, "");
  }


  /**
   * Make username safe for filenames
   */
  private _sanitizeFileName(name: string): string {
    return name.replace(/[^a-z0-9_-]/gi, "_");
  }
}
