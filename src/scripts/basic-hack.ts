import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([["target", "n00dles"]]);

  const moneyMax = ns.getServerMaxMoney(args["target"]);
  const securityMin = ns.getServerMinSecurityLevel(args["target"]);
  const securityMax = Math.max(securityMin + 5, securityMin * 1.2);
  const hackLevel = 0.8;

  while (true) {
    // if it is too strong, weaken it
    if (ns.getServerSecurityLevel(args["target"]) > securityMax) {
      await ns.weaken(args["target"]);
    } else {
      // otherwise decide whether to hack or grow
      const targetMoney = ns.getServerMoneyAvailable(args["target"]);
      if (targetMoney < moneyMax * hackLevel) {
        await ns.grow(args["target"]);
        continue;
      }

      const hackChance = (targetMoney / moneyMax) * (targetMoney / moneyMax);
      const rand = Math.random();
      if (rand <= hackChance) {
        await ns.hack(args["target"]);
      } else {
        await ns.grow(args["target"]);
      }
    }
  }
}
