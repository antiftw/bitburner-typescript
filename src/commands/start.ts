import { MainDaemon } from '../daemon/MainDaemon';
import { ExceptionHandler } from '/service/diagnostics/ExceptionHandler';
import Logger from '/service/diagnostics/Logger';
/**
 * Main loop
 * Can be executed using the 'start' alias
 * @param {*} ns
 */
/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    const context = 'LOOPCMD'
    try{
        let forceRefresh = false;
        let resupplyAmount = 0;

        const logger = new Logger(ns);
        for(let arg of ns.args) {
            // cast to string to keep Typescript happy
            arg = String(arg);
            if(arg === '--force' || arg === '--f') {
                forceRefresh = true;
            }else if (arg.includes('--resupply') || arg.includes('--r')) {
                if(arg.includes('=')) {
                    const parts = arg.split('=');
                    logger.log(parts[0] + ' ' + parts[1]);
                    resupplyAmount = Number(parts[1]);
                }
            }
        }
        const args = {
            resupplyAmount: resupplyAmount,
            forceRefresh: forceRefresh
        };
        
        // initialize MainLoopHandler;
        const loop = new MainDaemon(ns);
        // run loop with arguments
        await loop.execute(args);
    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e);
    }
}