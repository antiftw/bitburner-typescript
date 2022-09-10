
import Configurator from "service/core/Configurator";
import { FileManager } from "service/core/FileManager";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import Logger from "service/diagnostics/Logger";
import BotnetServer from "object/server/BotnetServer";
import { IScanner, ISimpleJSONReturn } from "types";

export default class BotnetScanner implements IScanner{
    ns: NS;
    verbose: number;
    servers: Array<BotnetServer>;
    structureFile: string;
    logger: Logger;
    cfg: Configurator;
    eh: ExceptionHandler;
    file: FileManager;

    readonly context: string = 'SCAN-BOT';
    readonly homeServer: string = 'home;'
    
    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.logger = new Logger(ns, verbose, this.context);
        this.cfg = new Configurator(ns, verbose);
        this.eh = new ExceptionHandler(ns, this.context);
        this.file = new FileManager(ns, verbose);
        this.structureFile = '';
        this.servers = [];
    }
    async execute() : Promise<ISimpleJSONReturn>{
        try {
            const initResult = this.init();
            let writeResult;
            if (!initResult.success) {
                return initResult;
            }else {
                this.logger.log(initResult.message);
            }
            const scanResult = this.scanNetwork([]);
            this.logger.log(scanResult.message);
            if(scanResult.success) {
                writeResult = await this.write();
                this.logger.log(writeResult.message);
                if(writeResult.success) {
                    // scanned and written successfully
                    return scanResult;
                }
            }else {
                return scanResult;
            }
            return {
                success: false,
                message: `Something went wrong. init: ${initResult}, scan: ${scanResult}, write: ${writeResult}`
            }
        }catch(e) {
            return this.eh.handle(e, 'EXECUTE');
        }
    }
    init(): ISimpleJSONReturn {
        try{
            this.structureFile = this.cfg.getConfiguration('structure_file', 'botnet').getStringValue();
            return {
                success: true,
                message: `Successfully initialized Botnet scanner.`,
                value: 0
            }
        }catch(e){
            return this.eh.handle(e, 'INIT');
        }
    }
    scanNetwork(exclude: string[]): ISimpleJSONReturn {
        try{
            const servers = this.ns.getPurchasedServers();
            for(let index = 0; index < servers.length; index++){
                const serverName = servers[index];
                if(!exclude.includes(serverName)) {
                    this.logger.log(`Adding server ${serverName} to list`)
                    const server = new BotnetServer(servers[index], 'home');
                    this.servers.push(server);
                }
            }
            return {
                success: true,
                message: `Successfully scanned Botnet network. Detected [ ${this.servers.length} ] servers`,
                value: this.servers.length
            }
       }catch(e){
           return this.eh.handle('SCAN-NETWORK');
       }
    }

    async write(): Promise<ISimpleJSONReturn> {
        try{
            await this.file.writeJson(this.structureFile, this.servers);
            return {
                success: true,
                message: `Successfully written [ ${this.servers.length} ] servers to disk.`
            }
        }catch(e) {
            return this.eh.handle(e, 'WRITE');
        }
    }
}