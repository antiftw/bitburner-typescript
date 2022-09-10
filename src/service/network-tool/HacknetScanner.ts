
import Configurator from "service/core/Configurator";
import { FileManager } from "service/core/FileManager";
import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import Logger from "service/diagnostics/Logger";
import HacknetServer from "object/server/HacknetServer";
import { IScanner, ISimpleJSONReturn } from "types";

export default class HacknetScanner implements IScanner{
    ns: NS;
    verbose: number;
    readonly context: string = 'SCAN-HCK';
    readonly homeServer: string = 'home;'
    servers: Array<HacknetServer>;
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
        this.structureFile = this.cfg.getConfiguration('structure_file', 'hacknet').getStringValue();
        this.servers = [];
    }
    async execute(): Promise<ISimpleJSONReturn>{
        try {
            const initResult = this.init();
            let writeResult;
            if (!initResult.success) {
                return initResult;
            }else {
                this.logger.log(initResult.message);
            }
            // we exclude home to avoid running in circles, and darkweb because of some invalid values (iirc)
            const scanResult = this.scanNetwork([]);
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

            this.structureFile = this.cfg.getConfiguration('structure_file', 'hacknet').getStringValue();
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
            const amountOfNodes = this.numNodes();
            for(let counter = 0; counter < amountOfNodes; counter++){
                const serverName = 'hacknet-node-' + counter;
                if(!exclude.includes(serverName)) {
                    const server = new HacknetServer(serverName);
                    this.servers.push(server);
                }
            }
           
            return {
                success: true,
                message: `Successfully scanned Hacknet network. Detected [ ${this.servers.length} ] servers`,
                value: this.servers.length
            }
       }catch(e){
           return this.eh.handle('SCAN-NETWORK');
       }
    }

    async write(): Promise<ISimpleJSONReturn>{
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

    /**
     * Get the amount of nodes in the Hacknet network
     */
        numNodes(): number{
        return this.ns.hacknet.numNodes();
    }
}