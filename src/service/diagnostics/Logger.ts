import { ISimpleJSONReturn } from "/types";

/**
 * Used to log and print output to the terminal
 * 
 */
 export default class Logger{
    ns: NS;
    context: string;
    verbose: number;
    prefix: string;
    timestamp: boolean;
    /**
     * Constructor
     * @param ns
     * @param verbose whether we want output (0 = none; 1 = only notifications; 2 = all output)
     * @param context where the logger is created
     * @param timestamp whether we want to timestamp the messages
     */
    constructor(ns: NS, verbose = 0, context = '', timestamp = false){
        this.ns = ns;
        this.context = context;
        this.verbose = verbose;
        this.prefix = `[${this.context}] - `;
        this.timestamp = timestamp;
    }

    /**
     * Log message to script logs, and output it to the terminal if this.verbose === true
     * @param msg the message to log
     * @param timestamp whether we want to prepend a timestamp
     */
    log(msg: string, timestamp = false): void{
        let stamp = '';
        const line = stamp + '[LOGGER] ' + this.prefix + msg;
        if(timestamp || this.timestamp)
            stamp = `[ ${this.currentTime()} ] `;
        if(this.verbose === 2){
            this.ns.tprintf(line);
        }
        this.ns.print(line);
       
    }

    /**
     * Write a line to the terminal
     * @param length length of the line
     * @param notify if we want to show it in 'log()' or 'notify();
     * @param symbol the symbol the line is constructed from
     */
    line(length = 30, notify = false, symbol = '=') : void {
        let line = '';
        for(let index = 0; index < length; index++) {
            line = `${line}${symbol}`
        }
        
        if(notify) {
            this.notify(line);
        }else{
            this.log(line);
        }
    }
    /**
     * Show a message to the user
     * @param msg the message to show the user
     * @param timestamp whether we want to prepend the message with a timestamp
     * @param fullStamp whether we want just the time or time + date
     */
    notify(msg: string, timestamp = false, fullStamp = false) : void{
        let stamp = '';
        if(timestamp || this.timestamp)
            stamp = `[ ${this.currentTime(fullStamp)} ] `;

        const line = stamp + '[NOTIFY] ' + this.prefix + msg;
        if(this.verbose > 0){
            this.ns.tprintf(line);
        }
       
    }

    /**
     * Pad a string
     * @param {int} amount amount to pad to
     * @param {string} str the string to pad
     * @param {bool} padLeft whether we want to pad on the left side
     * @param {string} padding the character to pad with
     * @returns the padded string
     */
    pad(amount: number, str: string, padLeft = false, padding = ' ') : string{
        let output = '';
        if(typeof str !== 'undefined'){
            if(str.length === amount)
            return str;
            while((str + output).length < amount) {
                output = output + padding;
            }
            if(padLeft) {
                return output + str;
            }
            return str + output;
        }
        return '';
    }

    /**
     * Generate a human readable timestamp string
     * @param full whether we want just time or time + date
     * @returns a human readable string with the current (date +) time
     */
    currentTime(full = false) : string {
        const currentDate = new Date();
        const cDay   = this.pad(2, String(currentDate.getDate()), true, '0');
        const cMonth = this.pad(2, String(currentDate.getMonth() + 1), true, '0');
        const cHour  = this.pad(2, String(currentDate.getHours()), true, '0');
        const cMin   = this.pad(2, String(currentDate.getMinutes()), true, '0');
        const cSec   = this.pad(2, String(currentDate.getSeconds()), true, '0');
        if(full) 
            return `${cDay} / ${cMonth} T ${cHour}:${cMin}:${cSec}`
        
        return `${cHour}:${cMin}:${cSec}`
    }

    /**
     * Format a price, so that it is more easily readable by the hoomans
     * @param {float} amount price to format
     * @returns {string} formatted price
     */
    formatPrice(amount: number, pad = true, decimals = 2, padding = 8) : string{
        const negative = amount >= 0 ? false : true;
        // handle just if it was a positive amount
        amount = negative ? amount * -1 : amount;
        let output = String(amount);
        const million = 1000000;
        const billion = 1000000000;
        const trillion = 1000000000000;
        const quadrillion = 1000000000000000;
        if(amount >= quadrillion) {
            amount = amount / quadrillion;
            output = `${amount.toFixed(decimals)}q`
        }else if(amount >= trillion) {
            amount = amount / trillion;
            output = `${amount.toFixed(decimals)}t`
        } else if(amount >= billion) {
            amount = amount / billion;
            output = `${amount.toFixed(decimals)}b`
        }else if(amount >= million) {
            amount = amount / million;
            output = `${amount.toFixed(decimals)}m`
        }else {
            output = `${amount.toFixed(decimals)}`
        }
        // add the minus sign again
        output = negative ? `-${output}` : output;
        if(pad) {
            return this.pad(padding + decimals, output, true);
        }
        return output;
    }

    /**
     * Format an amount, so that it is more easily readable by the hoomans
     * @param {float} ram amount of RAM to format (in GB)
     * @returns {string} formatted string
     */

    formatRam(ram: number, decimals = 4, pad = false) : string{
        let string = `${ram.toFixed(decimals)} GB`
        if(ram >= 1024 * 1024) {
            string = `${(ram / (1024 * 1024)).toFixed(decimals)} PB`;
        }else if(ram >= 1024) {
            string =`${(ram / 1024).toFixed(decimals)} TB`;
        }
        if(pad) {
            return `${this.pad(7 + decimals, string, true)}`;
        }
        return string;
    }

    handleResult(result: ISimpleJSONReturn) : void {
        let messageType = ''; 
        if(result.success) {
           messageType = 'INFO';
        }else {
            messageType = 'WARN';
        }
        this.ns.tprintf(`${messageType} [ ${this.context} ] - ${result.message}`)
    }

    /**
     * Disable logging for specific functions. Use 'ALL' to disable logging for all functions.
     * NOTE(1): this does not completely disable logging, just the successful return logs. Failures will still be logged.
     * NOTE(2): Notable functions that cannot have logs disabled: run, exec, exit
     * @param {*} fn function for which to disable logging
     */
    disableLog(fn: string) : void{
        this.ns.disableLog(fn)
    }
    /**
     * Enables log for specific function, or revert effects of disableLog('ALL') when called with fn: 'ALL'
     * @param {string} fn function for which to enable logging
     */
    enableLog(fn: string) : void {
        this.ns.enableLog(fn);
    }



}