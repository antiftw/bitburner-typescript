/** @param {NS} ns **/

import { ServerManager } from "./ServerManager";
import ExtendedHacknetServer from "/object/server/ExtendedHacknetServer";
import Logger from "/service/diagnostics/Logger";
import { IServerManagerAction, ISimpleJSONReturn } from "/types";

export class HacknetManager extends ServerManager {
    ramAmount: number;
    cpuAmount: number;
    lvlAmount: number;
    loopCounter: number;
    servers: Array<ExtendedHacknetServer>;
    constructor(ns: NS, verbose = 0, context = 'HCKNET'){
        super(ns, verbose, context);
        this.ramAmount = 0;
        this.cpuAmount = 0;
        this.lvlAmount = 0;
        this.loopCounter = 1;
        this.servers = []
        this.logger = new Logger(ns, verbose, this.context);
        this.loadData();
    }

    /**
     * @inheritdoc
     */
    loadData(): void {
        
        try {
            this.ramAmount = this.cfg.getConfiguration('min_ram_amount','hacknet').getNumberValue();
            this.cpuAmount = this.cfg.getConfiguration('min_cpu_amount','hacknet').getNumberValue();
            this.lvlAmount = this.cfg.getConfiguration('min_lvl_amount','hacknet').getNumberValue();
            this.budgetFile = this.cfg.getConfiguration('hacknet_file','budgets').getStringValue();
            this.dataFile = this.cfg.getConfiguration('data_file','hacknet').getStringValue();
            this.initializeServers();
            this.loadBudget();
            this.calculateLoopCounter();
        }catch(e) {
            this.eh.handle(e, 'INITIALIZE');
        }
    }

    async writeData(): Promise<ISimpleJSONReturn> {
        try{
            this.logger.log(`Writing new servers (${this.servers.length}) and budget (${this.budget.toLocaleString('en')}) to file`)
            if(typeof this.budgetFile !== 'undefined') {
                await this.bm.writeBudgetFile(this.budgetFile, this.budget);
            }
            await this.file.writeJson(this.cfg.getConfiguration('structure_file', 'hacknet').getStringValue(), this.servers);
            return {
                success: true,
                message: `Successfully written data to disk concerning the hacknet network`
            }
        }catch(e) {
            return this.eh.handle(e, 'WRITE-DATA');
        }
    }

    /**
     * @inheritdoc
     */
    initializeServers(): void{
        const servers = [];
        const serverData = this.file.readJson(this.dataFile);
        for(const data of serverData) {
        
            const server = new ExtendedHacknetServer(this.ns, data.name);
            server.actualize();
            servers.push(server);
        }
        this.servers = servers;
    }

    /**
     * @inheritdoc
     */
    determineOptimalAction(): IServerManagerAction | undefined {
        let action;
        const priceForNewNode = this.getPurchaseNodeCost();
        this.logger.log(`Price for new node: ${priceForNewNode.toFixed(0)}`)

        if(this.phase === 0 ){
            // Buy the first node, and switch to second phase
            action = this.formatAction('buy-new', priceForNewNode);
        }else if(this.phase === 1) {
            // In this phase we only buy new servers or upgrade the level of an existing one, whichever cheapest
            const cheapestNode = this.nodeToUpgrade('level');
            const levelPrice = cheapestNode.getLevelUpgradeCost(this.lvlAmount);
            this.logger.log(`Cheapest node to upgrade: ${cheapestNode.name}. Price: ${levelPrice}`)
            if (priceForNewNode < levelPrice) {
                action = this.formatAction('buy-new', priceForNewNode);
            } else {
                action = this.formatAction('upgrade-level', levelPrice, cheapestNode);
            }
        }else if(this.phase === 2) {
            const cheapestRamNode = this.nodeToUpgrade('ram');
            const cheapestCoreNode = this.nodeToUpgrade('core');
            const ramPrice = cheapestRamNode.getRamUpgradeCost(this.ramAmount);
            const corePrice = cheapestCoreNode.getCoreUpgradeCost(this.cpuAmount);
            this.logger.log(`Price to upgrade ram: ${ramPrice}`)
            this.logger.log(`Price to upgrade core: ${corePrice}`)
            if(ramPrice < corePrice){
                action = this.formatAction('upgrade-ram', ramPrice, cheapestRamNode);
            }else{
                action = this.formatAction('upgrade-core', corePrice, cheapestCoreNode);
            }
        }
        if (action === undefined) {
            return undefined;
        }
        this.priceOfLastAction = action.price;
        return action;
    }

    /**
     * @inheritdoc
     */
    async performAction(action: IServerManagerAction): Promise<ISimpleJSONReturn> {
        this.logger.log(`Performing action: '${action.name}'`)
        this.logger.log(JSON.stringify(action))
        if(action.node === undefined) {
            return {
                success: false,
                message: `Cannot perform action when node is undefined`
            }
        }
        try{ 
            if(action.name=== 'buy-new'){
                const result = this.expandNodeSwarm();
                this.logger.log(result.message);
                                
            }else if(action.name === 'upgrade-level'){
                this.logger.log(`Upgrading node '${action.node.name}' with [ ${this.lvlAmount} ] level(s)`)
                action.node.upgradeLevel(this.lvlAmount);
                this.logger.log(`Swarm upgraded: Level for node '${action.node.name}' to level [ ${action.node.fetch('level')} ] `)
            }else if(action.name === 'upgrade-ram'){
                this.logger.log(`Upgrading node '${action.node.name}' with [ ${this.ramAmount} ] GB RAM`)
                action.node.upgradeRam(this.ramAmount);
                this.logger.log(`Swarm upgraded: Ram for node '${action.node.name}' to [ ${action.node.fetch('ram')} ] GB RAM `)
            }else if(action.name === 'upgrade-core'){
                this.logger.log(`Upgrading node '${action.node.name}' with [ ${this.cpuAmount} ] CPU Cores`)
                action.node.upgradeCore(this.cpuAmount);
                this.logger.log(`Swarm upgraded: Core for node '${action.node.name}' to [ ${action.node.fetch('cores')} ] CORES `)
            }
            return {
                success: true,
                message: `Successfully performed action ${action.name}`
            }
        }catch(e) {
            return this.eh.handle(e, 'PERFORM-ACTION')
        }
    }

