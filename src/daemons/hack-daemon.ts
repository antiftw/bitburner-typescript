import { NS, Server } from "@ns";
import { getStats } from "/modules/helper.js";
import { Job, ScriptInfo, ScriptsInfo } from "/types.js";

const weakenSecurityEffect = 0.05;
const growSecurityEffect = 0.004;
const hackSecurityEffect = 0.002;
const scheduleBufferTime = 500;
const executeBufferTime = 100;

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([
    ["target", "joesguns"],
    ["ramBudget", 0.8],
    ["loop", false],
    ["hosts", ["pserv-0", "pserv-1"]],
    ["useScheduler", false],
    ["schedulerPort", 2],
  ]);

  let stats = getStats(ns, [args["target"], ...args["hosts"]]);

  // we do our own logging
  ns.disableLog("ALL");
  ns.print("----------Starting hack-daemon----------");

  // copy scripts to hosts
  const hackScript = {
    name: "/scripts/basic/hack.js",
    ram: ns.getScriptRam("/scripts/basic/hack.js", "home"),
  } as ScriptInfo;
  const growScript = {
    name: "/scripts/basic/grow.js",
    ram: ns.getScriptRam("/scripts/basic/grow.js", "home"),
  } as ScriptInfo;
  const weakenScript = {
    name: "/scripts/basic/weaken.js",
    ram: ns.getScriptRam("/scripts/basic/weaken.js", "home"),
  } as ScriptInfo;
  const scripts = { hackScript, growScript, weakenScript } as ScriptsInfo;
  ns.print("Copying scripts to hosts");
  for (const host of args["hosts"]) {
    await ns.scp(
      [hackScript.name, growScript.name, weakenScript.name],
      "home",
      host
    );
  }

  // grow target to max money (while keeping security low)
  await growToMaxMoney(
    ns,
    args["target"],
    args["hosts"],
    args["ramBudget"],
    scripts
  );

  // reduce target to minimum security level
  await reduceToMinSecurity(
    ns,
    args["target"],
    args["hosts"],
    args["ramBudget"],
    scripts
  );

  // HWGW cycle
  do {
    // update stats
    stats = getStats(ns, [args["target"], ...args["hosts"]]);

    // if money is not at max, grow it here and notify
    if (
      stats.servers[args["target"]].moneyAvailable <
      stats.servers[args["target"]].moneyMax
    ) {
      ns.print("-----TARGET NOT AT MAX MONEY AFTER HWGW CYCLE-----");
      await growToMaxMoney(
        ns,
        args["target"],
        args["hosts"],
        args["ramBudget"],
        scripts
      );
    }

    // if security is not at minimum, drop it here and notify
    if (
      stats.servers[args["target"]].hackDifficulty >
      stats.servers[args["target"]].minDifficulty
    ) {
      ns.print("-----TARGET NOT AT MIN SECURITY AFTER HWGW CYCLE-----");
      await reduceToMinSecurity(
        ns,
        args["target"],
        args["hosts"],
        args["ramBudget"],
        scripts
      );
    }

    // find max ram chunk
    const hostsStats = (args["hosts"] as string[]).map((h) => stats.servers[h]);
    hostsStats.sort((a, b) => b.maxRam - b.ramUsed - (a.maxRam - a.ramUsed));
    const maxRamChunk = hostsStats[0].maxRam - hostsStats[0].ramUsed;
    ns.print(`Hosts: ${args["hosts"]}.`);
    ns.print(
      `${hostsStats[0].hostname} has most ram available: ${maxRamChunk}`
    );

    // calc grow effect for max ram
    const gThreads = Math.floor(maxRamChunk / growScript.ram);
    if (gThreads <= 0) {
      ns.print(`Grow threads calculated at ${gThreads}, skipping`);
      continue;
    }
    const gTime = ns.formulas.hacking.growTime(
      stats.servers[args["target"]],
      stats.player
    );
    const gPercent = ns.formulas.hacking.growPercent(
      stats.servers[args["target"]],
      gThreads,
      stats.player,
      1
    );

    // find threads to hack equal to grow
    const hPercent = 1 - 1 / gPercent;
    const hThreads = Math.floor(
      ns.hackAnalyzeThreads(
        stats.servers[args["target"]].hostname,
        stats.servers[args["target"]].moneyMax * hPercent
      )
    );
    const hTime = ns.formulas.hacking.hackTime(
      stats.servers[args["target"]] as Server,
      stats.player
    );
    if (hThreads <= 0) {
      ns.print(`Hack threads calculated at ${gThreads}, skipping`);
      continue;
    }

    // find threads of weaken to offset hack and grow
    const hOffsetThreads = Math.ceil(
      (hackSecurityEffect * hThreads) / weakenSecurityEffect
    );
    const gOffsetThreads = Math.ceil(
      (growSecurityEffect * gThreads) / weakenSecurityEffect
    );
    const wTime = ns.formulas.hacking.weakenTime(
      stats.servers[args["target"]] as Server,
      stats.player
    );

    // output stats about jobs
    ns.print(
      `HACK:    ${hThreads} threads, ${hTime.toFixed(2)}ms, ${(
        hPercent * 100
      ).toFixed(2)}% hacked`
    );
    ns.print(
      `WEAKEN1: ${hOffsetThreads} threads, ${wTime.toFixed(2)}ms, ${(
        hOffsetThreads * weakenSecurityEffect
      ).toFixed(2)} weakened`
    );
    ns.print(
      `GROW:    ${gThreads} threads, ${gTime.toFixed(2)}ms, ${(
        gPercent * 100
      ).toFixed(2)}% growth`
    );
    ns.print(
      `WEAKEN2: ${gOffsetThreads} threads, ${wTime.toFixed(2)}ms, ${(
        gOffsetThreads * weakenSecurityEffect
      ).toFixed(2)} weakened`
    );

    // schedule jobs
    const now = Date.now();
    const endHackTime =
      now + Math.max(hTime, wTime, gTime) + scheduleBufferTime;
    const startHackTime = endHackTime - hTime;
    const startWeaken1Time = endHackTime + executeBufferTime - wTime;
    const startGrowTime = endHackTime + executeBufferTime * 2 - gTime;
    const startWeaken2Time = endHackTime + executeBufferTime * 3 - wTime;
    const scheduledJobs = [
      {
        name: `hack ${stats.servers[args["target"]].hostname}`,
        scriptName: hackScript.name,
        startTime: startHackTime,
        duration: hTime,
        threads: hThreads,
        target: stats.servers[args["target"]].hostname,
        host: args["hosts"][1],
      },
      {
        name: `weaken1 ${stats.servers[args["target"]].hostname}`,
        scriptName: weakenScript.name,
        startTime: startWeaken1Time,
        duration: wTime,
        threads: hOffsetThreads,
        target: stats.servers[args["target"]].hostname,
        host: args["hosts"][1],
      },
      {
        name: `grow ${stats.servers[args["target"]].hostname}`,
        scriptName: growScript.name,
        startTime: startGrowTime,
        duration: gTime,
        threads: gThreads,
        target: stats.servers[args["target"]].hostname,
        host: args["hosts"][0],
      },
      {
        name: `weaken2 ${stats.servers[args["target"]].hostname}`,
        scriptName: weakenScript.name,
        startTime: startWeaken2Time,
        duration: wTime,
        threads: gOffsetThreads,
        target: stats.servers[args["target"]].hostname,
        host: args["hosts"][1],
      },
    ] as Job[];

    // TODO: determine hosts for each job

    // dispatch jobs
    scheduledJobs.sort((a, b) => a.startTime - b.startTime);
    ns.print(scheduledJobs);
    // ns.print(
    //   scheduledJobs.map((j) => {
    //     j.endTime = new Date(j.startTime + j.duration).toISOString();
    //     return j;
    //   })
    // );
    while (scheduledJobs.length > 0) {
      const job = scheduledJobs.shift() as Job;
      ns.print(`Handling job: ${job.name}`);

      // sleep until job start time
      await sleepUntil(ns, job.startTime);

      // execute job
      ns.print(`Executing job: ${job.name}`);
      ns.exec(
        job.scriptName,
        job.host,
        job.threads,
        "--target",
        job.target,
        "--id",
        `${job.name} ${new Date(job.startTime + job.duration).toISOString()}`
      );
    }

    // wait until jobs are finished, display stats
    await sleepUntil(ns, endHackTime);
    for (let i = 0; i < 5; i++) {
      await sleepUntil(ns, endHackTime + executeBufferTime * i);
      printServerStats(ns, stats.servers[args["target"]]);
    }

    // padding with sleep, sometimes we go too quickly
    await ns.sleep(scheduleBufferTime);

    // TODO: calc how many targets we can effectively hack
  } while (args["loop"]);

  ns.print("----------End hack-daemon----------");
}

