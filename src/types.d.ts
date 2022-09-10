import ExtendedHacknetServer from "./object/server/ExtendedHacknetServer";
import Configurator from "./service/core/Configurator";
import { FileManager } from "./service/core/FileManager";
import { ExceptionHandler } from "./service/diagnostics/ExceptionHandler";
import Logger from "./service/diagnostics/Logger";

export interface IServer {
    name: string;
    rootAccess: boolean;
    usedRam: number;
    maxRam: number;
    money: number;
    maxMoney: number;
    cores:number;
}

export interface IBotnetServerData {
    maxRam: number;
    maxMoney: number;
    rootAccess: boolean;
    usedRam: number;
    money: number;
}

export interface IHacknetServerData {
    level: number;
    ram:number;
    isServer:boolean;
    production:number;
    totalProduction:number;
    timeOnline:number;
    cache:number;
    hashCapacity:number;
    cores:number;
}

export interface IPublicServerData {
    maxRam: number;
    maxMoney: number;
    rootAccess: boolean;
    usedRam: number;
    money: number;
    portsRequired: number;
    requiredHackingLevel: number;
    security: number;
    minSecurity: number;
}

export interface IException{
    message: string; 
    type: string;
}

export interface IPort{
    id: number;
    purpose: string;
}

export interface IConfiguration{
    name: string;
    category: string;
    value: string | number | boolean  | string[] | number[] | boolean[];
}

export interface ISimpleJSONReturn {
    success: boolean,
    message: string,
    value?: any,
}

export interface IScanner{
    ns: NS;
    verbose: number;
    context: string;
    servers: Array<IServer>;
    structureFile: string;
    logger: Logger;
    cfg: Configurator;
    eh: ExceptionHandler;
    file: FileManager;

    init(): ISimpleJSONReturn;
    execute(): Promise<ISimpleJSONReturn>;
    scanNetwork(exclude: string[]): ISimpleJSONReturn;
    write(): Promise<ISimpleJSONReturn>;
}

export interface IScript {
    name: string;
    file: string;
    ram: number;
}

export interface ICrack {
    name: string;
    text: string;
}

export interface IDisplayOptions {
    rootOnly: boolean;
    hackable: boolean;
    botnet: boolean;
    public: boolean;
    hacknet: boolean;
    query: string;
    sortBy: string;
}

export interface IServerManagerAction {
    name: string;
    price: number;
    node?: ExtendedHacknetServer
}

export interface IServerManagerPerformedAction {
    name: string;
    amount: number;
    cost: number;
}


export interface IMainDaemonArguments {
    resupplyAmount: number;
    forceRefresh: boolean;
}

export interface IMainDaemonStep {
    file: string;
    verbosity: number;
    enabled: boolean;
}

export interface IBatchVariables{
    batches: number;
    delay: number;
}