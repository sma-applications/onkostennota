// onkostennotaValidation.ts

export interface ValidationErrors {
  [key: string]: string;
}

export function validateOnkostennota(
  formData: FormData,
  doorgerekend: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  // 1. Omschrijving
  const omschrijving = getText('omschrijving', formData);
  if (!omschrijving) {
    errors['omschrijving'] = 'Vul hier een korte omschrijving in.';
  } else if (omschrijving.length < 5) {
    errors['omschrijving'] = 'De omschrijving is te kort.';
  }

  // 2. Categorie (A/B/C)
  const categorie = getText('categorie', formData);
  if (!categorie) {
    errors['categorie'] = 'Kies een categorie.';
  }

  // 3. Bedrag totaal
  const bedrag = getNumber('bedrag', formData);
  if (bedrag === null) {
    errors['bedrag'] = 'Vul een geldig bedrag in.';
  } else if (bedrag < 0) {
    errors['bedrag'] = 'Het bedrag kan niet negatief zijn.';
  }

  // 4. Rekeningnummer
    const rekeningnummer = getText('rekeningnummer', formData);

    if (!rekeningnummer) {
    errors['rekeningnummer'] = 'Dit veld is verplicht.';
    } else if (!isValidBelgianIban(rekeningnummer)) {
    errors['rekeningnummer'] = 'Dit is geen geldig Belgisch IBAN-nummer.';
    }

  // 5. Doorgerekend?
  if (!doorgerekend) {
    errors['doorgerekend'] = 'Maak een keuze.';
  }

  // 6–8 enkel als doorgerekend = ja
  if (doorgerekend === 'ja') {
    const uitstapOfVak = getText('uitstapOfVak', formData);
    if (!uitstapOfVak) {
      errors['uitstapOfVak'] = 'Vul in voor welke uitstap of welk vak dit is.';
    }

    const bedragLeerlingen = getNumber('bedragLeerlingen', formData);
    if (bedragLeerlingen === null) {
      errors['bedragLeerlingen'] = 'Vul een geldig bedrag in.';
    } else if (bedragLeerlingen < 0) {
      errors['bedragLeerlingen'] = 'Het bedrag kan niet negatief zijn.';
    } else if (bedrag !== null && bedragLeerlingen > bedrag) {
      errors['bedragLeerlingen'] =
        'Dit bedrag kan niet groter zijn dan het totaalbedrag.';
    }

    const klassenOfLeerlingen = getText('klassenOfLeerlingen', formData);
    if (!klassenOfLeerlingen) {
      errors['klassenOfLeerlingen'] =
        'Vul in aan wie dit bedrag moet worden verrekend.';
    }
  }

  // 9. Factuur / kasbon
  const factuur = formData.get('factuur');
  if (!factuur) {
    errors['factuur'] = 'Voeg een factuur of kasbon toe.';
  }

  return errors;
}

export function validateOpenbaarVervoer(
  formData: FormData
): ValidationErrors {
  const errors: ValidationErrors = {};

  // Verklaring (checkbox)
  const verklaring = formData.get('verklaring');
  if (!verklaring) {
    errors['verklaring'] = 'Je moet de verklaring aanvinken om dit formulier te kunnen indienen.';
  }

  // Jaar
  const jaarStr = getText('jaar', formData);
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  if (!jaarStr) {
    errors['jaar'] = 'Kies een jaar.';
  } else {
    const jaarNum = parseInt(jaarStr, 10);
    if (jaarNum !== currentYear && jaarNum !== previousYear) {
      errors['jaar'] = `Het jaar moet ${previousYear} of ${currentYear} zijn.`;
    }
  }

  // Maand
  const maand = getText('maand', formData);
  if (!maand) {
    errors['maand'] = 'Kies een maand.';
  }

  // Terug te betalen bedrag (> 0)
  const bedragStr = getText('bedrag', formData);
  const bedrag = parseFloat(bedragStr.replace(',', '.'));
  if (!bedragStr || isNaN(bedrag) || bedrag <= 0) {
    errors['bedrag'] = 'Geef een bedrag groter dan 0 in.';
  }

  // Rekeningnummer
  const rekeningnummer = getText('rekeningnummer', formData);
  const rekeningError = isValidBelgianIban(rekeningnummer);
  if (!rekeningError) {
    errors['rekeningnummer'] = 'Dit is geen geldig Belgisch IBAN-nummer.';
  }

  // Betalingsbewijs (factuur)
  const factuurFiles = formData
    .getAll('factuur')
    .filter(v => v instanceof File && (v as File).size > 0) as File[];

  if (!factuurFiles.length) {
    errors['factuur'] = 'Voeg minstens één betalingsbewijs toe (pdf of afbeelding).';
  }

  return errors;
}

// Helpers
function getText(name: string, formData: FormData): string {
  return ((formData.get(name) as string) || '').trim();
}

function getNumber(name: string, formData: FormData): number | null {
  const raw = ((formData.get(name) as string) || '').trim();
  if (!raw) return null;
  const n = Number(raw.replace(',', '.')); // voor veiligheid
  return isNaN(n) ? null : n;
}

function isValidBelgianIban(ibanRaw: string): boolean {
  if (!ibanRaw) return false;

  // Remove spaces and uppercase
  const iban = ibanRaw.replace(/\s+/g, '').toUpperCase();

  // BE IBAN must be exactly 16 chars and start with BE
  if (!/^BE\d{14}$/.test(iban)) return false;

  // IBAN check: move first 4 chars to the end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Replace letters with numbers (A = 10 ... Z = 35)
  const numeric = rearranged
    .split('')
    .map(ch =>
      ch >= 'A' && ch <= 'Z'
        ? (ch.charCodeAt(0) - 55).toString() // A=10, B=11, ...
        : ch
    )
    .join('');

  // Perform mod-97 check
  // Because the number can be too large for JS, we must do this in chunks
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const block = remainder + numeric.substring(i, i + 7);
    remainder = Number(block) % 97;
  }

  return remainder === 1;
}

