export type SiteId = number;
export type EtatSite = "dehors" | "demandeur" | "dedans";

export type Message =
  | { id: number; type: "REQ"; from: SiteId; to: SiteId; reqNumber: number }
  | { id: number; type: "TOKEN"; from: SiteId; to: SiteId; token: number[] };

export type Site = {
  id: SiteId;
  etat: EtatSite;
  req: number[];
  jetonPresent: boolean;
};

export type Step = {
  id: number;
  title: string;
  description: string;
  sites: Site[];
  token: number[];
  tokenOwner: SiteId | null;
  messages: Message[];
  activeSite?: SiteId;
};

export class RicartTokenEngine {
  private n: number;
  private sites: Site[];
  private token: number[];
  private tokenOwner: SiteId | null;
  private messages: Message[] = [];
  private steps: Step[] = [];
  private stepId = 0;
  private msgId = 0;

  constructor(n: number, initialTokenOwner: SiteId) {
    this.n = n;

    this.sites = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      etat: "dehors",
      req: Array(n).fill(0),
      jetonPresent: i + 1 === initialTokenOwner,
    }));

    this.token = Array(n).fill(0);
    this.tokenOwner = initialTokenOwner;

    this.save(
      "État initial",
      `Le jeton est initialement chez P${initialTokenOwner}.`
    );
  }

  getSteps() {
    return this.steps;
  }

  private site(id: SiteId) {
    return this.sites.find((s) => s.id === id)!;
  }

  private cloneSites(): Site[] {
    return this.sites.map((s) => ({
      ...s,
      req: [...s.req],
    }));
  }

  private save(
    title: string,
    description: string,
    messages: Message[] = [],
    activeSite?: SiteId
  ) {
    this.steps.push({
      id: ++this.stepId,
      title,
      description,
      sites: this.cloneSites(),
      token: [...this.token],
      tokenOwner: this.tokenOwner,
      messages,
      activeSite,
    });
  }

  /**
   * Pi veut entrer en SC.
   */
  requestCS(i: SiteId) {
    const pi = this.site(i);

    pi.etat = "demandeur";

    if (pi.jetonPresent) {
      this.enterCS(i);
      return;
    }

    pi.req[i - 1]++;

    const reqNumber = pi.req[i - 1];

    const messages: Message[] = [];

    for (let j = 1; j <= this.n; j++) {
      if (j !== i) {
        const msg: Message = {
          id: ++this.msgId,
          type: "REQ",
          from: i,
          to: j,
          reqNumber,
        };

        this.messages.push(msg);
        messages.push(msg);
      }
    }

    this.save(
      `P${i} demande la section critique`,
      `P${i} incrémente Req[${i}] à ${reqNumber}, puis diffuse REQ(${reqNumber}) aux autres processus.`,
      messages,
      i
    );
  }

  /**
   * Livraison d'une requête REQ.
   * Le réseau peut être non FIFO, donc on livre les messages manuellement.
   */
  deliverRequest(from: SiteId, to: SiteId) {
    const index = this.messages.findIndex(
      (m) => m.type === "REQ" && m.from === from && m.to === to
    );

    if (index === -1) return;

    const msg = this.messages[index] as Message & { type: "REQ" };
    this.messages.splice(index, 1);

    const receiver = this.site(to);

    // ✅ Ici : Pto reçoit REQ de Pfrom
    // donc Pto fait Req[from] = Req[from] + 1
    receiver.req[from - 1] += 1;

    this.save(
      `P${to} reçoit REQ de P${from}`,
      `P${to} mémorise la demande : Req[${from}] = Req[${from}] + 1 = ${
        receiver.req[from - 1]
      }.`,
      [msg],
      to
    );

    if (
      receiver.jetonPresent &&
      receiver.etat === "dehors" &&
      receiver.req[from - 1] > this.token[from - 1]
    ) {
      this.sendToken(to, from);
    }
  }

  /**
   * Réception du jeton.
   */
  deliverToken(from: SiteId, to: SiteId) {
    const index = this.messages.findIndex(
      (m) => m.type === "TOKEN" && m.from === from && m.to === to
    );

    if (index === -1) return;

    const msg = this.messages[index] as Message & { type: "TOKEN" };
    this.messages.splice(index, 1);

    const receiver = this.site(to);

    receiver.jetonPresent = true;
    this.tokenOwner = to;
    this.token = [...msg.token];

    this.save(
      `P${to} reçoit le jeton`,
      `P${to} possède maintenant le jeton.`,
      [msg],
      to
    );

    if (receiver.etat === "demandeur") {
      this.enterCS(to);
    }
  }



  deliverAllRequests(from: SiteId) {
    const deliveredMessages = this.messages.filter(
      (m) => m.type === "REQ" && m.from === from
    ) as (Message & { type: "REQ" })[];

    if (deliveredMessages.length === 0) return;

    // supprimer ces messages de la file réseau
    this.messages = this.messages.filter(
      (m) => !(m.type === "REQ" && m.from === from)
    );

    const updatedSites: SiteId[] = [];

    for (const msg of deliveredMessages) {
      const receiver = this.site(msg.to);

      receiver.req[from - 1] += 1;
      updatedSites.push(msg.to);
    }

    this.save(
      `Diffusion REQ de P${from} reçue`,
      `Tous les autres processus reçoivent REQ de P${from} et mettent à jour Req[${from}].`,
      deliveredMessages,
      from
    );

    // après la réception globale, le site qui possède le jeton décide
    const tokenSite = this.sites.find((s) => s.jetonPresent);

    if (
      tokenSite &&
      tokenSite.etat === "dehors" &&
      tokenSite.req[from - 1] > this.token[from - 1]
    ) {
      this.sendToken(tokenSite.id, from);
    }
  }


  /**
   * Entrée en section critique.
   */
  private enterCS(i: SiteId) {
    const pi = this.site(i);

    if (!pi.jetonPresent) return;

    pi.etat = "dedans";

    this.save(
      `P${i} entre en section critique`,
      `P${i} possède le jeton, donc il peut accéder à la ressource.`,
      [],
      i
    );
  }

  /**
   * Sortie de section critique.
   */
  releaseCS(i: SiteId) {
    const pi = this.site(i);

    if (pi.etat !== "dedans") return;

    pi.etat = "dehors";

    this.token[i - 1] = pi.req[i - 1];

    this.save(
      `P${i} libère la section critique`,
      `P${i} met à jour Jeton[${i}] = Req[${i}] = ${pi.req[i - 1]}.`,
      [],
      i
    );

    this.chooseNextTokenOwner(i);
  }

  /**
   * Choix équitable du prochain processus.
   * On parcourt i+1, ..., n, 1, ..., i-1.
   */
  private chooseNextTokenOwner(i: SiteId) {
    const pi = this.site(i);

    for (let k = 1; k < this.n; k++) {
      const j = ((i - 1 + k) % this.n) + 1;

      if (pi.req[j - 1] > this.token[j - 1]) {
        this.sendToken(i, j);
        return;
      }
    }

    this.save(
      `P${i} garde le jeton`,
      `Aucune requête en attente : P${i} conserve le jeton.`,
      [],
      i
    );
  }

  /**
   * Envoi du jeton.
   */
  private sendToken(from: SiteId, to: SiteId) {
    const sender = this.site(from);

    sender.jetonPresent = false;
    this.tokenOwner = null;

    const msg: Message = {
      id: ++this.msgId,
      type: "TOKEN",
      from,
      to,
      token: [...this.token],
    };

    this.messages.push(msg);

    this.save(
      `P${from} envoie le jeton à P${to}`,
      `Comme Req[${to}] > Jeton[${to}], la demande de P${to} n’est pas encore satisfaite.`,
      [msg],
      from
    );
  }
}