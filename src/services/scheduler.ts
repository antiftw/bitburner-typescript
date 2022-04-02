import { NS } from "@ns";
import { packMessage, unpackMessage } from "/modules/messaging";

export async function main(ns: NS): Promise<void> {
  // we do our own logging
  ns.disableLog("ALL");
  ns.print("----------Starting scheduler----------");

  // start up the port and clear it
  const p2Handle = ns.getPortHandle(2);
  p2Handle.clear();
  ns.print("Port 2 opened and cleared");

  // handle incoming service requests
  while (true) {
    // check for port data, if not from us, it's for us
    const parsed = unpackMessage<number>(ns, p2Handle.peek());
    if (parsed && parsed.source !== ns.getScriptName()) {
      p2Handle.read(); // consume message

      // handle message in
      const timeDiff = Date.now() - (parsed.data as number);
      ns.print(`Received message ${JSON.stringify(parsed)}`);
      ns.print(`Time diff: ${timeDiff}`);

      // respond to message
      const response = packMessage(ns, `Response to ${parsed.source}`, {
        sourceMessage: parsed,
        data: Date.now(),
      });
      p2Handle.write(response);
      ns.print(`Responded with ${response}`);
    }

    await ns.sleep(1);
  }
}
