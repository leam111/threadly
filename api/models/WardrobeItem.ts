import { Schema, model } from "mongoose";

const WardrobeItemSchema = new Schema(
  {
ownerId:{type: Schema.Types.ObjectId, ref: "User", required:true,index:true},
name:{type:String,required:true ,trim:true,maxLength:100},
category:{type:String,required:true,enum:["top","bottom","dress","outerwear","shoes","accessory","other"]},
brand:{type:String,trim:true},
color:{type:String,trim:true},
size:{type:String,trim:true},
status:{type:String,default:"active",enum:["active","archived"]}
  },
  { timestamps: true }
);

export const WardrobeItem = model("WardrobeItem", WardrobeItemSchema);