function printServerStats(ns: NS, stats: Server) {
  const mp = (stats.moneyAvailable / stats.moneyMax) * 100;
  const money = stats.moneyAvailable;
  const maxMoney = stats.moneyMax;

  const sp = (stats.hackDifficulty / stats.minDifficulty) * 100;
  const sec = stats.hackDifficulty;
  const minSec = stats.minDifficulty;

  ns.print(` Stats for ${stats.hostname}:`);
  ns.print(
    `   Money:    ${mp.toFixed(2)}% - ${money.toFixed(2)} / ${maxMoney}`
  );
  ns.print(`   Security: ${sp.toFixed(2)}% - ${sec.toFixed(2)} / ${minSec}`);
}

async function sleepUntil(ns: NS, timeMS: number, useAsleep = false) {
  const sleepTime = Math.floor(timeMS - Date.now());
  if (sleepTime > 0) {
    ns.print(`Sleeping ${sleepTime} until ${new Date(timeMS).toISOString()}`);
    useAsleep ? await ns.asleep(sleepTime) : await ns.sleep(sleepTime);
  }
}

async function growToMaxMoney(
  ns: NS,
  target: string,
  hosts: string[],
  ramBudget: number,
  scripts: ScriptsInfo
) {
  let stats = getStats(ns, [target, ...hosts]);
  ns.print(`Growing ${target} to maximum money`);
  while (
    stats.servers[target].moneyAvailable < stats.servers[target].moneyMax
  ) {
    printServerStats(ns, stats.servers[target]);
    const hostsInfo = hosts.map((s) => {
      const ramAvail =
        (stats.servers[s].maxRam - stats.servers[s].ramUsed) * ramBudget;
      return {
        hostname: s,
        ramAvail: ramAvail,
        wThreads: Math.floor(ramAvail / scripts.weakenScript.ram),
        gThreads: Math.floor(ramAvail / scripts.growScript.ram),
      };
    });
    const totals = hostsInfo.reduce((a, b) => {
      return {
        hostname: "",
        ramAvail: a.ramAvail + b.ramAvail,
        wThreads: a.wThreads + b.wThreads,
        gThreads: a.gThreads + b.gThreads,
      };
    });
    ns.print(`Will use ${totals.ramAvail}GB across ${hosts.length} hosts.`);
    ns.print(`wThreads: ${totals.wThreads}, gThreads ${totals.gThreads}`);

    // if weaken will have full effect or security is too high
    if (
      stats.servers[target].hackDifficulty /
        stats.servers[target].minDifficulty >
        1.5 ||
      stats.servers[target].hackDifficulty -
        weakenSecurityEffect * totals.wThreads >
        stats.servers[target].minDifficulty
    ) {
      const wTime = ns.formulas.hacking.weakenTime(
        stats.servers[target],
        stats.player
      );
      hostsInfo.forEach((host) => {
        if (host.wThreads > 0)
          ns.exec(
            scripts.weakenScript.name,
            host.hostname,
            host.wThreads,
            "--target",
            target
          );
      });
      ns.print(
        `Weakening server to drop security by ${
          weakenSecurityEffect * totals.wThreads
        }`
      );

      ns.print(
        `Sleeping ${Math.ceil(
          wTime + scheduleBufferTime
        )}ms until weaken is finished`
      );
      await ns.sleep(Math.ceil(wTime + scheduleBufferTime));
    } else {
      // otherwise, continue to grow
      const gTime = ns.formulas.hacking.growTime(
        stats.servers[target],
        stats.player
      );
      hostsInfo.forEach((host) => {
        if (host.gThreads > 0)
          ns.exec(
            scripts.growScript.name,
            host.hostname,
            host.gThreads,
            "--target",
            target
          );
      });
      ns.print(`Growing server with ${totals.gThreads} threads`);

      ns.print(
        `Sleeping ${Math.ceil(
          gTime + scheduleBufferTime
        )}ms until grow is finished`
      );
      await ns.sleep(Math.ceil(gTime + scheduleBufferTime));
    }

    stats = getStats(ns, [target, ...hosts]);
  }
  ns.print("-----Target at maximum money-----");
  printServerStats(ns, stats.servers[target]);
}

