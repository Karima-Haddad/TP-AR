import { LeLannEngine } from "./leLannAlgo";
import type { SiteNode, LeLannMessage } from "./types";

export type LeLannEventType =
  | "REQUEST"
  | "RECEIVE_TOKEN"
  | "SEND_TOKEN"
  | "ENTER_CS"
  | "EXIT_CS";

export interface LeLannStep {
  id: number;
  title: string;
  description: string;
  sites: SiteNode[];
  tokenHolder: number;
  message?: LeLannMessage | null;
  activeSite?: number;
  eventType: LeLannEventType;
}

function createStep(
  engine: LeLannEngine,
  steps: LeLannStep[],
  data: {
    title: string;
    description: string;
    eventType: LeLannEventType;
    activeSite?: number;
    message?: LeLannMessage | null;
  }
) {
  steps.push({
    id: steps.length,
    title: data.title,
    description: data.description,
    sites: engine.getSites(),
    tokenHolder: engine.getTokenHolder(),
    activeSite: data.activeSite,
    eventType: data.eventType,
    message: data.message,
  });
}


export function generateLeLannScenario(): LeLannStep[] {
  const engine = new LeLannEngine(5, 0);
  const steps: LeLannStep[] = [];

  createStep(engine, steps, {
    title: "État initial",
    description: "Le jeton est initialement chez S1. Tous les sites sont dehors.",
    eventType: "RECEIVE_TOKEN",
    activeSite: 0,
  });

  engine.acquire(3);
  createStep(engine, steps, {
    title: "S4 demande la section critique",
    description: "S4 devient demandeur et attend que le jeton arrive jusqu’à lui.",
    eventType: "REQUEST",
    activeSite: 3,
  });

  engine.acquire(1);
  createStep(engine, steps, {
    title: "S2 demande aussi la section critique",
    description: "S2 devient demandeur pendant que S4 attend déjà le jeton.",
    eventType: "REQUEST",
    activeSite: 1,
  });

  let msg = engine.receiveToken(0);
  createStep(engine, steps, {
    title: "S1 transmet le jeton",
    description: "S1 est dehors, donc il passe le jeton à son successeur S2.",
    eventType: "SEND_TOKEN",
    activeSite: 0,
    message: msg,
  });

  msg = engine.receiveToken(1);
  createStep(engine, steps, {
    title: "S2 reçoit le jeton",
    description: "S2 est demandeur, donc il garde le jeton.",
    eventType: "RECEIVE_TOKEN",
    activeSite: 1,
    message: msg,
  });

  createStep(engine, steps, {
    title: "S2 entre en section critique",
    description: "S2 possède le jeton : il peut entrer en section critique.",
    eventType: "ENTER_CS",
    activeSite: 1,
  });

  msg = engine.release(1);
  createStep(engine, steps, {
    title: "S2 quitte la section critique",
    description: "S2 libère la ressource et transmet le jeton à S3.",
    eventType: "EXIT_CS",
    activeSite: 1,
    message: msg,
  });

  msg = engine.receiveToken(2);
  createStep(engine, steps, {
    title: "S3 transmet le jeton",
    description: "S3 n’est pas demandeur, donc il transmet directement le jeton à S4.",
    eventType: "SEND_TOKEN",
    activeSite: 2,
    message: msg,
  });

  msg = engine.receiveToken(3);
  createStep(engine, steps, {
    title: "S4 reçoit le jeton",
    description: "S4 attendait le jeton : il le garde pour accéder à la section critique.",
    eventType: "RECEIVE_TOKEN",
    activeSite: 3,
    message: msg,
  });

  createStep(engine, steps, {
    title: "S4 entre en section critique",
    description: "S4 possède maintenant le jeton et entre en section critique.",
    eventType: "ENTER_CS",
    activeSite: 3,
  });

  msg = engine.release(3);
  createStep(engine, steps, {
    title: "S4 quitte la section critique",
    description: "S4 sort de la section critique et transmet le jeton à S5.",
    eventType: "EXIT_CS",
    activeSite: 3,
    message: msg,
  });

  msg = engine.receiveToken(4);
  createStep(engine, steps, {
    title: "S5 transmet le jeton",
    description: "S5 n’est pas intéressé, donc il transmet le jeton à S1.",
    eventType: "SEND_TOKEN",
    activeSite: 4,
    message: msg,
  });

  return steps;
}