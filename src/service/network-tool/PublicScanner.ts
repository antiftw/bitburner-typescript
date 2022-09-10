
import Configurator from "service/core/Configurator";
import { FileManager } from "service/core/FileManager";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import Logger from "service/diagnostics/Logger";
import PublicServer from "object/server/PublicServer";
import { IScanner, ISimpleJSONReturn, IBotnetServerData } from "types";
import BotnetServer from "object/server/BotnetServer";

export default class PublicScanner implements IScanner{
    ns: NS;
    verbose: number;
    readonly context: string = 'SCAN-PUB';
    readonly homeServer: string = 'home';
    servers: Array<PublicServer>;
    structureFile: string;
    logger: Logger;
    cfg: Configurator;
    eh: ExceptionHandler;
    file: FileManager;
    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.logger = new Logger(ns, verbose, this.context);
        this.cfg = new Configurator(ns, verbose);
        this.eh = new ExceptionHandler(ns, this.context);
        this.file = new FileManager(ns, verbose);
        this.structureFile = this.cfg.getConfiguration('structure_file', 'public').getStringValue();
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
            
            const botnetData = this.file.readJson(this.cfg.getConfiguration('structure_file', 'botnet').getStringValue());
            // we exclude home to avoid running in circles, and darkweb because of some invalid values (iirc)
            const exclude = ['home', 'darkweb'];
            // and all the botnet servers too
            for(const bot of botnetData) {
               exclude.push(bot.name);
            }

            const scanResult = this.scanNetwork(exclude);
            if(scanResult.success) {
                writeResult = await this.write();
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
            return {
                success: true,
                message: `Successfully initialized public scanner.`,
                value: 0
            }
        }catch(e){
            return this.eh.handle(e, 'INIT');
        }
    }
    scanNetwork(exclude: string[]): ISimpleJSONReturn {

        try{
            const toVisit = this.scan(this.homeServer, exclude);
            const analyzedServers: Array<PublicServer> = [];
            while(toVisit.length > 0) {
                const current = toVisit.shift();
                if(typeof current !== 'undefined'){
                    const hosts = this.scan(current.name, exclude)
                    for(const server of hosts){
                        if(!exclude.some(exclude => exclude === server.name)
                        && !analyzedServers.some(analyzed => analyzed.name === server.name)
                            ){
                                toVisit.push(server);
                        }
                    }
                }

                if(typeof current !== 'undefined') {
                    analyzedServers.push(current);
                }
            }
            this.servers = analyzedServers;
            return {
                success: true,
                message: `Successfully scanned public network. Detected [ ${this.servers.length} ] servers`,
                value: this.servers.length
            }
       }catch(e){
           return this.eh.handle('SCAN-NETWORK');
       }
    }

   
    /**
     * Wrapper for the NS.scan() function with an option to exclude servers from the search results
     * @param host: server to scan
     * @param exclude: servers to exclude from the search results
     * @return array with servers that is connected to 'host'
     */
     scan(host: string, exclude: string[]): Array<PublicServer> {
        const scanResult = this.ns.scan(host);

        const servers = [];
        for(let index = 0; index < scanResult.length; index++){ 
            const server = new PublicServer(scanResult[index], host); 
            if(!exclude.includes(server.name)){
                servers.push(server);
            }
        }
        return servers;
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