import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IFinancialFormsProps {
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  notificationEmail: string; 
  formType: 'onkostennota' | 'verplaatsing' | 'openbaar_vervoer';
  fietsvergoedingPerKm: string; // of number, als je het meteen parse’t
  autovergoedingPerKm: string;
  context: WebPartContext;   // email address
}
