import HacknetServer from 'object/server/HacknetServer'
import { NodeStats } from '/../NetscriptDefinitions';
export default class ExtendedHacknetServer extends HacknetServer {
    ns: NS;
    constructor(ns: NS, name: string, source?: string){
        super(name, source);
        this.ns = ns;
    }
    fetch(property: string): number{
        const stats = this.getNodeStats();
        switch(property) {
            case 'level':
                return stats.level;
            case 'ram':
                return stats.ram;
            case 'cores':
                return stats.cores;
            case 'production':
                return stats.production;
            case 'timeOnline':
                return stats.timeOnline;
            case 'totalProduction':
                return stats.totalProduction;
            case 'cache':
                return stats.cache;
            case 'hashCapacity':
                return stats.hashCapacity;
            default:
                return 0;
        }
    }
    
    actualize(): void {
        this.level = this.fetch('level');
        this.maxRam = this.fetch('ram');
        this.cores = this.fetch('cores');
        this.production = this.fetch('production');
        this.timeOnline = this.fetch('timeOnline');
        this.totalProduction = this.fetch('totalProduction');
        this.cache = this.fetch('cache');
        this.hashCapacity = this.fetch('hashCapacity');
    }
    
    getCacheUpgradeCost(n: number): number{
        return this.ns.hacknet.getCacheUpgradeCost(this.id, n);
    }
    getCoreUpgradeCost(n: number): number{
        return this.ns.hacknet.getCoreUpgradeCost(this.id, n);
    }
    getLevelUpgradeCost(n: number): number{
        return this.ns.hacknet.getLevelUpgradeCost(this.id, n);
    }
    getRamUpgradeCost(n: number): number{
        return this.ns.hacknet.getRamUpgradeCost(this.id, n);
    }
    upgradeCache(n: number): boolean{
        return this.ns.hacknet.upgradeCache(this.id, n);
    }
    upgradeCore(n: number): boolean{
        const upgradeCoreResult = this.ns.hacknet.upgradeCore(this.id, n);
        if(upgradeCoreResult) {
            this.cores += n;
        }
        return upgradeCoreResult;
    }
    upgradeLevel(n: number): boolean{
        const upgradeLevelResult = this.ns.hacknet.upgradeLevel(this.id, n);
        if(upgradeLevelResult) {
            this.level += n;
        }
        return upgradeLevelResult;
    }
    upgradeRam(n: number): boolean{
        const upgradeRamResult = this.ns.hacknet.upgradeRam(this.id, n);
        if(upgradeRamResult) {
            this.maxRam += n;
        }
        return upgradeRamResult;
    }
    getNodeStats(): NodeStats {
        return this.ns.hacknet.getNodeStats(this.id);
    }
    isMaxed(option = 'all'): boolean{
        const maxLevel = this.fetch('level') === 200;
        const maxRam = this.fetch('ram') === 64;
        const maxCores = this.fetch('cores') === 16;
    
        switch(option) {
            case 'all':
            default:
                return maxLevel && maxRam && maxCores;
            case 'level':
                return maxLevel;
            case 'ram':
                return maxRam;
            case 'cores':
                return maxCores;
        }
    }
}