const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserInputSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    electricityBill: { type: Number, required: true },
    waterBill: { type: Number, required: true },
    gasBill: { type: Number, required: true },
    mobileRecharge: { type: Number, required: true },
    employmentTenure: { type: Number, required: true },
    dataUsage: { type: Number, required: true },
    rationCardValue: { type: Number, required: true },
    minBankBalance: { type: Number },
    collateralValue: { type: Number },
    idProof: { type: Buffer, required: true },
    idProofContentType: { type: String, required: true },
    score: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('UserInput', UserInputSchema);
