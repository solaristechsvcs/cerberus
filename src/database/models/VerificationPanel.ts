import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../index";

export class VerificationPanel extends Model<InferAttributes<VerificationPanel>,InferCreationAttributes<VerificationPanel>>{
 declare id:CreationOptional<number>; declare guildId:string; declare name:string; declare title:string; declare description:string; declare buttonLabel:string; declare channelId:CreationOptional<string|null>; declare messageId:CreationOptional<string|null>; declare createdAt:CreationOptional<Date>; declare updatedAt:CreationOptional<Date>;
}
VerificationPanel.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},guildId:{type:DataTypes.STRING(32),allowNull:false},name:{type:DataTypes.STRING(100),allowNull:false},title:{type:DataTypes.STRING(256),allowNull:false},description:{type:DataTypes.TEXT,allowNull:false},buttonLabel:{type:DataTypes.STRING(80),allowNull:false,defaultValue:"Verify"},channelId:{type:DataTypes.STRING(32),allowNull:true},messageId:{type:DataTypes.STRING(32),allowNull:true},createdAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW},updatedAt:{type:DataTypes.DATE,allowNull:false,defaultValue:DataTypes.NOW}
},{sequelize,tableName:"verification_panels",indexes:[{fields:["guildId"]}]});
