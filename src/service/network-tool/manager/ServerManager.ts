
import ExtendedHacknetServer from '/object/server/ExtendedHacknetServer';
import { BudgetManager } from '/service/core/BudgetManager';
import Configurator from '/service/core/Configurator';
import { FileManager } from '/service/core/FileManager';
import { ExceptionHandler } from '/service/diagnostics/ExceptionHandler';
import Logger from '/service/diagnostics/Logger';
import { IServer, IServerManagerAction, IServerManagerPerformedAction, ISimpleJSONReturn } from '/types';
/**
 * Base class for all the servermanagers
 */
export class ServerManager {
    ns: NS;
    verbose: number;
    context: string;
    budget: number;
    phase: number;
    dataFile: string;
    logger: Logger;
    file: FileManager;
    cfg: Configurator;
    bm: BudgetManager;
    eh: ExceptionHandler;

    budgetFile: string;
    priceOfLastAction: number;
    performedActions: Array<IServerManagerPerformedAction>;
    enabled: boolean;
    constructor(ns: NS, verbose = 0, context = 'SERVER-MANAGER'){
        this.ns = ns;
        this.verbose = verbose;
        this.context = context;
        this.budget = 0;
        this.phase = 0;
        this.dataFile = '<fill_this_in_extended_class_after_loading_config>';
        this.logger = new Logger(ns, verbose, this.context);
        this.file = new FileManager(ns, verbose);
        this.cfg = new Configurator(ns, verbose);
        this.cfg.readConfig('main');
        this.bm = new BudgetManager(ns, verbose);
        this.eh = new ExceptionHandler(ns, this.context);

        this.budgetFile = '';
        this.priceOfLastAction = 0;
        this.performedActions = [];
        this.enabled = true;
    }

    /**
     * Main function. Keep upgrading network, until we run out of budget
     */
    async run(): Promise<ISimpleJSONReturn>{
        try{
            // Load configuration, budget, and set other variables
            this.loadData();
            while(this.budget >= this.priceOfLastAction && this.enabled) {

                this.determinePhase();
                const actResult = await this.act();
                if(actResult) {
                    this.logger.log(`Action result: [ ${actResult.message} ] `)
                }
                this.logger.line(50, false);
                await this.ns.asleep(10);
            }
            if(this.performedActions.length > 0 && this.performedActions[0].name !== 'wait'){
                // print results of run
                this.displayActionResult();
                await this.ns.asleep(1000);
                // write the new network data and budgets to file
                await this.writeData();
                await this.ns.asleep(1000);
            }
            return {
                success: true,
                message: `Successfully ran manager.`
            }

        }catch(e) {
            return this.eh.handle(e, 'RUN');
        }
    }

    loadData(): void {
        // This function will load all ManagerType specific data
        // This is just and example / stub for the base functions
        // It will not be run, since the specific managers will overrride this function
        this.performedActions = [];
        this.loadBudget();
    }

    /**
     * Write all data (budgets, serverstructure)
     */
    async writeData(): Promise<ISimpleJSONReturn> {
        try{
            return {
                success: true,
                message: `Successfully written data to file`
            }
        }catch(e) {
            return this.eh.handle(e, 'SRVWRI')
        }
    }

    /**
     * Analyze and register action, used for displaying results afterwards
     * @param action the action to analyze
     */
    analyzeAction(action: IServerManagerAction): void {
        const index = this.performedActions.findIndex( element => {
            if (element.name === action.name) {
              return true;
            }
            return -1 
        });

        let amount = 1;

        let cost = action.price;
        if(index > -1) {
            const search = this.performedActions[index];
            amount = search.amount + 1
            cost = search.cost + action.price;
        }

        const obj = {
            name: action.name,
            amount: amount,
            cost: cost
        }
        if(index === -1) {
            this.performedActions.push(obj)
        }else{
            this.performedActions[index] = obj;
        }
    }

    /**
     * Display all executed actions from the last run
     */
    displayActionResult(): void{
        const output: Array<string> = [];
        let maxLength = 0;
        this.performedActions.forEach(action => {
            const line = `| ${action.name} => amount: ${action.amount}, cost: ₿ ${action.cost.toLocaleString('en')} |`
            maxLength = maxLength < line.length ? line.length : maxLength;
            output.push(line)
        });

        this.logger.notify('')
        this.logger.notify(`Run completed:`)
        this.logger.line(maxLength, true)
        output.forEach( line => {
            this.logger.notify(`${line}`);
        })
        this.logger.line(maxLength, true)
        this.logger.notify('')
    }

