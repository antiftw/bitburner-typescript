import Configurator from '/service/core/Configurator';
import { FileManager } from '/service/core/FileManager';
import PortHandler from '/service/data/PortHandler';
import { ExceptionHandler } from '/service/diagnostics/ExceptionHandler';
import Logger from '/service/diagnostics/Logger';
import TypeHelper from '/toolbox/TypeHelper';
import { IMainDaemonArguments, IMainDaemonStep, ISimpleJSONReturn } from '/types';
/**
 * Runs the main loop, kicking off all different parts of the application
 * Inspired by the JAHS class by Jjin, because of the nice solution to wait for scripts to finish, which works faster than the 'spawn' solution
 */
export class MainDaemon {
    ns:NS;
    context:string;
    cfg: Configurator;
    verbose:number;
    logger: Logger;
    eh: ExceptionHandler;
    ph: PortHandler;
    file: FileManager;
    type: TypeHelper;
    host: string;
    modules: Array<any>; // no id;
    path: string;
    steps: Array<IMainDaemonStep>;
    args: IMainDaemonArguments | null;
    lastBeat: Date;
    heartbeat: number;
    previousFortunes: Array<number>;
    counter: number;
    phase: number;
    sleepDuration: number;


    constructor(ns: NS, verbose = 0) {
        this.ns = ns;
        this.context = 'MAIN-LOOP';
        this.cfg = new Configurator(ns);
        this.verbose = verbose;
        this.logger = new Logger(ns, this.verbose, this.context);
        this.eh = new ExceptionHandler(ns, this.context);
        this.ph = new PortHandler(ns, verbose);
        this.file = new FileManager(ns, this.verbose);
        this.type = new TypeHelper();
        this.host = "home";
        this.modules = [];
        this.path = '';
        this.steps = [];
        this.args = null;
        this.lastBeat = new Date();
        this.heartbeat = 1000 * 60 * 5; // default give us a heartbeat each 5 min -> we can override this in the configuration
        this.previousFortunes = [];
        this.previousFortunes.push(this.ns.getServerMoneyAvailable('home'));
        this.counter = 0;
        this.phase = 1;
        this.cfg.readConfig('main');
        this.sleepDuration = this.cfg.getConfiguration('sleep_duration', 'main').getNumberValue();
    }

    async execute(args: IMainDaemonArguments): Promise<void> {
       try {
            this.args = args;
            await this.updateConfig();

            // Thanks to https://textkool.com/en/ascii-art-generator?hl=default&vl=default&font=Elite&text=Anti-Bitburner
            this.notify(` ▄▄▄·  ▐ ▄ ▄▄▄▄▄▪  ▄▄▄▄· ▪  ▄▄▄▄▄▄▄▄▄· ▄• ▄▌▄▄▄   ▐ ▄ ▄▄▄ .▄▄▄  `);
            this.notify(`▐█ ▀█ •█▌▐█•██  ██ ▐█ ▀█▪██ •██  ▐█ ▀█▪█▪██▌▀▄ █·•█▌▐█▀▄.▀·▀▄ █·`);
            this.notify(`▄█▀▀█ ▐█▐▐▌ ▐█.▪▐█·▐█▀▀█▄▐█· ▐█.▪▐█▀▀█▄█▌▐█▌▐▀▀▄ ▐█▐▐▌▐▀▀▪▄▐▀▀▄ `);
            this.notify(`▐█ ▪▐▌██▐█▌ ▐█▌·▐█▌██▄▪▐█▐█▌ ▐█▌·██▄▪▐█▐█▄█▌▐█•█▌██▐█▌▐█▄▄▌▐█•█▌`);
            this.notify(` ▀  ▀ ▀▀ █▪ ▀▀▀ ▀▀▀·▀▀▀▀ ▀▀▀ ▀▀▀ ·▀▀▀▀  ▀▀▀ .▀  ▀▀▀ █▪ ▀▀▀ .▀  ▀`);
            const noVerbosity = `, verbose: ${this.verbose} => no output, running silently in background. To change this => ConfigurationHandler => main.verbosity.general`
            this.notify(`Initialized${this.verbose === 0 ? noVerbosity : '.' }`)
            await this.monitor();
       }catch(e) {
           this.eh.handle(e, 'EXECUTE');
       }
    }

