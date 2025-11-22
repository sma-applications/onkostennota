import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IOnkostenNotaProps {
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  templateFileUrl: string;      // SharePoint file path / URL to the Word template
  tempDirLocation: string;
  notificationEmail: string; 
  site: string;
  context: WebPartContext;   // email address
}
