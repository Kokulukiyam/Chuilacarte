import 'server-only';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import fs from 'node:fs';

let instP: Promise<DuckDBInstance> | null = null;

async function init(): Promise<DuckDBInstance> {
  const inst = await DuckDBInstance.create(':memory:');
  const c = await inst.connect();
  await c.run('INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET GLOBAL geometry_always_xy = true;');
  // Proxy HTTPS éventuel (environnements d'entreprise ou bac à sable)
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) {
    const u = new URL(proxy);
    await c.run(`SET GLOBAL http_proxy='${u.host}'`);
  }
  const ca = process.env.SSL_CERT_FILE || process.env.NODE_EXTRA_CA_CERTS || process.env.AWS_CA_BUNDLE;
  if (ca && fs.existsSync(ca)) await c.run(`SET GLOBAL ca_cert_file='${ca.replace(/'/g, "''")}'`);
  // Accès anonyme aux buckets publics (Overture), même si des identifiants AWS traînent dans l'environnement
  await c.run("CREATE OR REPLACE SECRET anon_s3 (TYPE s3, REGION 'us-west-2', KEY_ID '', SECRET '')");
  c.closeSync();
  return inst;
}

export async function duck(): Promise<DuckDBConnection> {
  if (!instP) instP = init().catch((e) => {
    instP = null;
    throw e;
  });
  const inst = await instP;
  const c = await inst.connect();
  return c;
}

export function sqlStr(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function query<T = Record<string, any>>(sql: string): Promise<T[]> {
  const c = await duck();
  try {
    const r = await c.runAndReadAll(sql);
    return r.getRowObjectsJson() as T[];
  } finally {
    c.closeSync();
  }
}
