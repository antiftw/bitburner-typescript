/** @param {NS} ns **/


import { ExtendedBotnetServer } from 'object/server/ExtendedBotnetServer';
import ExtendedPublicServer from 'object/server/ExtendedPublicServer';
import Configurator from 'service/core/Configurator';
import { FileManager } from 'service/core/FileManager';
import { ExceptionHandler } from 'service/diagnostics/ExceptionHandler';
import Logger from 'service/diagnostics/Logger';
import { cracks } from 'data/cracks.js';
import { ICrack, IScript, IServer, ISimpleJSONReturn } from 'types';
import { ProcessInfo } from '/../NetscriptDefinitions';

/**
 * Used to infect servers, forcing rootAccess so we can enslave them
 */
export class Infector {
    ns: NS;
    verbose: number;
    context: string;
    logger: Logger;
    eh: ExceptionHandler;
    cfg: Configurator;
    file: FileManager;

    cracks: Array<ICrack>;
    files: Array<IScript>

    reservedMemory: number;
    public: Array<ExtendedPublicServer>;
    botnet: Array<ExtendedBotnetServer>;
    path: string;

    minSecurityThreshold: number;
    minMoneyRatio: number;
    minRamRatio: number;
    constructor(ns: NS, verbose = 0){
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'INFECT'
        this.logger = new Logger(ns, verbose, this.context);
        this.eh     = new ExceptionHandler(ns, this.context);
        this.cfg     = new Configurator(ns, verbose);
        this.file   = new FileManager(ns, verbose);

        this.cracks = cracks;
        this.files = [];
        this.reservedMemory = 16;
        this.public = [];
        this.botnet = [];
        this.path = '';
        // used to filter out rounding errors while nearing the maximum/minimum values
        this.minSecurityThreshold = 0.01;
        this.minMoneyRatio = 1.002;
        this.minRamRatio = 0.99;
    }

    async init(force = false): Promise<ISimpleJSONReturn> {

        try{ 
            this.cfg.readConfig('main');
            this.files = [ 
                {   
                    file: this.cfg.getConfiguration("scripts.weaken.file", "hacking").getStringValue(),
                    ram: this.cfg.getConfiguration("scripts.weaken.ram", "hacking").getNumberValue(),
                    name: this.cfg.getConfiguration("scripts.weaken.name", "hacking").getStringValue()
                },
                {   
                    file: this.cfg.getConfiguration("scripts.grow.file", "hacking").getStringValue(),
                    ram: this.cfg.getConfiguration("scripts.grow.ram", "hacking").getNumberValue(),
                    name: this.cfg.getConfiguration("scripts.grow.name", "hacking").getStringValue()
                },
                {   
                    file: this.cfg.getConfiguration("scripts.hack.file", "hacking").getStringValue(),
                    ram: this.cfg.getConfiguration("scripts.hack.ram", "hacking").getNumberValue(),
                    name: this.cfg.getConfiguration("scripts.hack.name", "hacking").getStringValue()
                }
            ];
            this.path =  this.cfg.getConfiguration("path", "hacking").getStringValue();
            await this.loadServers(force);
            return {
                success: true,
                message: `Successfully initialized Infector`
            }
        }catch(e) {
            return this.eh.handle(e, 'INIT')
        }
    }

    async loadServers(force = false): Promise<void> {
        this.logger.log('Loading servers');
        const botnetData = this.file.readJson(this.cfg.getConfiguration('structure_file', 'botnet').getStringValue());
        const publicData = this.file.readJson(this.cfg.getConfiguration('structure_file', 'public').getStringValue()).filter((
                srv: { rootAccess: boolean; }) => srv.rootAccess === true
            );
        
        for(let index = 0; index < botnetData.length; index++) {
            const bot = botnetData[index];
            const server = new ExtendedBotnetServer(this.ns, bot.name);
            server.actualize();
            this.botnet.push(server);
            // make sure all files are present
            await this.prepareFiles(server, force);
        }
        this.logger.log('Botnet loaded');
        for(let index = 0; index < publicData.length; index++) {
            const pub = publicData[index];
            const server = new ExtendedPublicServer(this.ns, pub.name, pub.source);
            server.actualize();
            this.public.push(server);
            await this.prepareFiles(server, force);
        }
        this.logger.log('Public net loaded');
        this.logger.log(`Servers loaded: [ ${this.botnet.length} ] bots and [ ${this.public.length} ] public`)
    }
    /**
     * Infect a server
     * @param {*} server to infect
     * @returns {obj} = {success, messaage}
     */
    async infect(server: ExtendedPublicServer): Promise<ISimpleJSONReturn>{
        const context = 'INFECT'
        const exclude = ['home', 'darkweb'];
        if(exclude.includes(server.name)){
                return {
                    success: false,
                    message: `Serer ${server.name} is on the exclude list, skipping.`
                };
        }
        this.logger.log("Initializing Infectation of server " + server.name);
        const portsRequired = server.portsRequired;
        this.logger.log("Ports required: " + portsRequired);

        if(!server.rootAccess) {
            let portsCracked = 0;
            for(let index = 0; index < portsRequired; index++) {
                try{
                    await this.crack(this.cracks[index], server);
                    portsCracked++;
                }catch(e) {
                    return this.eh.handle(e, 'INFECT')
                }
            }
            if(portsRequired === portsCracked) {
                try{
                    this.logger.log("NUKING!");
                    server.nuke();
                    return {
                        success: true,
                        message: `Successfully infected server ${server.name}`
                    }
                }catch(e){
                    return this.eh.handle(e, context);
                }
            }
        }
        return {
            success: false,
            message: `No root access on server, aborting.`
        }
    }

