export type SiteState = "dehors" | "demandeur" | "dedans";

export interface SiteNode {
  id: number;
  name: string;
  state: SiteState;
  tokenPresent: boolean;
}

export interface LeLannMessage {
  type: "TOKEN";
  from: number;
  to: number;
}