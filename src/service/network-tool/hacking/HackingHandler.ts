import { Infector } from "./Infector";
import { ExtendedBotnetServer } from "/object/server/ExtendedBotnetServer";
import ExtendedPublicServer from "/object/server/ExtendedPublicServer";
import Configurator from "/service/core/Configurator";
import { FileManager } from "/service/core/FileManager";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import Logger from "/service/diagnostics/Logger";
import { HackingFormulaHandler } from "/service/formulas/HackingFormulaHandler";
import { IScript, ISimpleJSONReturn } from "/types";

/**
 * Handles the enslaving of servers, instructing them to weaken, grow or hack
 */
export class HackingHandler {
    ns: NS;
    verbose: number;
    context: string;
   
    cfg: Configurator;
    eh: ExceptionHandler;
    logger: Logger;
    file: FileManager;
    infector: Infector;
    hfh: HackingFormulaHandler;

    files: Array<IScript>;
    path: string;
    minMoney: number;

    public: Array<ExtendedPublicServer>;
    botnet: Array<ExtendedBotnetServer>;
    targets:  Array<ExtendedPublicServer>;

    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'HCKING'

        this.cfg = new Configurator(ns, verbose);
        this.eh = new ExceptionHandler(ns, this.context)
        this.logger = new Logger(ns, verbose, this.context);
        this.file = new FileManager(ns, verbose);
        this.infector = new Infector(ns, verbose);
        this.hfh = new HackingFormulaHandler(ns, verbose);

        this.targets = [];
        this.public = [];
        this.botnet = [];
        this.files = [];
        this.path = '';
        this.minMoney = 0;

    }
    async init(force = false): Promise<void> {

        this.loadServers();
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
        this.minMoney = this.determineMinMoney();
        await this.infector.init(force);
    }

    loadServers(): void {
        const botnetData = this.file.readJson((this.cfg.getConfiguration('structure_file', 'botnet').getStringValue()));
        const publicData = this.file.readJson((this.cfg.getConfiguration('structure_file', 'public').getStringValue()));
        for(let index = 0; index < botnetData.length; index++) {
            const bot = botnetData[index];
            const server = new ExtendedBotnetServer(this.ns, bot.name);
            server.actualize();
            this.botnet.push(server);
            // make sure all files are present
        }
        this.logger.log('Botnet loaded');
        for(let index = 0; index < publicData.length; index++) {
            const pub = publicData[index];
            const server = new ExtendedPublicServer(this.ns, pub.name, pub.source);
            server.actualize();
            this.public.push(server);
        }
    }

    async execute(force: boolean): Promise<ISimpleJSONReturn> {
       try{
            await this.init(force);
            const targets = this.infector.getPossibleTargets(this.minMoney);
            this.logger.log(`Targets found: ${targets.length}`)
            const errors = [];
            for(let index = 0; index < targets.length; index++) {
                const target = targets[index];
                const serverIsGettingTargetted = this.infector.checkIfServerIsGettingTargetted(target);
                let result = {success: false, message: ''};
                this.logger.log(`Server ${target.name} being targetted: [ ${serverIsGettingTargetted} ]`);
                if(!serverIsGettingTargetted && this.infector.targetNeedsPreparation(target)) {
                    this.logger.log(`Server ${target.name} needs preparation.`)
                    // not ready to hack, needs either money or security decrease
                    result = this.prepareServer(target);
                }else if(!serverIsGettingTargetted) {
                    // ready to hack
                    this.logger.log(`Server ${target.name} ready to hack.`)
                    result = this.hackServer(target);
                }else{
                    this.logger.notify(`Server is already being hacked (or prepared to be hacked)`);
                    result = {
                        success: true,
                        message: `Nothing to do.`
                    }
                }
                if(!result.success) {
                    errors.push(result.message);
                }
                await this.ns.asleep(10);
                break;
            }
            if(errors.length > 0){
                return {
                    success: false,
                    message: `Errors (${errors.length}): ${JSON.stringify(errors)}`
                }
            }else {
                return {
                    success: true,
                    message: `result.message`
                }
            }
            
       }catch(e) {
           return this.eh.handle(e, 'EXECUTE_2')
       }
    }

    prepareServer(server: ExtendedPublicServer): ISimpleJSONReturn {
        const weakenThreads = this.hfh.getThreadsToMinSecurityLevel(server);
        const growThreads = this.hfh.getThreadsToMaxMoney(server);
        const weakenScript = this.files.find(script => script.name === 'weaken');
        const growScript = this.files.find(script => script.name === 'grow');
        if(weakenScript === undefined || growScript === undefined) {
            return {success: false, message: 'Error locating weaken or growscript'}
        }
        const weakenResult = this.infector.executeScript(weakenScript, weakenThreads, server);
        const growResult = this.infector.executeScript(growScript, growThreads, server);
        const success = weakenResult.success && growResult.success;
        return {
            success: success,
            message: success
            ? `Successfully preparing server [ ${server.name} ] with ${weakenThreads} weaken-threads & ${growThreads} grow-threads.`
            : `Error while trying to prepare [ ${server.name} ]. [ weaken-result: ${weakenResult.message}] [ grow-result: ${growResult.message} ]`
        }
    }

    hackServer(server: ExtendedPublicServer): ISimpleJSONReturn {
        const weakenScript = this.files.find(script => script.name === 'weaken');
        const growScript = this.files.find(script => script.name === 'grow');
        const hackScript = this.files.find(script => script.name === 'hack');
        if(weakenScript === undefined || growScript === undefined || hackScript === undefined) {
            return {success: false, message: 'Error locating weaken, growscript or hackscript.'}
        }
        const moneyToHack = server.maxMoney * 0.2;
        const growThreads = this.hfh.getThreadsPerGrowthAmount(server, moneyToHack);
        const hackThreads = this.hfh.hackAnalyzeThreads(server.name, server.maxMoney);
        const securityIncreaseByGrowing = this.hfh.growthAnalyzeSecurity(growThreads);
        const securityIncreaseByHacking = this.hfh.hackAnalyzeSecurity(hackThreads);
        const weakenThreads = this.hfh.getThreadsPerSecurityLevels(securityIncreaseByGrowing + securityIncreaseByHacking, 1)

        const weakenResult = this.infector.executeScript(weakenScript, weakenThreads, server);
        const growResult = this.infector.executeScript(growScript, growThreads, server);
        const hackResult = this.infector.executeScript(hackScript, hackThreads, server);
        const success = weakenResult.success && growResult.success && hackResult.success;
        return {
            success: success,
            message: success
            ? `Successfully hacking server [ ${server.name} ] with ${weakenThreads}, ${growThreads} and ${hackThreads} (weaken-, grow-, and hack-threads) to steal ${this.logger.formatPrice(moneyToHack)}`
            : `Error while trying to hack server ${server.name}: [ ${weakenResult.message} ], [ ${growResult.message} ], [ ${hackResult.message} ], []`
        }

    }
    determineMinMoney(): number {
        let maxMoney = 0;
        this.public.filter(
            // filter out servers we cannot hack yet
            pub =>  pub.rootAccess
                    && pub.name !== 'home'
                    && pub.requiredHackingLevel <= this.ns.getHackingLevel()
        )
        .forEach(pub => {
            // get the highest amount of money available
            maxMoney = pub.maxMoney > maxMoney ? pub.maxMoney : maxMoney;
        });
        if(maxMoney > 1000000000) {
            return 1000000000;
        }else if(maxMoney > 1000000) {
            return 1000000;
        }
        return 0;
    }
    
}