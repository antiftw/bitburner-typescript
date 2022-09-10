import { ServerManager } from "./ServerManager";
import { ExtendedBotnetServer } from "/object/server/ExtendedBotnetServer";
import { IServerManagerAction, ISimpleJSONReturn } from "/types";

export class BotnetManager extends ServerManager {
    allowedRamAmounts: Array<number>;
    maxAllowedAmountOfRam: number;
    servers: Array<ExtendedBotnetServer>
    constructor(ns: NS, verbose = 0, context = 'BOTNET'){
        super(ns, verbose, context);
        this.allowedRamAmounts = [];
        this.maxAllowedAmountOfRam = 1024 * 1024;
        this.servers = [];
    }
    loadData(): void {

        this.budgetFile = this.cfg.getConfiguration('botnet_file', 'budget').getStringValue();
        this.dataFile = this.cfg.getConfiguration('data_file', 'botnet').getStringValue();

        this.initializeServers();
        this.loadBudget();
    }

    async writeData(): Promise<ISimpleJSONReturn> {
        try{
            this.logger.log(`Writing new servers (${this.servers.length}) and budget (${this.budget.toLocaleString('en')}) to file`)
            if(typeof this.budgetFile !== 'undefined') {
                await this.bm.writeBudgetFile(this.budgetFile, this.budget);
            }
            await this.file.writeJson(this.cfg.getConfiguration('structure_file', 'botnet').getStringValue(), this.servers);
            return {
                success: true,
                message: `Successfully written data to disk concerning the botnet network`
            }
        }catch(e) {
            return this.eh.handle(e, 'WRITE-DATA');
        }
    }

    initializeServers() : void{
        try{
            const servers: Array<ExtendedBotnetServer> = [];
            const serverData = this.file.readJson(this.dataFile);
            for(const data of serverData) {
                const server = new ExtendedBotnetServer(this.ns, data.name, 'home');
                server.actualize();
                servers.push(server);
            }
            this.servers = servers;
        }catch(e) {
            this.eh.handle(e, 'INITIALIZE-SERVERS')
        }
    }
    
    /**
     * Determine the phase we are in, influencing the choice of our optimal action
     */
    determinePhase(): void{
       try{
            // Since the maximum amount of servers increases over time, phase can go back to 0
            this.logger.log(`Determining phase:`)
            this.logger.log(`- maxServersReached: ${this.maxServersReached()}`)
            this.logger.log(`- allServersUpgraded: ${this.allServersUpgraded()}`)
            if(!this.maxServersReached()) {
                // Still allowed to buy new servers
                this.phase = 0;
            }else if (this.maxServersReached() && !this.allServersUpgraded()){
                // Not allowed to buy servers, but still able to upgrade
                this.phase = 1;
            }else if(this.allServersUpgraded()){
                // All servers fully upgraded
                this.phase = 2;
            }
            this.logger.log(`Phase determined: [ ${this.phase} ]`)
       }catch(e) {
            this.eh.handle(e, 'DETERMINE-PHASE')
       }
    }

    /**
     * Determine the optimal action depending on the phase and prices of different actions
     * @returns {object} action {name, price, node}
     */
    determineOptimalAction(): IServerManagerAction | undefined {
        // Our main tactic is to buy new ones if we can and upgrade RAM otherwise
        let action;
        if(this.phase === 0 ){
            const result = this.calculateMaxRam();
            action = this.formatAction('buy-new', result.cost);
        }else if(this.phase === 1) {
            // upgrade ram
            const result = this.calculateMaxRam('upgrade');
            action = this.formatAction('upgrade-ram', result.cost);
        }else if(this.phase === 2) {
            // nothing to do
            action = this.formatAction('wait');
        }
        this.logger.log(`${JSON.stringify(action)}`)
        return action;
    }

    /**
     * Perform the determined action
     * @param {object} action The action to be performed: {name, price, node}
     * @returns success
     */
    async performAction(action: IServerManagerAction): Promise<ISimpleJSONReturn>{
        this.logger.log(`action.name: ${action.name}`)
        this.logger.log(`${JSON.stringify(action)}`)
        if(action.name === 'buy-new'){
            const buyResult = await this.buyNodes();
            this.logger.log(`Buyresult: ${buyResult.success}: "${buyResult.message}"`);
            return buyResult;
        }else if(action.name === 'upgrade-ram'){
            const upgradeResult = await this.upgradeNodes();
            this.logger.log(`Upgraderesult: ${upgradeResult.success}:" ${upgradeResult.message}"`)
            return upgradeResult;
        }else if(action.name === 'wait'){
            this.enabled = false;
        }
        return {
            success: true,
            message: `Successfully performed action ${action.name}`
        }
    }