    async monitor(): Promise<ISimpleJSONReturn> {
        if(this.args === null) {
            return {
                success: false,
                message: `Arguments missing to properly run MainDaemon. Aborting...`
            };
        }

        if(this.args.forceRefresh) {
            const module = this.getStepByName('initConfig');
            this.executeModule(`${this.path}${module.file}`);
            await this.checkModuleStatus(module.file);
        }

        while (this.cfg.getConfiguration('heartbeat', 'main')) {
            const now = new Date();
            if(now.valueOf() - this.lastBeat.valueOf() > this.heartbeat && this.verbose === 0) {
                // even if we dont have verbosity on, we still want a signal of life every now and then
                const money = this.ns.getServerMoneyAvailable('home');
                const diff = money - this.previousFortunes[this.counter];
                // need to push the current amount before we can calculate the average funds
                this.previousFortunes.push(money);
                const fps = this.calculateAverageFundsPerSecond();
                // append 0 if needed, for a more consistent output (e.g. 19,7 => 19,70)
                const currentCash = this.logger.formatPrice(money, true, 4);
                const difference = this.logger.formatPrice(diff, true, 4);
                const fundsPerSecond = this.logger.formatPrice(fps, true, 4);

                this.notify(`Heartbeat - Current Funds: ${currentCash} - Difference since last beat: ${difference} - ( FPS: ~ ${fundsPerSecond} ₿/s )`);
                this.lastBeat = now;
                this.counter++;
            }
            if(this.cfg.getConfiguration('enabled', 'main')){
                this.logger.line(50, true);
                this.logger.notify(`Iteration started at ${this.logger.currentTime()}`);
                this.logger.line(50, true);
                let currentStep = this.getStepByName('initConfig');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('incrBudget');
                if(currentStep.enabled){
                    const args = [];
                    args[0] = this.args.forceRefresh;
                    args[1] = this.args.resupplyAmount;
                    this.executeModule(`${this.path}${currentStep.file}`, args);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('divdBudget');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('scanBotnet');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('scanPublic');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('scanHacknet');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }

                currentStep = this.getStepByName('runBotnet');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('runPublic');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('runHacknet');
                if(currentStep.enabled){
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }
                currentStep = this.getStepByName('runHacker');
                if(currentStep.enabled){
                    // check if we want to reset all servers, because there might be a new target
                    const output = this.ph.read('request-reassesment');
                    if(output !== 'NULL PORT DATA' && output === 1) {
                        const killAllFile = this.cfg.getConfiguration('killAll', 'processes').getStringValue();
                        const processPath = this.cfg.getConfiguration('processPath', 'process').getStringValue()
                        this.executeModule(`${processPath}${killAllFile}`);
                        await this.checkModuleStatus(killAllFile);
                    }
                    this.executeModule(`${this.path}${currentStep.file}`, this.args.forceRefresh);
                    await this.checkModuleStatus(currentStep.file);

                }
                currentStep = this.getStepByName('runBatcher');
                if (currentStep.enabled) {
                    this.executeModule(`${this.path}${currentStep.file}`);
                    await this.checkModuleStatus(currentStep.file);
                }

                await this.updateConfig();
                this.clearArgs();
            }else {
                await this.ns.asleep(5000);
            }
            await this.ns.asleep(10);
        }
        return {
            success: true,
            message: `Execution finished`
        }
    }

    async checkModuleStatus(module: string): Promise<void> {
        await this.waitForModule(`${this.path}${module}`);
    }

    async waitForModule(scrName: string): Promise<void> {
        while (this.ns.scriptRunning(scrName, this.host)) {
            await this.ns.sleep(this.sleepDuration);
        }
    }
    executeModule(scrName: string, args?: Array<string|number|boolean> | string | number | boolean, threads = 1): void{
       try {
        if(args != null){
            if(typeof args === 'string' || typeof args === 'number') {
                this.ns.exec(scrName, this.host, threads, args);
            }else if(this.type.is(args, Array) && args.length > 1) {
                switch(args.length) {
                    case 2:
                        this.ns.exec(scrName, this.host, threads, args[0], args[1]);
                        break;
                    case 3:
                        this.ns.exec(scrName, this.host, threads, args[0], args[1], args[2]);
                        break;
                    // @todo: expand when/if needed ;)
                }
            }
        } else {
            this.ns.exec(scrName, this.host);
        }
       }catch(e) {
           this.eh.handle(e, 'EXECUTE-MODULE');
       }
    }

    async updateConfig(): Promise<void>{
        this.path = this.cfg.getConfiguration('cmdPath', 'main').getStringValue();
        
        this.sleepDuration = this.cfg.getConfiguration('sleepDuration', 'main').getNumberValue();
        this.verbose = this.cfg.getConfiguration('verbosity', 'main').getNumberValue();
        // only replace it when defined
        this.heartbeat = this.cfg.getConfiguration('heartbeatDuration', 'main').getNumberValue() > 0 
        ? this.cfg.getConfiguration('heartbeatDuration', 'main').getNumberValue() : this.heartbeat;
    }

    notify(msg: string): void {
        this.ns.tprint(`[${this.logger.currentTime()}][NOTIFY][MAIN-LOOP] ${msg}`)
    }

    clearArgs(): void {
        if(this.args !== null) {
            this.args.forceRefresh = false;
            this.args.resupplyAmount = 0;
        }
    }

    initializeSteps(): void {
        const stepNames = this.cfg.getConfiguration('steps', 'main').getArrayValue();
        for(const name of stepNames) {
            const file = this.cfg.getConfiguration(`steps.${name}.file`, 'main').getStringValue();
            const enabled = this.cfg.getConfiguration(`steps.${name}.enabled`, 'main').getBooleanValue();
            const verbosity = this.cfg.getConfiguration(`steps.${name}.verbosity`, 'main').getNumberValue();
            this.initializeStep(file, enabled, verbosity);
        }
    }

    initializeStep(file: string, enabled = true, verbosity = 0): void {
        const step = { 
            file: file,
            enabled: enabled,
            verbosity: verbosity
        }
        this.steps.push(step);
    }

    getStepByName(name: string): IMainDaemonStep{
        for(const step of this.steps) {
            const parts = step.file.split('.');
            if(parts[1] === name) {
                return step;
            }
        }
        return {
            file: 'InvalidStepName',
            enabled: false,
            verbosity: 0
        };
    }
    calculateAverageFundsPerSecond(): number {
        let total = 0;
        let count = 0;
        const differences: Array<number> = [];
        this.previousFortunes.forEach((item, index) => {
            if(index !== 0) {
                differences.push(item - this.previousFortunes[index - 1]);
            }
        });
        differences.forEach(diff => {
            total += diff;
            count++;
        })
        //this.notify(`total ${total}, \ntotal - initial: ${total - (this.previousFortunes[0] * count)}.  \ncount: ${count}.\n heartbeat: ${this.heartbeat} `)
        // we only want the profit, so we subtract the first amount (for each beat), which is the total funds at the time the batching started
        // we then divide it by the amount of elements in the array * the time between beats. The division is because heartbeat is in ms
        return (total) / (count * this.heartbeat / 1000);
    }
}