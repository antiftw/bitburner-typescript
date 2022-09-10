import { Infector } from "service/network-tool/hacking/Infector";
import { ServerManager } from "service/network-tool/manager/ServerManager";
import ExtendedPublicServer from "object/server/ExtendedPublicServer";
import { IServerManagerAction, ISimpleJSONReturn } from "types";

/**
 * Class that handles the expansion of our infected part of the public network
 */
export class PublicManager extends ServerManager{
    infector: Infector;
    maxPortsHackable: number;
    servers: Array<ExtendedPublicServer>
    constructor(ns: NS, verbose = 0, context = 'PUBLIC'){
        super(ns, verbose, context);
        this.infector = new Infector(ns, verbose);
        this.maxPortsHackable = 0;
        this.servers = [];
    }

    /**
     * @inheritdoc
     */
    loadData(enabled = true): void{
        this.initializeServers();
        this.calculateNukablePortsMax();
        this.enabled = enabled;
    }

    async writeData(): Promise<ISimpleJSONReturn> {
        try{
            this.logger.log(`Writing new servers (${this.servers.length}) and budget (${this.budget.toLocaleString('en')}) to file`)
            if(typeof this.budgetFile !== 'undefined') {
                await this.bm.writeBudgetFile(this.budgetFile, this.budget);
            }
            await this.file.writeJson(this.cfg.getConfiguration('structure_file', 'public').getStringValue(), this.servers);
            return {
                success: true,
                message: `Successfully written data to disk concerning the public network`
            }
        }catch(e) {
            return this.eh.handle(e, 'WRITE-DATA');
        }
    }

    /**
     * @inheritdoc
     */
    initializeServers(): void {
        const serverData = this.file.readJson(this.cfg.getConfiguration('structure_file', 'public').getStringValue());
        for(const data of serverData) {
            const srv = new ExtendedPublicServer(this.ns, data.name, data.source);
            srv.actualize();
            this.servers.push(srv);
        }
    }

    /**
     * @inheritdoc
     */
    determineOptimalAction(): IServerManagerAction {
        let action = this.formatAction('wait', 0)
        if(this.phase === 0) {
            action = this.formatAction('infect', 0);
        }
        
        return action;
    }

    /**
     * @inheritdoc
     */
    async performAction(action: IServerManagerAction): Promise<ISimpleJSONReturn> {
        let result;
        const servers = this.rootableServers(false);
        switch(action.name) {
            case 'infect':
                
                await this.infectServers(servers);
                result = {
                    success: true,
                    message: `Infected servers (${servers.length})`
                }
                break;
            case 'wait':
            default:
                this.enabled = false;
                this.logger.notify(`No servers to infect, hybernating`);
                result =  {
                    success: true,
                    message: 'No new servers to infect, hybernating'
                }
                if(this.servers.find(srv => srv.requiredHackingLevel === this.ns.getHackingLevel())) {
                    // this is not completely correct, since we only want to do this once => but how?
                    // let the other part of the application know we might have a new target to consider
                    //let port = this.config.ports.find(port => port.purpose = 'request-reassesment');
                    //await ns.tryWritePort(port.id, 1);
                }
               
        }
        return result;
    }

    /**
     * @inheritdoc
     */
    determinePhase(): void{
        const rootableServers = this.rootableServers(false);
        const rootedServers = this.rootableServers();
        this.logger.log(`Rooted/Rootable servers: ${rootedServers.length} / ${rootableServers.length}`)
        if(rootableServers.length > rootedServers.length) {
            // There still are servers that can be rooted
            this.phase = 0;
        }else {
            this.phase = 1;
        }
        this.logger.log(`Phase determined: ${this.phase}`)
    }

    /**
     * Check which servers are rootable
     * @param rooted: Whether we also want servers that have already been rooted
     * @returns an array of servers
     */
    rootableServers(rooted = true): Array<ExtendedPublicServer>{
        const servers =  this.servers.filter(srv => this.isRootable(srv))
        if(rooted) {
            return servers.filter(srv => srv.rootAccess === true);
        }
        return servers;
    }

    /**
     * Check if a certain server is rootable (meaning we have enough exe's to open all ports)
     * @param server the server to check
     * @returns
     */
    isRootable(server: ExtendedPublicServer): boolean {
        const ports = server.portsRequired;
        if(ports > this.maxPortsHackable) {
            return false;
        }
        return true;
    }

    /**
     * Caclulate how many ports we can open
     * @param reload whether we wish to recaculate of just read from cache
     * @returns the max amount of servers we can open currently
     */
    calculateNukablePortsMax(reload = true): number{
        if(!reload && this.maxPortsHackable !== 0) {
            return this.maxPortsHackable;
        }
        let amount = 0 ;
        if(this.file.fileExists('BruteSSH.exe')){
            amount++;
        }
        if(this.file.fileExists('FTPCrack.exe')){
            amount++;
        }
        if(this.file.fileExists('relaySMTP.exe')){
            amount++;
        }
        if(this.file.fileExists('HTTPWorm.exe')){
            amount++;
        }
        if(this.file.fileExists('SQLInject.exe')){
            amount++;
        }
        this.maxPortsHackable = amount;
        return this.maxPortsHackable;
    }

    /**
     * Infect an array of servers
     * @param {array} servers to be infected
     */
    async infectServers(servers: Array<ExtendedPublicServer>): Promise<void> {
        for(const server of servers) {
            await this.infect(server);
        }

        if(servers.length > 0) {
            this.logger.notify(`Run complete: ${servers.length} servers infected.`);
            this.enabled = false;
            
        }
    }
    
    /**
     * Infect a server
     * @param {Server} server to be infected
     */
    async infect(server: ExtendedPublicServer): Promise<ISimpleJSONReturn>{
        try{
            const result = await this.infector.infect(server);
            if(result.success) {
                // Update our local datastructure, else we will get stuck in an infinite loop
                for(let index = 0; index < this.servers.length; index++) {
                    const srv = this.servers[index];
                    if(srv.name === server.name) {
                        this.servers[index].rootAccess = true;
                        break;
                    }
                }
            }
            return { 
                success: true,
                message: result.message
            }
        }catch(e){
            return this.eh.handle(e, 'INFECT');
        }
    }

}