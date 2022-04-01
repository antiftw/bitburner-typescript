import { CorporationInfo, Division, NS } from "@ns";

// upgrades we always want to start with
const upgradesToUnlock = [
  { name: "Warehouse API", level: "unlock" },
  { name: "Office API", level: "unlock" },
  { name: "Smart Supply", level: "unlock" },
  { name: "DreamSense", level: 1 },
];

function manageTobacco(ns: NS, corp: CorporationInfo, division: Division) {
  // handle generic tasks first
  manageDivision(ns, corp, division);

  // if no products, create one
  if (division.products.length < 1) {
    ns.print(`${division.name} with no products, creating one`);
    ns.corporation.makeProduct(division.name, "Sector-12", "1k", 1000, 1000);
  }
}

function manageDivision(ns: NS, corp: CorporationInfo, division: Division) {
  // TODO: Manage research

  // Do per city warehouse and office management
  for (const city of division.cities) {
    const office = ns.corporation.getOffice(division.name, city);

    // if there are job openings, hire candidates
    if (office.employees.length < office.size) {
      for (let i = office.size - office.employees.length; i > 0; i--) {
        ns.print(`${division.name}, ${city}: Hiring employee`);
        ns.corporation.hireEmployee(division.name, city);
      }
    }

    const warehouse = ns.corporation.getWarehouse(division.name, city);

    // turn on smart supply, if it isn't already
    if (!warehouse.smartSupplyEnabled) {
      ns.print(`${division.name}, ${city}: Enabling smart supply`);
      ns.corporation.setSmartSupply(division.name, city, true);
    }
  }

  // set product prices
  for (const product of division.products) {
    const productData = ns.corporation.getProduct(division.name, product);

    // set price in all cities
    for (const city of division.cities) {
      const [, , sell] = productData.cityData[city];

      if (sell === 0) {
        ns.print(`${division.name} selling ${product} from ${city}: MAX @ MP`);
        ns.corporation.sellProduct(
          division.name,
          city,
          product,
          "MAX",
          "MP",
          false
        );
      }
    }
  }
}

function manageCorp(ns: NS) {
  // attempt upgrades
  for (const upgrade of upgradesToUnlock) {
    if (upgrade.level === "unlock") {
      if (!ns.corporation.hasUnlockUpgrade(upgrade.name)) {
        ns.print(`Does not have ${upgrade.name}, unlocking now`);
        ns.corporation.unlockUpgrade(upgrade.name);
      }
    } else {
      const currentLevel = ns.corporation.getUpgradeLevel(upgrade.name);
      if (currentLevel < upgrade.level) {
        ns.print(
          `Does not have ${upgrade.name} up to ${upgrade.level}, upgrading now`
        );
        ns.corporation.levelUpgrade(upgrade.name);
      }
    }
  }
}

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([["loop", false]]);

  // check that we have a corporation to manage, exit if not
  const player = ns.getPlayer();
  if (!player.hasCorporation) {
    ns.print("Player has no corporation to manage, exiting");
    return;
  }

  let corpInfo = ns.corporation.getCorporation();

  // if no divisions, expand into tobacco
  if (corpInfo.divisions.length == 0) {
    ns.corporation.expandIndustry("Tobacco", "CigChungus");
  }

  do {
    corpInfo = ns.corporation.getCorporation();

    // manage whole corporation
    manageCorp(ns);

    // manage divisions
    for (const d of corpInfo.divisions) {
      switch (d.type) {
        case "Tobacco":
          manageTobacco(ns, corpInfo, d);
          break;
        default:
          ns.print(`Unknown division ${d.name}`);
          manageDivision(ns, corpInfo, d);
          break;
      }
    }

    await ns.sleep(1000);
  } while (args["loop"]);
}
