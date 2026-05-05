import type { SiteNode, LeLannMessage } from "./types";

export class LeLannEngine {
  private sites: SiteNode[];
  private tokenHolder: number;

  constructor(numberOfSites: number, initialTokenSite: number = 0) {
    this.sites = Array.from({ length: numberOfSites }, (_, i) => ({
      id: i,
      name: `P${i}`,
      state: "dehors",
      tokenPresent: i === initialTokenSite,
    }));

    this.tokenHolder = initialTokenSite;
  }

  getSites(): SiteNode[] {
    return this.sites.map((s) => ({ ...s }));
  }

  getTokenHolder(): number {
    return this.tokenHolder;
  }

  private successor(siteId: number): number {
    return (siteId + 1) % this.sites.length;
  }

  acquire(siteId: number): void {
    const site = this.sites[siteId];

    if (!site) return;

    site.state = "demandeur";

    if (site.tokenPresent) {
      site.state = "dedans";
    }
  }

  release(siteId: number): LeLannMessage | null {
    const site = this.sites[siteId];

    if (!site || site.state !== "dedans" || !site.tokenPresent) {
      return null;
    }

    const next = this.successor(siteId);

    site.state = "dehors";
    site.tokenPresent = false;

    this.sites[next].tokenPresent = true;
    this.tokenHolder = next;

    return {
      type: "TOKEN",
      from: siteId,
      to: next,
    };
  }

  receiveToken(siteId: number): LeLannMessage | null {
    const site = this.sites[siteId];

    if (!site) return null;

    this.tokenHolder = siteId;
    site.tokenPresent = true;

    if (site.state === "demandeur") {
      site.state = "dedans";
      return null;
    }

    const next = this.successor(siteId);

    site.tokenPresent = false;
    this.sites[next].tokenPresent = true;
    this.tokenHolder = next;

    return {
      type: "TOKEN",
      from: siteId,
      to: next,
    };
  }
}