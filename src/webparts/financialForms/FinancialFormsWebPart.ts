import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneDropdown
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'FinancialFormsWebPartStrings';
import FinancialForms from './components/FinancialForms';

export interface IFinancialFormsWebPartProps {
  notificationEmail: string;  
  formType: 'onkostennota' | 'verplaatsing' | 'openbaar_vervoer';
  fietsvergoedingPerKm: string; // of number, als je het meteen parse’t
  autovergoedingPerKm: string;
// email address
}

export default class FinancialFormsWebPart extends BaseClientSideWebPart<IFinancialFormsWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _environmentMessage: string = '';

  public render(): void {
    const element: React.ReactElement<IFinancialFormsWebPartProps> = React.createElement(
      FinancialForms,
      {
        isDarkTheme: this._isDarkTheme,
        environmentMessage: this._environmentMessage,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        notificationEmail: this.properties.notificationEmail,
        formType: this.properties.formType,
        fietsvergoedingPerKm: this.properties.fietsvergoedingPerKm,
        autovergoedingPerKm: this.properties.autovergoedingPerKm,
        context: this.context
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onInit(): Promise<void> {
    return this._getEnvironmentMessage().then(message => {
      this._environmentMessage = message;
    });
  }



  private _getEnvironmentMessage(): Promise<string> {
    if (!!this.context.sdks.microsoftTeams) { // running in Teams, office.com or Outlook
      return this.context.sdks.microsoftTeams.teamsJs.app.getContext()
        .then(context => {
          let environmentMessage: string = '';
          switch (context.app.host.name) {
            case 'Office': // running in Office
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOffice : strings.AppOfficeEnvironment;
              break;
            case 'Outlook': // running in Outlook
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentOutlook : strings.AppOutlookEnvironment;
              break;
            case 'Teams': // running in Teams
            case 'TeamsModern':
              environmentMessage = this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentTeams : strings.AppTeamsTabEnvironment;
              break;
            default:
              environmentMessage = strings.UnknownEnvironment;
          }

          return environmentMessage;
        });
    }

    return Promise.resolve(this.context.isServedFromLocalhost ? strings.AppLocalEnvironmentSharePoint : strings.AppSharePointEnvironment);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }

  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: 'instellingen'
          },
          groups: [
            {
              groupName: 'Algemene instellingen',
              groupFields: [
                // 1. Formulier kiezen
                PropertyPaneDropdown('formType', {
                  label: 'Formulier',
                  options: [
                    { key: 'onkostennota', text: 'Onkostennota' },
                    { key: 'verplaatsing', text: 'Verplaatsing' },
                    { key: 'openbaar_vervoer', text: 'Openbaar vervoer' }
                  ],
                  selectedKey: 'onkostennota'
                }),

                // 2. Fietsvergoeding per km
                PropertyPaneTextField('fietsvergoedingPerKm', {
                  label: 'Fietsvergoeding per km',
                  description: 'Bijvoorbeeld 0,35',
                  onGetErrorMessage: (value: string) => {
                    if (!value) {
                      return '';
                    }
                    const normalized = value.replace(',', '.');
                    return isNaN(parseFloat(normalized))
                      ? 'Geef een geldig getal in.'
                      : '';
                  }
                }),

                // 3. Autovergoeding per km
                PropertyPaneTextField('autovergoedingPerKm', {
                  label: 'Autovergoeding per km',
                  description: 'Bijvoorbeeld 0,4170',
                  onGetErrorMessage: (value: string) => {
                    if (!value) {
                      return '';
                    }
                    const normalized = value.replace(',', '.');
                    return isNaN(parseFloat(normalized))
                      ? 'Geef een geldig getal in.'
                      : '';
                  }
                }),

                PropertyPaneTextField('notificationEmail', {
                  label: 'Email',
                  description: 'Onkosten worden naar dit adres gestuurd'
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