    executeScript(script: IScript, threads: number, target: ExtendedPublicServer, delay = 0): ISimpleJSONReturn {
        this.logger.log(`Trying to find attackers to execute '${script.name}' with ${Math.round(threads)} threads => [ ${target.name} ] with delay ${delay}.`)
        const ram = this.calculateTotalProcessingPower();
        const freeRam = ram.total - ram.used;
        let remainingThreads = 0;
        this.logger.log(`Checking if we have sufficient processing power to run all threads: ${(freeRam > threads * script.ram)}`)
        if(freeRam < threads * script.ram) {
            // we cannot run the amount of threads at once, so we just run it multiple times
            // calculate the threads that we can process using the current setup
            const availableThreads = freeRam / script.ram;
            // save the remaining threads, so we can signal we're not done
            remainingThreads = threads - availableThreads;
            // and alter the amount of threads for the rest of the code
            threads = availableThreads;
            this.logger.log(`Unable to run all (${threads}) threads, running ${availableThreads} threads instead`)
        }
        const attackers = this.getAttackers();
        let threadsLeft = threads;
        let success = true;
        const errors = [];
        for(let index = 0; index < attackers.length; index++) {
            if(threadsLeft < 1) {
                // all work done
                break;
            }
            const attacker = attackers[index];
            this.logger.log(`Considering ${attacker.name}`)
            const result = this.assignAttacker(attacker, script, threadsLeft, target, delay);
            this.logger.log(`assignAttacker, success: ${result.success}, mssg: ${result.message}`);
            threadsLeft = result.value;
            success = success && result.success;
            if(!result.success) {
                errors.push(result.message);
            }
            this.logger.log(`Attacker assigned: ${attacker.name} => ${target.name} success: ${success}, remaining threads: ${threadsLeft.toFixed(2)}`)
            this.logger.line(100, false, '.')
        }
        const result = {
            success: success,
            message: success
                ? `Successfully executed ${script.file} ( ${threads - remainingThreads} / ${threads} threads ) => ${target.name}`
                : `Error(s) occurred while trying to execute ${script.file} ( ${threads} threads ) => ${target.name}: ${JSON.stringify(errors )}`,
            value: remainingThreads
        };
        return result;
    }

    getAttackers(): Array<ExtendedBotnetServer | ExtendedPublicServer>{
        const attackers = [];
        
        for(let index = 0; index < this.botnet.length; index++) {
            const srv = this.botnet[index];
            if(this.isPotentialAttacker(srv)) {
                attackers.push(srv)
            }
        }
        for(let index = 0; index < this.public.length; index++) {
            const srv = this.public[index];
            if(this.isPotentialAttacker(srv)) {
                attackers.push(srv)
            }
        }
        this.logger.log(`Attackers found: ${attackers.length}`)
        return attackers;
    }

    isPotentialAttacker(server: IServer): boolean {
        if((server.usedRam / server.maxRam) > this.minRamRatio || !server.rootAccess ) {
            return false;
        }
        return true;
    }

