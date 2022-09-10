import { ExceptionHandler } from "service/diagnostics/ExceptionHandler";
import Logger from "service/diagnostics/Logger";
import Configurator from "service/core/Configurator";
import { FileManager } from "service/core/FileManager";
import { ISimpleJSONReturn } from "types";

/**
 * Handles the budget related functionality
 */
export class BudgetManager {
    ns: NS;
    verbose: number;
    context: string;
    enabled: boolean;

    cfg: Configurator;
    file: FileManager;
    logger: Logger;
    eh: ExceptionHandler;
    // Budget variables
    totalFunds: number;
    botnetBudget: number;
    generalBudget: number;
    hacknetBudget: number;
    programBudget: number;
    // The following are just variables to save configuration values, to clean up the code a bit
    hacknetPercentage: number;
    botnetPercentage: number;
    programPercentage: number;
    home: string;
    botnetFile: string;
    hacknetFile: string;
    programFile: string;
    generalFile: string;
    

    constructor(ns: NS, verbose = 0, enabled = true) {
        this.ns = ns;
        this.verbose = verbose;
        this.context = 'BUDGET'
        this.enabled = enabled;
        this.cfg = new Configurator(ns, verbose);
        this.file = new FileManager(ns, verbose);
        this.logger = new Logger(ns, verbose, this.context)
        this.eh = new ExceptionHandler(ns, this.context)

        // Budget variables
        this.totalFunds = 0;
        this.botnetBudget = 0;
        this.generalBudget = 0;
        this.hacknetBudget = 0;
        this.programBudget = 0;
        // The following are just variables to save configuration values, to clean up the code a bit
        this.hacknetPercentage = 0;
        this.botnetPercentage = 0;
        this.programPercentage = 0;
        this.home = 'home'
        this.botnetFile = '';
        this.hacknetFile = '';
        this.programFile = '';
        this.generalFile = '';
    }
    /**
     * Run the actual Handler, divide and assign the budgets
     */
    async run(): Promise<ISimpleJSONReturn>{
        await this.init();
        if(this.generalBudget > 0) {
            try{
                const toSpend = this.generalBudget;
                this.logger.log(`Dividing budget: ${toSpend} to spend ...`)

                // Divide budget between the different managers
                this.divideBudget();
                // Write to file, so other programs can pick it up.
                await this.writeBudgetFiles();
                return {
                    success: true,
                    message: `Successfully divided ${this.logger.formatPrice(toSpend)} funds`
                }
            }catch(e) {
                return this.eh.handle(e, 'RUN')
            }
        }else{
            this.logger.notify(`No budget to divide, skipping`)
            return {
                success: true,
                message: `Nothing to do, skipping`
            };
        }
    }
    /**
     * Initialize Handler, also initializing the budgetfiles if specified
     * @param force if we want to overwrite the files
     */
    async init(force = false): Promise<void>{
        this.logger.log(`Initializing`);
        this.logger.log(`Loading configuration`)
        this.loadConfig();
        
        if(!this.ns.fileExists(this.botnetFile, this.home) || force){
            await this.writeBudgetFile(this.botnetFile, 0);
        }
        if(!this.ns.fileExists(this.generalFile, this.home) || force){
            await this.writeBudgetFile(this.generalFile, 0);
        }
        if(!this.ns.fileExists(this.hacknetFile, this.home) || force){
            await this.writeBudgetFile(this.hacknetFile, 0);
        }
        if(!this.ns.fileExists(this.programFile, this.home) || force){
            await this.writeBudgetFile(this.programFile, 0);
        }
        this.loadData();
        this.logger.log(`BudgetHandler initialized`);
    }

