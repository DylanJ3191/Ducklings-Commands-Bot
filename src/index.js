const DISCORD_API = "https://discord.com/api/v10";
const FLIP_GIF_URL = "https://klipy.com/gifs/get-flipped-idiot-cube-flip";

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp || !publicKey) return false;

  const body = await request.clone().text();

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body)
    );
  } catch {
    return false;
  }
}

function getOption(options, name) {
  return options?.find((option) => option.name === name);
}

const PERMISSIONS = [
  ["Create Invite", "CreateInstantInvite", 0n],
  ["Kick Members", "KickMembers", 1n],
  ["Ban Members", "BanMembers", 2n],
  ["Administrator", "Administrator", 3n],
  ["Manage Channels", "ManageChannels", 4n],
  ["Manage Server", "ManageGuild", 5n],
  ["Add Reactions", "AddReactions", 6n],
  ["View Audit Log", "ViewAuditLog", 7n],
  ["Priority Speaker", "PrioritySpeaker", 8n],
  ["Video", "Stream", 9n],
  ["View Channels", "ViewChannel", 10n],
  ["Send Messages", "SendMessages", 11n],
  ["Send Text-to-Speech Messages", "SendTTSMessages", 12n],
  ["Manage Messages", "ManageMessages", 13n],
  ["Embed Links", "EmbedLinks", 14n],
  ["Attach Files", "AttachFiles", 15n],
  ["Read Message History", "ReadMessageHistory", 16n],
  ["Mention @everyone, @here, and All Roles", "MentionEveryone", 17n],
  ["Use External Emoji", "UseExternalEmojis", 18n],
  ["View Server Insights", "ViewGuildInsights", 19n],
  ["Connect", "Connect", 20n],
  ["Speak", "Speak", 21n],
  ["Mute Members", "MuteMembers", 22n],
  ["Deafen Members", "DeafenMembers", 23n],
  ["Move Members", "MoveMembers", 24n],
  ["Use Voice Activity", "UseVAD", 25n],
  ["Change Nickname", "ChangeNickname", 26n],
  ["Manage Nicknames", "ManageNicknames", 27n],
  ["Manage Roles", "ManageRoles", 28n],
  ["Manage Webhooks", "ManageWebhooks", 29n],
  ["Manage Expressions", "ManageGuildExpressions", 30n],
  ["Use Application Commands", "UseApplicationCommands", 31n],
  ["Request to Speak", "RequestToSpeak", 32n],
  ["Manage Events", "ManageEvents", 33n],
  ["Manage Threads", "ManageThreads", 34n],
  ["Create Public Threads", "CreatePublicThreads", 35n],
  ["Create Private Threads", "CreatePrivateThreads", 36n],
  ["Use External Stickers", "UseExternalStickers", 37n],
  ["Send Messages in Threads", "SendMessagesInThreads", 38n],
  ["Use Activities", "UseEmbeddedActivities", 39n],
  ["Timeout Members", "ModerateMembers", 40n],
  ["View Creator Monetization Analytics", "ViewCreatorMonetizationAnalytics", 41n],
  ["Use Soundboard", "UseSoundboard", 42n],
  ["Create Expressions", "CreateGuildExpressions", 43n],
  ["Create Events", "CreateEvents", 44n],
  ["Use External Sounds", "UseExternalSounds", 45n],
  ["Send Voice Messages", "SendVoiceMessages", 46n],
  ["Create Polls", "SendPolls", 49n],
  ["Use External Apps", "UseExternalApps", 50n],
  ["Pin Messages", "PinMessages", 51n],
  ["Bypass Slowmode", "BypassSlowmode", 52n]
].map(([uiName, internalName, shift]) => ({
  uiName,
  internalName,
  shift,
  bit: 1n << shift
}));

const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

function findPermission(query) {
  const q = normalize(query);
  if (!q) return null;
  return (
    PERMISSIONS.find(
      (p) => normalize(p.internalName) === q || normalize(p.uiName) === q
    ) ?? null
  );
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("NameDuckling770's Commands Bot is running.", { status: 200 });
    }

    if (!(await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY))) {
      return new Response("Invalid request signature.", { status: 401 });
    }

    const interaction = await request.json();

    // Discord endpoint verification (PING).
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    if (interaction.type === 2 && interaction.data?.name === "flipuser") {
      const userOption = getOption(interaction.data.options, "user");

      // A USER command option contains the user's ID in `value`.
      const userId = userOption?.value;

      // Discord provides the actual user object in resolved.users.
      const targetUser = interaction.data.resolved?.users?.[userId];

      if (!targetUser) {
        return Response.json({
          type: 4,
          data: {
            content: "You need to pick someone to flip.",
            flags: 64
          }
        });
      }

      const response = {
        type: 4,
        data: {
          content: `<@${userId}> got flipped[.](${FLIP_GIF_URL})`,
          flags: 4096
        }
      };

      return Response.json(response);
    }
    
    // Autocomplete for the permission option (optional, but nice to have).
    if (interaction.type === 4 && interaction.data?.name === "permission") {
      const focused = getOption(interaction.data.options, "permission");
      const q = normalize(focused?.value ?? "");

      const choices = PERMISSIONS
        .filter(
          (p) =>
            normalize(p.internalName).includes(q) ||
            normalize(p.uiName).includes(q)
        )
        .slice(0, 25)
        .map((p) => ({
          name: `${p.uiName} (${p.internalName})`.slice(0, 100),
          value: p.internalName
        }));

      return Response.json({ type: 8, data: { choices } });
    }

    if (interaction.type === 2 && interaction.data?.name === "permission") {
      const input = getOption(interaction.data.options, "permission")?.value ?? "";
      const perm = findPermission(input);

      if (!perm) {
        return Response.json({
          type: 4,
          data: {
            content: `I couldn't find a permission matching \`${input.slice(0, 100)}\`.`,
            flags: 64
          }
        });
      }

      return Response.json({
        type: 4,
        data: {
          embeds: [
            {
              title: perm.uiName,
              color: 0x5865f2,
              fields: [
                { name: "UI Name", value: perm.uiName, inline: true },
                { name: "Internal Name", value: `\`${perm.internalName}\``, inline: true },
                {
                  name: "Permission Bit",
                  value: `\`${perm.bit.toString()}\` (\`1 << ${perm.shift}\`)`,
                  inline: true
                }
              ]
            }
          ],
          flags: 4096
        }
      });
    }

    return Response.json({
      type: 4,
      data: {
        content: "Unknown command.",
        flags: 64
      }
    });
  }
};