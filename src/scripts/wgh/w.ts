import Logger from "service/diagnostics/Logger";

/** @param {NS} ns **/
export async function main(ns: NS) : Promise<void> {
    const server = String(ns.args[0]);
    let delay = Number(ns.args[1]);
    const verbose = 1;
    const context = 'WEAKEN'
    const logger = new Logger(ns, verbose, context);

    if(typeof server === 'undefined') {
        logger.notify('Cannot call weaken without passing a server');
        return;
    }

    if(typeof delay === 'undefined') {
        delay = 0;
    }

    try{
        logger.log(`Script started at ${logger.currentTime()} with target ${server} and delay ${delay}`)
        if(delay > 0) {
            logger.log(`Waiting for ${delay / 60 / 1000} minutes`)
            await  ns.asleep(delay);
        }
        logger.log(`Started weakening server [ ${server} ] at ${logger.currentTime()}`)
        await ns.weaken(server);
        logger.log(`Finished weakening server [ ${server} ] at ${logger.currentTime()}`)
    }
    catch(exception) {
        ns.tprint(`ERROR - ${exception}`);
    }
}