// OpenbaarVervoerForm.tsx
import * as React from 'react';
import styles from '../FinancialForms.module.scss';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';

export interface IOpenbaarVervoerFormProps {
  userDisplayName: string;

  errors: { [key: string]: string };

  onClearError: (fieldName: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;

  isSubmitting: boolean;
}

export default class OpenbaarVervoerForm extends React.Component<IOpenbaarVervoerFormProps> {
  public render(): React.ReactElement<IOpenbaarVervoerFormProps> {
    const {
      errors,
      onClearError,
      onSubmit,
      isSubmitting
    } = this.props;

    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    const maanden = [
      'januari',
      'februari',
      'maart',
      'april',
      'mei',
      'juni',
      'juli',
      'augustus',
      'september',
      'oktober',
      'november',
      'december'
    ];

    return (
      <>
        <h2>Openbaar vervoer voor het woon-werkverkeer</h2>

        <p className={styles.intro}>
          Via dit formulier geef je je onkosten voor openbaar vervoer door.
        </p>

        <p className={styles.requiredHint}>
          Alle velden zijn verplicht.
        </p>

        <form className={styles.form} onSubmit={onSubmit}>
          {/* Verklaring */}
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                id="verklaring"
                name="verklaring"
                required
                onChange={() => onClearError('verklaring')}
              />
              <span>
                Ik verklaar op eer dat ik openbaar vervoer heb gebruikt voor de
                woon-werkverplaatsing of een deel ervan. Ik verklaar kennis te
                hebben genomen van het feit dat misbruiken kunnen bestraft worden,
                zie punt 4.6 van de omzendbrief 13AC/CR/JVM/js van 22/12/2000.
              </span>
            </label>
            {errors['verklaring'] && (
              <p className={styles.error}>{errors['verklaring']}</p>
            )}
          </div>

          {/* Jaar */}
          <div className={styles.formGroup}>
            <label htmlFor="jaar">
              Jaar
            </label>
            <select
              id="jaar"
              name="jaar"
              required
              defaultValue={currentYear.toString()}
              onChange={() => onClearError('jaar')}
            >
              <option value={previousYear}>{previousYear}</option>
              <option value={currentYear}>{currentYear}</option>
            </select>
            {errors['jaar'] && (
              <p className={styles.error}>{errors['jaar']}</p>
            )}
          </div>

          {/* Maand */}
          <div className={styles.formGroup}>
            <label htmlFor="maand">
              Maand
            </label>
            <select
              id="maand"
              name="maand"
              required
              defaultValue=""
              onChange={() => onClearError('maand')}
            >
              <option value="" disabled>Kies een maand</option>
              {maanden.map((maand) => (
                <option key={maand} value={maand}>
                  {maand}
                </option>
              ))}
            </select>
            {errors['maand'] && (
              <p className={styles.error}>{errors['maand']}</p>
            )}
          </div>

          {/* Terug te betalen bedrag */}
          <div className={styles.formGroup}>
            <label htmlFor="bedrag">
              Terug te betalen bedrag (in Euro)
            </label>
            <input
              id="bedrag"
              name="bedrag"
              type="number"
              min={0.01}
              step="0.01"
              required
              onChange={() => onClearError('bedrag')}
            />
            <p className={styles.helpText}>
              Voer een bedrag in groter dan 0.
            </p>
            {errors['bedrag'] && (
              <p className={styles.error}>{errors['bedrag']}</p>
            )}
          </div>


          <div className={styles.formGroup}>
            <label htmlFor="rekeningnummer">
              Op welk rekeningnummer wil je dit bedrag ontvangen? <span className={styles.required}>*</span>
            </label>
            <input
              id="rekeningnummer"
              name="rekeningnummer"
              type="text"
              required
              onChange={() => onClearError('rekeningnummer')}
            />
            {errors['rekeningnummer'] && (
              <p className={styles.error}>{errors['rekeningnummer']}</p>
            )}
          </div>

          {/* Factuur / kasbon – altijd tonen */}
          <div className={styles.formGroup}>
            <label htmlFor="factuur">
              Voeg je betalingsbewijs toe.
            </label>
            <p className={styles.helpText}>
              (Voeg een pdf of een afbeelding toe.)
            </p>
            <input
              id="factuur"
              name="factuur"
              type="file"
              className={styles.fileInput}
              multiple
              accept=".pdf,image/*"
              required
              onChange={() => onClearError('factuur')}
            />
            {errors['factuur'] && (
              <p className={styles.error}>{errors['factuur']}</p>
            )}
          </div>

          {/* Submit */}
          <div className={styles.actions}>
            {isSubmitting ? (
              <div className={styles.spinnerWrapper}>
                <Spinner
                  size={SpinnerSize.medium}
                  label="Bezig met verzenden..."
                />
              </div>
            ) : (
              <button
                type="submit"
                className={styles.primaryButton}
              >
                Verzenden
              </button>
            )}
          </div>
        </form>
      </>
    );
  }
}
