const EventEmitter = require('events');
const Discord = require('discord.js');
const Collection = Discord.Collection;

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
	 * @param {Object} config: JSON containing
	 * {	 
	 *	 @param roleInputArray {array} Array of objects with properties{ "role":string, "emoji":string }
	 *	 @param guildId {string}
	 *	 @param channelId {string}
	 *	 @param messageId {string}
	 * }
	 *	 The IDs are used to target/retrieve the role call message
	 */
	
	constructor(client,config) 
	{
		super();
		if(client == undefined && config == undefined)
		{
			/*
			  empty constructor to make declaring listeners work.
			  you can declare a hollow object on your initial declaration,
			  and then redeclare your actual object with the proper constructor
			  in your .ready event handler
			 */
			 return;
		}
		this.client = client; //this is the syntax for declaring object properties in JS
		this.guild = client.guilds.get(config.guildId); 
		this.guild.channels.get(config.channelId).fetchMessage(config.messageId).then(theMessage =>
		{
			this.message = theMessage; //because we need the message object, we have to retrieve it, and because internet, this takes time. so we have to wait and set it here
			this.roles = new Collection(); //@type: Collection<Snowflake, Role> where Snowflake is the snowflake of the emoji that is associate with the role 
			this.reactions = new Collection(); //@type: Collection<Snowflake,MessageReaction> passed in as emoji resolvables								  
			let reactArr = []; //this is a local variable that will be used during construction
			
			//set roles collection. Collection is an extension of javascript Map object with expanded functionality, primarily for mapping ID (aka snowflake) to object
			config.roleInputArray.map(roleToCall => { 
				if(this.guild.roles.has(roleToCall.role))
				{
					this.roles.set(roleToCall.emoji, this.guild.roles.get(roleToCall.role));
				} else {
					console.error(`error: ${this.guild} does not have role resolvable with ${roleToCall.role}`);
				}
			});
			
			//collect matching reaction objects from existing reactions
			this.message.reactions && this.message.reactions.array().map(reaction => 
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
						.catch(error => console.log(`Error adding reaction ${emoji} to roleCall message ${this.message.id}`))
					);
				}
			});
			
			//wait until client finishes adding its own reactions before adding the reaction listeners, so that it doesnt try to handle iteself
			Promise.all(reactArr).then(async done => 
			{
				this.client.setMaxListeners(this.client.getMaxListeners() + 2);
				this.__retryQueue = 0;
				this.client.on(`messageReactionAdd`, this.reactionAdded.bind(this));
				this.client.on(`messageReactionRemove`, this.reactionRemoved.bind(this));
				console.log(`done`);
			});
		})
		.catch(err => console.error(`Error retrieving role call message: ${err}`));
	}
	
	//function called by event listener to handle reactionAdd events
	reactionAdded(reaction,user)
	{
		if(reaction.message.id != this.message.id) return;
		if(!this.reactions.has(reaction.emoji.name)) return;
		if(user.bot) return;
		
		const member = this.client.guilds.get(this.guild.id).members.get(user.id);
		const role = this.roles.get(reaction.emoji.name);
		this.emit('roleReactionAdd', reaction, member, role);
	}
	
	//@throws Error
	//default add handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	//returns a promise with the edited member, or an error if one is thrown
	//when you catch the error, output its .stack property to get the full set of info, including your program lines
	//i'm still working on making this more robust, right now it runs into issues with too many listeners due to the promises building up
	//if you spam it pretty good
	addRole(reaction, member, role, retry = false)
	{
		const addError = new Error(`Adding role ${role.name} to user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.addRole(role);
				resolve(newMember);
			} catch(err) {
				if(!retry)
				{
					let delay = new Promise(async(resolve,reject) =>
					{
						setTimeout(async function(){
							resolve(`delay`);
						}, ++this.__retryQueue*7000);
					});
					await delay;
					this.__retryQueue--;
					try {
						const newMember = await this.addRole.bind(this)(reaction,member,role,true);
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
	
	//function called by event listener to handle reactionRemove events - this event is not triggered by the "Remove All Reactions" button
	reactionRemoved(reaction,user)
	{
		if(reaction.message.id != this.message.id) return;
		if(!this.reactions.has(reaction.emoji.name)) return;
		if(user.bot) return;
		
		const member = this.client.guilds.get(this.guild.id).members.get(user.id);
		const role = this.roles.get(reaction.emoji.name);
		this.emit('roleReactionRemove', reaction, member, role);
	}
	
	//@throws Error
	//default remove handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	//returns a promise with the edited member, or an error if one is thrown
	//when you catch the error, output its .stack property to get the full set of info, including your program lines
	//i'm still working on making this more robust, right now it runs into issues with too many listeners due to the promises building up
	//if you spam it pretty good
	removeRole(reaction, member, role, retry = false)
	{
		const removeError = new Error(`Removing role ${role.name} from user ${member.nickname || member.user.username} failed:\n\t`);
		return new Promise(async (resolve,reject) =>
		{
			try {
				const newMember = await member.removeRole(role);
				resolve(newMember);
			} catch(err) {
				if(!retry)
				{
					let delay = new Promise(async(resolve,reject) =>
					{
						setTimeout(async function(){
							resolve(`delay`);
						}, ++this.__retryQueue*7000);
					});
					await delay;
					this.__retryQueue--;
					try {
						const newMember = await this.removeRole.bind(this)(reaction,member,role,true);
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