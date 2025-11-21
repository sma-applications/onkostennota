import * as React from 'react';
import styles from './OnkostenNota.module.scss';
import type { IOnkostenNotaProps } from './IOnkostenNotaProps';
import { escape } from '@microsoft/sp-lodash-subset';
import OnkostenNotaForm from './OnkostenNotaForm';
import { validateOnkostennota } from './onkostennotaValidation';


interface IOnkostenNotaState {
  doorgerekend: string; // 'ja' | 'nee' | ''
  errors: { [key: string]: string };
}

export default class OnkostenNota extends React.Component<IOnkostenNotaProps, IOnkostenNotaState> {

  public constructor(props: IOnkostenNotaProps) {
    super(props);

    this.state = {
      doorgerekend: '',
      errors: {}
    };

    this._handleDoorgerekendChange = this._handleDoorgerekendChange.bind(this);
    this._handleSubmit = this._handleSubmit.bind(this);
    this._clearError = this._clearError.bind(this);
  }

  private _handleDoorgerekendChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value;
    this.setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors['doorgerekend'];

      // Als we van 'ja' naar 'nee' gaan, zijn de extra velden niet meer relevant
      if (value === 'nee') {
        delete newErrors['uitstapOfVak'];
        delete newErrors['bedragLeerlingen'];
        delete newErrors['klassenOfLeerlingen'];
      }

      return { doorgerekend: value, errors: newErrors };
    });
  }

  private _clearError(fieldName: string): void {
    this.setState(prev => {
      if (!prev.errors[fieldName]) {
        return null;
      }
      const newErrors = { ...prev.errors };
      delete newErrors[fieldName];
      return { errors: newErrors };
    });
  }

  private _handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const { doorgerekend } = this.state;

    console.log("DEBUG iban raw:", formData.get("rekeningnummer"));


    // gebruik de aparte validator
    const errors = validateOnkostennota(formData, doorgerekend);

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      // Scroll naar bovenste fout kan eventueel nog toegevoegd worden
      return;
    }

    // Als alles OK is: hier zou je later de echte submit / API-call doen.
    // Voor nu gewoon een placeholder:
    const result: any = {};
    formData.forEach((value, key) => {
      result[key] = value;
    });

    console.log('Formulier is geldig. Hier kan je de data verzenden.', result);
    alert(
      'Formulier is geldig en klaar om verzonden te worden (technical placeholder).'
    );
  }


  public render(): React.ReactElement<IOnkostenNotaProps> {
    const {
      hasTeamsContext,
      userDisplayName
    } = this.props;

    const { doorgerekend, errors } = this.state;

    return (
      <section className={`${styles.onkostenNota} ${hasTeamsContext ? styles.teams : ''}`}>
        <div className={styles.container}>
          <h2>Onkostennota</h2>

          <p className={styles.intro}>
            Via dit formulier geef je een onkostennota door aan de financiële dienst.
            Let op: wanneer je een aankoop doet in naam van de school dien je vooraf steeds
            toestemming te vragen bij je directie.
          </p>

          <p className={styles.notice}>
            Hi, {escape(userDisplayName)}. Wanneer je dit formulier indient,
            zal de eigenaar je naam en e-mailadres kunnen zien.
          </p>

          <p className={styles.requiredHint}>Velden gemarkeerd met * zijn verplicht.</p>

          <OnkostenNotaForm
            doorgerekend={doorgerekend}
            errors={errors}
            onDoorgerekendChange={this._handleDoorgerekendChange}
            onClearError={this._clearError}
            onSubmit={this._handleSubmit}
          />
        </div>
      </section>
    );
  }
}
