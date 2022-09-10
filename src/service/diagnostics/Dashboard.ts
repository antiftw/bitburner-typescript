
import Configurator from 'service/core/Configurator';
import { FileManager } from 'service/core/FileManager';
import { ExceptionHandler } from 'service/diagnostics/ExceptionHandler';
import { ExtendedBotnetServer } from 'object/server/ExtendedBotnetServer';
import ExtendedHacknetServer from 'object/server/ExtendedHacknetServer';
import ExtendedPublicServer from 'object/server/ExtendedPublicServer';
import { IDisplayOptions, IScript, IServer } from 'types';
import Logger from 'service/diagnostics/Logger';
/**
 * Handle the displaying of the network on the terminal
 */
export class Dashboard{
    ns: NS;
    verbose: number;
    readonly context: string = 'DASHBOARD';

    public: Array<ExtendedPublicServer>;
    botnet: Array<ExtendedBotnetServer>;
    hacknet: Array<ExtendedHacknetServer>;
    
    file: FileManager;
    ch: Configurator;
    eh: ExceptionHandler; 
    logger: Logger;
    initialized: boolean;
    scripts: Array<IScript>
    
    constructor(ns: NS, verbose: number) {
        this.ns = ns;
        this.verbose = verbose;
        this.public = [];
        this.botnet = [];
        this.hacknet = [];

        this.file = new FileManager(ns, verbose);
        this.ch = new Configurator(ns, verbose);
        this.eh = new ExceptionHandler(ns, this.context)
        this.logger = new Logger(ns, verbose, this.context);
        
        this.initialized = false;
        this.scripts = [];
    }
    loadConfig(): void{
        try{
            this.ch.readConfig('main');
        }catch(e) {
            this.logger.log('Error reading configuration file: ' + e)
        }
    }
    /**
     * Show all the networks, or a part of it, depending on the arguments and options
     * @param queryType ['all', 'network', 'server']
     * @param query the actual query
     */
    showNetwork(queryType = 'all', query = ''): void{
        let showBotnet = false;
        let showPublic = false;
        let showHacknet = false;
        let showRootOnly = false;
        let showHackableOnly = false;
        const sortBy = 'favorability';
        if(queryType === 'all') {
            showBotnet = true;
            showPublic = true;
            showHacknet = true;
            // We hide the non-rooted and non-hackable servers here to at least limit the list a bit, else it becomes too large
            showRootOnly = true;
            showHackableOnly = true;
        }else if (queryType === 'network' && query !== null) {
            // can be 1 network name ("botnet"), or several: "botnet, hacknet"
            if('botnet'.includes(query)) {
                showBotnet = true;
            }
            if ('hacknet'.includes(query)){
                showHacknet = true;
            }
            if ('public'.includes(query)){
                showPublic = true;
            }
        }else if (queryType === 'server' && query !== null) {
            showHacknet = this.hacknet.some(srv => srv.name.includes(query));
            showBotnet = this.botnet.some(srv => srv.name.includes(query));
            showPublic = !showBotnet && !showHacknet;
            if(showPublic) {
                const target = this.public.find(srv => srv.name.includes(query));
                if(typeof target !== 'undefined'){
                    showRootOnly = target.rootAccess;
                }
            }
        }
        this.show({
                rootOnly: showRootOnly,
                hackable: showHackableOnly,
                botnet: showBotnet,
                public: showPublic,
                hacknet: showHacknet,
                query: query,
                sortBy: sortBy
        })
    }

    showScripts(): void {
        this.logger.line(79, true);
        this.logger.notify(``);
        this.logger.notify(`Scripts on botnet:`);
        this.logger.notify(``);
        this.logger.line(79, true);
        this.botnet.forEach(bot => {
            this.showScriptsOnServer(bot)
        })
        this.logger.line(79, true);
        this.logger.notify(``);
        this.logger.notify(`Scripts on public net:`);
        this.logger.notify(``);
        this.public.forEach(pub => {
            this.showScriptsOnServer(pub);
        })

    }

