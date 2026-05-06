export type SiteId = 1 | 2 | 3 | 4 | 5;

export type SiteState = "dehors" | "demandeur" | "dedans";

export type MessageKind = "REQ" | "TOKEN";

export interface RicartTokenProcess {
  id: SiteId;
  state: SiteState;
  req: number[];
  hasToken: boolean;
}

export interface RicartToken {
  values: number[];
  owner: SiteId;
}

export interface RicartTokenMessage {
  id: number;
  type: MessageKind;
  from: SiteId;
  to: SiteId;
}

export interface RicartTokenStep {
  id: number;
  title: string;
  description: string;
  processes: RicartTokenProcess[];
  token: RicartToken;
  activeMessages: RicartTokenMessage[];
  activeSite?: SiteId;
}