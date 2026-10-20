import { Schema, model } from "mongoose";


const AuditLogSchema = new Schema(
  {
 
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action:{index:true,type:String,required:true},
    targetId:{type:Schema.Types.ObjectId,ref:"User"},
    details:{type:Schema.Types.Mixed},
    ip:{type:String}

  }
,
  { timestamps: {createdAt:true,updatedAt:false} },
);

export const AuditLog = model("AuditLog", AuditLogSchema);