    async upgradeNodes(): Promise<ISimpleJSONReturn> {
        // init vars
        let name;
        let success = false;
        const errors = [];
       
        const toUpgrade = this.calculateMaxRam('upgrade');

        for(let index = 0; index < toUpgrade.amount; index++) {
            name = this.cfg
                .getConfiguration("name_template", "botnet")
                .getStringValue()
                .replace('[id]', String(index));
            const result = this.upgradeNode(name, toUpgrade.ram);
            this.logger.log(result.message);
            success = success && result.success;
            if(!result.success) {
                errors.push(result.message);
            }
            await this.ns.asleep(10)
        }

        return {
            success: success,
            message: success ? `Successfully upgraded ${toUpgrade.amount} new bots` : `${errors.join()}`
        }
    }

    /**
     * Upgrades a single node, which is actually the deletion & re-creation of that node
     * @param serverName The name of the server to 'upgrade'
     * @param ram : The (total) amount we are 'upgrading' the server to in GB
     */
    upgradeNode(serverName: string, ram: number): ISimpleJSONReturn{
        try{
            this.logger.log(`Attempting to upgrade node ${serverName} to ${ram} GB RAM`);
            const server = this.findByName(serverName);
            if(typeof server === 'undefined'){
                return {
                    success: false,
                    message: `Node with name ${serverName} not found.`
                }
            }
            this.logger.log(`Located ${server.name}: current ram: ${server.maxRam}`);
            // since we cannot actually upgrade a node, we need to delete it
            const deleteResult = this.deleteServer(serverName);
            this.logger.log(`${deleteResult.message}`)
            if (deleteResult.success) {
                // and create a new one with the same name and the "upgraded" amount of RAM
                const buyResult = this.buyNode(serverName, ram);
                if(buyResult.success){
                    this.logger.log(buyResult.message);
                    return {
                        success: true,
                        message: `Successfully upgraded node ${buyResult.value.name}`,
                        value: buyResult.value
                    };
                }
            }
            return {
                success: false,
                message: `Error deleting node ${serverName}`
            };
        }catch(e) {
            return this.eh.handle(e, 'UPGRADE-NODE');
        }
    }

    async buyNodes(): Promise<ISimpleJSONReturn> {
        const toBuy = this.calculateMaxRam();
        if(toBuy.amount === 0) {
            return {
                success: false,
                message: `Not buying any nodes, not enough budget`
            }
        }
        let newId = this.servers.length;
        let name;
        let success = false;
        const errors = [];
        this.logger.log(`toBuy: ${JSON.stringify(toBuy)}, newId: ${newId}`)
        for(let index = 0; index < toBuy.amount; index++) {
            name = this.cfg.getConfiguration("name_template", "botnet").getStringValue().replace('[id]', String(newId));
            const result = this.buyNode(name, toBuy.ram);
            this.logger.log(result.message);
            newId++;
            success = success && result.success;
            if(!result.success) {
                errors.push(result.message);
            }
            await this.ns.asleep(10)
        }
        
        return {
            success: success,
            message: success ? `Successfully bought ${toBuy.amount} new bots` : `${errors.join()}`
        }
    }

