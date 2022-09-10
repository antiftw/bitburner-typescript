import BotnetServer from "object/server/BotnetServer";

/**
 * Complete Botnet server class, contains all relevant functionality
 */
export class ExtendedBotnetServer extends BotnetServer {
    ns: NS;
    constructor(ns: NS, name: string, source = 'home'){
        super(name, source);
        this.ns = ns;
    }
    fetch(property: string): number{
        switch(property) {
            case 'money':
                return this.ns.getServerMoneyAvailable(this.name);
            case 'maxMoney':
                return this.ns.getServerMaxMoney(this.name);
            case 'usedRam':
                return this.ns.getServerUsedRam(this.name);
            case 'maxRam':
                return this.ns.getServerMaxRam(this.name);
            case 'rootAccess':
                return Number(this.ns.hasRootAccess(this.name));
            case 'security':
                return this.ns.getServerSecurityLevel(this.name);
            case 'minSecurity':
                return this.ns.getServerMinSecurityLevel(this.name);
            default:
                return 0;
        }
    }

    actualize(): void {
        this.money = this.fetch('money');
        this.maxMoney = this.fetch('maxMoney');
        this.usedRam = this.fetch('usedRam');
        this.maxRam = this.fetch('maxRam');
        this.rootAccess = Boolean(this.fetch('rootAccess'));
    }
}