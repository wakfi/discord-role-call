# RoleCall.js
`const RoleCall = require('discord-role-call');`

This package enables management of automated Role-Calling. You will need a Discord.js bot to use it. Additionally, please ensure that you place at least one role of your bot above the roles you wish to manage under Role Call.

## Configuration

Proper configuration requires three distinct elements:
1. Gathering the ID's of all roles you wish to place under Role Call
2. Choose an emoji for each role (note: custom server emojis are not yet supported, coming soon)
3. Create your role call message listing the roles and corresponding emojis in the channel you would like it to be in, and gather the server, channel, and message ID's
	

These will need to be arranged in a JSON like this, using these key names (example):

```json
{
	"roleInputArray" : 
	[
		{"role": "674309198166753310", "emoji": "☄️"},
		{"role": "674307556734402591", "emoji": "🪐"},
		{"role": "674307567052128256", "emoji": "🌟"},
		{"role": "674307569342349322", "emoji": "⭐"},
		{"role": "674307575701045258", "emoji": "☀️"},
		{"role": "674101356155633680", "emoji": "💡"},
		{"role": "674101051112030229", "emoji": "💾"},
		{"role": "674100802406580234", "emoji": "💿"},
		{"role": "674101140954284059", "emoji": "🔌"},
		{"role": "674100988822421554", "emoji": "📀"},
		{"role": "674031221541699638", "emoji": "🐣"},
		{"role": "674032329919954944", "emoji": "🐥"},
		{"role": "674031156580057098", "emoji": "🐤"},
		{"role": "674032298185850880", "emoji": "🐦"},
		{"role": "674028539229503489", "emoji": "🐛"},
		{"role": "674032129449001000", "emoji": "🦋"},
		{"role": "674031226977517629", "emoji": "🎲"},
		{"role": "674032127108448259", "emoji": "♟️"},
		{"role": "674031310024736779", "emoji": "🐴"},
		{"role": "674032120834031740", "emoji": "🦄"}
	],
	"guildId" : "673769572804853791",
	"channelId" : "674870421237268483",
	"messageId" : "674874071099375637"
}
```

This process will be automated with a user-friendly interface in a future update, timeframe unknown.


## Constraints
You can have up to 20 roles per RoleCall object, due to Discord limiting messages to 20 reactions per message. If you need more, create a more messages continueing to list roles, and keep track of which role-emoji pairs are on which message. Create seperate RoleCall instances for each.
RoleCall instances must be in variables at the same scope as your client, however they cannot be initialized until the client has completed login and connected to Discord. As such, it is easiest to declare variables at normal scope, and initialize them inside the "ready" handler.
