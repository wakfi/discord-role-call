const path = require('path');
const EventEmitter = require('events');
const Collection = require((require.resolve('discord.js')).split(path.sep).slice(0, -1).join(path.sep) + `${path.sep}util${path.sep}Collection.js`);

/**
 * Options required to configure a RoleCall instance. Specifies one message to listen to
 * @typedef {Object} RoleCallConfig
 * @property {RoleEmojiPair[]} [roleInputArray] Array of RoleEmojiPairs describing the setup of the roles & corresponding reactions, maximum 20
 * @property {string}   [GuildId] ID of Guild with message to monitor for Role Call
 * @property {string}   [ChannelId] ID of Channel with message to monitor for Role Call
 * @property {string}   [MessageId] ID of Message to monitor for Role Call
 */

/**
 * Describes a RoleID - Emoji association
 * @typedef {Object} RoleEmojiPair
 * @property {string} [role] A role snowflake, represented as a string
 * @property {string} [emoji] Identifier of emoji to use as reaction for role. This can be a unicode emoji, or the raw format of a custom guild emoji (i.e. <:name:id>)
 */

/**
 *  Each RoleCall can handle up to 20 roles due to Discord limiting messages to 20 reactions/message. 
 *	Make additional role call messages and additional, seperate RoleCall objects for them if you need
 * 	to call more roles.
 */
class RoleCall extends EventEmitter
{
	/**
	 * Create a new RoleCall instance for a given client and configuration options
	 * @param {Discord.Client} [client] Represents the bot client
	 * @param {RoleCallConfig} [config] Configuration/setup information for RoleCall instance 
	 */
	constructor(client,config) 
	{
		super();
		this.client = client; // this is the syntax for declaring object properties in JS
		this.guild = client.guilds.cache.get(config.guildId);
		this.guild.channels.cache.get(config.channelId).messages.fetch(config.messageId).then(theMessage =>
		{
			this.message = theMessage; // because we need the message object, we have to retrieve it, and because internet, this takes time. so we have to wait and set it here
			this.roles = new Collection(); // @type: Collection<Snowflake, Role> where the Snowflake is the ID of the role 
			this.roleEmojiPairs = new Collection(); // @type: Collection<Emoji, Role> where Emoji is the emoji identifier that is associated with the role 
			this.reactions = new Collection(); // @type: Collection<Snowflake, MessageReaction> passed in as emoji resolvables								  
			const reactArr = []; // this is a local variable that will be used during construction
			
			// Set roles collection. Collection is an extension of the JavaScript Map object with expanded functionality, primarily for mapping ID (aka snowflake) to object
			config.roleInputArray.map(roleToCall => 
			{ 
				this.guild.roles.fetch();
				if(this.guild.roles.cache.has(roleToCall.role))
				{
					this.roles.set(roleToCall.role, this.guild.roles.cache.get(roleToCall.role));
					this.roleEmojiPairs.set(roleToCall.emoji, this.guild.roles.cache.get(roleToCall.role));
				} else {
					throw new Error(`${this.guild} does not have role resolvable with ${roleToCall.role}`); //change this to log instead of throwing if you don't want object construction to break, in other words, if you don't want this to be fatal to the instantiation
				}
			});
			
			// Collect matching reaction objects from existing reactions
			this.message.reactions && this.message.reactions.cache.forEach(reaction => 
			{
				if(this.roleEmojiPairs.has(reaction.emoji.name))
				{
					this.reactions.set(reaction.emoji.name, reaction);
				}
			});
			
			// Fill in any remaining reactions for emojis not found as existing reactions in order to fill out collections
			if(this.reactions.size < config.roleInputArray.length)
			{
				config.roleInputArray.map(roleToCall => 
				{ 
					if(!this.reactions.has(roleToCall.emoji))
					{
						let emoji = roleToCall.emoji.includes(`<`) ? guild.emoji.names.cache.get(roleToCall.emoji) : roleToCall.emoji;
						reactArr.push(
							this.message.react(emoji)
							.then(reaction => this.reactions.set(reaction.emoji.name, reaction))
							.catch(error => {throw new Error(`Adding reaction ${emoji} to roleCall message ${this.message.id}:\n\t${error.stack}`)}) //change this to catch and log instead of throwing if you don't want object construction to break
						);
					}
				});
			}
			
			// Wait until client finishes adding its own reactions before adding the reaction listeners, so that it doesnt try to handle iteself
			Promise.all(reactArr).then(async done => 
			{
				this.__retryQueue = 0;
				this.client.setMaxListeners(this.client.getMaxListeners() + 1);
				this.client.on(`raw`, this.rawPacket.bind(this));
			});
		})
		.catch(err => {throw new Error(`Retrieving role call message: \n\t${err.stack}`)});
	}
	
