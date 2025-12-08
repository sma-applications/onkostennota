import { PdfLayoutHelper } from "./PdfLayoutHelper";

export function createOnkostenNotaPdf(
  layout: PdfLayoutHelper,
  formValues: { [key: string]: any }
) {
  // ----- Titel -----
  layout.drawText('Onkostennota', { bold: true, size: 18, lineGap: 10 });
  layout.y -= 10;

  // ----- Basisgegevens -----
  const datum = layout.formatDateDutch(new Date());
  const voornaamNaam =
    (formValues['userDisplayName'] as string) || '';

  layout.drawText(`Voornaam en naam: ${voornaamNaam}   Datum: ${datum}`, {
    size: 11
  });
  layout.y -= 10;

  layout.drawText(
    'Heeft de toestemming verkregen via begroting of klasbudget voor:',
    { size: 11 }
  );
  layout.y -= 10;

  // ------------------ Kader 1: toestemming + omschrijving + categorie ------------------
  const kader1TopY = layout.y + 5;

  // ----- Omschrijving aankoop/kosten -----
  layout.drawText('Omschrijving aankoop/kosten:', { bold: true });
  layout.wrapAndDraw(String(formValues['omschrijving'] ?? ''), 90);
  layout.y -= 10;

  // ----- Categorie -----
  layout.drawText('Categorie:', { bold: true });
  layout.drawText(String(formValues['categorie'] ?? ''), { size: 11 });
  layout.drawText(
    'Aankoop B- of C-producten vereist VOORAF de toestemming van de preventiedienst',
    { size: 9 }
  );

  // Kader 1 tekenen rond bovenstaande blok
  layout.drawSectionBox(kader1TopY, layout.y);
  layout.y -= 20;

  // ------------------ Kader 2: bedragen & rekeningnummer ------------------
  const kader2TopY = layout.y + 5;

  const bedrag = layout.formatEuro(formValues['bedrag']);
  const rekeningNummer = String(formValues['rekeningnummer'] ?? '');

  layout.drawText(
    `Volgend bedrag dient aan mij overgeschreven worden: € ${bedrag}`,
    { bold: true }
  );
  layout.y -= 5;

  layout.drawText(`Mijn rekeningnummer: ${rekeningNummer}`, { size: 11 });

  layout.drawSectionBox(kader2TopY, layout.y);
  layout.y -= 20;

  // ------------------ Eventueel kader 3: doorgerekend aan leerlingen ------------------
  if (formValues['doorgerekend'] === 'ja') {
    const kader3TopY = layout.y + 5;

    const uitstapOfVak = String(formValues['uitstapOfVak'] ?? '');
    const bedragLeerlingen = layout.formatEuro(
      formValues['bedragLeerlingen']
    );
    const klassenOfLeerlingen = String(
      formValues['klassenOfLeerlingen'] ?? ''
    );

    layout.drawText('Aankoop/onkosten door te rekenen aan de leerlingen', {
      bold: true
    });
    layout.y -= 10;

    layout.drawText(
      `Aankoop/onkosten voor vak of uitstap: ${uitstapOfVak}.`,
      { size: 11 }
    );
    layout.y -= 5;

    layout.drawText(
      `Van dit bedrag moet € ${bedragLeerlingen} worden doorgerekend aan de volgende leerlingen:`,
      { size: 11 }
    );
    layout.wrapAndDraw(klassenOfLeerlingen, 90);
    layout.y -= 10;

    layout.drawSectionBox(kader3TopY, layout.y);
    layout.y -= 20;
  }

  // ----- Factuur/kasbon -----
  layout.drawText('Factuur of kassabon:', { bold: true });
  layout.drawText('Zie bijlage.', { size: 11 });
  layout.y -= 20;

  // Kleine code/versieregel zoals in de template
  layout.drawText('CPD Arcadia-2021.02.10', { size: 8 });
}