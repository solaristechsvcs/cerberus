import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class Poll extends Model<InferAttributes<Poll>,InferCreationAttributes<Poll>> {
 declare id:CreationOptional<number>;declare guildId:string;declare channelId:string;
 declare messageId:CreationOptional<string|null>;declare creatorId:string;declare question:string;declare options:string[];
 declare status:CreationOptional<"OPEN"|"CLOSED">;declare endsAt:CreationOptional<Date|null>;declare closedBy:CreationOptional<string|null>;
 declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
Poll.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
 guildId:{type:DataTypes.STRING(32),allowNull:false},channelId:{type:DataTypes.STRING(32),allowNull:false},
 messageId:{type:DataTypes.STRING(32),allowNull:true},creatorId:{type:DataTypes.STRING(32),allowNull:false},
 question:{type:DataTypes.STRING(256),allowNull:false},options:{type:DataTypes.JSON,allowNull:false},
 status:{type:DataTypes.STRING(10),allowNull:false,defaultValue:"OPEN"},endsAt:{type:DataTypes.DATE,allowNull:true},
 closedBy:{type:DataTypes.STRING(32),allowNull:true},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"polls",indexes:[{fields:["guildId","status"]}]});

export class PollVote extends Model<InferAttributes<PollVote>,InferCreationAttributes<PollVote>> {
 declare id:CreationOptional<number>;declare pollId:number;declare userId:string;declare optionIndex:number;
 declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
PollVote.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},pollId:{type:DataTypes.INTEGER,allowNull:false},
 userId:{type:DataTypes.STRING(32),allowNull:false},optionIndex:{type:DataTypes.INTEGER,allowNull:false},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"poll_votes",indexes:[{unique:true,fields:["pollId","userId"]}]});
