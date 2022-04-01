import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([["loop", true]]);

  // we do our own logging
  ns.disableLog("ALL");
  ns.print("----------Staring bladeburner daemon----------");

  // make sure we are in the bladeburner division
  while (!ns.bladeburner.joinBladeburnerDivision()) {
    ns.print("Not currently in bladeburner division, waiting to join");
    await ns.sleep(1000);
  }

  do {
    const [currentStamina, maxStamina] = ns.bladeburner.getStamina();
    const lowStamina = maxStamina * 0.5;
    const highStamina = maxStamina * 0.95;

    ns.print(`Stamina: ${currentStamina}/${maxStamina}`);
    ns.print(`Thresholds: [${lowStamina} - ${highStamina}]`);

    await ns.sleep(1000);
  } while (args["loop"]);
}
