// onkostennotaValidation.ts

export interface OnkostennotaErrors {
  [key: string]: string;
}

export function validateOnkostennota(
  formData: FormData,
  doorgerekend: string
): OnkostennotaErrors {
  const errors: OnkostennotaErrors = {};

  // Helpers
  const getText = (name: string) =>
    ((formData.get(name) as string) || '').trim();

  const getNumber = (name: string): number | null => {
    const raw = ((formData.get(name) as string) || '').trim();
    if (!raw) return null;
    const n = Number(raw.replace(',', '.')); // voor veiligheid
    return isNaN(n) ? null : n;
  };

  // 1. Omschrijving
  const omschrijving = getText('omschrijving');
  if (!omschrijving) {
    errors['omschrijving'] = 'Vul hier een korte omschrijving in.';
  } else if (omschrijving.length < 5) {
    errors['omschrijving'] = 'De omschrijving is te kort.';
  }

  // 2. Categorie (A/B/C)
  const categorie = getText('categorie');
  if (!categorie) {
    errors['categorie'] = 'Kies een categorie.';
  }

  // 3. Bedrag totaal
  const bedrag = getNumber('bedrag');
  if (bedrag === null) {
    errors['bedrag'] = 'Vul een geldig bedrag in.';
  } else if (bedrag < 0) {
    errors['bedrag'] = 'Het bedrag kan niet negatief zijn.';
  }

  // 4. Rekeningnummer
    const rekeningnummer = getText('rekeningnummer');

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
    const uitstapOfVak = getText('uitstapOfVak');
    if (!uitstapOfVak) {
      errors['uitstapOfVak'] = 'Vul in voor welke uitstap of welk vak dit is.';
    }

    const bedragLeerlingen = getNumber('bedragLeerlingen');
    if (bedragLeerlingen === null) {
      errors['bedragLeerlingen'] = 'Vul een geldig bedrag in.';
    } else if (bedragLeerlingen < 0) {
      errors['bedragLeerlingen'] = 'Het bedrag kan niet negatief zijn.';
    } else if (bedrag !== null && bedragLeerlingen > bedrag) {
      errors['bedragLeerlingen'] =
        'Dit bedrag kan niet groter zijn dan het totaalbedrag.';
    }

    const klassenOfLeerlingen = getText('klassenOfLeerlingen');
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