	// Function called by event listener to handle raw packets delivered from the websocket - this enables handling of uncached reactions
	rawPacket(packet)
	{
		// We don't want this to run on unrelated packets
		if (!packet.d.emoji) return;
		// We don't want to run on any message other than the RoleCall target
		if(packet.d.message_id != this.message.id) return;
		// Grab the channel the message is from
		this.client.channels.fetch(packet.d.channel_id).then(async channel =>
		{
			// Verify channel
			if(!channel || channel.type === 'voice') return;
			const messageWasCached = channel.messages.cache.has(packet.d.message_id);
			// Fetches & resolves with message if not cached or message in cache is a partial, otherwise resolves with cached message
			const message = await channel.messages.fetch(packet.d.message_id);
			// Emojis can have identifiers of name:id format, so we have to account for that case as well
			const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
			// This gives us the reaction we need to emit the event properly, in top of the message object
			const reaction = message.reactions.cache.get(emoji);
			// Another early return, optimization using knowledge about RoleCall intentions
			if(!reaction || !this.reactions.has(emoji)) return console.log('returning');
			// Fetch and verify user
			const user = await this.client.users.fetch(packet.d.user_id);
			if(!user || user.bot) return;
			// Check which type of event it is before emitting
			const member = this.client.guilds.cache.get(this.guild.id).members.cache.get(user.id);
			const role = this.roleEmojiPairs.get(reaction.emoji.name);
			if(packet.t === 'MESSAGE_REACTION_ADD')
			{
				// Adds the currently reacting user to the reaction's ReactionUserManager
				if(!messageWasCached) reaction._add(user);
				this.emit('roleReactionAdd', reaction, member, role);
			} else if(packet.t === 'MESSAGE_REACTION_REMOVE') {
				// Removes the currently reacting user from the reaction's ReactionUserManager
				if(!messageWasCached) reaction._remove(user);
				this.emit('roleReactionRemove', reaction, member, role);
			}
		});
	} 
	
	// @throws Error
	// Default add handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. 
	// You can also call it after your own added logic. Returns a promise with the edited member, or an error if one is thrown. When you
	// catch the error, output its .stack property to get the full set of info, including locations in your program. I'm still working on
	// making this more robust, right now it runs into issues with too many listeners due to the promises building up if you spam it pretty
	// good.
	addRole(member, role, retry = false)
	{
		const addError = new Error(`Adding role ${role.name} to user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.roles.add(role); //TODO: Custom reasons
				resolve(newMember);
			} catch(err) {
				if(!retry)
				{
					let delay = new Promise(async(resolve,reject) =>
					{
						setTimeout(async function(){
							resolve();
						}, ++this.__retryQueue*7000);
					});
					await delay;
					this.__retryQueue--;
					try {
						const newMember = await this.addRole.bind(this)(member,role,true);
						resolve(newMember);
					} catch(err) {
						addError.message += `${err.stack}`;
						reject(addError);
					}
				} else {
					reject(err);
				}
			}
		});
	}
	
	// @throws Error
	// Default remove handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic.
	// You can also call it after your own added logic. Returns a promise with the edited member, or an error if one is thrown. When you
	// catch the error, output its .stack property to get the full set of info, including locations in your program. I'm still working on 
	// making this more robust, right now it runs into issues with too many listeners due to the promises building up if you spam it pretty
	// good.
	removeRole(member, role, retry = false)
	{
		const removeError = new Error(`Removing role ${role.name} from user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.roles.remove(role); //TODO: Custom reasons
				resolve(newMember);
			} catch(err) {
				if(!retry)
				{
					let delay = new Promise(async(resolve,reject) =>
					{
						setTimeout(async function(){
							resolve();
						}, ++this.__retryQueue*7000);
					});
					await delay;
					this.__retryQueue--;
					try {
						const newMember = await this.removeRole.bind(this)(member,role,true);
						resolve(newMember);
					} catch(err) {
						removeError.message += `${err.stack}`;
						reject(removeError);
					}
				} else {
					reject(err);
				}
			}
		});
	}
	
	// Remove reaction & role, using role to find the reaction. This
	// is useful for creating poll-button type functionality, where
	// only one of a set of options can be selected at a time and 
	// choosing a different option will deselect the previous option.
	// Returns the promise from RoleCall#removeRole
	removeReaction(member, role, retry = false)
	{
		const emoji = this.roleEmojiPairs.findKey(val => val.id == role.id);
		const reaction = this.reactions.get(emoji);
		reaction.users.remove(member).catch(e=>console.error(e.stack)); // An error here is non-fatal, lets removeRole figure that out
		return this.removeRole(member, role, retry);
	}
}

module.exports = RoleCall;
