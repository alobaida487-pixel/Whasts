import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data.json");

interface BotData {
  staffRoles: Record<string, string[]>;
  adminRoles: Record<string, string[]>;
  applyRole: Record<string, string>;
  giveaways: Record<string, GiveawayData>;
  tickets: Record<string, TicketData>;
}

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

function loadData(): BotData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw) as BotData;
    }
  } catch {}
  return { staffRoles: {}, adminRoles: {}, applyRole: {}, giveaways: {}, tickets: {} };
}

function saveData(data: BotData): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export function getStaffRoles(guildId: string): string[] {
  const data = loadData();
  return data.staffRoles[guildId] ?? [];
}

export function setStaffRoles(guildId: string, roleIds: string[]): void {
  const data = loadData();
  data.staffRoles[guildId] = roleIds;
  saveData(data);
}

export function getAdminRoles(guildId: string): string[] {
  const data = loadData();
  return (data.adminRoles ?? {})[guildId] ?? [];
}

export function setAdminRoles(guildId: string, roleIds: string[]): void {
  const data = loadData();
  if (!data.adminRoles) data.adminRoles = {};
  data.adminRoles[guildId] = roleIds;
  saveData(data);
}

export function getApplyRole(guildId: string): string | null {
  const data = loadData();
  return (data.applyRole ?? {})[guildId] ?? null;
}

export function setApplyRole(guildId: string, roleId: string): void {
  const data = loadData();
  if (!data.applyRole) data.applyRole = {};
  data.applyRole[guildId] = roleId;
  saveData(data);
}

export function getGiveaway(messageId: string): GiveawayData | null {
  const data = loadData();
  return data.giveaways[messageId] ?? null;
}

export function saveGiveaway(messageId: string, giveaway: GiveawayData): void {
  const data = loadData();
  data.giveaways[messageId] = giveaway;
  saveData(data);
}

export function getAllGiveaways(): Record<string, GiveawayData> {
  return loadData().giveaways;
}

export function getTicket(channelId: string): TicketData | null {
  const data = loadData();
  return data.tickets[channelId] ?? null;
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