    /**
     * Loads all required data
     */
    loadData(): ISimpleJSONReturn {
        
        this.logger.log(`Loading Budgetfiles`)
        this.readBudgetFiles();
          // Get the actual available funds of the player

        this.totalFunds = this.getTotalFunds();
        if(this.hacknetPercentage + this.botnetPercentage + this.programPercentage !== 100) {
            const actualSum = this.hacknetPercentage + this.botnetPercentage + this.programPercentage;
            const sum = `${this.hacknetPercentage} + ${this.botnetPercentage} + ${this.programPercentage} = ${actualSum}`
            return {
                success: false,
                message: `Error with percentages, total must add up to exactly 100, while: ${sum}`
            };
          
        }
        return {
            success: true,
            message: `Data loaded`
        }
    }
    /**
     * Loads configuration and creates local variables
     */
    loadConfig(): void {
        try{
            // read the configuration file
            
            // assign local variables, mostly for better readability
            this.botnetFile = this.cfg.getConfiguration('botnet_file', 'budget').getStringValue();
            this.hacknetFile = this.cfg.getConfiguration('hacknet_file', 'budget').getStringValue();
            this.programFile = this.cfg.getConfiguration('program_file', 'budget').getStringValue();
            this.generalFile = this.cfg.getConfiguration('general_file', 'budget').getStringValue();
            this.hacknetPercentage = Number(this.cfg.getConfiguration('hacknet_percentage', 'budget'));
            this.botnetPercentage = Number(this.cfg.getConfiguration('botnet_percentage', 'budget'));
            this.programPercentage = Number(this.cfg.getConfiguration('program_percentage', 'budget'));
        }catch(e) {
            this.eh.handle(e, 'INITIALIZE');
        }
    }

    /**
     * Divide the budget between the different managers to spend.
     */
    divideBudget(): ISimpleJSONReturn{

        if(this.generalBudget === 0) {
            return {
                success: false,
                message: `Cannot divide funds when this.generalBudget is zero.`
            }
        }
        this.logger.log(`Sufficient budget available: ${this.generalBudget}`)
        try{
            this.logger.log(`Calculating assigned budgets`)
            const toDivide = this.logger.formatPrice(this.generalBudget);
            const botnetAmount = Number(this.botnetPercentage) / 100 * Number(this.generalBudget);
            const hacknetAmount = Number(this.hacknetPercentage) / 100 * Number(this.generalBudget);
            const programAmount = Number(this.programPercentage) / 100 * Number(this.generalBudget);
            const resultMessage = `Divided ${toDivide} -> Budgets assigned: [ HACKNET: ${hacknetAmount} ][ BOTNET: ${botnetAmount} ][ PROGRAM: ${programAmount} ] `
            this.logger.log(`Calculated: assigning budgets`)
            this.assignBudget(botnetAmount, 'botnet');
            this.assignBudget(hacknetAmount, 'hacknet');
            this.assignBudget(programAmount, 'program');
            this.logger.notify(resultMessage)
            this.logger.log(`Budget left: ${this.generalBudget} (should be 0)`)
            return {
                success: true,
                message: resultMessage
            }
        }catch(e) {
            return this.eh.handle(e, 'DIVIDE');
        }
    }

    /**
     * Assign budget to a certain Manager, so it can spend it.
     * @param {int} amount
     * @param {string} managerName
     */
    assignBudget(amount: number, managerName: string): ISimpleJSONReturn {
        amount = Number(amount);
        this.logger.log(`Assigning ₿ ${amount} to ${managerName}`)
        try{
            if(managerName === 'botnet') {
                this.botnetBudget = this.botnetBudget + amount;
            } else if (managerName === 'hacknet') {
                this.hacknetBudget = this.hacknetBudget + amount;
            } else if (managerName === 'program') {
                this.programBudget = this.programBudget + amount;
            }
            this.generalBudget = this.generalBudget - amount;
            this.logger.log(`Budget assigned, funds left: ₿ ${this.generalBudget}`)
            return {
                success: true,
                message: `Successfully assigned ${amount} to  [ ${managerName} ] .`
            }
        }catch(e){
            return this.eh.handle(e, 'ASSIGN-BUDGET');
        }
    }
    /**
     * Increases this.generalBudget, so that the BudgetHandler can divide it between the different parts of the Application
     * @param {int} amount
     * @returns
     */
    async increaseBudget(amount: number, mode = 0): Promise<ISimpleJSONReturn> {
        if(amount === 0) {
            return {
                success: true,
                message: `No budget to add, hybernating` 
            };
        }
        try{
            if(amount > this.totalFunds) {
                return {
                    success: false, 
                    message: `Cannot add ${amount} to budget, only ₿ ${this.totalFunds.toFixed(0)} available`
                }
            }
            let returnMessage = 'Something went wrong';
            if(mode === 0) {
                this.generalBudget = Number(this.generalBudget) + Number(amount);
                await this.writeBudgetFile(this.generalFile, this.generalBudget);
                returnMessage =
                    `Succesfully added ${amount.toLocaleString('en')} to the budget, which is now a total of ${this.generalBudget.toLocaleString('en')}`
                ;
            }else if( mode === 1 ) {
                this.hacknetBudget = Number(this.hacknetBudget + Number(amount));
                await this.writeBudgetFile(this.hacknetFile, this.hacknetBudget);
                returnMessage =
                    `Succesfully added ${amount.toLocaleString('en')} to the hacknetbudget, which is now a total of ${this.hacknetBudget.toLocaleString('en')}`
                ;
            }else if (mode === 2 ) {
                this.botnetBudget = Number(this.botnetBudget + Number(amount));
                await this.writeBudgetFile(this.botnetFile, this.botnetBudget);
                returnMessage =
                    `Succesfully added ${amount.toLocaleString('en')} to the botnetbudget, which is now a total of ${this.botnetBudget.toLocaleString('en')}`
                ;
            }
            return {
                success: true,
                message: returnMessage
            }
        }catch(e){
            return this.eh.handle(e, 'INCREASE-BUDGET');
        }
    }

