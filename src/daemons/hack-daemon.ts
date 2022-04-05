import { NS, Server } from "@ns";
import { getStats } from "/modules/helper.js";
import {
  createMessage,
  getSchedulerMaxRam,
  sendReceive,
} from "/modules/messaging";
import {
  Job,
  ScheduledJob,
  SchedulerRequest,
  SchedulerResponse,
  ScriptInfo,
  ScriptsInfo,
} from "/types.js";

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
    scripts,
    args["useScheduler"],
    args["schedulerPort"]
  );

  // reduce target to minimum security level
  await reduceToMinSecurity(
    ns,
    args["target"],
    args["hosts"],
    args["ramBudget"],
    scripts,
    args["useScheduler"],
    args["schedulerPort"]
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
        scripts,
        args["useScheduler"],
        args["schedulerPort"]
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
        scripts,
        args["useScheduler"],
        args["schedulerPort"]
      );
    }

    let maxRamChunk = 0;
    if (args["useScheduler"]) {
      // get max ram chunk
      maxRamChunk = await getSchedulerMaxRam(ns, args["schedulerPort"]);
    } else {
      // find max ram chunk
      const hostsStats = (args["hosts"] as string[]).map(
        (h) => stats.servers[h]
      );
      hostsStats.sort((a, b) => b.maxRam - b.ramUsed - (a.maxRam - a.ramUsed));
      maxRamChunk = hostsStats[0].maxRam - hostsStats[0].ramUsed;
      ns.print(`Hosts: ${args["hosts"]}.`);
      ns.print(
        `${hostsStats[0].hostname} has most ram available: ${maxRamChunk}`
      );
    }

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

    // calc run times
    const now = Date.now();
    const endHackTime =
      now + Math.max(hTime, wTime, gTime) + scheduleBufferTime;
    const startHackTime = endHackTime - hTime;
    const startWeaken1Time = endHackTime - wTime + executeBufferTime;
    const startGrowTime = endHackTime - gTime + executeBufferTime * 2;
    const startWeaken2Time = endHackTime - wTime + executeBufferTime * 3;

    // aggregate jobs
    const hackJob = {
      scriptName: hackScript.name,
      startTime: startHackTime,
      endTime: endHackTime,
      threads: hThreads,
      ram: hThreads * hackScript.ram,
      args: [
        "--target",
        args["target"],
        "--id",
        `H: ${new Date(endHackTime).toISOString()}`,
      ],
    };
    const weaken1Job = {
      scriptName: weakenScript.name,
      startTime: startWeaken1Time,
      endTime: startWeaken1Time + wTime,
      threads: hOffsetThreads,
      ram: hOffsetThreads * weakenScript.ram,
      args: [
        "--target",
        args["target"],
        "--id",
        `W1: ${new Date(startWeaken1Time + wTime).toISOString()}`,
      ],
    };
    const growJob = {
      scriptName: growScript.name,
      startTime: startGrowTime,
      endTime: startGrowTime + gTime,
      threads: gThreads,
      ram: gThreads * growScript.ram,
      args: [
        "--target",
        args["target"],
        "--id",
        `G: ${new Date(startGrowTime + gTime).toISOString()}`,
      ],
    };
    const weaken2Job = {
      scriptName: weakenScript.name,
      startTime: startWeaken2Time,
      endTime: startWeaken2Time + wTime,
      threads: gOffsetThreads,
      ram: gOffsetThreads * weakenScript.ram,
      args: [
        "--target",
        args["target"],
        "--id",
        `W2: ${new Date(startWeaken2Time + wTime).toISOString()}`,
      ],
    };
    const jobs = [hackJob, weaken1Job, growJob, weaken2Job] as Job[];

    // output stats about jobs
    for (const job of jobs) {
      ns.print(`${job.args[3]}: ${job.threads}t`);
    }

    if (args["useScheduler"]) {
      // schedule jobs
      const scheduledJobs = [] as ScheduledJob[];
      for (const job of jobs) {
        const schedulerResponse = await sendReceiveScheduleRequest(
          ns,
          job.ram,
          args["schedulerPort"],
          job.startTime,
          job.endTime
        );
        if (schedulerResponse.success && schedulerResponse.host) {
          scheduledJobs.push({ ...job, host: schedulerResponse.host });
        }
      }

      // if we weren't able to schedule all the jobs, leave loop
      if (scheduledJobs.length < jobs.length) {
        ns.print("Could not schedule all jobs, skipping loop");
      }

      // execute scheduled jobs
      scheduledJobs.sort((a, b) => a.startTime - b.startTime);
      ns.print(scheduledJobs);
      while (scheduledJobs.length > 0) {
        const job = scheduledJobs.shift() as ScheduledJob;
        ns.print(`Handling job: ${job.args[3]}`);

        // sleep until job start time
        await sleepUntil(ns, job.startTime);

        // execute job
        ns.print(`Executing job: ${job.args[3]}`);
        ns.exec(job.scriptName, job.host, job.threads, ...job.args);
      }

      // wait until jobs are finished, display stats
      await sleepUntil(ns, endHackTime);
      for (let i = 0; i < 5; i++) {
        await sleepUntil(ns, endHackTime + executeBufferTime * i);
        printServerStats(ns, stats.servers[args["target"]]);
      }
    } else {
      // schedule jobs
      const scheduledJobs = [
        { ...hackJob, host: args["hosts"][1] },
        { ...weaken1Job, host: args["hosts"][1] },
        { ...growJob, host: args["hosts"][0] },
        { ...weaken2Job, host: args["hosts"][1] },
      ] as ScheduledJob[];

      // dispatch jobs
      scheduledJobs.sort((a, b) => a.startTime - b.startTime);
      ns.print(scheduledJobs);
      while (scheduledJobs.length > 0) {
        const job = scheduledJobs.shift() as ScheduledJob;
        ns.print(`Handling job: ${job.args[3]}`);

        // sleep until job start time
        await sleepUntil(ns, job.startTime);

        // execute job
        ns.print(`Executing job: ${job.args[3]}`);
        ns.exec(job.scriptName, job.host, job.threads, ...job.args);
      }

      // wait until jobs are finished, display stats
      await sleepUntil(ns, endHackTime);
      for (let i = 0; i < 5; i++) {
        await sleepUntil(ns, endHackTime + executeBufferTime * i);
        printServerStats(ns, stats.servers[args["target"]]);
      }
    }

    // padding with sleep, sometimes we go too quickly
    await ns.sleep(scheduleBufferTime);
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

