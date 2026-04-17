const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    client.user.setPresence({
      activities: [{ name: 'l\'Empire Hussein', type: ActivityType.Watching }],
      status: 'online',
    });
    console.log(`Bot connecté en tant que ${client.user.tag}`);
  },
};
