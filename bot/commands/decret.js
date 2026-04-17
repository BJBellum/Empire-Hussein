const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('decret')
    .setDescription('[Admin] Émettre un décret impérial dans ce salon')
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('Contenu du décret')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Accès refusé. Réservé aux administrateurs impériaux.', ephemeral: true });
    }

    const message = interaction.options.getString('message');

    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('📜 DÉCRET IMPÉRIAL')
      .setDescription(message)
      .setFooter({ text: `Émis par ${interaction.user.username} — Au nom de l'Empire Hussein` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
