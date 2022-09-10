
import { IPublicServerData, IServer } from '/types';
export default class PublicServer implements IServer {
    name: string;
    source: string;

    rootAccess: boolean;
    maxMoney: number;
    maxRam: number;
    money: number;
    usedRam: number;
    cores: number

    portsRequired: number;
    requiredHackingLevel: number;
    security: number;
    minSecurity: number;
    favorability: number;

    constructor(name: string, source: string, rootAccess = false, money = 0, maxMoney = 0, usedRam = 0, maxRam = 0, cores = 1) {
        this.name = name;
        this.source = source;
        this.rootAccess = rootAccess;
        this.money = money;
        this.maxMoney = maxMoney;
        this.usedRam = usedRam;
        this.maxRam = maxRam;
        this.cores = cores;

        this.portsRequired = 0;
        this.requiredHackingLevel = 0;
        this.security = 0;
        this.minSecurity = 0;
        this.favorability = this.calculateFavorability();
    }

    update(values: IPublicServerData) : void {
        this.maxRam = values.maxRam;
        this.maxMoney = values.maxMoney;
        this.rootAccess = values.rootAccess;
        this.usedRam = values.usedRam;
        this.money = values.money;
        this.portsRequired = values.portsRequired;
        this.requiredHackingLevel = values.requiredHackingLevel;
        this.security = values.security;
        this.minSecurity = values.minSecurity;
        this.favorability = this.calculateFavorability();
    }
    /**
     * Calculate how potentially favorable/profitable it would be to attack this server
     * @param denominator to divide by to get an overal ratio (default value is the maxMoney / minSecurity ratio of the "best" server)
     * @returns the favorabilityratio
     */
    calculateFavorability(denominator = 52782079024.242424242424242424242) : number {
       // return this.favorability = (this.maxMoney / this.minSecurity / denominator).toFixed(4);
       return (this.maxMoney / this.minSecurity / denominator * 100);
    }
}