    showScriptsOnServer(server: IServer) : void {
        const width = 79;
        const running = this.ns.ps(server.name);
        if(running.length === 0) {
            return;
        }
        this.logger.line(width, true);
        this.logger.notify(`| ${server.name}`);
        this.logger.line(width, true, '-')
        this.logger.notify(`| PID |                         Name | Threads |           Arguments          |`);
        running.forEach(file => {
            const pid = this.logger.pad(5, `${file.pid}`, true);
            const name = this.logger.pad(30, `${file.filename}`, true);
            const threads = this.logger.pad(9, `${file.threads}`, true);
            const args = this.logger.pad(30, JSON.stringify(file.args), true)
            this.logger.line(width, true, '-')
            this.logger.notify(`|${pid}|${name}|${threads}|${args}|`)
        })
    }

    init() : void{
       try{
        this.loadConfig();
        //  this.hacknet = this.file.readJson(this.config.hacknet.data_file);
        //  this.public = this.file.readJson(this.config.public.data_file);
        //  this.botnet = this.file.readJson(this.config.botnet.data_file);
        this.loadServers();
       }catch(e) {
           this.eh.handle(e, 'INIT')
       }finally{
            this.initialized = true;
       }
    }

    loadServers(): void {
        this.logger.log('Loading servers' + this.ch.getConfiguration('structure_file', 'public').getStringValue());
        const botnetData = this.file.readJson(this.ch.getConfiguration('structure_file', 'botnet').getStringValue());
        const publicData = this.file.readJson(this.ch.getConfiguration('structure_file', 'public').getStringValue());
        const hacknetData = this.file.readJson(this.ch.getConfiguration('structure_file', 'hacknet').getStringValue());
        
        for(let index = 0; index < botnetData.length; index++) {
            const bot = botnetData[index];
            const server = new ExtendedBotnetServer(this.ns, bot.name);
            server.actualize();
            this.botnet.push(server);
        }
        this.logger.log('Botnet loaded');
        for(let index = 0; index < publicData.length; index++) {
            const pub = publicData[index];
            const server = new ExtendedPublicServer(this.ns, pub.name, pub.source);
            server.actualize();
            this.public.push(server);
        }

        for(let index = 0; index < hacknetData.length; index++) {
            const hack = hacknetData[index];
            const server = new ExtendedHacknetServer(this.ns, hack.name);
            server.actualize();
            this.hacknet.push(server);
        }

        this.logger.log('Public net loaded');
        this.logger.log(`Servers loaded: [ ${this.botnet.length} ] bots and [ ${this.public.length} ] public`)
    }


