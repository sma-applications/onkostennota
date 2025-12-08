import { PdfLayoutHelper } from "./PdfLayoutHelper";

export function createOpenbaarVervoerPdf(
    layout: PdfLayoutHelper,
    formValues: { [key: string]: any }
) {
  // ----- Titel -----
  layout.drawText('Openbaar vervoer voor het woon-werkverkeer', { bold: true, size: 18, lineGap: 10 });
  layout.y -= 10;// Implement the PDF creation logic for openbaar vervoer here

  const kader1TopY = layout.y + 5;
    // ----- Basisgegevens -----
  const datum = layout.formatDateDutch(new Date());
  const voornaamNaam =
    (formValues['userDisplayName'] as string) || '';

  layout.drawText(`Voornaam en naam: ${voornaamNaam}`, {
    size: 11
  });
  layout.y -= 10;

  layout.drawText(`Datum: ${datum}`, {
    size: 11
  });
  layout.y -= 10;

  const rekeningNummer = (formValues['rekeningnummer'] as string) || '';
  layout.drawText(`Rekeningnummer: ${rekeningNummer}`, { size: 11 });

  layout.drawSectionBox(kader1TopY, layout.y);
  layout.y -= 20;


  const maand = formValues['maand'] as string || '';
  const jaar = formValues['jaar'] as string || '';

  layout.wrapAndDraw(`Ik verklaar op eer dat ik tijdens de maand ${maand} ${jaar} het openbaar vervoer heb gebruikt voor de woon-werkverplaatsing of een deel ervan.`, 90);

  const bedrag = layout.formatEuro(formValues['bedrag']);
  layout.drawText(
    `Volgend bedrag dient aan mij overgeschreven worden: € ${bedrag}`,
    { bold: true }
  );
  layout.y -= 20;

  layout.drawText('Factuur of kassabon:', { bold: true });
  layout.drawText('Zie bijlage.', { size: 11 });
}