    /**
     * @inheritdoc
     */
    determinePhase(): void{
        this.logger.log(`Determining phase`)
        this.logger.log(`Server amount: [ ${this.servers.length} ] ; LoopCounter ${this.loopCounter} `)
        this.logger.log(`${this.servers.length} <= ${(12 * this.loopCounter)} : ${this.servers.length <= (12 * this.loopCounter)}`)
        if(this.servers.length == 0) {
            // Beginning, we dont have any Nodes yet
            this.phase = 0;
        }else if (this.servers.length <= (12 * this.loopCounter) && !this.allNodesUpgraded('level')){
            // First Node bought, start looping
            // Only Buy new nodes + extra levels
            this.phase = 1;
        }else if(!this.allNodesUpgraded()){
            // If not all Nodes fully upgraded
            // Buy more Ram + Cores
            this.phase = 2;
        }else if (this.allNodesUpgraded()){
            // When we have upgraded all nodes, recalculate the loop counter, and switch to phase 0, to buy a new server
            this.calculateLoopCounter();
            this.phase = 0;
        }
        this.logger.log(`Phase determined: [ ${this.phase} ]`)
    }

    /**
     * Expands our swarm of hacknet nodes by buying a new one
     */
    expandNodeSwarm(): ISimpleJSONReturn{
        try{
            const nodeId = this.purchaseNode();
            const node = new ExtendedHacknetServer(this.ns, 'hacknet-node-' + nodeId);
            this.servers.push(node);
            return {
                success: true,
                message: `Successfully expanded nodeswarm with "hacknet-node-${nodeId}.`,
                value: node
            };
        }catch(e){
            return this.eh.handle(e, 'EXPAND-NODE-SWARM');
        }
    }

    /**
     * Find the optimal Hacknetnode to upgrade given the type of upgrade we want to perform
     * @param {string} type of upgrade we want to perform
     * @returns {ExtendedHacknetServer} optimal node to upgrade
     */
    nodeToUpgrade(type: string): ExtendedHacknetServer{
        this.logger.log(`Calculating optimal node to upgrade with regard to ${type}`)
        this.servers.sort((a, b) => {
            if(type === 'level'){
                return a.getLevelUpgradeCost(this.lvlAmount) - b.getLevelUpgradeCost(this.lvlAmount);
            }else if(type === 'ram'){
                return a.getRamUpgradeCost(this.ramAmount) - b.getRamUpgradeCost(this.ramAmount);
            }else if(type === 'core') {
                return a.getCoreUpgradeCost(this.cpuAmount) - b.getCoreUpgradeCost(this.cpuAmount);
            }else {
                // typescript needs a default path (for type matching), so we just put in the last one
                return a.getCoreUpgradeCost(this.cpuAmount) - b.getCoreUpgradeCost(this.cpuAmount);
            }
        });

        return this.servers[0];
    }

    /**
     * Check if all nodes are upgraded given which part we want to check
     * @param {string} option which checks we want to perform ['all', 'level', 'ram', 'core']
     * @returns {bool}
     */
    allNodesUpgraded(option = 'all'): boolean{
        for(let index = 0; index < this.servers.length; index++){

            // walk through all nodes
            const node = this.servers[index];
            if(option === 'all' && (!node.isMaxed())){
                // check if either ram, cores or level are not fully upgraded
                return false;
            }else if (option === 'level' && !node.isMaxed('level')){
                // Just level
                return false;
            }else if (option === 'ram' && !node.isMaxed('ram')){
                // Just ram
                return false;
            }else if (option === 'core' && !node.isMaxed('core')){
                // Just cores
                return false;
            }
        }
        return true;
    }

    /**
     * Calculate how far we are in expanding our Hacknet network, influences the optimal actions chosen to perform
     */
    calculateLoopCounter():void {
        const serverAmount = this.servers.length;
        if(serverAmount > 12) {
            this.loopCounter = Math.round((this.servers.length / 12) + 0.5);
        }else {
            this.loopCounter = 1;
        }
    }

    /** Some wrappers for hacknet functions */
    getHashUpgradeLevel(upgName: string): number{
        return this.ns.hacknet.getHashUpgradeLevel(upgName);
    }
    getHashUpgrades(): string[] {
        return this.ns.hacknet.getHashUpgrades();
    }
    getPurchaseNodeCost(): number {
        return this.ns.hacknet.getPurchaseNodeCost();
    }
    getStudyMult(): number {
        return this.ns.hacknet.getStudyMult();
    }
    getTrainingMult(): number {
        return this.ns.hacknet.getTrainingMult();
    }
    hashCapacity(): number {
        return this.ns.hacknet.hashCapacity();
    }
    hashCost(upgName: string): number {
        return this.ns.hacknet.hashCost(upgName);
    }
    maxNumNodes(): number {
        return this.ns.hacknet.maxNumNodes();
    }
    numHashes(): number {
        return this.ns.hacknet.numHashes();
    }
    numNodes(): number {
        return this.ns.hacknet.numNodes();
    }
    purchaseNode(): number {
        return this.ns.hacknet.purchaseNode();
    }
    spendHashes(upgName: string, upgTarget: string): boolean {
        return this.ns.hacknet.spendHashes(upgName, upgTarget);
    }
}