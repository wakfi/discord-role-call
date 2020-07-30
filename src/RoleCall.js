const path = require('path');
const EventEmitter = require('events');
const Collection = require((require.resolve('discord.js')).split(path.sep).slice(0, -1).join(path.sep) + `${path.sep}util${path.sep}Collection.js`);

/**
 *
 *  Each RoleCall can handle up to 20 roles due to Discord limiting messages to 20 reactions/message. 
 *	Make additional role call messages and additional, seperate RoleCall objects for them if you need
 * 	to call more roles.
 *
 */
class RoleCall extends EventEmitter
{
	/**
	 * @param {Discord.Client} client: Represents the bot client
	 * @param {Object} config: JSON containing roleInputArray of role input properties, guildId {string}, channelId {string}, and messageId {string}. 
			   The IDs are used to target/retrieve the role call message
	 */
	constructor(client,config) 
	{
		super();
		this.client = client; //this is the syntax for declaring object properties in JS
		this.guild = client.guilds.cache.get(config.guildId); 
		this.guild.channels.cache.get(config.channelId).messages.fetch(config.messageId).then(theMessage =>
		{
			this.message = theMessage; //because we need the message object, we have to retrieve it, and because internet, this takes time. so we have to wait and set it here
			this.roles = new Collection(); //@type: Collection<Snowflake, Role> where Snowflake is the snowflake of the emoji that is associate with the role 
			this.reactions = new Collection(); //@type: Collection<Snowflake,MessageReaction> passed in as emoji resolvables								  
			let reactArr = []; //this is a local variable that will be used during construction
			//set roles collection. Collection is an extension of javascript Map object with expanded functionality, primarily for mapping ID (aka snowflake) to object
			config.roleInputArray.map(async roleToCall => { 
				try {
					this.roles.set(roleToCall.emoji, await this.guild.roles.fetch(roleToCall.role));
				} catch(e) {
					console.error(e.stack);
					throw new Error(`${this.guild} does not have role resolvable with ${roleToCall.role}`); //change this to log instead of throwing if you don't want object construction to break
				}
			});
			
			//collect matching reaction objects from existing reactions
			this.message.reactions && this.message.reactions.cache.mapValues(reaction => 
			{
				if(this.roles.has(reaction.emoji.name))
				{
					this.reactions.set(reaction.emoji.name, reaction);
				}
			});
			
			//fill in any remaining reactions as required in order to fill out collections
			if(this.reactions.size < config.roleInputArray.length) config.roleInputArray.map(roleToCall => { 
				if(!this.reactions.has(roleToCall.emoji))
				{
					let emoji = roleToCall.emoji.includes(`<`) ? guild.emoji.names.get(roleToCall.emoji) : roleToCall.emoji;
					reactArr.push(
						this.message.react(emoji)
						.then(reaction => this.reactions.set(reaction.emoji.name, reaction))
						.catch(error => {throw new Error(`Adding reaction ${emoji} to roleCall message ${this.message.id}:\n\t${error.stack}`)}) //change this to catch and log instead of throwing if you don't want object construction to break
					);
				}
			});
			
			//wait until client finishes adding its own reactions before adding the reaction listeners, so that it doesnt try to handle iteself
			Promise.all(reactArr).then(done => 
			{
				this.__retryQueue = 0;
				this.client.setMaxListeners(this.client.getMaxListeners() + 1);
				this.client.on(`raw`, this.rawPacket.bind(this));
			});
		})
		.catch(err => {throw new Error(`Retrieving role call message: \n\t${err.stack}`)});
	}
	
	//function called by event listener to handle raw packets - enables handling of uncached reactions
	async rawPacket(packet)
	{
		// We don't want this to run on unrelated packets
		if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
		// Grab the channel to check the message from
		const channel = await client.channels.fetch(packet.d.channel_id);
		// Grab the message
		const message = await channel.messages.fetch(packet.d.message_id);
		
		// Emojis can have identifiers of name:id format, so we have to account for that case as well
		const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
		
		// This gives us the reaction we need to emit the event properly, in top of the message object
		const reaction = message.reactions.cache.get(emoji);
		
		// More early returns
		if(!this.reactions.has(reaction.emoji.name)) return;
		
		const user = await client.users.fetch(packet.d.user_id);
		//Don't need to execute commands on actions from bots
		if(user.bot) return; 
		// Adds the currently reacting user to the reaction's users collection.
		if (reaction) reaction.users.cache.set(packet.d.user_id, user);
		else return console.error(`Could not retrieve reaction for emoji ${emoji}`);
		const member = await this.client.guilds.cache.get(this.guild.id).members.fetch(user.id);
		const role = this.roles.get(reaction.emoji.name);
		// Check which type of event it is before emitting
		if(packet.t === 'MESSAGE_REACTION_ADD')
		{
			this.emit('roleReactionAdd', reaction, member, role);
		} else if(packet.t === 'MESSAGE_REACTION_REMOVE') {
			this.emit('roleReactionRemove', reaction, member, role);
		}
	} 
	
	//@throws Error
	//default add handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	//returns a promise with the edited member, or an error if one is thrown
	//when you catch the error, output its .stack property to get the full set of info, including your program lines
	//i'm still working on making this more robust, right now it runs into issues with too many listeners due to the promises building up
	//if you spam it pretty good
	addRole(member, role, retry = false)
	{
		const addError = new Error(`Adding role ${role.name} to user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.roles.add(role);
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
	
	//@throws Error
	//default remove handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	//returns a promise with the edited member, or an error if one is thrown
	//when you catch the error, output its .stack property to get the full set of info, including your program lines
	//i'm still working on making this more robust, right now it runs into issues with too many listeners due to the promises building up
	//if you spam it pretty good
	removeRole(member, role, retry = false)
	{
		const removeError = new Error(`Removing role ${role.name} from user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.roles.remove(role);
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
}

module.exports = RoleCall;