    /**
     * Reads the current general budget from file and updates local values
     * @returns {float} the current budget
     */
    loadBudget(): number {
        this.budget = Number(this.file.read(this.budgetFile));
        if(this.budget > 0) {
            this.logger.log(`budget: ${this.budget} / price: ${this.priceOfLastAction ? this.priceOfLastAction : 0}`)
            if(this.budget < this.priceOfLastAction || this.budget === 0) {
                this.enabled = false;
                this.logger.log(`Budget: [ ${this.budget} ] < Price: [ ${this.priceOfLastAction ? this.priceOfLastAction : 0} ] || Budget === 0`)
            }else if(this.budget >= this.priceOfLastAction && this.budget > 0) {
                this.enabled = true;
                this.logger.log(`Budget: [ ${this.budget} ] >= Price: [ ${this.priceOfLastAction ? this.priceOfLastAction : 0} ]`)
            }
        }
        return this.budget;
    }

    /**
     * Determine and perform the next optimal action
     * @returns {obj} = {success, message}
     */
    async act(): Promise<ISimpleJSONReturn> {
        try{
            this.logger.log(`Determining optimal action. Budget: ₿ [ ${this.budget.toLocaleString('en')} ]`)
            const action = this.determineOptimalAction();
            if(action === undefined) {
                return {
                    success: false,
                    message: `Something went wrong selecting the action (=> action === undefined)`
                }
            }
            const price = action.price;
            this.logger.log(JSON.stringify(action))
            if(price > this.budget) {

                const length = String(price).length;
                const required = price - this.budget;

                this.logger.log(`Cannot perform action [ ${action.name} ]. Need more funds:`);
                this.logger.log(`cost: ₿ ${Math.round(price).toLocaleString('en')} `)
                this.logger.log(`have: ₿ ${this.logger.pad(length, Math.round(this.budget).toLocaleString('en'), true)} `)
                this.logger.line();
                this.logger.log(`need: ₿ ${this.logger.pad(length, String(required), true)}`)
                this.logger.notify(`Insufficient funds, need ${required.toLocaleString('en') } extra (${action.price.toLocaleString('en')} - ${this.budget.toLocaleString('en')})`)

                // disable the loop
                this.enabled = false;
                this.priceOfLastAction = action.price;
                return {
                    success: false,
                    message: `Price of optimal action too high for budget`
                }
            }
            this.logger.log(`budget: ${this.budget}`)
            const amountOfCharacters = String(this.budget).length;
            // more logging
            this.logger.log(`Optimal action determined: '${action.name}'`)
            this.logger.log(`This would amount to:`)
            this.logger.log(`have: ₿ ${this.budget}`)
            this.logger.log(`cost: ₿ ${price} -`)
            this.logger.line();
            this.logger.log(`left: ₿ ${this.logger.pad(amountOfCharacters, String(this.budget - price), true)}`)

            // do the actual thing
            const result = await this.performAction(action);
            // do some processing for reporting purposes
            this.analyzeAction(action);
            // update the local budget
            this.budget = this.budget - action.price;
            // return success
            return result;
        }catch (e) {
            return this.eh.handle(e, 'SRVACT');
        }
    }

    toggle(): void{ this.enabled = !this.enabled; }
    enable(enabled = true): void { this.enabled = enabled; }
    addBudget(amount: number): void { this.budget += amount; }

    // stub functions => implementation located in extended Managers
    determineOptimalAction(): IServerManagerAction | undefined{
        return {
            name: `Implement first`,
            price: 0 
        }
    }
    determinePhase(): void {
        // to be implemented in extended manager
    }
    async performAction(action: IServerManagerAction): Promise<ISimpleJSONReturn> {
        return {
            success: false,
            message: `Implement first`
        }
    }

    /**
     * Function to get a commom interface for the functionality
     * @param name unique string to identify
     * @param price the amount the action costs
     * @param node (if applicable) the server/node the action affects
     * @returns 
     */
    formatAction(name: string, price = 0, node?: ExtendedHacknetServer): IServerManagerAction {
        return {
            name: name,
            price: price,
            node: node
        };
    }

    /**
     * Check if a server exists
     * @param host servername
     * @returns
     */
    serverExists(host: string): boolean{
        return this.ns.serverExists(host);
    }
}