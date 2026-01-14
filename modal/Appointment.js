const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    date: { type: Date, required: true },
    slotStartIso: { type: String, required: true },
    slotEndIso: { type: String, required: true },

    consultationType: {
      type: String,
      enum: ["Video Consultation", "Voice Call"],
      default: "Video Consultation",
    },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled", "In Progress"],
      default: "Scheduled",
    },
    symptoms: { type: String, default: "" },
    zegoRoomId: { type: String, default: "" },
    prescription: { type: String, default: "" },
    notes: { type: String, default: "" },

    //Payment fields
    consultationFees: { type: Number, required: true },
    platformFees: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "refunded"],
      default: "Pending",
    },

    payoutStatus: {
      type: String,
      enum: ["Pending", "Paid", "Cancelled"],
      default: "Pending",
    },

    payoutDate: { type: Date },
    paymentMethod: { type: String, default: "Online" },

    //Stripe payment fields
    stripePaymentIntentId: { type: String },
    stripeChargeId: { type: String },
    paymentDate: { type: Date },
  },
  { timestamps: true }
);

//1 means accending order
//unique: true means uniquness is enfoced across that combination of filds
appointmentSchema.index(
  { doctorId: 1, date: 1, slotStartIso: 1 },
  { unique: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
