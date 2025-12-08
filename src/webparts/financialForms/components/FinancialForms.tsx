import * as React from 'react';
import styles from './FinancialForms.module.scss';
import type { IFinancialFormsProps } from './IFinancialFormsProps';
import OnkostenNotaForm from './forms/OnkostenNotaForm';
import OpenbaarVervoerForm from './forms/OpenbaarVervoerForm';
import { validateOnkostennota, validateOpenbaarVervoer } from './onValidation';
import { DocumentService } from './DocumentService'; // <- new import
import { MailService } from './MailService';



interface IFinancialFormsState {
  doorgerekend: string; // 'ja' | 'nee' | ''
  errors: { [key: string]: string };
  isSubmitting: boolean;
}

export default class FinancialForms extends React.Component<IFinancialFormsProps, IFinancialFormsState> {

  private _docService: DocumentService;
  private _mailService: MailService;

  public constructor(props: IFinancialFormsProps) {
    super(props);

    this.state = {
      doorgerekend: '',
      errors: {},
      isSubmitting: false
    };

    this._handleDoorgerekendChange = this._handleDoorgerekendChange.bind(this);
    this._handleSubmit = this._handleSubmit.bind(this);
    this._clearError = this._clearError.bind(this);
    // Instantiate the service once, using the WebPart context from props
    this._docService = new DocumentService(this.props);
    this._mailService = new MailService(this.props.context);
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
    const { formType } = this.props;

    // Alleen onkostennota krijgt de specifieke validator
    let errors: { [key: string]: string } = {};
    if (formType === 'onkostennota') {
      errors = validateOnkostennota(formData, doorgerekend);
    } else if (formType === 'openbaar_vervoer') {
      errors = validateOpenbaarVervoer(formData);
    }

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      // Scroll naar bovenste fout kan eventueel nog toegevoegd worden
      return;
    }

    // Geen validatiefouten → we zijn nu aan het verzenden
    this.setState({ isSubmitting: true });

    // Maak een gewoon object van de FormData
    const formValues: { [key: string]: any } = {};
    // Alle niet-file velden vullen (of in elk geval niet 'factuur')
    formData.forEach((value, key) => {
      if (key !== 'factuur') {
        formValues[key] = value;
      }
    });

    // Alle bestanden met name 'factuur' ophalen (FileList → File[])
    const factuurFiles = formData
      .getAll('factuur')
      .filter((v) => v instanceof File && (v as File).size > 0) as File[];

    formValues['facturen'] = factuurFiles;
    formValues['doorgerekend'] = this.state.doorgerekend;
    formValues['formType'] = formType;
    formValues['userDisplayName'] = this.props.userDisplayName;

    try {
      // 1. Generate PDF from template
      const result = await this._docService.generatePdfFromTemplate(
        formValues
      );

      // 2a. If you keep it only in memory: open in a new tab
      const pdfUrl = URL.createObjectURL(result);
      window.open(pdfUrl, '_blank');

      // 2b. E-mail versturen met PDF in bijlage
      await this._mailService.sendMail(
        result,
        this.props.notificationEmail,
        this.props.userDisplayName
      );

      // ✅ Alleen bij succes: formulier resetten
      form.reset();
      this.setState({
        doorgerekend: '',
        errors: {}
      });

      // You can also show a nicer success message in the UI instead of alert
      alert('Formulier is geldig, de PDF werd aangemaakt en verzonden.');

    } catch (e) {
      console.error('Fout bij aanmaken/verzenden PDF:', e);
      alert('Er is een fout opgetreden bij het aanmaken van de formulier: ' + e.message);
    } finally {
      // In alle gevallen: spinner stoppen, knop terug tonen
      this.setState({ isSubmitting: false });
    }
  }


  public render(): React.ReactElement<IFinancialFormsProps> {
    const {
      hasTeamsContext,
      userDisplayName,
      formType
    } = this.props;

    const { doorgerekend, errors, isSubmitting } = this.state;


    // Kies het juiste formulier op basis van formType
    const formElement =
      formType === 'openbaar_vervoer'
        ? (
          <OpenbaarVervoerForm
            userDisplayName={userDisplayName}
            errors={errors}
            onClearError={this._clearError}
            onSubmit={this._handleSubmit}
            isSubmitting={isSubmitting}
          />
        )
        : (
          <OnkostenNotaForm
            userDisplayName={userDisplayName}
            doorgerekend={doorgerekend}
            errors={errors}
            onDoorgerekendChange={this._handleDoorgerekendChange}
            onClearError={this._clearError}
            onSubmit={this._handleSubmit}
            isSubmitting={isSubmitting}
          />
        );

    return (
      <section className={`${styles.onkostenNota} ${hasTeamsContext ? styles.teams : ''}`}>
        <div className={styles.container}>
          {formElement}
        </div>
      </section>
    );
  }
}