async function runWithScheduler(
  ns: NS,
  threads: number,
  script: ScriptInfo,
  executionTimeMS: number,
  schedulerPort: number,
  scriptArgs: string[]
): Promise<void> {
  const now = Date.now();
  const schedulerResponse = await sendReceiveScheduleRequest(
    ns,
    threads * script.ram,
    schedulerPort,
    now,
    now + executionTimeMS + scheduleBufferTime + executeBufferTime
  );

  if (schedulerResponse.success) {
    ns.exec(
      script.name,
      schedulerResponse.host as string,
      threads,
      ...scriptArgs
    );
    ns.print(
      `Executing ${script.name} on ${schedulerResponse.host} for ${ns.nFormat(
        schedulerResponse.endTime - schedulerResponse.startTime,
        "0.0"
      )}ms`
    );
    await sleepUntil(ns, schedulerResponse.endTime);
  }
}

async function sendReceiveScheduleRequest(
  ns: NS,
  ram: number,
  schedulerPort: number,
  startTime: number,
  endTime: number
): Promise<SchedulerResponse> {
  const schedulerMessage = createMessage(
    ns.getScriptName() + JSON.stringify(ns.args),
    "Scheduler request",
    {
      ram,
      startTime,
      endTime,
    } as SchedulerRequest
  );
  const schedulerResponse = await sendReceive<
    SchedulerRequest,
    SchedulerResponse
  >(ns, schedulerPort, schedulerMessage);

  return (
    schedulerResponse?.data.data || {
      ...schedulerMessage.data,
      host: "",
      success: false,
    }
  );
}

async function growToMaxMoney(
  ns: NS,
  target: string,
  hosts: string[],
  ramBudget: number,
  scripts: ScriptsInfo,
  useScheduler = false,
  schedulerPort = 0
) {
  let stats = getStats(ns, [target, ...hosts]);
  ns.print(`Growing ${target} to maximum money`);
  while (
    stats.servers[target].moneyAvailable < stats.servers[target].moneyMax
  ) {
    printServerStats(ns, stats.servers[target]);

    if (useScheduler && schedulerPort > 0) {
      const maxRamChunk = await getSchedulerMaxRam(ns, schedulerPort);

      if (
        stats.servers[target].hackDifficulty /
          stats.servers[target].minDifficulty >
        1.5
      ) {
        // weaken server
        const wThreads = Math.floor(maxRamChunk / scripts.weakenScript.ram);
        const wTime = Math.ceil(
          ns.formulas.hacking.weakenTime(stats.servers[target], stats.player)
        );
        await runWithScheduler(
          ns,
          wThreads,
          scripts.weakenScript,
          wTime,
          schedulerPort,
          ["--target", target, "--id", `${new Date(Date.now()).toISOString()}`]
        );
      } else {
        // grow server
        const gThreads = Math.floor(maxRamChunk / scripts.growScript.ram);
        const gTime = ns.formulas.hacking.growTime(
          stats.servers[target],
          stats.player
        );
        await runWithScheduler(
          ns,
          gThreads,
          scripts.growScript,
          gTime,
          schedulerPort,
          ["--target", target, "--id", `${new Date(Date.now()).toISOString()}`]
        );
      }
    } else {
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
    }

    await ns.sleep(executeBufferTime);
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
  scripts: ScriptsInfo,
  useScheduler = false,
  schedulerPort = 0
) {
  ns.print(`Reducing ${target} to minimum security`);
  let stats = getStats(ns, [target, ...hosts]);

  while (
    stats.servers[target].hackDifficulty > stats.servers[target].minDifficulty
  ) {
    printServerStats(ns, stats.servers[target]);

    if (useScheduler && schedulerPort > 0) {
      const maxRamChunk = await getSchedulerMaxRam(ns, schedulerPort);

      // weaken server
      const wThreads = Math.floor(maxRamChunk / scripts.weakenScript.ram);
      const wTime = Math.ceil(
        ns.formulas.hacking.weakenTime(stats.servers[target], stats.player)
      );
      await runWithScheduler(
        ns,
        wThreads,
        scripts.weakenScript,
        wTime,
        schedulerPort,
        ["--target", target, "--id", `${new Date(Date.now()).toISOString()}`]
      );
    } else {
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
    }

    await ns.sleep(executeBufferTime);
    stats = getStats(ns, [target, ...hosts]);
  }
  ns.print("-----Target at minimum security-----");
  printServerStats(ns, stats.servers[target]);
}
