import Logger from "/service/diagnostics/Logger";
import { Player, Server } from "/../NetscriptDefinitions";
import PublicServer from "/object/server/PublicServer";

export class HackingFormulaHandler {
    ns: NS;
    verbose: number;
    context: string;
    player: Player;
    logger: Logger;
    minSecurityThreshold: number;
    minMoneyRatio:number;

    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'HCKFOR';
        this.player = this.ns.getPlayer();
        this.logger = new Logger(ns, verbose, this.context);
        // used to filter out rounding errors while nearing the maximum/minimum values
        this.minSecurityThreshold = 0.01;
        this.minMoneyRatio = 1.002;
    }
    

    getThreadsToMinSecurityLevel(server: PublicServer): number {
        const srv = this.ns.getServer(server.name);
        const cores = srv.cpuCores;
        const difference = server.security - server.minSecurity;
        return this.getThreadsPerSecurityLevels(difference, cores);
    }

    getThreadsPerSecurityLevels(levels: number, cores = 1): number {
        let threads = 0;
        let calculated = 0;
        if(levels <= this.minSecurityThreshold) {
            // in this case weakening is not actually required. looks like issues with the money nearing the max value but not actually
            // reaching it. This causes the system to think it needs to grow when the money is actually as maxed as it can be.
            return threads;
        }
        while(levels > calculated){
            threads++;
            /** @function weakenAnalyze(threads,cores) => predict effect of weaken */
            calculated = this.ns.weakenAnalyze(threads, cores);
        }
        return threads;
    }

    /**
     * Calculate the amount of threads to restore a specified amount of funds
     * @param {PublicServer} server to consider
     * @param {float} amount funds to restore
     * @returns {float} threads to run
     */
    getThreadsPerGrowthAmount(server: PublicServer, amount: number, cores = 1): number {
        let ratio;
        const serverIsAtMaxFunds = server.maxMoney / server.money < this.minMoneyRatio;
        //this.logger.log(`server.money: ${server.money}. amount: ${amount} money+amount: ${server.money + amount} (max: ${server.maxMoney})`)
        if(amount >= server.maxMoney) {
            // we need to restore all (or would exceed the max) funds
            // a hack would be to calculate:
            // maxMoney / maxMoney - (maxMoney - 1)
            // === maxMoney / 1 === maxMoney
            ratio = server.maxMoney;
        }else {
            // we need to restore a part of the funds
            if(serverIsAtMaxFunds) {
                // if we are already at max funds => used for batching
                ratio =  server.maxMoney / (server.maxMoney - amount);
            }else{
                // if we are not yet at max funds => used for pre-batching
                ratio = (server.money + amount) / server.money;
            }
        }
        this.logger.log(`Amount to restore: ${this.logger.formatPrice(amount)} resulting in ratio [ ${ratio} ] with ${ratio} < ${this.minMoneyRatio} => ${ratio < this.minMoneyRatio}`)
        if(ratio < this.minMoneyRatio) {
            // required for "rounding errors", else servers will sometimes always keep requiring growing, even if we are (nearly) maxed
            //this.logger.log(`No growing required, ${ratio} < ${this.minMoneyRatio}`)
            return 0;
        }
        
        /** @function growthAnalyze(host,growthAmount,cores) => amount of threads to grow amount with a specifil multiplier (=> decimal) */
        let threads = this.ns.growthAnalyze(server.name, ratio, cores) ;
        this.logger.log(`Threads before: ${threads}`)
        threads = threads < 1 ? 1 : threads;
        
        return threads;
    }

    /**
     * Calculate the amount of threads to restore a specified amount of funds
     * @deprecated in favor of this.getThreadsPerGrowthAmount()
     * @param {PublicServer} server to consider
     * @param {float} amount funds to restore
     * @returns {float} threads to run
     */
    getThreadsPerGrowthAmountOld(server: PublicServer, amount: number): number {
        const srv = this.ns.getServer(server.name);
        const cores = srv.cpuCores;
        let ratio = 0;
        // the calculation differs when server.maxMoney ≈ server.money (i.e. when maxMoney/money < minMoneyRatio (to account for rounding errors))
        this.logger.log(`server.maxMoney ${server.maxMoney} / server.money ${server.money} (=${server.maxMoney / server.money}) < this.minMoneyRatio (${this.minMoneyRatio}): ${server.maxMoney / server.money < this.minMoneyRatio}`)
        if(server.maxMoney / server.money < this.minMoneyRatio) {
            // server.money === server.maxMoney => we need to subtract the amount from the maximum amount of money => used in the batching process
            if(amount === server.maxMoney) {
                // if amount equals the total amount of funds, we would get a division by zero in the other equasion, so we add 1
                ratio = server.maxMoney / (server.maxMoney - (amount - 1));
            }else {
                ratio = server.maxMoney / (server.maxMoney - amount);
            }
            this.logger.log(`server.maxMoney ≈ server.money => ratio = ${server.maxMoney} / ${server.maxMoney - amount} = ${ratio}`)
        }else if(server.maxMoney / server.money > this.minMoneyRatio ) {
            // server.money !== server.maxMoney => we need to add the amount to the current amount of money => used in the prebatching process
            if(server.money + amount > server.maxMoney) {
                // if growing server.money with 'amount' exceeds server.maxMoney, we make sure it doesn't
                amount = server.maxMoney - server.money;
                this.logger.log(`Max money amount would be exceeded by adding ${amount} => (${amount} + ${server.money} > ${server.money}, using amount ${amount} instead`)
                ratio = (server.money + amount) / server.money;
            }else if(server.money === 0) {
                // server.money === 0 => would result in a ratio of Infinity because of the division by 0
                amount = server.maxMoney - 1;
                ratio = (server.money + amount)
            }
            this.logger.log(`server.maxMoney !≈≈ server.money`)
            this.logger.log(`ratio = (server.money (${server.money}) + amount (${amount})) / server.money (${server.money}) == ${ratio}`)
        }
        
        if(ratio < this.minMoneyRatio) {
            // required for "rounding errors", else servers will sometimes always keep requiring growing, even if we are (nearly) maxed
            //this.logger.log(`No growing required, ${ratio} < ${this.minMoneyRatio}`)
            return 0;
        }

        /** @function growthAnalyze(host,growthAmount,cores) => amount of threads to grow amount with a specifil multiplier (=> decimal) */
        return this.ns.growthAnalyze(server.name, ratio, cores);
    }

    getThreadsToMaxMoney(server: PublicServer): number {
        const amount = server.maxMoney - server.money
        this.logger.log(`Calculating threads to restore [ ${amount} ]{amount) ]`)
        return this.getThreadsPerGrowthAmount(server, amount);
    }
    /** 
     * Returns increase in security rating afting growing with a specified amount of threads
     * @function ns.growthAnalyzeSecurity(threads)
     * */
    growthAnalyzeSecurity(threads: number): number {
        return this.ns.growthAnalyzeSecurity(threads);
    }
    /**
     * Returns effect on security by hacking with a specified amount of threads
     * @function ns.hackAnalyzeSecurity(threads)
     */
    hackAnalyzeSecurity(threads: number): number{
        return this.ns.hackAnalyzeSecurity(threads);
    }
    /**
     * Returns amount of threads required to get a specified amount of money
     * @function ns.hackAnalyzeThreads(host,amount)
     * */
    hackAnalyzeThreads(server: string, money: number): number{
        return this.ns.hackAnalyzeThreads(server, money);
    }

    getWeakenTime(server: Server): number {
        return this.ns.formulas.hacking.weakenTime(server, this.player);
    }
    getGrowTime(server: Server): number {
        return this.ns.formulas.hacking.growTime(server, this.player);
    }
    getHackTime(server: Server): number {
        return this.ns.formulas.hacking.hackTime(server, this.player);
    }
    getTimes(server: PublicServer): { growTime: number; hackTime: number; weakenTime: number } {
        const srv = this.ns.getServer(server.name);
        return {
            growTime: this.getGrowTime(srv),
            hackTime: this.getHackTime(srv),
            weakenTime: this.getWeakenTime(srv)
        };
    }
}