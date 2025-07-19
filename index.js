const { Client, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, GatewayIntentBits, Partials, time, PermissionsBitField, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const client = new Client({
  intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction,
        Partials.ThreadMember
    ]
});

  // Host the bot:
  require('http')
    .createServer((req, res) => res.end(''))
    .listen(3030);

  client.once('ready', () => {
    console.log(client.user.username + ' is ready!');
    console.log('== The logs are starting from here ==');
    console.log('Log channel ID:', log);
    const logChannel = client.channels.cache.get(log);
    if (logChannel) {
      console.log('Log channel found:', logChannel.name);
    } else {
      console.error('Log channel NOT found! Check channel ID in config.js');
    }
    console.log('Logging config:', getLoggingConfig());
  });

const config = require("./config.js");
const CoinManager = require("./coins.js");
const fs = require('fs');
const owner = config.modmail.ownerID
const supportcat = config.modmail.supportId
const premiumcat = config.modmail.premiumId
const whitelistrole = config.modmail.whitelist
const staffID = config.modmail.staff
const log = config.logs.logschannel;
const cooldowns = new Map(); // Map to track cooldowns
const coinManager = new CoinManager();

// Logging configuration functions
function getLoggingConfig() {
  try {
    return JSON.parse(fs.readFileSync('./logging.json', 'utf8'));
  } catch (error) {
    // Default config if file doesn't exist
    const defaultConfig = {
      pointsTransactions: true,
      historyViews: true,
      ticketCreation: true,
      ticketDeletion: true,
      ticketClosure: true,
      balanceChecks: false,
      leaderboardViews: false,
      helpCommands: false
    };
    fs.writeFileSync('./logging.json', JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }
}

function updateLoggingConfig(config) {
  fs.writeFileSync('./logging.json', JSON.stringify(config, null, 2));
}

function shouldLog(logType) {
  const config = getLoggingConfig();
  return config[logType] === true;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Coin commands
  if (message.content.toLowerCase().startsWith("!points")) {
    const args = message.content.split(" ");
    const command = args[1];

    // Check balance
    if (!command || command === "balance") {
      const userId = message.mentions.users.first()?.id || message.author.id;
      const balance = coinManager.getBalance(userId);
      const user = message.mentions.users.first() || message.author;

      const balanceEmbed = new EmbedBuilder()
        .setTitle("Points Balance")
        .setDescription(`${user.displayName} has **${balance}** Refferal Points`)
        .setColor("#00FF46")
        .setThumbnail(user.displayAvatarURL());

      // Log balance check if enabled
      if (shouldLog('balanceChecks') && userId !== message.author.id) {
        const logEmbed = new EmbedBuilder()
          .setTitle("🔍 Balance Check Log")
          .setDescription(`**User:** ${message.author.displayName}\n**Checked Balance Of:** ${user.displayName}\n**Current Balance:** ${balance}`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `Target User ID: ${userId} | Checker ID: ${message.author.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }

      return message.channel.send({ embeds: [balanceEmbed] });
    }

    // Admin commands - check if user has admin permissions
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== owner) {
      return message.channel.send("❌ You need administrator permissions to use this command.");
    }

    // Give coins
    if (command === "give") {
      const user = message.mentions.users.first();
      const amount = parseInt(args[3]);

      if (!user || isNaN(amount) || amount <= 0) {
        return message.channel.send("❌ Usage: `!Points give @user amount`");
      }

      const oldBalance = coinManager.getBalance(user.id);
      const newBalance = coinManager.addCoins(user.id, amount, message.author.id);

      const giveEmbed = new EmbedBuilder()
        .setTitle("💰 Points Given")
        .setDescription(`Given **${amount}** Points to ${user.displayName}\nNew balance: **${newBalance}** Points`)
        .setColor("#00FF46")
        .setThumbnail(user.displayAvatarURL());

      message.channel.send({ embeds: [giveEmbed] });

      // Log to the logs channel if enabled
      if (shouldLog('pointsTransactions')) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Points Transaction Log")
          .setDescription(`**Action:** Points Given\n**Admin:** ${message.author.displayName}\n**User:** ${user.displayName}\n**Amount:** +${amount}\n**Old Balance:** ${oldBalance}\n**New Balance:** ${newBalance}`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `User ID: ${user.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }
    }

    // Remove coins
    else if (command === "remove") {
      const user = message.mentions.users.first();
      const amount = parseInt(args[3]);

      if (!user || isNaN(amount) || amount <= 0) {
        return message.channel.send("❌ Usage: `!Points remove @user amount`");
      }

      const oldBalance = coinManager.getBalance(user.id);
      const newBalance = coinManager.removeCoins(user.id, amount, message.author.id);

      const removeEmbed = new EmbedBuilder()
        .setTitle("💰 Refferal Points Removed")
        .setDescription(`Removed **${amount}** Points from ${user.displayName}\nNew balance: **${newBalance}** Points`)
        .setColor("#00FF46")
        .setThumbnail(user.displayAvatarURL());

      message.channel.send({ embeds: [removeEmbed] });

      // Log to the logs channel if enabled
      if (shouldLog('pointsTransactions')) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Points Transaction Log")
          .setDescription(`**Action:** Points Removed\n**Admin:** ${message.author.displayName}\n**User:** ${user.displayName}\n**Amount:** -${amount}\n**Old Balance:** ${oldBalance}\n**New Balance:** ${newBalance}`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `User ID: ${user.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }
    }

    // Set coins
    else if (command === "set") {
      const user = message.mentions.users.first();
      const amount = parseInt(args[3]);

      if (!user || isNaN(amount) || amount < 0) {
        return message.channel.send("❌ Usage: `!Refferal Points @user amount`");
      }

      const oldBalance = coinManager.getBalance(user.id);
      const newBalance = coinManager.setCoins(user.id, amount, message.author.id);

      const setEmbed = new EmbedBuilder()
        .setTitle("💰 Refferal Points Set")
        .setDescription(`Set ${user.displayName}'s Refferal Points to **${newBalance}**`)
        .setColor("#00FF46")
        .setThumbnail(user.displayAvatarURL());

      message.channel.send({ embeds: [setEmbed] });

      // Log to the logs channel if enabled
      if (shouldLog('pointsTransactions')) {
        const logEmbed = new EmbedBuilder()
          .setTitle("📊 Points Transaction Log")
          .setDescription(`**Action:** Points Set\n**Admin:** ${message.author.displayName}\n**User:** ${user.displayName}\n**Old Balance:** ${oldBalance}\n**New Balance:** ${newBalance}`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `User ID: ${user.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }
    }

    // Leaderboard
    else if (command === "leaderboard" || command === "lb") {
      const leaderboard = coinManager.getLeaderboard(10);

      if (leaderboard.length === 0) {
        return message.channel.send("📊 No users have Refferal Points yet!");
      }

      let description = "";
      for (let i = 0; i < leaderboard.length; i++) {
        const [userId, coins] = leaderboard[i];
        const user = client.users.cache.get(userId);
        const username = user ? user.displayName : "Unknown User";
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
        description += `${medal} **${username}** - ${coins} Refferal Points\n`;
      }

      const leaderboardEmbed = new EmbedBuilder()
        .setTitle("🏆 Refferal Points Leaderboard")
        .setDescription(description)
        .setColor("#00FF46")
        .setFooter({ text: `${message.guild.name} | Top 10 Users` });

      // Log leaderboard view if enabled
      if (shouldLog('leaderboardViews')) {
        const logEmbed = new EmbedBuilder()
          .setTitle("🏆 Leaderboard View Log")
          .setDescription(`**User:** ${message.author.displayName}\n**Action:** Viewed leaderboard`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `User ID: ${message.author.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }

      message.channel.send({ embeds: [leaderboardEmbed] });
    }

    // History command
    else if (command === "history") {
      const user = message.mentions.users.first();

      if (!user) {
        return message.channel.send("❌ Usage: `!Points history @user`");
      }

      const history = coinManager.getHistory(user.id, 10);

      if (history.length === 0) {
        return message.channel.send(`📊 No transaction history found for ${user.displayName}.`);
      }

      let description = "";
      for (const transaction of history) {
        const admin = client.users.cache.get(transaction.adminId);
        const adminName = admin ? admin.displayName : "Unknown Admin";
        const date = new Date(transaction.timestamp).toLocaleDateString();
        const time = new Date(transaction.timestamp).toLocaleTimeString();

        let actionText = "";
        if (transaction.action === "give") {
          actionText = `📈 **+${transaction.amount}** points given`;
        } else if (transaction.action === "remove") {
          actionText = `📉 **-${transaction.amount}** points removed`;
        } else if (transaction.action === "set") {
          actionText = `⚖️ Points set to **${transaction.newBalance}**`;
        }

        description += `${actionText}\n`;
        description += `🔸 **Admin:** ${adminName}\n`;
        description += `🔸 **Balance:** ${transaction.oldBalance} → ${transaction.newBalance}\n`;
        description += `🔸 **Date:** ${date} at ${time}\n\n`;
      }

      const historyEmbed = new EmbedBuilder()
        .setTitle(`📊 Points History for ${user.displayName}`)
        .setDescription(description)
        .setColor("#00FF46")
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: `Showing last 10 transactions | User ID: ${user.id}` });

      message.channel.send({ embeds: [historyEmbed] });

      // Log the history view to the logs channel if logging is enabled
      if (shouldLog('historyViews')) {
        const viewLogEmbed = new EmbedBuilder()
          .setTitle("👁️ History View Log")
          .setDescription(`**User:** ${message.author.displayName}\n**Viewed History Of:** ${user.displayName}\n**Action:** Viewed transaction history`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `Target User ID: ${user.id} | Viewer ID: ${message.author.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [viewLogEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }
    }

    // Help command
    else if (command === "help") {
      const helpEmbed = new EmbedBuilder()
        .setTitle("💰 Refferal Points System Help")
        .setDescription(`
**User Commands:**
\`!Points\` or \`!Points balance\` - Check your Refferal Points balance
\`!Points balance @user\` - Check another user's balance
\`!Points leaderboard\` - View the top 10 users

**Admin Commands:**
\`!Points give @user amount\` - Give Refferal Points to a user
\`!Points remove @user amount\` - Remove Refferal Points from a user
\`!Points set @user amount\` - Set a user's Refferal Points balance
\`!Points history @user\` - View transaction history for a user

**Owner Commands:**
\`!log status\` - View current logging settings
\`!log toggle <type>\` - Toggle specific logging type
\`!log enable <type>\` - Enable specific logging type
\`!log disable <type>\` - Disable specific logging type
        `)
        .setColor("#00FF46")
        .setFooter({ text: "Admin commands require Administrator permissions" });

      // Log help command usage if enabled
      if (shouldLog('helpCommands')) {
        const logEmbed = new EmbedBuilder()
          .setTitle("❓ Help Command Log")
          .setDescription(`**User:** ${message.author.displayName}\n**Action:** Viewed help command`)
          .setColor("#00FF46")
          .setTimestamp()
          .setFooter({ text: `User ID: ${message.author.id}` });

        const logChannel = client.channels.cache.get(log);
        if (logChannel) {
          logChannel.send({ embeds: [logEmbed] }).catch(console.error);
        } else {
          console.error('Log channel not found:', log);
        }
      }

      message.channel.send({ embeds: [helpEmbed] });
    }
  }

  // Logging management commands (Owner only)
  if (message.content.toLowerCase().startsWith("!log") && message.author.id === owner) {
    const args = message.content.split(" ");
    const command = args[1];

    if (command === "status") {
      const config = getLoggingConfig();
      let statusText = "";

      Object.entries(config).forEach(([key, value]) => {
        const emoji = value ? "✅" : "❌";
        const readableName = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        statusText += `${emoji} **${readableName}**: ${value ? 'Enabled' : 'Disabled'}\n`;
      });

      const statusEmbed = new EmbedBuilder()
        .setTitle("📊 Logging Status")
        .setDescription(statusText)
        .setColor("#00FF46")
        .setFooter({ text: "Use !log toggle <type> to change settings" });

      return message.channel.send({ embeds: [statusEmbed] });
    }

    if (command === "toggle" || command === "enable" || command === "disable") {
      const logType = args[2];
      const config = getLoggingConfig();

      if (!logType || !config.hasOwnProperty(logType)) {
        const availableTypes = Object.keys(config).join(", ");
        return message.channel.send(`❌ Invalid log type. Available types: ${availableTypes}`);
      }

      if (command === "toggle") {
        config[logType] = !config[logType];
      } else if (command === "enable") {
        config[logType] = true;
      } else if (command === "disable") {
        config[logType] = false;
      }

      updateLoggingConfig(config);

      const action = config[logType] ? 'enabled' : 'disabled';
      const emoji = config[logType] ? '✅' : '❌';

      const confirmEmbed = new EmbedBuilder()
        .setTitle("⚙️ Logging Updated")
        .setDescription(`${emoji} **${logType}** logging has been **${action}**`)
        .setColor(config[logType] ? "#00FF46" : "#00FF46");

      return message.channel.send({ embeds: [confirmEmbed] });
    }

    if (command === "help") {
      const helpEmbed = new EmbedBuilder()
        .setTitle("📝 Logging Management Help")
        .setDescription(`
**Commands:**
\`!log status\` - View current logging settings
\`!log toggle <type>\` - Toggle specific logging type
\`!log enable <type>\` - Enable specific logging type
\`!log disable <type>\` - Disable specific logging type

**Available Log Types:**
• \`pointsTransactions\` - Points give/remove/set actions
• \`historyViews\` - When someone views another user's history
• \`ticketCreation\` - When tickets are created
• \`ticketDeletion\` - When tickets are deleted
• \`ticketClosure\` - When tickets are closed
• \`balanceChecks\` - When someone checks another user's balance
• \`leaderboardViews\` - When someone views the leaderboard
• \`helpCommands\` - When someone uses help commands
        `)
        .setColor("#00FF46")
        .setFooter({ text: "Only the bot owner can manage logging settings" });

      return message.channel.send({ embeds: [helpEmbed] });
    }
  }

  if (message.author.id === owner) {
    if (message.content.toLowerCase().startsWith("!ticket-embed")) {
      message.delete();
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel("📨 Support Tickets")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("support"),
          new ButtonBuilder()
            .setLabel("💸 Middleman Tickets")
            .setStyle(ButtonStyle.Primary)
            .setCustomId("premium")
        );

      const ticketmsg = new EmbedBuilder()
        .setTitle(`Grow A Garden┃Trading & Stocks Tickets`)

        .setDescription(

          `**Welcome to our Ticket System!** 🎫
         ==========================
📨 **Support Tickets:** For general support and assistance.

💸 **Middleman Tickets:** For using our free middleman services.
`
        )
        .setFooter({ text: `${message.guild.name} Tickets | Made by Game Services`, iconURL: message.guild.iconURL() })
        .setColor("#00FF46");

      message.channel.send({
        embeds: [ticketmsg],
        components: [row],
      });
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      const userId = interaction.user.id;
      const userCooldown = cooldowns.get(userId) || 0;
      const currentTime = Date.now();

      if (userCooldown > currentTime && (interaction.customId === "support" || interaction.customId === "premium")) {
        const remainingTime = Math.ceil((userCooldown - currentTime) / 1000);
        interaction.reply({
          content: `You're on a cooldown. Please wait ${remainingTime} seconds before opening another ticket.`,
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId === "support" || interaction.customId === "premium") {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("⚙️ Manage")
            .setCustomId("close")
            .setStyle(ButtonStyle.Primary)
        );

        const supportmsg = new EmbedBuilder()
          .setTitle(`${interaction.user.displayName}'s Support Ticket`)
          .setDescription(
            "**Hello!**\nPlease provide the reason for this support ticket, and our staff team will respond as fast as possible"
          )
          .setFooter({ text: `User ID: ${interaction.user.id} Grow A Garden┃Trading & Stocks.` })
          .setColor("#00FF46");

        const premiummsg = new EmbedBuilder()
          .setTitle(`${interaction.user.displayName}'s Buying Ticket`)
          .setDescription(
            "**Hello there!**\nPlease provide the reason for this buying ticket, and our staff team will respond as fast as possible"
          )
          .setFooter({ text: `User ID: ${interaction.user.id} Game Services Premuim.` })
          .setColor("#00FF46");

        if (interaction.customId === "support") {
          const ticket = await interaction.guild.channels.create({
            name: `ticket ${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: supportcat,
            permissionOverwrites: [
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: whitelistrole,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
          });

          interaction.reply({
            content: `<#${ticket.id}> has been made for you under Premuim General Support Category.`,
            ephemeral: true,
          });

          if (shouldLog('ticketCreation')) {
            const logChannel = client.channels.cache.get(log);
            if (logChannel) {
              logChannel.send(`# New Ticket\n\n**User:** <@${interaction.user.id}> opened <#${ticket.id}> under General Support Category!`).catch(console.error);
            } else {
              console.error('Log channel not found:', log);
            }
          }
          ticket.send({
            content: `<@&${staffID}>\n**==========================**`,
            embeds: [supportmsg],
            components: [row2],
          });

          // Set cooldown for the user (2 hours in milliseconds)
          cooldowns.set(userId, currentTime + 2 * 60 * 60 * 1000);
        }

        if (interaction.customId === "premium") {
          const ticket = await interaction.guild.channels.create({
            name: `ticket ${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: premiumcat,
            permissionOverwrites: [
              {
                id: interaction.user.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: whitelistrole,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                ],
              },
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
              },
            ],
            });

          interaction.reply({
            content: `<#${ticket.id}> has been made for you under Premium Middleman Services Category.`,
            ephemeral: true,
          });

          if (shouldLog('ticketCreation')) {
            const logChannel = client.channels.cache.get(log);
            if (logChannel) {
              logChannel.send(`# New Ticket\n\n**User:** <@${interaction.user.id}> opened <#${ticket.id}> under Buying Support Category!`).catch(console.error);
            } else {
              console.error('Log channel not found:', log);
            }
          }
          ticket.send({
            content: `<@&${staffID}>\n**==========================**`,
            embeds: [premiummsg],
            components: [row2],
          });

          // Set cooldown for the user (2 hours in milliseconds)
          cooldowns.set(userId, currentTime + 2 * 60 * 60 * 1000);
        }
      } else if (interaction.customId === "close") {
        // Check if the user has the whitelisted role
        const guild = interaction.guild;
        const member = guild.members.cache.get(userId);

        if (!member.roles.cache.has(whitelistrole)) {
          // User is not whitelisted, send an ephemeral message
          interaction.reply({
            content: "You are not whitelisted to perform this action, You need helper role.",
            ephemeral: true,
          });
          return;
        }

        const deleteButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel("🗑️ Delete")
              .setCustomId("delete")
              .setStyle(ButtonStyle.Danger)
          );

        const close2Button = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel("🔒 Close")
              .setCustomId("close2")
              .setStyle(ButtonStyle.Primary)
          );

        interaction.update({ content: `<@${interaction.user.id}> **Please click on either of the following button.**`, components: [deleteButton, close2Button] });
      } else if (interaction.customId === "delete") {
        // Delete the channel
        const channel = interaction.channel;
        channel.delete()
          .then(() => {
            interaction.reply("Ticket channel deleted.");
            if (shouldLog('ticketDeletion')) {
              const logChannel = client.channels.cache.get(log);
              if (logChannel) {
                logChannel.send(`# Ticket Deleted\n\n**User:** <@${interaction.user.id}> deleted a ticket.`).catch(console.error);
              } else {
                console.error('Log channel not found:', log);
              }
            }
          })
          .catch(console.error);
      } else if (interaction.customId === "close2") {
        interaction.channel.permissionOverwrites.set([
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
          }
        ]);
        interaction.reply(`<@${interaction.user.id}> closed the ticket.`);
        if (shouldLog('ticketClosure')) {
          const logChannel = client.channels.cache.get(log);
          if (logChannel) {
            logChannel.send(`# Ticket Closed\n\n**User:** <@${interaction.user.id}> closed a ticket.`).catch(console.error);
          } else {
            console.error('Log channel not found:', log);
          }
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (message.content.toLowerCase() === `!setup`) {
    // Create General Tickets category
    const generalTicketsCategory = await message.guild.channels.create({
      name: 'General Tickets',
      type: ChannelType.GuildCategory,
    });

    // Create Premium Tickets category
    const premiumTicketsCategory = await message.guild.channels.create({
      name: 'Premium Tickets',
      type: ChannelType.GuildCategory,
    });

    // Create Ticket Logs category
    const ticketLogsCategory = await message.guild.channels.create({
      name: 'Logs', 
      type: ChannelType.GuildCategory,
    });

    // Create a channel inside Ticket Logs category named 'ticket-logs'
    const ticket = await message.guild.channels.create({
      name: `ticket logs`,
      type: ChannelType.GuildText,
      parent: ticketLogsCategory,
      permissionOverwrites: [
        {
          id: message.author.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: whitelistrole,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: message.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
      ],
      });

    // Reply to the user in the channel where the command was received
    message.channel.send('Ticket setup completed!');
  }
});

client.login(process.env.TOKEN);