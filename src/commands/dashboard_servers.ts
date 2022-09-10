import { Dashboard } from 'service/diagnostics/Dashboard';
import { ExceptionHandler } from '/service/diagnostics/ExceptionHandler';

/**
 * Show relevant network information
 * Can be executed by using the 'show-network' alias. Accepts two arguments:
 * @param {*} ns
 * @argument {string} queryType: Allows you to search the networks, can be either 'all' (default), 'server' or 'network'
 *                               - All will show all networks, however it excludes the non-rooted public servers
 *                               - Network will show an entire network specified by the 'query' argument
 *                               - Server will also show an entire network, and highlight the specified server in 'query'
 * @argument {string} query: the query to search for, can be 'botnet', 'hacknet', or 'public', when queryType = 'network'
 *                           or any (partial) servername when queryType = 'server' (e.g. 'srv13.anti', or 'node-14')
 * @returns void
 */
/** @param {NS} ns **/
export async function main(ns: NS): Promise<void> {
    const context = 'SHOWNET'
    try{
    
        let queryType = String(ns.args[0]);
        const query = String(ns.args[1]);

        if(typeof queryType !== 'undefined' && typeof query === 'undefined') {
            ns.tprint(`The second argument cannot be missing when the first is given, please provide a query for your search`);
            return;
        }

        if(queryType === 'undefined') {
            queryType = 'all';
        }else if(queryType !== 'network' && queryType !== 'server' && queryType !== 'all') {
            ns.tprint(`The first argument can only be 'network', 'server', or 'all'`);
            return;
        }
        const verbose = 0;
        const display = new Dashboard(ns, verbose);
        display.init();
        display.showNetwork(queryType, query);

    }catch(e){
        const eh = new ExceptionHandler(ns, context);
        eh.handle(e);
    }
}