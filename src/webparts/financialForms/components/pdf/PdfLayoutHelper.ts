import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';

// Logo's zitten nu in de helper, want de header is voor elke pdf hetzelfde
const arcadiaLogoUrl: string = require('../../assets/arcadia.png');
const smaLogoUrl: string = require('../../assets/SMA_logo.png');

export interface IDrawTextOptions {
  bold?: boolean;
  size?: number;
  lineGap?: number;
}

export class PdfLayoutHelper {
  private _y: number = 0;
  public readonly contentWidth: number;

  constructor(
    private readonly pdfDoc: PDFDocument,
    public readonly page: PDFPage,
    private readonly font: PDFFont,
    private readonly boldFont: PDFFont,
    public readonly marginLeft: number,
    public readonly marginRight: number
  ) {
    const { width } = page.getSize();
    this.contentWidth = width - marginLeft - marginRight;
  }

  /** Huidige verticale positie (y) */
  public get y(): number {
    return this._y;
  }

  public set y(value: number) {
    this._y = value;
  }

  /**
   * Tekent de header met beide logo's en het adresblok.
   * Geeft de y-positie onder de header terug (headerBottomY).
   */
  public async generateHeader(): Promise<number> {
    const { page, font, marginLeft, marginRight } = this;
    const { width, height } = page.getSize();

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

      const arcadiaImg = await this.pdfDoc.embedPng(arcadiaBuf);
      const smaImg = await this.pdfDoc.embedPng(smaBuf);

      const logoHeight = 40;
      const arcadiaWidth =
        (arcadiaImg.width / arcadiaImg.height) * logoHeight;
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

    // Y onder de header bewaren
    this._y = headerBottomY;
    return headerBottomY;
  }

  /**
   * Tekent één regel tekst op de huidige y-positie
   * en schuift y daarna naar beneden.
   */
  public drawText(text: string, options?: IDrawTextOptions): void {
    const size = options?.size ?? 11;
    const lineGap = options?.lineGap ?? 4;
    const usedFont = options?.bold ? this.boldFont : this.font;

    if (text && text.trim().length > 0) {
      this.page.drawText(text, {
        x: this.marginLeft,
        y: this._y,
        size,
        font: usedFont,
        color: rgb(0, 0, 0)
      });
    }
    this._y -= size + lineGap;
  }

  /**
   * Wrapt tekst in regels van maxChars en tekent elke regel
   * via drawText (y wordt automatisch aangepast).
   */
  public wrapAndDraw(
    text: string,
    maxChars: number,
    options?: IDrawTextOptions
  ): void {
    if (!text) {
      return;
    }
    const lines = this.wrapText(text, maxChars);
    for (const line of lines) {
      this.drawText(line, options);
    }
  }

  /** Tekent een rechthoek als kader rond een sectie. */
  public drawSectionBox(
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

    this.page.drawRectangle({
      x: this.marginLeft - paddingSides,
      y: boxBottom,
      width: this.contentWidth + paddingSides * 2,
      height,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0)
    });
  }

  // ----------------- Helpers voor datum, euro, wrapping -----------------

  public formatDateDutch(date: Date): string {
    return date.toLocaleDateString('nl-BE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  public formatEuro(value: any): string {
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

  public wrapText(text: string, maxChars: number): string[] {
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
}
