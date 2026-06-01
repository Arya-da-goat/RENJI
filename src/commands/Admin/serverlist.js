import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { botConfig } from '../../config/bot.js';

const OWNER_ID = '1478793986700349470';

export default {
    data: new SlashCommandBuilder()
        .setName('serverlist')
        .setDescription('List all servers the bot is in (Bot Owner only)'),
    category: 'Admin',

    async execute(interaction) {
        // Owner-only guard — check both the hardcoded ID and the OWNER_IDS env var
        const owners = [OWNER_ID, ...(botConfig.commands.owners || [])];
        if (!owners.includes(interaction.user.id)) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [
                    errorEmbed(
                        '🔒 Access Denied',
                        'This command is restricted to the bot owner only.'
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferSuccess) {
            logger.warn('Serverlist interaction defer failed', {
                userId: interaction.user.id,
                commandName: 'serverlist',
            });
            return;
        }

        try {
            const guilds = [...interaction.client.guilds.cache.values()];

            if (guilds.length === 0) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        createEmbed({
                            title: '🌐 Server List',
                            description: 'The bot is not in any servers.',
                            color: 'warning',
                        }),
                    ],
                });
            }

            // Discord embed descriptions are capped at 4096 characters.
            // We chunk guilds into pages of up to 25 servers each so every
            // entry is always visible regardless of how many servers exist.
            const PAGE_SIZE = 25;
            const pages = [];

            for (let i = 0; i < guilds.length; i += PAGE_SIZE) {
                const chunk = guilds.slice(i, i + PAGE_SIZE);
                const lines = chunk.map((guild, idx) => {
                    const serial = i + idx + 1;
                    const memberCount = guild.memberCount.toLocaleString();
                    return `\`${String(serial).padStart(3, ' ')}.\` **${guild.name}** — ${memberCount} members`;
                });
                pages.push(lines.join('\n'));
            }

            const totalMembers = guilds
                .reduce((acc, g) => acc + g.memberCount, 0)
                .toLocaleString();

            // Send the first page (and only page for most bots).
            // If there are multiple pages, append them as follow-up embeds.
            const baseEmbed = createEmbed({
                title: '🌐 Server List',
                description: pages[0],
                color: 'primary',
                footer: {
                    text: `Total: ${guilds.length} server${guilds.length !== 1 ? 's' : ''} · ${totalMembers} members`,
                },
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [baseEmbed],
            });

            // Send additional pages as ephemeral follow-ups if needed
            for (let p = 1; p < pages.length; p++) {
                const pageEmbed = createEmbed({
                    title: `🌐 Server List (Page ${p + 1}/${pages.length})`,
                    description: pages[p],
                    color: 'primary',
                    footer: {
                        text: `Total: ${guilds.length} server${guilds.length !== 1 ? 's' : ''} · ${totalMembers} members`,
                    },
                });

                await interaction.followUp({
                    embeds: [pageEmbed],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            logger.error('Serverlist command error:', error);
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'System Error',
                        description: 'Could not fetch the server list.',
                        color: 'error',
                    }),
                ],
            });
        }
    },
};