    assignAttacker(server: ExtendedPublicServer | ExtendedBotnetServer, script: IScript, threads: number, target: ExtendedPublicServer, delay: number): ISimpleJSONReturn{
        server.actualize();
        const ramRequired = script.ram * threads;
        const freeRam = server.maxRam - server.usedRam;
        let remainingThreads = 0;
        let success = false;
        // if we are trying to assign the home server, we need to keep some memory free
        if(ramRequired > freeRam - (server.name === 'home' ? this.reservedMemory: 0)) {
            // not enough free RAM to run all threads on this server
            const availableThreads = freeRam / script.ram;
            remainingThreads = threads - availableThreads;
            this.logger.log(`Not enough RAM available (required: ${ramRequired} / free: ${freeRam}) on ${server.name}, only able to run ${availableThreads} / ${threads}.`)
            if(availableThreads >= 1) {
                this.logger.log(`Executing the ${availableThreads} available threads...`)
                const result = this.ns.exec(`${this.path}${script.file}`, server.name, availableThreads, target.name, delay);
                success = result > 0;
            }else{
                this.logger.log(`Nothing to do, skipping`)
                return {
                    success: false,
                    value: threads,
                    message: `Not enough RAM to run even one thread (only room for ${availableThreads.toFixed(4)}) => remaining: ${remainingThreads}`
                }
            }
        }else{
            // enough free RAM to run all threads
            const result = this.ns.exec(`${this.path}${script.file}`, server.name, threads, target.name, delay);
            remainingThreads = 0;
            success = result > 0;
            this.logger.log(`Able to run all ${threads} threads on ${server.name}.`)
        }
        this.logger.log(`Executed '${script.file}' (${threads} threads), result: ${Number(success) > 0 ? 'success' : 'failure'}`)
        const extraMessage = remainingThreads > 0 ? `However, there are still ${remainingThreads} left to be assigned.` : '';
        return {
            success: success,
            message: success
            ? `Successfully assigned attacker ${server.name} => ${target.name} to execute ${script.file} with ${threads - remainingThreads}/${threads} threads. ${extraMessage}`
            : `Error while assigning attacker ${server.name} => ${target.name} to execute ${script.file}`,
            value: remainingThreads
        };
    }

    calculateTotalProcessingPower():{ total: number, used: number; } {
        let usedRam = 0
        let totalRam = 0;
        this.logger.log(`Calculating processing power`)
        for(let index = 0; index < this.public.length; index++) {
            const server = this.public[index];
            server.actualize();
            // we cannot use all the RAM of the home, for running all apps we need some reserved memory
            totalRam += server.name !== 'home' ? server.maxRam : server.maxRam - this.reservedMemory;
            usedRam += server.usedRam;
        }
        for(let index = 0; index < this.botnet.length; index++) {
            const server = this.botnet[index];
            server.actualize();
            totalRam += server.maxRam;
            usedRam += server.usedRam;
        }
        this.logger.log(`Calculated: ${usedRam}/${totalRam} GB`)
        return {
            total: totalRam,
            used: usedRam
        };
    }

    /**
     * Check if a server is already getting targetted by another server, in any way (very crude check)
     * @param server to be checked
     */
    checkIfServerIsGettingTargetted(server: ExtendedPublicServer) : boolean {
        // check all bots
        this.logger.log(`Checking ${this.botnet.length} bots`);
        for(let index = 0; index < this.botnet.length; index++) {
            const srv = this.botnet[index];
            const files = this.ps(srv.name);
            for(let counter = 0; counter < files.length; counter++){
                const file = files[counter];
                if(file.args[0] === server.name) {
                    this.logger.log(`checking (target) ${file.args[0]} === (server) ${server.name} => ${file.args[0] === server.name}`);
                    return true;
                }
            }
        }
        this.logger.log(`Checking ${this.public.length} public servers`);
        // check all public servers
        for(let index = 0; index < this.public.length; index++) {
            const srv = this.public[index];
            const files = this.ps(srv.name);
            for(let counter = 0; counter < files.length; counter++){
                const file = files[counter];
                if(file.args[0] === server.name) {
                    this.logger.log(`checking ${file.args[0]} === ${server.name}`);
                    return true;
                }
            }
        }
        return false;
    }
    targetNeedsPreparation(target: ExtendedPublicServer): boolean{
        const targetNeedsMoney = target.maxMoney / target.money > this.minMoneyRatio;
        const targetNeedsSecurityDecrease = target.security - target.minSecurity > this.minSecurityThreshold;
        return (targetNeedsMoney || targetNeedsSecurityDecrease);
    }

    /**
     * Check if a server has the scripts required to weaken, grow and hack
     * @param {Server} server to check
     * @returns {bool}
     */
     checkIfServerHasRequiredScripts(server: ExtendedPublicServer | ExtendedBotnetServer) : boolean{
        for(let index = 0; index < this.files.length; index++) {
            const script = this.files[index];
            const toCheck = `${this.path}${script.file}`;
            if(!this.file.fileExists(toCheck, server.name)){
                return false;
            }
        }
        return true;
    }

    removeAllFiles(server: string, force = false): ISimpleJSONReturn {
        // prevent accidents :P
        if(server === 'home' && !force) {
            return {
                success: false,
                message: 'Use force to delete all files on the home server'
            };
        }
        const files = this.ns.ls(server);
        let deleted = 0;

        for(let index = 0; index < files.length; index++) {
            const file = files[index];
            const result = this.ns.rm(file, server);
            if(result){
                deleted++;
            }
        }
        return {
            success: true,
            message: `Successfully deleted ${deleted} / ${files.length} files`
        }
    }

