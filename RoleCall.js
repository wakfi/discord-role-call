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
		console.log(`firing event add`);
		this.emit('roleReactionAdd', reaction, member, role);
	}
	
	//default add handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	addRole(reaction, member, role, reason = `Role Call`, retry = false)
	{
		console.log(`adding role`);
		member.addRole(role, reason)
		.catch(err => 
		{
			if(!retry)
			{
				console.error(`Error adding role ${role.name} to user ${user.username}:\n\t${err}`);
				setTimeout((function(reaction,member,role,reason){
					this.addRole.bind(this)(reaction,member,role,reason,true);
					console.error(`Retrying...`);
					this.__retryQueue--;
				}).bind(this), ++this.__retryQueue*7000, reaction, member, role, reason);
			} else {
				console.error(`Error: Adding role ${role.name} to user ${user.username} failed:\n\t${err}`);
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
		console.log(`firing event remove`);
		this.emit('roleReactionRemove', reaction, member, role);
	}
	
	//default remove handler provided for convenience. Call this if you don't want to write your own handler or don't need to add any logic. You can also call it after your own added logic
	removeRole(reaction, member, role, reason = `Role Call`, retry = false)
	{
		console.log(`removing role`);
		member.removeRole(role, reason)
		.catch(err => 
		{
			if(!retry)
			{
				console.error(`Error removing role ${role.name} from user ${user.username}:\n\t${err}`);
				setTimeout((function(reaction,member,role,reason){
					this.removeRole.bind(this)(reaction,member,role,reason,true);
					console.error(`Retrying...`);
					this.__retryQueue--;
				}).bind(this), ++this.__retryQueue*7000, reaction, member, role, reason);
			} else {
				console.error(`Error: Removing role ${role.name} from user ${user.username} failed:\n\t${err}`);
			}
		});
	}
}

module.exports = RoleCall;