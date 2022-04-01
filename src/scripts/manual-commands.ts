import { NS } from "@ns";
import { connectToSever } from "/modules/helper";

export async function main(ns: NS): Promise<void> {
  ns.tprintf(
    "Purchase:      buy BruteSSH.exe; buy FTPCrack.exe; buy relaySMTP.exe; buy HTTPWorm.exe; buy SQLInject.exe; buy ServerProfiler.exe; buy DeepscanV1.exe; buy DeepscanV2.exe; buy AutoLink.exe; buy Formulas.exe; buy -l;"
  );

  const toCSEC = await connectToSever(ns, "CSEC");
  ns.tprintf(
    "To CSEC:       %s; backdoor;",
    toCSEC.reduce((p, c) => `${p}; connect ${c}`)
  );

  const toNiteSec = await connectToSever(ns, "avmnite-02h");
  ns.tprintf(
    "To NiteSec:    %s; backdoor;",
    toNiteSec.reduce((p, c) => `${p}; connect ${c}`)
  );

  const toBlackHand = await connectToSever(ns, "I.I.I.I");
  ns.tprintf(
    "To Black Hand: %s; backdoor;",
    toBlackHand.reduce((p, c) => `${p}; connect ${c}`)
  );

  const toBitRunners = await connectToSever(ns, "run4theh111z");
  ns.tprintf(
    "To Bitrunners: %s; backdoor;",
    toBitRunners.reduce((p, c) => `${p}; connect ${c}`)
  );

  const toTheCave = await connectToSever(ns, "The-Cave");
  ns.tprintf(
    "To The Cave:   %s; backdoor;",
    toTheCave.reduce((p, c) => `${p}; connect ${c}`)
  );
}