    /**
     * Find possible targets
     * @param {array} server array of servers to look in
     * @param {float} minMoney the minimum amount of money a potential target should have
     * @returns {array} Servers that should/could be attacked
     */
    getPossibleTargets(minMoney = 0): Array<ExtendedPublicServer> {
        return this.public
            // Filter out servers that aren't valid targets
            .filter(
                srv =>  srv.rootAccess
                         && srv.name !== 'home'
                         && srv.requiredHackingLevel <= this.ns.getHackingLevel()
                         && srv.maxMoney > minMoney
                    )
            // sort on the maximum amount of favorability (ratio maxMoney/minSecurity)
            .sort((a,b) => b.favorability - a.favorability)
    }

    /**
    * Find the optimal target to batch
    * @returns server to attack
    */
   getOptimalTarget(index = 0): ExtendedPublicServer {
       return this.getPossibleTargets()[index];
   }

    /**
     * Prepare a server so that it has all the correct files present
     * @param {Server} server server to prepare
     * @param {bool} force whether we want to force copy, regardless if the files are already present
     */
     async prepareFiles(server: ExtendedPublicServer | ExtendedBotnetServer, force = false): Promise<void> {

        if(force) {
            this.removeAllFiles(server.name);
        }
        if(!this.checkIfServerHasRequiredScripts(server) || force) {
            for(let index = 0; index < this.files.length; index++) {
                const result = await this.ns.scp(this.path + this.files[index].file, server.name);
                this.logger.log(`SCP ${this.files[index].file} to ${server.name} => result: ${result}`)
                // Add the logger so we can use the currentTime functionality in the w/g/h.js scripts
            }
            const result = await this.ns.scp('/src/tools/Logger.js', server.name);
            this.logger.log(`SCP '/src/tools/Logger.js' to ${server.name} => result: ${result}`)
        }
    }

    /**
     * Execute a certain script on a specified server - does so for max ram available
     * @param {string} script /path/filename of the script to execute
     * @param {string} server name of the server to execute the script on
     * @param {array} param parameters
     * @returns
     */
    executeScriptOld(script: string, server: ExtendedPublicServer, param: string | number | boolean): ISimpleJSONReturn {
        const serverRam = server.maxRam;
        const scriptRam = this.ns.getScriptRam(script, server.name);
        this.logger.log(`Executing file [ ${script} ] ( ${scriptRam} GB ) on server [ ${server.name} ] with [ ${serverRam} GB ] `)
        const threads = (serverRam / scriptRam) | 0 ; // | 0 => bitwise or to round down
        if(serverRam === 0 || threads === 0) {
            return {
                success: false,
                message: 'Infectation of server failed => insufficient processingpower available'
            }
        }
        this.logger.log('ScriptRam: ' + scriptRam + ' / ServerRam: ' + serverRam);
        this.logger.log("Executing script: ( " + script + " ) with " + threads + " threads.")
        const result = this.ns.exec(script, server.name, threads, param)
        return {
            success: result > 0,
            message: `Infectation of server [ ${server.name} ] ==> [ ${param }] is complete. Result: ${result > 0 ? true : false}`
        }
    }
    
    terminateExecution(): void {
        this.botnet.forEach(bot => {
            this.killScriptsOnHost(bot.name);
        })
        this.public.forEach(pub => {
            this.killScriptsOnHost(pub.name);
        })
    }
    killScriptsOnHost(host: string): boolean {
        return this.ns.killall(host);
    }
    /**
     * Get all running scripts on server
     * @param {string} host name of server
     * @returns {array} list of scripts + arguments
     */
    ps(host: string): ProcessInfo[] {
        return this.ns.ps(host)
    }


    /**
     * Crack a server using one of the available tools
     * @param {obj} crack crack to run
     * @param {obj} server server to run crack on
     */
    crack(crack: ICrack, server: ExtendedPublicServer): ISimpleJSONReturn {
        if(this.ns.fileExists(crack.name)) {
            switch (crack.name) {
                case 'BruteSSH.exe':
                    server.bruteSsh();
                    break;
                case 'FTPCrack.exe':
                    server.ftpCrack();
                    break;
                case 'relaySMTP.exe':
                    server.relaySmtp();
                    break;
                case 'HTTPWorm.exe':
                    server.httpWorm();
                    break;
                case 'SQLInject.exe':
                    server.sqlInject();
                    break;
                default:
                    break;
            }
            this.logger.log(crack.text);
            return {
                success: true,
                message: crack.text
            }
        }else{ 
            return {
                success: false,
                message: `Error when trying to execute ${crack.name} on ${server.name}: File does not exist.`
            }
        }
    }
}