    /**
     * Show all networks specified by the options
     * @param options aray of options that influence the rendering of the networks
     * @returns     
     */
    show(options: IDisplayOptions) : void{
        this.logger.log('DisplayHandler init.');
        if(!this.initialized){
            return;
        }
        this.logger.log('Display network with options: [ ' + JSON.stringify(options) + ' ]');
        this.showNetworkStats()

        if(options.botnet && this.botnet.length > 0) {
            this.logger.line();
            this.logger.log('✔️ Also showing Botnet');
            this.ns.tprint('==========================================');
            this.ns.tprint('|       NAME        |   (max) |   RAM    | ');
            this.ns.tprint('==========================================');
            
            // we want the botnet servers to be on top, because they are more powerful
            for(let index = 0; index < this.botnet.length; index++) {
                this.showBotnetServer(this.botnet[index], options.query);
            }
        }
        if(options.hacknet && this.hacknet.length > 0){
            this.logger.line();
            this.logger.log('✔️ Also showing Hacknet');
            this.ns.tprint('=========================================================================================');
            this.ns.tprint('|SERVER |        NAME         |LEVEL|  RAM  | CPUS |        PRODUCTION        |  UPTIME |');
            this.ns.tprint('=========================================================================================');
            
            this.hacknet.forEach(srv => {
               try{
                this.showHacknetServer(srv, options.query);
               }catch(e){
                   this.eh.handle(e);
               }
            });
        }

        if(options.public && this.public.length > 0) {
            this.logger.line();
            this.logger.log(`✔️ Also showing Public servers: ${this.public.length}`);
            this.ns.tprint('========================================================================================================================================');
            this.ns.tprint('|ROOT| PORTS |    HACK    |         NAME         |   (max) | RAM      |    (max)    |   MONEY   |         SECURITY      | FAVORABILITY |');
            this.ns.tprint('========================================================================================================================================');
            if(options.sortBy) {
                switch(options.sortBy) {
                    case 'name':
                        this.public.sort(function(a, b) {
                            const textA = a.name.toUpperCase();
                            const textB = b.name.toUpperCase();
                            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
                        })
                        break;
                    case 'maxMoney':
                        this.public.sort((a,b) => b.maxMoney - a.maxMoney);
                        break;
                    case 'favorability':
                        this.public.sort((a,b) => b.favorability - a.favorability);
                        break;
                }
            }
            if(options.rootOnly || options.hackable) {
                this.public
                    .filter( srv => srv.rootAccess === options.rootOnly)
                    .filter( srv => srv.requiredHackingLevel <= this.ns.getHackingLevel())
                    .forEach(srv => {
                        this.showPublicServer(srv, options.query);
                        return;
                });
            } else {
                this.logger.log('✔️ Also showing nodes without r00t Access');
                this.public.forEach(srv => {
                    this.showPublicServer(srv, options.query);
                });
            }
        }
    }
    showNetworkStats(): void {
        let totalRam = 0;
        let usedRam = 0;
        let totalMoney = 0;
        let money = 0;
        let hackRam = 0;
        let hackCores = 0;
        let hackLevels = 0;
        this.botnet.forEach(bot => {
            totalRam += bot.maxRam;
            usedRam += bot.usedRam;
        })
        this.public.filter(pub => pub.name !== 'home').forEach(pub => {
            totalRam += pub.maxRam;
            usedRam += pub.usedRam;
            totalMoney += pub.maxMoney;
            money += pub.money;
        })
        this.hacknet.forEach(node => {
            hackRam += node.maxRam;
            hackCores += node.cores;
            hackLevels += node.level;
        })
        this.ns.tprint(`Amount of servers: [  ${this.public.length} ]`);
        this.ns.tprint(`Size of botnet : [ ${this.botnet.length} ]`);
        this.ns.tprint(`Size of hacknet: [ ${this.hacknet.length} ] => ${hackRam} GB RAM | ${hackCores} CORES | ${hackLevels} levels.`);
        const home = this.public.find(srv => srv.name === 'home');
        this.ns.tprint(`Used/Total amount of RAM: ${usedRam} / ${totalRam} GB ( ${this.logger.formatRam(usedRam)} / ${this.logger.formatRam(totalRam)} = ${(usedRam/totalRam * 100).toFixed(2)} % ) of which ${this.logger.formatRam(typeof home !== 'undefined' ? home.maxRam : 0)} is from the 'home' server`);
        this.ns.tprint(`Current/Total amount of Money on all public servers: ${this.logger.formatPrice(money, false)} / ${this.logger.formatPrice(totalMoney, false)} (= ${money/totalMoney*100} %)`)
        this.ns.tprint(`Total amount of Money on home server: ${this.logger.formatPrice(typeof home !== 'undefined' ? home.money : 0, false)}`)
        

    }
    /**
     * Show a Botnet server
     * @param server to display
     * @param  query optional search parameter
     */
    showBotnetServer(server: ExtendedBotnetServer, query = ''): void{
        let marker = '';
        if(query !== '' && server.name.includes(query)) {
            marker = '🔍';
        }
        const name = '| ' + this.logger.pad(17, server.name) + ' | ';

        const ram = this.visualizeRamUsage(server);
        const line = name + ram + marker;
        this.ns.tprint(line);
    }

   
    /**
     * Show a Hacknet server
     * @param server to display
     * @param  query optional search parameter
     */
    showHacknetServer(server: ExtendedHacknetServer, query = ''): void{
        let marker = '';
        if(query !== null && server.name.includes(query)) {
            marker = '🔍';
        }

        //this.ns.tprint(JSON.stringify(server));
        const name = ' ' + this.logger.pad(20, server.name) + ' | ';
        const isServer = server.isServer ? '|  ☣️  |' : '|  ☢️  |';
        const level = `${this.logger.pad(3, String(server.level))} |`;
        const maxRam =` ${this.logger.pad(2, String(server.maxRam)) } GB |`;
        const cores = `  ${this.logger.pad(2, String(server.cores))}  |`;
        const production = this.logger.pad(11, server.production.toFixed(0), true);
        const totalProduction = this.logger.pad(11, server.totalProduction.toFixed(0));
        const prod = `${production} / ${totalProduction} |`;
        const online = `${this.logger.pad(8, server.timeOnline.toFixed(0), true)} |`;
        const line = isServer + name + level + maxRam + cores + prod + online + marker;
        this.ns.tprint(line);
    }
    /**
     * Show a Public server
     * @param server to display
     * @param query optional search parameter
     */
    showPublicServer(server: ExtendedPublicServer, query: string): void {
        //this.logger.notify(JSON.stringify(server));
        // get the server object from the NS lib to get the current open ports
        const srv = this.ns.getServer(server.name);
        const marker = query !== null && server.name.includes(query) ? '🔍' : '';
        // @todo: create a separate script overview, since this screen is already to crowded
        //const scripts = this.getRunningScripts(server);
        const currentSecurity = this.logger.pad(3, server.security.toFixed(0), true);

        const minSecurity = this.logger.pad(3, server.minSecurity.toFixed(0), true);
        const security = ` ${currentSecurity} / ${minSecurity} |`
        
        const secRatio = Math.round(server.security / server.minSecurity * 100);
        const securityRatio =  ` (${this.logger.pad(3, `${secRatio}`, true)} %) |`;
        const name = ` ${this.logger.pad(20, server.name)} | `;

        const ports = ` | ${srv.openPortCount} / ${server.portsRequired} |`;
        const root = (server.rootAccess ? '✔️' : '❌');
        const playerHack = this.ns.getHackingLevel();
        const hackable = playerHack > server.requiredHackingLevel ? '🟢' : '🔴';
        const levelHack = ` ${hackable} (${this.logger.pad(4, String(server.requiredHackingLevel), true)}) |`;
        const ram = this.visualizeRamUsage(server);
        const money = this.visualizeMoneyReserves(server);
        const favorability = `    ${this.logger.pad(7, String(server.favorability), true)}    |`;
        const line = '| ' + root + ports + levelHack + name + ram + money + security + securityRatio + favorability + marker;

        this.ns.tprint(line);
    }

