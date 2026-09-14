import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const environments = {
  staging: {
    mode: "mlc-staging",
    workerName: "music-school-library-staging",
    databaseName: "music-school-library-staging",
    databaseId:
      "a5192040-0557-459e-86b9-9f80f3f23ad2",
  },

  production: {
    mode: "mlc-production",
    workerName: "music-school-library",
    databaseName: "music-school-library",
    databaseId:
      "6f449e4e-73cc-4eed-8370-f0c8339a969e",
  },
};

const envName = process.argv[2];

if (!(envName in environments)) {
  console.error(
    "Usage: node scripts/deploy-env.mjs staging|production"
  );
  process.exit(2);
}

const target = environments[envName];

function run(args) {
  let result;

  if (process.platform === "win32") {
    /*
     * Node 26 on Windows can reject direct spawnSync of .cmd
     * launchers with EINVAL. Execute pnpm through cmd.exe instead.
     */
    const command =
      "pnpm " +
      args.map((arg) => {
        const value = String(arg);

        if (
          /[\\s"&<>|^()]/.test(value)
        ) {
          return '"' +
            value.replace(/"/g, '\\"') +
            '"';
        }

        return value;
      }).join(" ");

    result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", command],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
  } else {
    result = spawnSync(
      "pnpm",
      args,
      {
        stdio: "inherit",
        env: process.env,
      },
    );
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("");
console.log(
  "=============================================="
);
console.log(
  `TARGET ENVIRONMENT : ${envName.toUpperCase()}`
);
console.log(
  `Worker             : ${target.workerName}`
);
console.log(
  `D1                 : ${target.databaseName}`
);
console.log(
  `D1 ID              : ${target.databaseId}`
);
console.log(
  "=============================================="
);
console.log("");

/*
 * Build with an environment-specific Vite mode.
 */
run([
  "exec",
  "vite",
  "build",
  "--mode",
  target.mode,
]);

function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const result = [];

  for (const entry of fs.readdirSync(
    dir,
    { withFileTypes: true },
  )) {
    const full = path.join(
      dir,
      entry.name,
    );

    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (
      entry.name === "wrangler.json"
    ) {
      result.push(full);
    }
  }

  return result;
}

const generatedConfigs =
  walk("dist");

let deployConfig = null;

for (const candidate of generatedConfigs) {
  let config;

  try {
    config = JSON.parse(
      fs.readFileSync(
        candidate,
        "utf8",
      ),
    );
  } catch {
    continue;
  }

  const db =
    config.d1_databases?.find(
      (item) =>
        item.binding === "DB",
    );

  if (
    config.name === target.workerName &&
    db?.database_name ===
      target.databaseName &&
    db?.database_id ===
      target.databaseId
  ) {
    deployConfig = candidate;
    break;
  }
}

if (!deployConfig) {
  console.error("");
  console.error(
    "DEPLOY ABORTED: generated Wrangler config"
  );
  console.error(
    "does not match the requested environment."
  );
  console.error("");

  console.error(
    "Expected Worker:",
    target.workerName,
  );

  console.error(
    "Expected D1:",
    target.databaseName,
  );

  console.error(
    "Expected D1 ID:",
    target.databaseId,
  );

  console.error("");
  console.error(
    "Generated Wrangler configs:",
    generatedConfigs,
  );

  process.exit(3);
}

console.log("");
console.log(
  "PRE-DEPLOY IDENTITY CHECK: PASS"
);
console.log(
  "Generated config:",
  deployConfig,
);
console.log("");

run([
  "exec",
  "wrangler",
  "deploy",
  "--config",
  deployConfig,
]);
