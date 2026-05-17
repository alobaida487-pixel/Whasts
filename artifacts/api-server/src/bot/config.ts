import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data.json");

export interface GiveawayData {
  channelId: string;
  messageId: string;
  prize: string;
  endsAt: number;
  hostedBy: string;
  winners: number;
  guildId: string;
  ended: boolean;
  participants: string[];
}

export interface TicketData {
  channelId: string;
  ownerId: string;
  guildId: string;
  reason: string;
  claimedBy?: string;
}

export interface JailConfig {
  roleId: string;
  dayOptions: number[];
  hourOptions: number[];
}

export interface JailRecord {
  userId: string;
  guildId: string;
  originalRoles: string[];
  jailRoleId: string;
  endsAt: number | null;
}

interface BotData {
  staffRoles: Record<string, string[]>;
  adminRoles: Record<string, string[]>;
  dismissRoles: Record<string, string[]>;
  applyRole: Record<string, string>;
  jailConfig: Record<string, JailConfig>;
  jailedUsers: Record<string, JailRecord>;
  giveaways: Record<string, GiveawayData>;
  tickets: Record<string, TicketData>;
}

function loadData(): BotData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw) as BotData;
    }
  } catch {}
  return {
    staffRoles: {},
    adminRoles: {},
    dismissRoles: {},
    applyRole: {},
    jailConfig: {},
    jailedUsers: {},
    giveaways: {},
    tickets: {},
  };
}

function saveData(data: BotData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

// ── Staff roles ───────────────────────────────────────────────────────────────
export function getStaffRoles(guildId: string): string[] {
  return loadData().staffRoles[guildId] ?? [];
}
export function setStaffRoles(guildId: string, roleIds: string[]): void {
  const data = loadData();
  data.staffRoles[guildId] = roleIds;
  saveData(data);
}

// ── Admin roles ($اداره) ──────────────────────────────────────────────────────
export function getAdminRoles(guildId: string): string[] {
  return (loadData().adminRoles ?? {})[guildId] ?? [];
}
export function setAdminRoles(guildId: string, roleIds: string[]): void {
  const data = loadData();
  if (!data.adminRoles) data.adminRoles = {};
  data.adminRoles[guildId] = roleIds;
  saveData(data);
}

// ── Dismiss roles ($فصل) ──────────────────────────────────────────────────────
export function getDismissRoles(guildId: string): string[] {
  return (loadData().dismissRoles ?? {})[guildId] ?? [];
}
export function setDismissRoles(guildId: string, roleIds: string[]): void {
  const data = loadData();
  if (!data.dismissRoles) data.dismissRoles = {};
  data.dismissRoles[guildId] = roleIds;
  saveData(data);
}

// ── Apply role (تقديم الإدارة) ─────────────────────────────────────────────
export function getApplyRole(guildId: string): string | null {
  return (loadData().applyRole ?? {})[guildId] ?? null;
}
export function setApplyRole(guildId: string, roleId: string): void {
  const data = loadData();
  if (!data.applyRole) data.applyRole = {};
  data.applyRole[guildId] = roleId;
  saveData(data);
}

// ── Jail config ($سجن) ────────────────────────────────────────────────────────
export function getJailConfig(guildId: string): JailConfig | null {
  return (loadData().jailConfig ?? {})[guildId] ?? null;
}
export function setJailConfig(guildId: string, cfg: JailConfig): void {
  const data = loadData();
  if (!data.jailConfig) data.jailConfig = {};
  data.jailConfig[guildId] = cfg;
  saveData(data);
}

// ── Jailed users ──────────────────────────────────────────────────────────────
export function getJailRecord(guildId: string, userId: string): JailRecord | null {
  return (loadData().jailedUsers ?? {})[`${guildId}:${userId}`] ?? null;
}
export function saveJailRecord(record: JailRecord): void {
  const data = loadData();
  if (!data.jailedUsers) data.jailedUsers = {};
  data.jailedUsers[`${record.guildId}:${record.userId}`] = record;
  saveData(data);
}
export function deleteJailRecord(guildId: string, userId: string): void {
  const data = loadData();
  delete data.jailedUsers[`${guildId}:${userId}`];
  saveData(data);
}
export function getAllJailRecords(): JailRecord[] {
  return Object.values(loadData().jailedUsers ?? {});
}

// ── Giveaways ─────────────────────────────────────────────────────────────────
export function getGiveaway(messageId: string): GiveawayData | null {
  return loadData().giveaways[messageId] ?? null;
}
export function saveGiveaway(messageId: string, giveaway: GiveawayData): void {
  const data = loadData();
  data.giveaways[messageId] = giveaway;
  saveData(data);
}
export function getAllGiveaways(): Record<string, GiveawayData> {
  return loadData().giveaways;
}

// ── Tickets ───────────────────────────────────────────────────────────────────
export function getTicket(channelId: string): TicketData | null {
  return loadData().tickets[channelId] ?? null;
}
export function saveTicket(channelId: string, ticket: TicketData): void {
  const data = loadData();
  data.tickets[channelId] = ticket;
  saveData(data);
}
export function deleteTicket(channelId: string): void {
  const data = loadData();
  delete data.tickets[channelId];
  saveData(data);
}
