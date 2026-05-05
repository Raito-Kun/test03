import prisma from '../lib/prisma';
import { sshDiscover } from './network-scan-service';
import bcrypt from 'bcryptjs';

interface ExtensionRow {
  extension: string;
  password: string;
  callerName: string;
  accountcode: string;
}

/** Sync extensions from FusionPBX via SSH for a given cluster */
export async function syncExtensions(clusterId: string, sshHost: string, sshPassword: string, sipDomain: string, sshUser = 'root') {
  const { Client } = require('ssh2');
  const fs = require('fs');
  const path = require('path');

  // Load host SSH key
  const homedir = process.env.HOME || '/home/node';
  let privateKey: Buffer | undefined;
  for (const kp of [path.join(homedir, '.ssh/id_rsa'), '/root/.ssh/id_rsa']) {
    try { if (fs.existsSync(kp)) { privateKey = fs.readFileSync(kp); break; } } catch {}
  }

  const conn = new Client();

  const extensions: ExtensionRow[] = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, 20000);

    conn.on('ready', async () => {
      try {
        const result = await new Promise<string>((res, rej) => {
          conn.exec(
            `sudo -u postgres psql -d fusionpbx -t -A -F'|' -c "SELECT extension, password, COALESCE(effective_caller_id_name,''), COALESCE(accountcode,'') FROM v_extensions WHERE domain_uuid=(SELECT domain_uuid FROM v_domains WHERE domain_name='${sipDomain}') AND enabled='true' ORDER BY extension;"`,
            (err: Error, stream: any) => {
              if (err) return rej(err);
              let out = '';
              stream.on('data', (d: Buffer) => { out += d.toString(); });
              stream.stderr.on('data', () => {});
              stream.on('close', () => res(out.trim()));
            },
          );
        });

        clearTimeout(timeout);
        conn.end();

        const rows: ExtensionRow[] = [];
        for (const line of result.split('\n')) {
          const parts = line.split('|');
          if (parts.length >= 2 && parts[0].trim()) {
            rows.push({
              extension: parts[0].trim(),
              password: parts[1]?.trim() || '',
              callerName: parts[2]?.trim() || '',
              accountcode: parts[3]?.trim() || '',
            });
          }
        }
        resolve(rows);
      } catch (err) {
        clearTimeout(timeout);
        conn.end();
        reject(err);
      }
    });

    conn.on('keyboard-interactive', (_n: any, _i: any, _il: any, _p: any, finish: Function) => finish([sshPassword]));
    conn.on('error', (err: Error) => { clearTimeout(timeout); reject(err); });

    conn.connect({
      host: sshHost, port: 22, username: sshUser,
      password: sshPassword, privateKey,
      readyTimeout: 10000, tryKeyboard: true,
    });
  });

  // Upsert extensions into cluster_extensions
  for (const ext of extensions) {
    await prisma.clusterExtension.upsert({
      where: { clusterId_extension: { clusterId, extension: ext.extension } },
      create: {
        clusterId,
        extension: ext.extension,
        password: ext.password,
        callerName: ext.callerName,
        accountcode: ext.accountcode,
      },
      update: {
        password: ext.password,
        callerName: ext.callerName,
        accountcode: ext.accountcode,
        syncedAt: new Date(),
      },
    });
  }

  // Remove extensions that no longer exist on PBX
  const extNumbers = extensions.map((e) => e.extension);
  if (extNumbers.length > 0) {
    await prisma.clusterExtension.deleteMany({
      where: { clusterId, extension: { notIn: extNumbers } },
    });
  }

  return { count: extensions.length, extensions: extensions.map((e) => e.extension) };
}

/** List extensions for a cluster */
export async function listExtensions(clusterId: string) {
  return prisma.clusterExtension.findMany({
    where: { clusterId },
    orderBy: { extension: 'asc' },
    select: { id: true, extension: true, callerName: true, accountcode: true, syncedAt: true },
  });
}

/** Auto-create default accounts when a new cluster is created */
export async function autoCreateClusterAccounts(clusterId: string, clusterName: string) {
  const roles = [
    { role: 'admin', prefix: 'admin' },
    { role: 'manager', prefix: 'manager' },
    { role: 'supervisor', prefix: 'supervisor' },
    { role: 'qa', prefix: 'qa' },
    { role: 'leader', prefix: 'leader' },
  ];

  const defaultPassword = 'Pls@1234!';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  const safeName = clusterName.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const created: string[] = [];

  for (const { role, prefix } of roles) {
    const email = `${prefix}_01@${safeName}.local`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) continue;

    await prisma.user.create({
      data: {
        fullName: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} 01`,
        email,
        passwordHash: hashedPassword,
        role: role as any,
        clusterId,
        status: 'active',
      },
    });
    created.push(email);
  }

  return { created, count: created.length };
}
