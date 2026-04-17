const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Latence du bot de l\'Empire'),
  async execute(interaction) {
    const latency = interaction.client.ws.ping;
    const embed = new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('⚡ Signal de l\'Empire')
      .setDescription(`Latence : **${latency}ms**`)
      .setFooter({ text: 'Empire Hussein — Signal reçu' });
    await interaction.reply({ embeds: [embed] });
  },
};
