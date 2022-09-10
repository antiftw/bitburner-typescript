import PublicServer from 'object/server/PublicServer'
export default class ExtendedPublicServer extends PublicServer {
    ns: NS;
    constructor(ns: NS, name: string, source: string){
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
                // cast to Number to kinda hack around the type 
                return Number(this.ns.hasRootAccess(this.name));
            case 'security':
                return this.ns.getServerSecurityLevel(this.name);
            case 'minSecurity':
                return this.ns.getServerMinSecurityLevel(this.name);
            case 'portsRequired':
                return this.ns.getServerNumPortsRequired(this.name);
            case 'requiredHackingLevel':
                return this.ns.getServerRequiredHackingLevel(this.name);
            default:
                return 0;
        }
    }

    actualize() {
        this.money = this.fetch('money');
        this.maxMoney = this.fetch('maxMoney');
        this.usedRam = this.fetch('usedRam');
        this.maxRam = this.fetch('maxRam');
        // cast back to Bool to avoid problems elsewhere in the application (when using === for instance)
        this.rootAccess = Boolean(this.fetch('rootAccess'));
        this.security = this.fetch('security');
        this.minSecurity = this.fetch('minSecurity');
        this.portsRequired = this.fetch('portsRequired');
        this.requiredHackingLevel = this.fetch('requiredHackingLevel');
        this.favorability = this.calculateFavorability();
    }
    nuke(){
        this.ns.nuke(this.name);
    }
    bruteSsh(){
        this.ns.brutessh(this.name);
    }
    ftpCrack() {
        this.ns.ftpcrack(this.name);
    }
    relaySmtp(){
        this.ns.relaysmtp(this.name);
    }
    httpWorm(){
        this.ns.httpworm(this.name);
    }
    sqlInject(){
        this.ns.sqlinject(this.name);
    }
}