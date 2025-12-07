// OnkostenNotaForm.tsx
import * as React from 'react';
import styles from './FinancialForms.module.scss';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';

export interface IOnkostenNotaFormProps {
  doorgerekend: string; // 'ja' | 'nee' | ''
  errors: { [key: string]: string };

  onDoorgerekendChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (fieldName: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;

  isSubmitting: boolean; 
}

export default class OnkostenNotaForm extends React.Component<IOnkostenNotaFormProps> {
  public render(): React.ReactElement<IOnkostenNotaFormProps> {
    const {
      doorgerekend,
      errors,
      onDoorgerekendChange,
      onClearError,
      onSubmit,
      isSubmitting
    } = this.props;

    return (
      <form className={styles.form} onSubmit={onSubmit}>
        {/* Vraag 1 */}
        <div className={styles.formGroup}>
          <label htmlFor="omschrijving">
            1. Omschrijf wat je aankocht. <span className={styles.required}>*</span>
          </label>
          <textarea
            id="omschrijving"
            name="omschrijving"
            rows={4}
            required
            onChange={() => onClearError('omschrijving')}
          />
          {errors['omschrijving'] && (
            <p className={styles.error}>{errors['omschrijving']}</p>
          )}
        </div>

        {/* Vraag 2 */}
        <div className={styles.formGroup}>
          <fieldset className={styles.fieldset}>
            <legend>
              2. In welke categorie past dit product? <span className={styles.required}>*</span>
            </legend>
            <p className={styles.helpText}>
              Let op: aankoop van B- of C-producten vereist vooraf de toestemming
              van de preventiedienst.
            </p>

            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  name="categorie"
                  value="A"
                  required
                  onChange={() => onClearError('categorie')}
                />
                A
              </label>

              <label>
                <input
                  type="radio"
                  name="categorie"
                  value="B"
                  onChange={() => onClearError('categorie')}
                />
                B
              </label>

              <label>
                <input
                  type="radio"
                  name="categorie"
                  value="C"
                  onChange={() => onClearError('categorie')}
                />
                C
              </label>
            </div>
            {errors['categorie'] && (
              <p className={styles.error}>{errors['categorie']}</p>
            )}
          </fieldset>
        </div>

        {/* Vraag 3 */}
        <div className={styles.formGroup}>
          <label htmlFor="bedrag">
            3. Wat is het totale bedrag van de aankoop, in euro? <span className={styles.required}>*</span>
          </label>
          <input
            id="bedrag"
            name="bedrag"
            type="number"
            min={0}
            step="0.01"
            required
            onChange={() => onClearError('bedrag')}
          />
          <p className={styles.helpText}>
            Voer een bedrag in groter dan of gelijk aan 0.
          </p>
          {errors['bedrag'] && (
            <p className={styles.error}>{errors['bedrag']}</p>
          )}
        </div>

        {/* Vraag 4 */}
        <div className={styles.formGroup}>
          <label htmlFor="rekeningnummer">
            4. Op welk rekeningnummer wil je dit bedrag ontvangen? <span className={styles.required}>*</span>
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

        {/* Vraag 5 */}
        <div className={styles.formGroup}>
          <fieldset className={styles.fieldset}>
            <legend>
              5. Moeten deze onkosten doorgerekend worden aan je leerlingen? <span className={styles.required}>*</span>
            </legend>

            <div className={styles.radioGroup}>
              <label>
                <input
                  type="radio"
                  name="doorgerekend"
                  value="ja"
                  checked={doorgerekend === 'ja'}
                  onChange={onDoorgerekendChange}
                  required
                />
                Ja
              </label>
              <label>
                <input
                  type="radio"
                  name="doorgerekend"
                  value="nee"
                  checked={doorgerekend === 'nee'}
                  onChange={onDoorgerekendChange}
                />
                Nee
              </label>
            </div>
            {errors['doorgerekend'] && (
              <p className={styles.error}>{errors['doorgerekend']}</p>
            )}
          </fieldset>
        </div>

        {/* Vragen 6–8: enkel tonen als vraag 5 = Ja */}
        {doorgerekend === 'ja' && (
          <>
            {/* Vraag 6 */}
            <div className={styles.formGroup}>
              <label htmlFor="uitstapOfVak">
                6. Voor welke uitstap of welk vak deed je deze aankoop? <span className={styles.required}>*</span>
              </label>
              <textarea
                id="uitstapOfVak"
                name="uitstapOfVak"
                rows={3}
                required
                onChange={() => onClearError('uitstapOfVak')}
              />
              {errors['uitstapOfVak'] && (
                <p className={styles.error}>{errors['uitstapOfVak']}</p>
              )}
            </div>

            {/* Vraag 7 */}
            <div className={styles.formGroup}>
              <label htmlFor="bedragLeerlingen">
                7. Welk bedrag moet er doorgerekend worden aan de leerlingen?
                (Dit is niet noodzakelijk het hele bedrag!) <span className={styles.required}>*</span>
              </label>
              <input
                id="bedragLeerlingen"
                name="bedragLeerlingen"
                type="number"
                min={0}
                step="0.01"
                required
                onChange={() => onClearError('bedragLeerlingen')}
              />
              <p className={styles.helpText}>
                Voer een bedrag in groter dan of gelijk aan 0.
              </p>
              {errors['bedragLeerlingen'] && (
                <p className={styles.error}>{errors['bedragLeerlingen']}</p>
              )}
            </div>

            {/* Vraag 8 */}
            <div className={styles.formGroup}>
              <label htmlFor="klassenOfLeerlingen">
                8. Aan welke klassen of individuele leerlingen moet dit bedrag verrekend worden? <span className={styles.required}>*</span>
              </label>
              <textarea
                id="klassenOfLeerlingen"
                name="klassenOfLeerlingen"
                rows={3}
                required
                onChange={() => onClearError('klassenOfLeerlingen')}
              />
              {errors['klassenOfLeerlingen'] && (
                <p className={styles.error}>{errors['klassenOfLeerlingen']}</p>
              )}
            </div>
          </>
        )}

        {/* Factuur / kasbon – altijd tonen */}
        <div className={styles.formGroup}>
          <label htmlFor="factuur">
            9. Voeg je factuur of kasbon toe. <span className={styles.required}>*</span>
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
    );
  }
}
