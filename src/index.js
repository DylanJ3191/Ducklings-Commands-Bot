const DISCORD_API = "https://discord.com/api/v10";

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

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Discord Flip Worker is running.", { status: 200 });
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

      const displayName =
        targetUser.global_name ||
        targetUser.username ||
        "That user";

      const response = {
        type: 4,
        data: {
          content: `<@${userId}> got flipped[.](${env.FLIP_GIF_URL})`
        }
      };

      return Response.json(response);
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