import { Infector } from "/service/network-tool/hacking/Infector";
import Configurator from "/service/core/Configurator";
import { FileManager } from "/service/core/FileManager";
import { ExceptionHandler } from "/service/diagnostics/ExceptionHandler";
import Logger from "/service/diagnostics/Logger";
import { HackingFormulaHandler } from "/service/formulas/HackingFormulaHandler";
import { IBatchVariables, IScript, ISimpleJSONReturn } from "/types";
import ExtendedPublicServer from "/object/server/ExtendedPublicServer";
import PublicServer from "/object/server/PublicServer";

/**
 * Handles the (pre)batching of servers, instructing them to weaken, grow or hack
 * using: https://github.com/danielyxie/bitburner/blob/dev/markdown/bitburner.hackingformulas.md
 * and https://bitburner.readthedocs.io/en/latest/advancedgameplay/hackingalgorithms.html
 */
export class BatchHandler {
    ns: NS;
    verbose: number;
    context: string;
    configuration: number;
    cfg: Configurator;
    eh: ExceptionHandler;
    logger: Logger;
    file: FileManager;
    hfh: HackingFormulaHandler;
    infector: Infector;
    moneyToHack: number;
    files: Array<IScript>
    path: string;
    interval: number;
    
    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'BATCHR';
        // used to choose from configurations in the ConfigurationHandler
        this.configuration = 0;
        this.cfg = new Configurator(ns, verbose);

