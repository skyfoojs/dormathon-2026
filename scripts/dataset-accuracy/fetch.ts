// Downloads the two public datasets named in docs/Internal-Calculation.md
// into ./data (git-ignored). Safe to rerun: files already present are kept.
//
//   npx tsx scripts/dataset-accuracy/fetch.ts
//
// 1. Pharma Sales Data (Kaggle): one zip, only salesdaily.csv is kept.
// 2. NHS English Prescribing Data: the monthly files are about 6 GB each, so
//    only the slice needed is pulled through the portal's SQL API.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
const KAGGLE_DIR = path.join(DATA_DIR, "kaggle");
const EPD_DIR = path.join(DATA_DIR, "epd");

const KAGGLE_URL = "https://www.kaggle.com/api/v1/datasets/download/milanzdravkovic/pharma-sales-data";
const EPD_API = "https://opendata.nhsbsa.net/api/3/action";
const EPD_PACKAGE = "english-prescribing-data-epd";

// BNF chemical substances: salbutamol, ipratropium bromide, budesonide.
export const EPD_SUBSTANCES = ["0301011R0", "0301020I0", "0302000K0"];
// Practices are ranked by salbutamol items in the latest month. More are
// fetched than are used, so ones with an incomplete history can be dropped.
const CANDIDATE_PRACTICES = 25;

type CkanResource = { name: string; datastore_active?: boolean };

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (attempt === 3) throw new Error(`${res.status} from ${url}`);
  }
}

async function epdSql(resource: string, sql: string): Promise<Record<string, unknown>[]> {
  const url = `${EPD_API}/datastore_search_sql?resource_id=${resource}&sql=${encodeURIComponent(sql)}`;
  const body = (await getJson(url)) as { result: { result: { records: Record<string, unknown>[] } } };
  return body.result.result.records;
}

// Reads one file out of a zip through its central directory, so no unzip
// tool has to be installed.
function unzipEntry(zip: Buffer, name: string): Buffer {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(end + 16);
  for (let i = zip.readUInt16LE(end + 10); i > 0; i--) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const skip = zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    if (zip.toString("utf8", offset + 46, offset + 46 + nameLength) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const body = zip.subarray(start, start + compressedSize);
      return method === 0 ? body : inflateRawSync(body);
    }
    offset += 46 + nameLength + skip;
  }
  throw new Error(`${name} not found in the zip`);
}

async function fetchKaggle(): Promise<void> {
  const csv = path.join(KAGGLE_DIR, "salesdaily.csv");
  if (existsSync(csv)) return console.log("kaggle: salesdaily.csv already present");
  mkdirSync(KAGGLE_DIR, { recursive: true });
  const res = await fetch(KAGGLE_URL);
  if (!res.ok) throw new Error(`Kaggle download failed: ${res.status}`);
  writeFileSync(csv, unzipEntry(Buffer.from(await res.arrayBuffer()), "salesdaily.csv"));
  console.log("kaggle: downloaded salesdaily.csv");
}

async function fetchEpd(): Promise<void> {
  mkdirSync(EPD_DIR, { recursive: true });
  const pkg = (await getJson(`${EPD_API}/package_show?id=${EPD_PACKAGE}`)) as {
    result: { resources: CkanResource[] };
  };
  // Only months loaded into the portal's datastore can be queried with SQL.
  const months = pkg.result.resources.filter((r) => r.datastore_active).map((r) => r.name).sort();
  const latest = months[months.length - 1];
  const substances = EPD_SUBSTANCES.map((s) => `'${s}'`).join(", ");

  const top = await epdSql(
    latest,
    `SELECT PRACTICE_CODE, SUM(ITEMS) AS ITEMS FROM \`${latest}\` WHERE BNF_CHEMICAL_SUBSTANCE = '${EPD_SUBSTANCES[0]}' ` +
      `GROUP BY PRACTICE_CODE ORDER BY ITEMS DESC LIMIT ${CANDIDATE_PRACTICES}`,
  );
  const practiceCodes = top.map((r) => String(r.PRACTICE_CODE));
  writeFileSync(path.join(EPD_DIR, "practices.json"), JSON.stringify({ rankedOn: latest, practiceCodes }, null, 2));
  const practices = practiceCodes.map((p) => `'${p}'`).join(", ");

  for (const month of months) {
    const file = path.join(EPD_DIR, `${month}.json`);
    if (existsSync(file)) continue;
    const records = await epdSql(
      month,
      `SELECT YEAR_MONTH, PRACTICE_CODE, PRACTICE_NAME, BNF_CHEMICAL_SUBSTANCE, CHEMICAL_SUBSTANCE_BNF_DESCR, ` +
        `SUM(ITEMS) AS ITEMS, SUM(TOTAL_QUANTITY) AS TOTAL_QUANTITY, SUM(ACTUAL_COST) AS ACTUAL_COST ` +
        `FROM \`${month}\` WHERE BNF_CHEMICAL_SUBSTANCE IN (${substances}) AND PRACTICE_CODE IN (${practices}) ` +
        `GROUP BY YEAR_MONTH, PRACTICE_CODE, PRACTICE_NAME, BNF_CHEMICAL_SUBSTANCE, CHEMICAL_SUBSTANCE_BNF_DESCR`,
    );
    writeFileSync(file, JSON.stringify(records));
    console.log(`epd: ${month} ${records.length} rows`);
  }
  console.log(`epd: ${months.length} months, ${months[0]} to ${latest}`);
}

async function main(): Promise<void> {
  await fetchKaggle();
  await fetchEpd();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
