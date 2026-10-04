import { EmbedBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

type NukeCodes = { alpha: string; bravo: string; charlie: string };

const NUKACRYPT_URL = "https://api.nukacrypt.com/api/codes";

function isCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{8}$/.test(value.trim());
}

function extractCodes(value: unknown): NukeCodes | null {
  if (typeof value !== "object" || value === null) return null;

  const data = value as Record<string, unknown>;
  if (!isCode(data.ALPHA) || !isCode(data.BRAVO) || !isCode(data.CHARLIE)) return null;

  return {
    alpha: data.ALPHA.trim(),
    bravo: data.BRAVO.trim(),
    charlie: data.CHARLIE.trim()
  };
}

async function fetchNukeCodes(): Promise<NukeCodes> {
  const response = await fetch(NUKACRYPT_URL, {
    headers: {
      "User-Agent": "Cerberus Discord Bot/1.0 (https://nukacrypt.com)"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) {
    throw new Error(`NukaCrypt returned HTTP ${response.status}.`);
  }

  const data: unknown = await response.json();
  const codes = extractCodes(data);

  if (!codes) {
    throw new Error("NukaCrypt returned an unexpected response.");
  }

  return codes;
}

export const codeCommands = [
  new SlashCommandBuilder()
    .setName("codes")
    .setDescription("Show the current Fallout 76 nuclear launch codes.")
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
  } catch (error) {
    console.error("Failed to fetch Fallout 76 nuke codes:", error);
    await i.editReply({
      content: "☢️ I couldn’t retrieve the current launch codes from NukaCrypt right now. Please try again shortly: https://nukacrypt.com"
    });
  }
}