        this.eh = new ExceptionHandler(ns, this.context)
        this.logger = new Logger(ns, verbose, this.context);
        this.file = new FileManager(ns, verbose);
        this.infector = new Infector(ns, verbose, this.configuration);
        this.hfh = new HackingFormulaHandler(ns, verbose);
        this.moneyToHack = 0;
        this.files = [];
        this.path = '';
        // interval after which two subsequent scripts finish. @todo: optimize
        this.interval = 100;
    }

    async execute(force = false): Promise<ISimpleJSONReturn> {
        try {
            await this.init(force);
            
            const target = this.infector.getOptimalTarget();
            this.logger.log(`Optimal target: [ ${target.name} ]`)
            const serverIsGettingTargetted = this.infector.checkIfServerIsGettingTargetted(target);
            if(!serverIsGettingTargetted && this.infector.targetNeedsPreparation(target)) {
                // server stats not within boundaries and not yet being targetted => prepare for batching
                const result = this.prebatch(target);
                this.logger.notify(result.message);
                return result;
            }else if(!serverIsGettingTargetted) {
                // server stats within boundaries and not yet being targetted => batch
                const result = await this.batch(target);
                this.logger.notify(result.message);
                return result;
            }else{
                const msg = `Nothing to do, [ ${target.name} ] already ${this.infector.targetNeedsPreparation(target) ? 'pre-' : '' }batching.`;
                this.logger.notify(msg)
                return {
                    success: true,
                    message: msg
                }
            }
            
        }catch(e) {
            return this.eh.handle(e, 'EXECUTE')
        }
    }

    async batch(target: ExtendedPublicServer): Promise<ISimpleJSONReturn> {
        try {
            const batchVariables = this.determineBatchVariables(target); // {amount: 3, delay: this.interval * 4 };//
            const errors = [];
            let success = true;
            let batched = 0;
      
            for(let batch = 0; batch < batchVariables.batches; batch++) {
                // and start kicking off the batches
                const result = this.batchServer(target, batch, batchVariables);
                success = success && result.success;
                if(!result.success) {
                    errors.push(batch)
                }else{
                    batched++
                }

                this.logger.line(100);
                this.logger.log(`Batch ${batch} batched: ${result.message}`)
                this.logger.line(100);
                await this.ns.asleep(10);
            }
            return {
                success: success,
                message: success
                    ? `Successfully batched ${target.name}, ${batched} batches have been initiated.`
                    : `Errors occurred while trying to batch ${target.name}. Batches with errors: [ ${errors.join(' , ' )} ] `
            }

        }catch(e) {
            return this.eh.handle(e, 'BATCH')
        }
    }

    prebatch(target: ExtendedPublicServer): ISimpleJSONReturn {
        try{
            this.logger.log(`Prebatching [ ${target.name} ] `)
            const srv = this.ns.getServer(target.name);
            // this is not correct, since it is the amount of cores on the target and not on the attacker,
            // but its weird, since we would get a circular dependency:
            // i.e. we need to know how much processingpower we need before we can find the attacker, and as such cannot lookup the cores
            // However, for now its np, since this code is only used in prebatching, and the exact timing does not matter
            const cores = srv.cpuCores;
            // see how much we already need to decrease security
            const currentRequiredSecurity = target.security - target.minSecurity;
            // see how much we need grow the money
            const requiredGrowThreads = this.hfh.getThreadsToMaxMoney(target);
            // and what effect it has on the security
            const securityIncrease = this.hfh.growthAnalyzeSecurity(requiredGrowThreads);
            // add both to get the total required security increase
            const totalSecurity = currentRequiredSecurity + securityIncrease;
            // calculate the amount of threads required to attain that increase
            const requiredWeakenThreads = this.hfh.getThreadsPerSecurityLevels(totalSecurity, cores);

            this.logger.log(`Required security rating: ${currentRequiredSecurity} + ${securityIncrease} = ${totalSecurity}`)
            this.logger.log(`Required weakening: ${requiredWeakenThreads}, required growing: ${requiredGrowThreads}`)

            let growResult, weakenResult ;
            growResult = weakenResult = {
                success: false,
                message: ''
            };
            if(requiredGrowThreads > 0) {
                // grow server if required
                const growScript = this.files.find(script => script.name === 'grow');
                if(growScript !== undefined) {
                    growResult = this.infector.executeScript(growScript, requiredGrowThreads, target);
                }
                
            }else {
                growResult = {
                    success: true,
                    message: `No growing required`
                }
            }
            if(requiredWeakenThreads > 0) {
                // weaken server if required
                const weakenScript = this.files.find(script => script.name === 'weaken');
                if(weakenScript !== undefined) {
                    weakenResult = this.infector.executeScript(weakenScript, requiredWeakenThreads, target);
                }
            }else {
                weakenResult = {
                    success: true,
                    message: `No weakening required`
                }
            }
            return {
                success: growResult.success && weakenResult.success,
                message: growResult.success && weakenResult.success
                         ? `Preparing server ${target.name} for batching, using ${requiredGrowThreads} growthreads & ${requiredWeakenThreads} weakenthreads`
                         : `Error while trying to prepare ${target.name} for batching: \n\n growresult: ${growResult.message} \n\n weakenresult: ${weakenResult.message}`
            }
        }catch(e) {
            return this.eh.handle(e, 'PREBATCH');
        }
    }

    async init(force = false): Promise<void> {
        this.logger.log('Initializing BatchHandler');

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
+
        await this.infector.init(force);

    } 
    batchServer(target: ExtendedPublicServer, batchId: number, args: IBatchVariables): ISimpleJSONReturn {
        const delayBetweenBatches = args.delay;
        this.logger.log(`Batching server [ ${target.name} ]`)
        const server = this.ns.getServer(target.name);
        const weakenTime = this.hfh.getWeakenTime(server);
        const hackTime   = this.hfh.getHackTime(server);
        const growTime   = this.hfh.getGrowTime(server);
        const delays = this.calculateDelays(weakenTime, growTime, hackTime, delayBetweenBatches * batchId);
        const growScript = this.files.find(script => script.name === 'grow');
        const hackScript = this.files.find(script => script.name === 'hack');
        const weakenScript = this.files.find(script => script.name === 'weaken');
        if(weakenScript === undefined || hackScript === undefined || growScript === undefined) {
            return  {
                success: false,
                message: `Something went wrong. Was unable to locate the wgh scripts`
            };
        }
        const weakenDelay = batchId * delayBetweenBatches;
        const money = this.findOptimumMoney(target, 1, args.batches);
        this.logger.log(`Analysis results in amount: ${this.logger.formatPrice(money, false)}`)
        // see what the impact of the hack would be
        const threadsForHacking = this.hfh.hackAnalyzeThreads(target.name, money);
        const securityIncreaseByHacking = this.hfh.hackAnalyzeSecurity(threadsForHacking);
        this.logger.log(`Calculated threads to hack [ ${money.toFixed(2)} ] bitcoins => ${threadsForHacking} / securityIncrease: ${securityIncreaseByHacking}`);

        // to compensate the security increase, we need to weaken the server again
        const threadsForWeakening = this.hfh.getThreadsPerSecurityLevels(securityIncreaseByHacking);
        this.logger.log(`threadsForWeakening: ${threadsForWeakening}`);

        // and also grow it again to compensate the reduction in money
        const threadsForGrowing = this.hfh.getThreadsPerGrowthAmount(target, money);

        // growthAnalyzeSecurity(threads) => security increase from grow
        const securityIncreaseByGrowing = this.hfh.growthAnalyzeSecurity(threadsForGrowing);
        this.logger.log(`threadsForGrowing: ${threadsForGrowing} securityIncreaseByGrowing: ${securityIncreaseByGrowing}`);
        // which in turn requires more weakening
        const threadsForWeakening2 = this.hfh.getThreadsPerSecurityLevels(securityIncreaseByGrowing);
        this.logger.log(`threadsForWeakening2: ${threadsForWeakening2}`);
       
        // perform the weakening to compensate the hack
        // which we start first, since it takes longest, and needs to start right away, w/o delay
        let result = this.infector.executeScript(weakenScript, threadsForWeakening, target, weakenDelay);
        this.logger.log(`exec result: ${JSON.stringify(result)}`)
        let success = 0;
        success += result.success ? 1 : 0;
        if(success === 0) {
            this.logger.log(`An error occurred when trying to execute ${weakenScript.file} ( ${threadsForWeakening} threads ) => ${target.name} with delay [ ${weakenDelay} ] .`)
        }
        this.logger.log(`Result/Success after first weaken: ${result.success ? 1 : 0} / ${success}` )
        this.logger.log(`delays: ${JSON.stringify(delays)}`)
        this.logger.log(`Executing batch to attack ${target.name} `)
        this.logger.log(`Weakening: ${this.path}${weakenScript.file} 1: ${threadsForWeakening}, 2: ${threadsForWeakening2} threads`)
        this.logger.log(`Growing: ${this.path}${growScript.file}: ${threadsForGrowing} threads`)
        this.logger.log(`Hacking: ${this.path}${hackScript.file}: ${threadsForHacking} threads`)

        for(let index = 0; index < delays.length; index++) {
            result = { success: false, message: ''};
            const delay = delays[index];
            if(delay.name === 'weaken' && threadsForWeakening2 > 0){
                result = this.infector.executeScript(weakenScript, threadsForWeakening2, target, delay.amount);
            }else if(delay.name === 'grow' && threadsForGrowing > 0){
                result = this.infector.executeScript(growScript, threadsForGrowing, target, delay.amount);
            }else if(delay.name === 'hack' && threadsForHacking > 0){
                result = this.infector.executeScript(hackScript, threadsForHacking, target, delay.amount);
            }
            this.logger.log(`Executed '${delay.name}' => ${target.name}. Result: [ ${result.success} ]: ${result.message} `)
            success += result.success ? 1 : 0;
            this.logger.log(`Result/Success after '${delay.name}' : ${result.success ? 1 : 0} / ${success} from ${delays.length+1} files`)
            this.logger.line(100, false, '-');
        }
        return {
            // after executing 4 scripts success should be 4 if all succeeded
            success: success === 4 ? true : false,
            message: `(${success === 4 ? 'Successfully' : 'Unsuccessfully'}) finished  batch ${batchId} / ${args.batches} of server [ ${target.name} ]`
            
        }
    }

    calculateDelays(weakenTime: number, growTime: number, hackTime: number, batchDelay: number) :
    [{name: string, amount: number}, {name: string, amount: number}, {name: string, amount: number}]
    
    {
        // https://bitburner.readthedocs.io/en/latest/advancedgameplay/hackingalgorithms.html
        // We want an execution like:
        // Batch 1
        //                      ||||
        // W --------------------|
        // W   --------------------|
        // G        --------------|
        // H               -----|
        //                      ||||
        // Batch 2                  ||||
        // W     --------------------|
        // W       --------------------|
        // G            --------------|
        // H                    ----|
        // etc.                     ||||
        // Where the Δt between two | >= 20ms because of limitations to JS. We need to optimize those times, for now just use 100ms
        // @todo: optimize Δt (this.interval for now)

        // We know the latter weakenscript should terminate 2 x interval later than the former weakenscript
        // We also need to include an additional delay that depends on which batch we are in
        const weaken2delay = (2 * this.interval) + batchDelay;
        // The growscript should terminate 1 x interval later
        const growDelay = (weakenTime - growTime + this.interval) + batchDelay;
        // And the hackscript should terminate 1 x interval earlier
        const hackDelay = (weakenTime - hackTime - this.interval) + batchDelay;

        return [
            {
                name: 'weaken',
                amount: weaken2delay,
            },
            {
                name: 'grow',
                amount: growDelay,
            },
            {
                name: 'hack',
                amount: hackDelay,
            },

        ]
    }

    determineBatchVariables(target: PublicServer): IBatchVariables {
        const times = this.hfh.getTimes(target);
        const longest = Math.max.apply(null, [times.weakenTime, times.growTime, times.hackTime]);
        this.logger.log(`Analyzing target ${target.name}'s times: ${JSON.stringify(times)}`);
        // the starting of 2 subsequent batches needs to be delayed with a certain amount, i.e. the interval between the first (H) of
        // the scripts (HWGW) and the last (W) of the scripts - with an extra interval to prevent the two batches from overlapping -
        // which comes to (3 + 1) = 4 times the interval between two scripts
        const delayBetweenBatches = this.interval * 4
        // using this delay we can then calculate the amount of batches we can run to complete fill up the available time
        let batches = longest / delayBetweenBatches;
        this.logger.log(`Longest duration: ${longest}, delayBetweenBatches: ${delayBetweenBatches} resulting in amount of batches [ ${batches} ]`)
        // however, we need to make sure we have enough processingpower for this, so we calculate the total amount of possible batches
        const resources = this.infector.calculateTotalProcessingPower();
        const growScript = this.files.find(script => script.name === 'grow');
        const hackScript = this.files.find(script => script.name === 'hack');
        const weakenScript = this.files.find(script => script.name === 'weaken');
        if(weakenScript === undefined || hackScript === undefined || growScript === undefined) {
            return  {
                batches: 0,
                delay: Infinity
            };
        }
        // 1 batch = 2 weakenscripts + 1 hackscript + 1 growScript
        this.logger.log(`Total ram : ${resources.total}`)
        const maxBatches = resources.total / ((2 * weakenScript.ram) + hackScript.ram + growScript.ram);
        // if it is more than the max possible, use the max amount
        batches = batches > maxBatches ? maxBatches : batches;
        this.logger.log(`Max capacity for batches = ${maxBatches}, maxBatches > batches: ${maxBatches > batches}`)
        this.logger.log(`Calculated capacity: ${batches} batches possible simultaneously (with 1 thread).`)

        return {
            batches: Math.round(batches - 0.5),
            delay: delayBetweenBatches
        };
    }

    /**
     * Determine the amount of money we want to hack from a target
     * @param {Server} target target to hack
     * @param {float} amountOfBatches maximum amount of batches to consider
     * @returns {float} amount of money to hack
     */
    findOptimumMoney(target: ExtendedPublicServer, cores = 1, amountOfBatches = 1): number {

        const power = this.infector.calculateTotalProcessingPower();
        const weakenScript = this.files.find(script => script.name === 'weaken');
        const growScript = this.files.find(script => script.name === 'grow');
        const hackScript = this.files.find(script => script.name === 'hack');
        let multiplier = 1;
        let money = target.maxMoney;
        const step = 0.025;
    
        while(Math.round(money) > 0) {
            money = target.maxMoney * multiplier;
            this.logger.log(`money: ${money}, multiplierMoney: ${multiplier},`);
            const hackThreads = this.hfh.hackAnalyzeThreads(target.name, money);
            const growThreads = this.hfh.getThreadsPerGrowthAmount(target, money)
            const hackSecurityIncrease = this.hfh.hackAnalyzeSecurity(hackThreads);
            const growSecurityIncrease = this.hfh.growthAnalyzeSecurity(growThreads);
            const weakenThreadsHack = this.hfh.getThreadsPerSecurityLevels(hackSecurityIncrease, cores);
            const weakenThreadsGrow = this.hfh.getThreadsPerSecurityLevels(growSecurityIncrease, cores);
            if(weakenScript === undefined || hackScript === undefined || growScript === undefined) {
                // something went wrong
                return -1;
            }
            let totalPowerCost = (hackThreads * hackScript.ram) + (growThreads * growScript.ram) + ((weakenThreadsGrow + weakenThreadsHack) * weakenScript.ram);
            totalPowerCost = amountOfBatches * totalPowerCost;
            this.logger.log(`TotalPowerCost: ${totalPowerCost}, total power: ${power.total}`)

            if(totalPowerCost < power.total && Math.round(amountOfBatches) !== 0 && Math.round(money) !== 0) {
                // Network is able to process the amount of funds
                return money;
            }

            multiplier -= step;
        }
        // return 10 % if all fails
       return target.maxMoney * 0.1
    }
}