    /**
     * @param {string} hostname Hostname of the new node
     * @param {int} ram Amount of RAM for the new node
     * @returns {bool} success
     */
    buyNode(hostname: string, ram: number): ISimpleJSONReturn{
        this.logger.log(`Attempting to buy node ${hostname}, with ${ram} GB RAM`)
        try{
            const result = {
                success: false,
                message: `Failed to buy BotnetServer [ ${hostname} ], bot with that name already exists`
            };
            if(this.serverExists(hostname)){
                return result;
            }
            if(!this.ramAmountAllowed(ram)){
                result.message = 'RAM amount can only be a power of 2 and > 0';
                return result;
            }
            if(this.maxServersReached()) {
                result.message = `Maximum allowed Botnet size reached: ${String(this.servers.length)} ' / ' ${this.getPurchasedServerLimit()}`;
                return result;
            }
            this.logger.log(`No Exceptions triggered: proceeding...`)
            const purchaseResult = this.ns.purchaseServer(hostname, ram);

            if(purchaseResult === '') {
                return {
                    success: false,
                    message: `Something went wrong purchasing a new BotnetServer with name ${hostname}`
                }
            }else{
                const server = new ExtendedBotnetServer(this.ns, purchaseResult);
                this.logger.log(`Updating local datastructure, old length: ${this.servers.length}`)
                server.update({
                    maxRam: ram,
                    maxMoney: 0,
                    rootAccess: true,
                    usedRam: 0,
                    money: 0,
                })
                const len = this.servers.push(server);
                this.logger.log(`Local datastructure updated, new length: ${len}`)
                // fetch to see if it worked
                const newServer = this.servers[this.servers.length -1];

                return {
                    success: true,
                    message: `Succesfully bought new node ${newServer.name} with ${newServer.maxRam} GB RAM`,
                    value: newServer
                };
            }
        }catch(e) {
            const exception = this.eh.handle(e);
            return {
                success: false,
                message: `Error buying node: ${exception}`
            };
        }
    }
    /**
     * Check if we have reached the maximum amount of servers
     * @returns {bool}
     */
    maxServersReached(): boolean{
        const allowedSize = this.getPurchasedServerLimit();
        const currentSize = this.servers.length;
        if(currentSize < allowedSize) {
           return false;
        }
        return true;
    }
    /**
     * Check if all servers are upgraded (have max ram)
     * @returns {bool} 
     */
    allServersUpgraded(): boolean {
        if(!this.maxServersReached()) {
            return false;
        }
        try{
            const maxRam = this.ns.getPurchasedServerMaxRam();
            const server = this.servers.find(srv => srv.maxRam < maxRam);
            if(typeof server === 'undefined') {
                return true;
            }
            return false;
        }catch(e) {
            this.eh.handle(e);
            return false;
        }
    }
    /**
     * Check whether a given amount of RAM is allowed for buying a Botnet server
     * @param {int} ram The amount of ram to check
     * @returns Whether the amount is allowed (is a power of two and not equal to 0)
     */
    ramAmountAllowed(ram: number): boolean{
        // Thanks to https://graphics.stanford.edu/~seander/bithacks.html#DetermineIfPowerOf2
        // Power of 2 && > 0
        if((ram && !(ram & (ram - 1)))){
            return true;
        }
        return false;
    }

    /**
     * Wrapper for the NS PurchaseServer function (Buy a new "purchased" server)
     * @param {string} hostname the name of the new server
     * @param {int} ram the amount of RAM for the new server
     * @returns the name of the new server if success, or am empty string when failed
     */
    purchaseServer(hostname: string, ram: number): string{
        return this.ns.purchaseServer(hostname, ram);
    }
    /**
     * Delete a purchased servers and update local datastructure to new situation
     * @param {string} hostname the name of the serer to be deleted
     * @returns {obj} = {success, message}
     */
    deleteServer(hostname: string): ISimpleJSONReturn{
        try{
            this.logger.log(`Pre-deletion check for existance: exists = ${this.serverExists(hostname)}`)
            if(this.serverExists(hostname)){
                
                this.logger.log(`Pre deletion check for running scripts: [ ${hostname} ]`)
                const runningScripts = this.ns.ps(hostname);
                // Kill all scripts, else ns.deleteServer() will fail
                if(runningScripts.length > 0 ) {
                    this.logger.log(`Killing all scripts (${runningScripts.length}) on server: [ ${hostname} ]`)
                    const killResult = this.ns.killall(hostname);
                    if(killResult) {
                        this.logger.log(`Successfully killed all scripts on server [ ${hostname} ]`)
                    }
                }else {
                    this.logger.log(`No scripts running on server [ ${hostname} ]`)
                }
                this.logger.log(`Deleting server: [ ${hostname} ]`)
                const deleteResult = this.ns.deleteServer(hostname);
                if(!deleteResult) {
                    return {
                        success: false,
                        message: `Failed deleting server [ ${hostname} ] `
                    }
                }
                // Remove element from out local datastructure
                this.logger.log(`Removing ${hostname} from local datastructure, old length: ${this.servers.length}`)
                const indexToDeleteNode = this.servers.findIndex(srv => srv.name === hostname);
                this.logger.log(`to delete: [ ${indexToDeleteNode} ]`)
                this.servers.splice(indexToDeleteNode, 1);
                this.logger.log(`Removed ${hostname} from local datastructure, new length: ${this.servers.length}`)
                return {
                    success: deleteResult,
                    message: `Successfully deleted server ${hostname}`
                }
            }
            return {
                success: false,
                message: `Cannot find server ${hostname}`
            }
        }catch(e) {
            return this.eh.handle(e, 'DELETE-SERVER');
        }
    }