    lookupBudget(type: string): void {
        if(typeof type === 'undefined') {
            this.logger.notify(`[BUDGET] Please specify a type as argument for this command. Type --help for usage options.`)
            return;
        }
        if(type ==='--help') {
            this.logger.notify(`[BUDGET] Use this functionality to lookup howmuch budget there is available You can choose from "general", "hacknet" and "botnet"`)
        }
        if(type !== 'general' && type !== 'hacknet' && type !== 'botnet') {
            type = 'all';
        }
        if (type === 'general' || type === 'all'){
            this.logger.notify(`General budget: ${this.generalBudget}`)
        }
        if (type === 'hacknet' || type === 'all'){
            this.logger.notify(`Hacknet budget: ${this.hacknetBudget}`)
        }
        if (type === 'botnet' || type === 'all'){
            this.logger.notify(`Botnet budget: ${this.botnetBudget}`)
        }
    }

    /**
     * Get the amount of money currently available by the player
     * @returns {float} amount
     */
    getTotalFunds(): number{
        return this.getServerMoneyAvailable(this.home);
    }
    /**
     * Get the amount of money currently available on the server
     * @param {string} hostname the name of the server to check
     * @returns {float} amount
     */
    getServerMoneyAvailable(hostname: string): number{
        return this.ns.getServerMoneyAvailable(hostname)
    }

    /**
     * Reads the budget files, saving the budgets in our local datastructure
     */
    readBudgetFiles(): ISimpleJSONReturn {
        try{
            this.loadConfig();
            this.botnetBudget = Number(this.file.read(this.botnetFile));
            this.generalBudget = Number(this.file.read(this.generalFile));
            this.hacknetBudget = Number(this.file.read(this.hacknetFile));
            this.programBudget = Number(this.file.read(this.programFile));
            if(this.generalBudget > 0) {
                // If the budget was increased, we need to split it up, so we break the handler out of sleep mode
                this.enabled = true;
            }
            return {
                success: true,
                message: `Successfully read budgetfiles.`
            }
        }catch(e){
            return this.eh.handle(e, 'READ-BUDGET-FILES')
        }

    }
    /**
     * Write the local budgets to file, so other parts of the application can use them
     */
    async writeBudgetFiles(): Promise<ISimpleJSONReturn>{
       try{
            this.logger.log(`Writing new budgetdata to file`);
            await this.writeBudgetFile(this.botnetFile, this.botnetBudget);
            await this.writeBudgetFile(this.generalFile, this.generalBudget);
            await this.writeBudgetFile(this.hacknetFile, this.hacknetBudget);
            await this.writeBudgetFile(this.programFile, this.programBudget);
            return {
                success: true,
                message: `New budgetdata written to file`
            }
       }catch(e) {
           return this.eh.handle(e, 'WRITE-BUDGET-FILES');
       }
    }

    /**
     * Write a specific amount to a certain budgetfile
     * @param {string} file path + name of the file to write
     * @param {int} amount allocated budget
     */
    async writeBudgetFile(file: string, amount: number): Promise<ISimpleJSONReturn> {
        try{
            this.logger.log(`Writing  ${amount} to ${file}`)
            await this.file.write(file, String(amount), 'w');
            return {
                success: true,
                message: `Successfully written ${amount} to ${file}`
            }
        }catch(e) {
            return this.eh.handle(e, 'WRITE-BUDGET-FILE');
        }
    }

    toggle(): void{
        this.enabled = !this.enabled;
    }

}