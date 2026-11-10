import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";
export class AutoRaidLockdown extends Model<InferAttributes<AutoRaidLockdown>,InferCreationAttributes<AutoRaidLockdown>> {
 declare guildId:string;
 declare channelIds:CreationOptional<string[]>;
 declare unlockAt:Date;
 declare createdAt:CreationOptional<Date>;
 declare updatedAt:CreationOptional<Date>;
}
AutoRaidLockdown.init({
 guildId:{type:DataTypes.STRING(32),primaryKey:true},
 channelIds:{type:DataTypes.JSON,allowNull:false,defaultValue:[]},
 unlockAt:{type:DataTypes.DATE,allowNull:false},
 createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},
 updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"auto_raid_lockdowns"});