    /**
     * Calculate the max amount of RAM we can buy/upgrade using the current budget.
     * @param mode whether we want to calculate it for an upgrade or a buy action
     * @returns an amount of RAM we will purchase in our new servers, or upgrade servers to.
     */
    calculateMaxRam(mode = 'buy'): {amount: number, ram: number, cost: number} {
        if(typeof mode === 'undefined' && mode !== 'buy' && mode !== 'upgrade') {
            return {amount: 0, ram: 0, cost: 0};
        }
        this.logger.log(`Calculating max ram for mode: ${mode}`)
        const currentServers = this.servers.length;
        let amount = 0;
        let counter = 1;
        let ram;
        let previousCost = 0;
        let originalRamAmount = 0

        if(mode === 'buy') {
            // Calculate the amount of servers we need to buy
            const maxServers = this.getPurchasedServerLimit();
            amount = maxServers - currentServers;
        }else if (mode === 'upgrade'){
            // We always upgrade all the servers at once or none at all
            amount = currentServers;
             // either server works, since we only upgrade all servers at the same time.
            ram = this.servers[0].maxRam;
            originalRamAmount = ram;
        }
        while(true) {
            if(mode === 'upgrade') {
                // Calculate the exponent of 2 ^ x = ram as a starting point
                counter = Math.log2(Number(ram)) + 1;
            }
            // Calulate the new amount of RAM
            ram = Math.pow(2, counter);
            originalRamAmount = counter === 1 && mode === 'buy' ? ram : originalRamAmount;
            this.logger.log(`counter: ${counter}, ram: ${ram}`)
            // Check what it costs to buy a new server with the new amount of RAM, and calculate what it costs for all servers
            const costForOneServer = this.getPurchasedServerCost(ram);
            let totalCost = amount * costForOneServer;
            this.logger.log(`ram: ${ram}, counter: ${counter}, costForOneServer: ${costForOneServer}, totalCost ${totalCost} * amount ${amount}, budget: ${this.budget}`)
            if(totalCost < this.budget) {
                // We might be able to afford more
                counter++;
                // save current cost so we can reference it in the next iteration if needed
                previousCost = totalCost;
                this.logger.log('continuing');
                continue;
            }else if(totalCost > this.budget) {
                // this is too pricy, we need the previous amount
                this.logger.log(`too pricy with counter ${counter} log2(${ram}): ${ Math.log2(ram)}`);
                if(mode === 'buy'){
                    // when buying, the minimum counter === 1
                    // so if it still is, we know there has been no increase in counter
                    totalCost = counter > 1 ? previousCost : totalCost;
                    // if so, set amount to 0, indicating we are not buying anything
                    amount = counter > 1 ? amount : 0;
                    // update counter to previous if counter > 0
                    counter = counter > 1 ?  counter - 1 : 1;
                }else if (mode === 'upgrade'){
                    // when upgrading, the minimum counter === Math.log2(ram) + 1
                    this.logger.log(` counter(${counter}) > log2(origRam(${originalRamAmount})) (${Math.log2(originalRamAmount)}) + 1 => ${counter >  Math.log2(originalRamAmount) + 1 }`)
                    // if so, we know there has been no increase in counter
                    totalCost = counter > Math.log2(originalRamAmount) + 1 ? previousCost : totalCost;
                    // if so, we set the amount to 0, indicating we are not upgrading anything
                    amount = counter > Math.log2(originalRamAmount) + 1 ? amount : 0;
                    // update counter to previous if counter larger than the minimum value
                    counter = counter > Math.log2(originalRamAmount) + 1 ? counter - 1 : Math.log2(originalRamAmount) + 1;
                }
                this.logger.log(`to purchase: 2^${counter} (= ${Math.pow(2, counter)}) RAM * ${amount} servers => costs: ${totalCost}`);
            }
            // if no ifs are triggered it means totalCost === this.budget, meaning it's exactly enough.
            // So we return without altering counter and return the current totalCost
            return {
                amount: amount,
                ram: Math.pow(2, counter),
                cost: totalCost
            };
        }
    }

    /**
     * Search a server in the local datastructure
     * @param name the servername to search
     * @returns the server
     */
    findByName(name: string): ExtendedBotnetServer | undefined{
        return this.servers.find(srv => srv.name === name)
    }
    /**
     * Get the max amount of servers
     * @returns {int} amount
     */
    getPurchasedServerLimit(): number{
        return this.ns.getPurchasedServerLimit();
    }
    /**
     * Check how much a new server costs with a specified amount of RAM
     * @param {int} ram amount of RAM
     * @returns {float} cost
     */
    getPurchasedServerCost(ram: number): number {
        return this.ns.getPurchasedServerCost(ram);
    }
    /**
     * Check how much RAM a "purchased" server can maximally get
     * @returns {int} amount
     */
    getPurchasedServerMaxRam(): number{
        return this.ns.getPurchasedServerMaxRam();
    }
    /**
     * Get a list of all "purchased" servers
     * @returns currently purchased servers
     */
    getPurchasedServers(): Array<string>{
        return this.ns.getPurchasedServers();
    }
}