# discord-role-call
`const RoleCall = require('discord-role-call');`

This package enables management of automated Role-Calling. You will need a Discord.js bot to use it. Additionally, 
please ensure that you place at least one of your bot's roles above the roles you wish to manage under Role Call.

### Configuration

Proper configuration requires three distinct elements:
1. Gathering the ID's of all roles you wish to place under Role Call
2. Choose an emoji for each role (note: custom server emojis are not yet supported, coming soon)
3. Create your role call message listing the roles and corresponding emojis in the channel you would like it to be in,
   and gather the server, channel, and message ID's
	

These will need to be arranged in a JSON or Object like this, using these key/property names (example):

```json
{
	"roleInputArray" : 
	[
		{"role": "672948198166753310", "emoji": "☄️"},
		{"role": "674307556944402591", "emoji": "🪐"},
		{"role": "674307564952128256", "emoji": "🌟"},
		{"role": "674307585642349322", "emoji": "⭐"},
		{"role": "674307572931045258", "emoji": "☀️"},
		{"role": "674101354955633680", "emoji": "💡"},
		{"role": "674101051159230229", "emoji": "💾"},
		{"role": "674100802012480234", "emoji": "💿"},
		{"role": "674101120344284059", "emoji": "🔌"},
		{"role": "674100924052421554", "emoji": "📀"},
		{"role": "674031221694429638", "emoji": "🐣"},
		{"role": "674032329915634944", "emoji": "🐥"},
		{"role": "674031512380057098", "emoji": "🐤"},
		{"role": "674032285325850880", "emoji": "🐦"},
		{"role": "674028539236503489", "emoji": "🐛"},
		{"role": "674032129064301000", "emoji": "🦋"},
		{"role": "674031226323917629", "emoji": "🎲"},
		{"role": "674032127464348259", "emoji": "♟️"},
		{"role": "674031310034646779", "emoji": "🐴"},
		{"role": "674032127444031740", "emoji": "🦄"}
	],
	"guildId" : "673769983804853791",
	"channelId" : "674870421029268483",
	"messageId" : "674892871099375637"
}
```

This process will be automated with a user-friendly interface in a future update, timeframe unknown. Please check for 
updates frequently, as this project will remain in active development for the forseable future. This message will 
be updated if that changes.


### Usage

The Role Call is powered by an event system. The Role Call object first recieves and does initial handling on 
'reaction' events from the client. If they are related to the Role Call, it will emit an approproate event. 
When a reaction is added where a user has added the reaction to the Role Call message, the reaction is mapped 
to one of the managed roles, and the user is not a bot, the Role Call object will emit 'roleReactionAdd'. 
Under the same circumstances but where a user has instead removed a reaction, the object will emit 
'roleReactionRemove'. After some back and forth, I have elected not to pre-screenthe events for whether the user
aleady does/does not have the role in question, respectively, in order to provide more direct control. This 
means you will need to do this check yourself at some point before calling addRole/removeRole. The event is
emitted with the following arguments: reaction, which is the MessageReaction object that was added/removed; 
member, which is the GuildMember object that added/removed the reaction; and role, which is the Role object that
the reaction is mapped to. You are free to do as much or as little logic to this as you wish, although I 
reccomend at minimum verifying whether the user does or does not already have the role, depending on add or remove
respectively, as too many listeners and role add/remove timeout can easily become a problem. For convenience, there
is an implementation of a basic handler for both adding and removing roles bundled into the object, that comes with
basic error handling based on the things I have worked out. If you find other errors and/or know how to set this up 
better than I do, I would really appreciate the opportunity to improve it! Currently, it is mostly geared towards
handling the API timeout from too many add/remove role requests being sent on one user at once. It catches the error,
delays for 7 seconds, and then retries. On a second failure, it will return a new error that has the stack of the 
first error bundled into it. These handlers (they are nearly identical for add and remove which is why I refer to 
them together) are set up as promises, with successful resolution returning the edited member, and failure returning
the aforementioned error.


### Constraints

You can have up to 20 roles per RoleCall object, due to Discord limiting messages to 20 reactions per message. If you
need more, create a more messages continueing to list roles, and keep track of which role-emoji pairs are on which 
message. Create seperate RoleCall instances for each. RoleCall instances must be in variables at the same scope as your
client, however they cannot be initialized until the client has completed login and connected to Discord. As such, it is 
easiest to declare variables at normal scope, and initialize them inside the "ready" handler. The event handlers can throw 
errors so you will need to catch them if you don't want them to crash you, and the constructor will throw errors that it 
encounters too, unless you change that in the source code (there are comments there that suggest it) so that the 
construction won't stop.
