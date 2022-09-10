
import { IHacknetServerData, IServer } from '/types';
export default class HacknetServer implements IServer {
    id: number;
    name: string;
    source?: string;

    rootAccess: boolean;
    maxMoney: number;
    maxRam: number;
    money: number;
    usedRam: number;
    cores:number;

    level: number;
    isServer: boolean;
    production: number;
    totalProduction: number;
    timeOnline: number;
    cache: number;
    hashCapacity: number;
    availableStats: Array<string>;
    constructor(name: string, source?: string, rootAccess = false, money = 0, maxMoney = 0, usedRam = 0, maxRam = 0, cores = 1) {
        
        this.name = name;
        this.source = source;
        this.rootAccess = rootAccess;
        this.money = money;
        this.maxMoney = maxMoney;
        this.usedRam = usedRam;
        this.maxRam = maxRam;
        this.cores = cores;
        const parts = name.split('-');
        this.id = Number(parts[2]);

        // Can be either Node or Server
        this.level = 0;
        this.isServer = false;
        this.production = 0;
        this.totalProduction = 0;
        this.timeOnline= 0;
        this.cache = 0;
        this.hashCapacity = 0;
        this.availableStats = [];
    }

    update(values: IHacknetServerData): void{
        this.level = values.level;
        this.maxRam = values.ram;
        this.cores = values.cores;
        this.isServer = values.isServer;
        this.production = values.production;
        this.totalProduction = values.totalProduction;
        this.timeOnline = values.timeOnline;
        this.cache = values.cache;
        this.hashCapacity = values.hashCapacity;
        this.availableStats = this.setAvailableStats();
    }

    setAvailableStats(): Array<string> {
        const stats = ['name', 'level', 'ram', 'cores', 'production', 'timeOnline', 'totalProduction'];
        if(this.isServer){
            this.availableStats.push('cache', 'hashCapacity');
        }
        return stats;
    }
}