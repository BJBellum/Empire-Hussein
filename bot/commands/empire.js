const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('empire')
    .setDescription('Informations sur l\'Empire Hussein'),
  async execute(interaction) {
    const isAdmin = ADMIN_IDS.includes(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('⚜️ Empire Hussein')
      .setDescription('Monarchie théocratique absolue. Une vision. Une volonté. Un Empire.')
      .addFields(
        { name: '🏛️ Régime', value: 'Monarchie théocratique absolue', inline: true },
        { name: '👑 Dirigeant', value: 'La famille Hussein', inline: true },
        { name: '🌐 Site officiel', value: '[bjbellum.github.io/Empire-Hussein](https://bjbellum.github.io/Empire-Hussein/)', inline: false },
        { name: '🔒 Votre rang', value: isAdmin ? '**Administrateur impérial**' : 'Citoyen de l\'Empire', inline: true },
      )
      .setFooter({ text: 'Empire Hussein — Gloire éternelle' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
