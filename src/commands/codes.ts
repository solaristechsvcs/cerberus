import { EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

type NukeCodes = { alpha: string; bravo: string; charlie: string };

const ENDPOINTS = [
  "https://nukacrypt.com/api/codes",
  "https://nukacrypt.com/api/solved",
  "https://nukacrypt.com/api/launchcodes"
];

function findCode(text: string, name: string): string | undefined {
  const pattern = new RegExp(name + "\\s*[:=]\\s*[\\\"]?(\\\\d{8})", "i");
  return text.match(pattern)?.[1];
}

function extractCodes(value: unknown): NukeCodes | null {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return null;
  const alpha = findCode(text, "alpha");
  const bravo = findCode(text, "bravo");
  const charlie = findCode(text, "charlie");
  return alpha && bravo && charlie ? { alpha, bravo, charlie } : null;
}

async function fetchNukeCodes(): Promise<NukeCodes> {
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        headers: { "User-Agent": "Cerberus Discord Bot/1.0 (+https://nukacrypt.com)" },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "";
      const data = contentType.includes("application/json") ? await response.json() : await response.text();
      const codes = extractCodes(data);
      if (codes) return codes;
    } catch {}
  }
  throw new Error("NukaCrypt did not return readable current launch codes.");
}

export const codeCommands = [
  new SlashCommandBuilder().setName("codes").setDescription("Show the current Fallout 76 nuclear launch codes.")
];

export async function handleCodeCommand(i: ChatInputCommandInteraction): Promise<void> {
  await i.deferReply();
  const fence = String.fromCharCode(96).repeat(3);
  try {
    const codes = await fetchNukeCodes();
    const embed = new EmbedBuilder()
      .setTitle("☢️ Fallout 76 Nuclear Launch Codes")
      .setDescription("Current launch codes for the three Appalachian nuclear silos.")
      .addFields(
        { name: "Alpha", value: fence + codes.alpha + fence, inline: true },
        { name: "Bravo", value: fence + codes.bravo + fence, inline: true },
        { name: "Charlie", value: fence + codes.charlie + fence, inline: true }
      )
      .setColor(0x8f315c)
      .setFooter({ text: "Source: NukaCrypt • Codes change weekly" })
      .setURL("https://nukacrypt.com")
      .setTimestamp();
    await i.editReply({ embeds: [embed] });
  } catch {
    await i.editReply({ content: "☢️ I couldn’t retrieve the current launch codes from NukaCrypt right now. Please try again shortly: https://nukacrypt.com" });
  }
}