    visualizeRamUsage(server: IServer, maxRamLength = 4): string {

        let ratio = 0;
        if(server.usedRam > 0 && server.maxRam > 0) {
            ratio = server.usedRam / server.maxRam * 100;
        }
        //this.logger.notify(`ram: ${server.usedRam}, maxram: ${server.maxRam}, ratio: ${ratio}`)
        const precision = 10;
        const stripes = ratio / precision;
        let indicator = '';
        for(let counter = 0; counter < stripes; counter++ ){
            indicator += '█';
        }
        let maxRamString = this.logger.formatRam(server.maxRam, 0, true)

        maxRamString = this.logger.pad(maxRamLength, maxRamString, true);
        return `${maxRamString} |${this.logger.pad(precision, indicator)}|`
    }

    visualizeMoneyReserves(server: IServer): string{
        let maxMoney = this.logger.formatPrice(server.maxMoney);
        let ratio = server.money / server.maxMoney * 100;
        //this.logger.notify(`money: ${server.money}, maxMoney: ${server.maxMoney}, ratio: ${ratio}`)
        if(server.name === 'home') {
            // hack, since the maxMoney of home === 0
            ratio = 10;
            maxMoney = this.logger.formatPrice(server.money)
        }
        ratio = ratio > 10 ? ratio / 10 : ratio;
        let indicator = '';
        for (let counter = 0; counter < ratio; counter++){
            indicator += '█';
        }
        return `₿ ${maxMoney} |${this.logger.pad(10, indicator)}| |`
    }

    /**
     * Create a string corresponding to the amount of ports that are required to attain root access
     * @param number port number
     * @returns visual representation of the amount of ports required
     */
    port(number: number): string {
        let result = '';
        return `|  ${number}  |`
        switch (number) {
            case 0: result = ' 0 '//'0️⃣'
                break;
            case 1: result = ' I '//'1️⃣'
                break;
            case 2: result = 'I I'//'2️⃣'
                break;
            case 3: result = 'III'//'3️⃣'
                break;
            case 4: result = 'I V'//'4️⃣'
                break;
            case 5: result = ' V '//'5️⃣'
                break;
        }
        return result;
    }
}