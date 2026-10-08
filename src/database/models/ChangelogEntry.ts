import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class ChangelogEntry extends Model<InferAttributes<ChangelogEntry>,InferCreationAttributes<ChangelogEntry>>{
 declare id:CreationOptional<number>;declare guildId:string;declare channelId:string;declare messageId:string;declare title:string;declare newItems:CreationOptional<string|null>;declare removed:CreationOptional<string|null>;declare changedItems:CreationOptional<string|null>;declare authorId:CreationOptional<string|null>;declare createdAt:CreationOptional<Date>;declare updatedAt:CreationOptional<Date>;
}
ChangelogEntry.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},guildId:{type:DataTypes.STRING(32),allowNull:false},channelId:{type:DataTypes.STRING(32),allowNull:false},messageId:{type:DataTypes.STRING(32),allowNull:false,unique:true},title:{type:DataTypes.STRING(256),allowNull:false},newItems:{type:DataTypes.TEXT,allowNull:true},removed:{type:DataTypes.TEXT,allowNull:true},changedItems:{type:DataTypes.TEXT,allowNull:true,field:"changed"},authorId:{type:DataTypes.STRING(32),allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"changelog_entries",indexes:[{fields:["guildId"]}]});
