require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel]
});

// Load environment variables
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;

// Maps to track user-channel relationships
const userChannelMap = new Map();
const channelUserMap = new Map();
let ticketCounter = 1;

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
        console.error('Guild not found.');
        return;
    }

    try {
        // Handle Direct Messages (User starts a ticket)
        if (message.channel.isDMBased()) {
            let channel = userChannelMap.get(message.author.id);
            if (!channel) {
                channel = await guild.channels.create({
                    name: `ticket-${ticketCounter++}-${message.author.username}`,
                    type: 0, // Text channel
                    parent: CATEGORY_ID,
                    topic: `Ticket with ${message.author.tag}`
                });

                userChannelMap.set(message.author.id, channel);
                channelUserMap.set(channel.id, message.author.id);

                // Notify staff
                const staffEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setTitle('🆕 New Ticket Opened')
                    .addFields(
                        { name: 'User', value: message.author.tag, inline: true },
                        { name: 'User ID', value: message.author.id, inline: true }
                    )
                    .setFooter({ text: 'BrotherHood Support Team' })
                    .setTimestamp();

                await channel.send({ embeds: [staffEmbed] });

                // Send auto DM to the user
                const userEmbed = new EmbedBuilder()
                    .setColor(0xFFD700)
                    .setTitle('📩 Support Ticket Created')
                    .setDescription(`Hello **${message.author.username}**,  
                    Your ticket has been created successfully! 🎉  
                    Our support team will respond to you as soon as possible.\n\n
                    🔹 **Please be patient.**  
                    🔹 **Check your DMs for responses.**\n\n
                    Thank you for reaching out to **BrotherHood Support**!`)
                    .setFooter({ text: 'BrotherHood Support Team' })
                    .setTimestamp();

                await message.author.send({ embeds: [userEmbed] });
            }

            // Forward user message to modmail channel in an embed
            if (message.content.trim().length > 0) {
                const userMessageEmbed = new EmbedBuilder()
                    .setColor(0x00AE86)
                    .setAuthor({ name: `${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setDescription(`📩 **User Message:** \n 
                    ${message.content}
                    `)
                    .setFooter({ text: `User ID: ${message.author.id}` })
                    .setTimestamp();

                await channel.send({ embeds: [userMessageEmbed] });
            }
        }

        // Handle Staff Responses in Modmail Channels
        if (message.guild && channelUserMap.has(message.channel.id)) {
            const userId = channelUserMap.get(message.channel.id);
            const user = await client.users.fetch(userId);

            if (message.content.startsWith('!reply ')) {
                const member = await message.guild.members.fetch(message.author.id);
                if (!member.roles.cache.has(STAFF_ROLE_ID)) {
                    return message.channel.send('❌ You do not have permission to respond.');
                }

                const response = message.content.slice(7).trim();
                if (response.length > 0) {
                    const replyEmbed = new EmbedBuilder()
                        .setColor(0x3498DB)
                        .setAuthor({ name: `Support Team`, iconURL: client.user.displayAvatarURL() })
                        .setDescription(`💬 **Staff Response:** \n 
                        ${response}
                        `)
                        .setFooter({ text: 'BrotherHood Support Team' })
                        .setTimestamp();

                    await user.send({ embeds: [replyEmbed] });
                    await message.channel.send({ embeds: [replyEmbed] });
                    await message.react('✅');
                }
            }

            if (message.content.startsWith('!close')) {
                const member = await message.guild.members.fetch(message.author.id);
                if (!member.roles.cache.has(STAFF_ROLE_ID)) {
                    return message.channel.send('❌ You do not have permission to close tickets.');
                }

                // Send attractive closing message
                const closingEmbed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('🎟 Ticket Closed')
                    .setDescription(`Hello **${user.username}**,  
                    Your support ticket has been successfully closed. ✅\n\n
                    We're always here to help! If you need assistance again, simply send us a DM, and a new ticket will be created for you. 📨\n\n
                    Thank you for choosing **BrotherHood Support**!  
                    🎉 **Stay safe and take care!**`)
                    .setFooter({ text: 'BrotherHood Support Team' })
                    .setTimestamp();

                await user.send({ embeds: [closingEmbed] });

                userChannelMap.delete(userId);
                channelUserMap.delete(message.channel.id);
                await message.channel.delete();
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

client.login(TOKEN);
