import { ContactContext, LeadStatus, SettingsDocument, StatusDocument } from "./kommo";

export interface SalesAgentRequest {
  messageText: string;
  currentStatus: LeadStatus;
  talkId: string;
  contactContext?: ContactContext;
  rules?: Array<{ priority: number; rule: string }>;
  settings?: SettingsDocument | null;
  statuses?: StatusDocument[] | null;
  attachment?: {
    type: string;
    link: string;
    file_name: string;
  };
}
