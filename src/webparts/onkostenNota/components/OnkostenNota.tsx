import * as React from 'react';
import styles from './OnkostenNota.module.scss';
import type { IOnkostenNotaProps } from './IOnkostenNotaProps';
import { escape } from '@microsoft/sp-lodash-subset';
import OnkostenNotaForm from './OnkostenNotaForm';
import { validateOnkostennota } from './onkostennotaValidation';
import { OnkostenNotaDocumentService } from './OnkostenNotaDocumentService'; // <- new import



interface IOnkostenNotaState {
  doorgerekend: string; // 'ja' | 'nee' | ''
  errors: { [key: string]: string };
}

export default class OnkostenNota extends React.Component<IOnkostenNotaProps, IOnkostenNotaState> {

  private _docService: OnkostenNotaDocumentService;
  
  public constructor(props: IOnkostenNotaProps) {
    super(props);

    this.state = {
      doorgerekend: '',
      errors: {}
    };

    this._handleDoorgerekendChange = this._handleDoorgerekendChange.bind(this);
    this._handleSubmit = this._handleSubmit.bind(this);
    this._clearError = this._clearError.bind(this);
    // Instantiate the service once, using the WebPart context from props
    this._docService = new OnkostenNotaDocumentService(this.props.context);
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

  private async _handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const { doorgerekend } = this.state;

    // gebruik de aparte validator
    const errors = validateOnkostennota(formData, doorgerekend);

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      // Scroll naar bovenste fout kan eventueel nog toegevoegd worden
      return;
    }


    // Maak een gewoon object van de FormData
    const formValues: { [key: string]: any } = {};
    formData.forEach((value, key) => {
      // For files, you might want to treat them differently
      formValues[key] = value;
    });

    try {
      // 1. Generate PDF from template
      const result = await this._docService.generatePdfFromTemplate(
        formValues,
        this.props.templateFileUrl
      );

      // 2a. If you keep it only in memory: open in a new tab
      const pdfUrl = URL.createObjectURL(result.pdfBlob);
      window.open(pdfUrl, '_blank');

      // 2b. Or if you rely on SharePoint upload: use result.pdfSharePointUrl
      // alert(`PDF opgeslagen op: ${result.pdfSharePointUrl}`);

      // You can also show a nicer success message in the UI instead of alert
      alert('Formulier is geldig en de onkostennota-PDF werd aangemaakt.');

    } catch (e) {
      console.error('Fout bij aanmaken onkostennota-PDF:', e);
      alert('Er is een fout opgetreden bij het aanmaken van de onkostennota.');
    }
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
