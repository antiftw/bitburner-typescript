
import { IBotnetServerData, IServer } from 'types';
export default class BotnetServer implements IServer {
    name: string;
    source?: string;

    rootAccess: boolean;
    maxMoney: number;
    maxRam: number;
    money: number;
    usedRam: number;
    cores: number;
    constructor(name: string, source = 'home', rootAccess = false, money = 0, maxMoney = 0, usedRam = 0, maxRam = 0, cores = 1) {
        this.name = name;
        this.source = source;
        this.rootAccess = rootAccess;
        this.money = money;
        this.maxMoney = maxMoney;
        this.usedRam = usedRam;
        this.maxRam = maxRam;
        this.cores = cores;
    }

    update(values: IBotnetServerData) : void {
        this.maxRam = values.maxRam;
        this.maxMoney = values.maxMoney;
        this.rootAccess = values.rootAccess;
        this.usedRam = values.usedRam;
        this.money = values.money;
    }
}