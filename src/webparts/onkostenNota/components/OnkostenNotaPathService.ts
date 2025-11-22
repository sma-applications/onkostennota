// OnkostenNotaPathService.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IOnkostenNotaProps } from './IOnkostenNotaProps';

export class OnkostenNotaPathService {
  private readonly _context: WebPartContext;
  private readonly _props: IOnkostenNotaProps;
  private readonly _libraryDisplayName: string;
  private _resolvedSiteId: string | null = null;

  /**
   * @param site   e.g. "SSM-Personeel"
   * @param templateFileUrl e.g. "financieel/forms/onkostennota_template.docx"
   * @param tempDirLocation e.g. "financieel/temp"
   */
  constructor(props: IOnkostenNotaProps) {
    this._context = props.context;
    this._props = props;

    // In your tenant this is "Gedeelde documenten".
    // If you ever change the library, change it here or make it a web part prop.
    this._libraryDisplayName = 'Gedeelde documenten';
  }

  // ---------------------------------------------------
  // Basic building blocks
  // ---------------------------------------------------

  /** Tenant root, e.g. "https://arcadiascholen.sharepoint.com" */
  public getTenantRootUrl(): string {
    const abs = this._context.pageContext.site.absoluteUrl;
    const idx = abs.toLowerCase().indexOf('/sites/');
    return idx > -1 ? abs.substring(0, idx) : abs;
  }

  /** Site relative URL, e.g. "/sites/SSM-Personeel" */
  public getTargetSiteServerRelativeUrl(): string {
    return `/sites/${this._props.site}`;
  }

  /** Site absolute URL, e.g. "https://.../sites/SSM-Personeel" */
  public getTargetSiteAbsoluteUrl(): string {
    return `${this.getTenantRootUrl()}${this.getTargetSiteServerRelativeUrl()}`;
  }

  /** Server-relative URL of the document library root for this site. */
  public getDocumentLibraryServerRelativeUrl(): string {
    // /sites/SSM-Personeel/Gedeelde documenten
    return `${this.getTargetSiteServerRelativeUrl()}/${this._libraryDisplayName}`;
  }

  /** Template file server-relative path, for SP REST. */
  public getTemplateFileServerRelativeUrl(): string {
    // /sites/SSM-Personeel/Gedeelde documenten/financieel/forms/onkostennota_template.docx
    const relPath = this._props.templateFileUrl.replace(/^\/+/, '');
    return `${this.getDocumentLibraryServerRelativeUrl()}/${relPath}`;
  }

  /** Temp folder server-relative path, for uploading DOCX/PDF via SP REST. */
  public getTempFolderServerRelativeUrl(): string {
    // /sites/SSM-Personeel/Gedeelde documenten/financieel/temp
    const relPath = this._props.tempDirLocation.replace(/^\/+/, '');
    return `${this.getDocumentLibraryServerRelativeUrl()}/${relPath}`;
  }

  /** Email address from props (centralised here so DocumentService doesn't touch props directly). */
  public getNotificationEmail(): string {
    return this._props.notificationEmail;
  }



    
  public async getSiteId(): Promise<string> {
    if (this._resolvedSiteId) return this._resolvedSiteId;

    const webUrl = this._props.context.pageContext.site.absoluteUrl; 
    const hostname = new URL(webUrl).hostname;       // arcadiascholen.sharepoint.com
    const sitePath = this._props.site;                // "/sites/SSM-Personeel"

    const graphClient = await this._props.context.msGraphClientFactory.getClient("3");

    const siteInfo = await graphClient
        .api(`/sites/${hostname}:/sites/${sitePath}`)
        .get();

    this._resolvedSiteId = siteInfo.id;
    return this._resolvedSiteId!;
}


  // ---------------------------------------------------
  // SPHttpClient URLs
  // ---------------------------------------------------

  /**
   * Full SP REST URL to download the template (as file content).
   * Use with SPHttpClient: GET -> returns the DOCX bytes.
   */
  public getTemplateDownloadUrl(): string {
    const fileUrl = this.getTemplateFileServerRelativeUrl();
    return `${this.getTargetSiteAbsoluteUrl()}` +
      `/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(fileUrl)}')/$value`;
  }

  /**
   * SP REST URL to upload a filled DOCX into the temp folder.
   * Use with SPHttpClient: POST body = ArrayBuffer.
   */
  public getUploadDocxUrl(fileName: string): string {
    const folderUrl = this.getTempFolderServerRelativeUrl();
    return `${this.getTargetSiteAbsoluteUrl()}` +
      `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')` +
      `/Files/add(overwrite=true, url='${encodeURIComponent(fileName)}')`;
  }

  /**
   * SP REST URL to upload a generated PDF into the temp folder.
   * This is symmetrical with getUploadDocxUrl, just a different fileName (.pdf).
   */
  public getUploadPdfUrl(fileName: string): string {
    const folderUrl = this.getTempFolderServerRelativeUrl();
    return `${this.getTargetSiteAbsoluteUrl()}` +
      `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')` +
      `/Files/add(overwrite=true, url='${encodeURIComponent(fileName)}')`;
  }

  // ---------------------------------------------------
  // Graph "path" helpers (used to build API paths, not full URLs)
  // ---------------------------------------------------

  /**
   * Returns the *drive-relative* path of a file in the temp folder,
   * e.g. "financieel/temp/Onkostennota_Yvan_123456789.docx".
   *
   * This assumes that, for the SSM-Personeel site, the Graph drive root
   * corresponds to this document library ("Gedeelde documenten" / "Shared Documents").
   */
  public getGraphTempFilePath(fileName: string): string {
    const tempPath = this._props.tempDirLocation.replace(/^\/+/, ''); // "financieel/temp"
    return `${tempPath}/${fileName}`;
  }

  /**
   * Path portion for Graph to resolve the DOCX DriveItem by path.
   * You still prepend the siteId externally:
   *
   *   const apiPath = pathService.getGraphDocxInfoApiPath(siteId, fileName);
   *   graphClient.api(apiPath).get();
   */
  public async getGraphDocxInfoApiPath(fileName: string): Promise<string> {
    const siteId = await this.getSiteId();
    const driveRelativePath = this.getGraphTempFilePath(fileName); // "financieel/temp/..."
    // /sites/{siteId}/drive/root:/financieel/temp/Onkostennota_....docx
    return `/sites/${siteId}/drive/root:/${encodeURI(driveRelativePath)}`;
  }

  /**
   * Graph path to download the PDF version of a DriveItem.
   * Typical call:
   *
   *   const apiPath = pathService.getGraphPdfContentApiPath(driveId, itemId);
   *   const pdfResponse = await graphClient.api(apiPath).get();
   */
  public getGraphPdfContentApiPath(driveId: string, itemId: string): string {
    // /drives/{driveId}/items/{itemId}/content?format=pdf
    return `/drives/${driveId}/items/${itemId}/content?format=pdf`;
  }
}