async function reduceToMinSecurity(
  ns: NS,
  target: string,
  hosts: string[],
  ramBudget: number,
  scripts: ScriptsInfo
) {
  ns.print(`Reducing ${target} to minimum security`);
  let stats = getStats(ns, [target, ...hosts]);

  while (
    stats.servers[target].hackDifficulty > stats.servers[target].minDifficulty
  ) {
    printServerStats(ns, stats.servers[target]);
    const hostsInfo = hosts.map((s) => {
      const ramAvail =
        (stats.servers[s].maxRam - stats.servers[s].ramUsed) * ramBudget;
      return {
        hostname: s,
        ramAvail: ramAvail,
        wThreads: Math.floor(ramAvail / scripts.weakenScript.ram),
      };
    });
    const wThreadsTotal = hostsInfo
      .map((info) => info.wThreads)
      .reduce((a, b) => a + b);

    const wTime = ns.formulas.hacking.weakenTime(
      stats.servers[target],
      stats.player
    );
    hostsInfo.forEach((host) => {
      if (host.wThreads > 0)
        ns.exec(
          scripts.weakenScript.name,
          host.hostname,
          host.wThreads,
          "--target",
          target
        );
    });
    ns.print(
      `Weakening server to drop security by ${
        weakenSecurityEffect * wThreadsTotal
      }`
    );

    ns.print(
      `Sleeping ${Math.ceil(
        wTime + scheduleBufferTime
      )}ms until weaken is finished`
    );
    await ns.sleep(Math.ceil(wTime + scheduleBufferTime));

    stats = getStats(ns, [target, ...hosts]);
  }
  ns.print("-----Target at minimum security-----");
  printServerStats(ns, stats.servers[target]);
}
